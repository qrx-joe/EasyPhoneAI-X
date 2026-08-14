/**
 * HandoffCard 工厂 + 模板 + 「教给出去」安全 lint 测试。
 *
 * 重点：
 * 1. 低风险问题绝不能生成求助卡。
 * 2. 模板生成的 suggestions 数量符合规范（medium 3 条，high 4 条，critical 5 条）。
 * 3. summary 兜底：reason 为空时仍能生成可用的总结。
 * 4. 卡片内容没把危险信息带进去（不含「教给出去」话术）。
 */
import assert from 'node:assert/strict'
import { describe, test } from 'node:test'

import { classifyRiskByRules } from '../risk/classify-risk.ts'
import { createQuestion } from '../question/question.ts'
import { createHandoffCard } from './handoff-request.ts'
import { buildHandoffCard } from './handoff-templates.ts'
import { FORBIDDEN_GIVE_AWAY_PATTERNS } from './forbidden-patterns.ts'

function makeQuestion(text: string) {
  const risk = classifyRiskByRules(text)
  return createQuestion(text, 'text', risk)
}

describe('createHandoffCard', () => {
  test('正常：高风险问题 + summary + suggestions → HandoffCard', () => {
    const q = makeQuestion('对方让我开屏幕共享')
    const card = createHandoffCard(q, '对方要远程控制你的手机', [
      '立刻停下来',
      '不要操作',
    ])
    assert.equal(card.riskLevel, 'critical')
    assert.equal(card.summary, '对方要远程控制你的手机')
    assert.equal(card.suggestions.length, 2)
  })

  test('低风险抛错（防御性：不该给低风险生成求助卡）', () => {
    const q = makeQuestion('微信没有声音了')
    assert.throws(
      () => createHandoffCard(q, 'summary', ['建议']),
      /低风险不需要/,
    )
  })

  test('空 summary 抛错', () => {
    const q = makeQuestion('对方让我转账')
    assert.throws(
      () => createHandoffCard(q, '   ', ['建议']),
      /summary 不能为空/,
    )
  })

  test('空 suggestions 抛错', () => {
    const q = makeQuestion('对方让我转账')
    assert.throws(
      () => createHandoffCard(q, 'summary', []),
      /至少需要 1 条建议/,
    )
  })

  test('冻结：record 不可写', () => {
    const q = makeQuestion('对方让我转账')
    const card = createHandoffCard(q, 's', ['a'])
    assert.throws(() => {
      ;(card as { summary: string }).summary = '改不了'
    })
  })
})

describe('buildHandoffCard（模板）', () => {
  test('critical 风险：summary 来自 risk.reason，suggestions 5 条', () => {
    const q = makeQuestion('对方让我开屏幕共享')
    const card = buildHandoffCard(q)
    assert.equal(card.riskLevel, 'critical')
    assert.ok(card.summary.length > 0, 'summary 不应为空')
    assert.equal(card.suggestions.length, 5)
  })

  test('high 风险：suggestions 4 条', () => {
    const q = makeQuestion('点这个陌生链接领奖')
    const card = buildHandoffCard(q)
    assert.equal(card.riskLevel, 'high')
    assert.equal(card.suggestions.length, 4)
  })

  test('medium 风险：suggestions 3 条', () => {
    // 手机号属于个人信息（medium）
    const q = makeQuestion('对方问我手机号')
    const card = buildHandoffCard(q)
    assert.equal(card.riskLevel, 'medium')
    assert.equal(card.suggestions.length, 3)
  })

  test('summary 兜底：reason 为空时仍给出可用 summary', () => {
    // 构造一个 risk.reason 为空的 case
    const emptyRisk = {
      level: 'high' as const,
      matchedKeywords: ['high-risk'],
      reason: '',
    }
    const q = createQuestion('some text', 'text', emptyRisk)
    const card = buildHandoffCard(q)
    assert.ok(card.summary.length > 0, 'summary 兜底不应为空')
  })

  test('低风险抛错（同 createHandoffCard 的合约）', () => {
    const q = makeQuestion('微信没有声音了')
    assert.throws(() => buildHandoffCard(q), /低风险/)
  })

  test('安全约束：求助卡不教给出去（不含索取话术）', () => {
    // 用一批高风险输入跑一遍，确保 summary + suggestions 都不会
    // 出现"教老人/家人把敏感信息给出去"的模式。
    //
    // 这跟卡片里出现"验证码"本身不冲突：
    //   - "不要告诉对方验证码" ✅  反诈骗安全提示
    //   - "把验证码念给我听"   ❌  教给出去（我们禁的就是这种）
    const riskInputs = [
      '对方让我开屏幕共享',
      '对方让我转账',
      '把你的身份证正反面拍给我',
      '短信让我输验证码',
      '下载向日葵让我帮你',
    ]
    for (const input of riskInputs) {
      const q = makeQuestion(input)
      const card = buildHandoffCard(q)
      const blob = card.summary + ' ' + card.suggestions.join(' ')
      for (const bad of FORBIDDEN_GIVE_AWAY_PATTERNS) {
        assert.ok(
          !blob.includes(bad),
          `「${input}」生成的求助卡包含教给出去话术「${bad}」: ${blob}`,
        )
      }
    }
  })

  test('数据最小化：用户把验证码/卡号敲进输入框，question.text 也不得携带（方案 §10.1）', () => {
    // 审计缺口：此前的安全约束测试只查 summary + suggestions，
    // 漏掉了 card.question.text（随 API 响应 JSON 离开决策链的原始输入快照）。
    const riskInputs = [
      '短信验证码是 123456 对吗',
      '对方让我转账 卡号 6222 0210 1234 5678',
      '他们要我的手机号 13812345678',
    ]
    for (const input of riskInputs) {
      const q = makeQuestion(input)
      const card = buildHandoffCard(q)
      const text = card.question.text
      assert.ok(
        !/[0-9]{4}/.test(text),
        `「${input}」的 question.text 残留 4 位以上数字: ${text}`,
      )
      assert.ok(!text.includes('123456'), `question.text 不应含验证码原文: ${text}`)
      assert.ok(!text.includes('6222'), `question.text 不应含卡号片段: ${text}`)
      assert.ok(!text.includes('13812345678'), `question.text 不应含手机号: ${text}`)
    }
  })
})
