/**
 * serializeHandoffCard 序列化输出测试。
 *
 * 重点：
 * 1. 包含产品签名（让家人识别来源）
 * 2. 包含 summary 和 suggestions
 * 3. 风险等级人话化
 * 4. 纯文本无 HTML 标签
 * 5. 不泄露 matched keywords
 */
import assert from 'node:assert/strict'
import { describe, test } from 'node:test'

import { classifyRiskByRules } from '../risk/classify-risk.ts'
import { createQuestion } from '../question/question.ts'
import { buildHandoffCard } from './handoff-templates.ts'
import { serializeHandoffCard } from './card-serialization.ts'

function makeCard(input: string) {
  const risk = classifyRiskByRules(input)
  const q = createQuestion(input, 'text', risk)
  return buildHandoffCard(q)
}

describe('serializeHandoffCard', () => {
  test('包含产品签名（让家人识别来源）', () => {
    const card = makeCard('对方让我转账')
    const text = serializeHandoffCard(card)
    assert.ok(text.includes('【爸妈别急'))
  })

  test('包含 summary（从 risk.reason 来）', () => {
    const card = makeCard('对方让我开屏幕共享')
    const text = serializeHandoffCard(card)
    assert.ok(card.summary.length > 0)
    assert.ok(text.includes(card.summary))
  })

  test('包含所有 suggestions 并编号', () => {
    const card = makeCard('对方让我开屏幕共享')
    const text = serializeHandoffCard(card)
    for (let i = 0; i < card.suggestions.length; i++) {
      const numbered = `${i + 1}. ${card.suggestions[i]}`
      assert.ok(text.includes(numbered), `应包含「${numbered}」`)
    }
  })

  test('critical 风险显示「极高风险」标签', () => {
    const card = makeCard('对方让我开屏幕共享')
    assert.equal(card.riskLevel, 'critical')
    const text = serializeHandoffCard(card)
    assert.ok(text.includes('极高风险'))
  })

  test('high 风险显示「高风险」标签', () => {
    const card = makeCard('点这个陌生链接领奖')
    assert.equal(card.riskLevel, 'high')
    const text = serializeHandoffCard(card)
    assert.ok(text.includes('高风险'))
  })

  test('medium 风险显示「需谨慎」标签', () => {
    const card = makeCard('对方问我手机号')
    assert.equal(card.riskLevel, 'medium')
    const text = serializeHandoffCard(card)
    assert.ok(text.includes('需谨慎'))
  })

  test('纯文本：不含 HTML/Markdown 标签（防 XSS）', () => {
    const card = makeCard('对方让我转账')
    const text = serializeHandoffCard(card)
    assert.ok(!text.includes('<script'), '不应含 <script>')
    assert.ok(!/<[a-z]+>/i.test(text), '不应含 HTML 标签')
    assert.ok(!text.includes('```'), '不应含 Markdown 代码块标记')
  })

  test('不泄露 matched keywords（那是给开发/调试看的）', () => {
    const card = makeCard('把你的身份证正反面拍给我')
    const text = serializeHandoffCard(card)
    for (const kw of card.question.risk.matchedKeywords) {
      // matched keywords 列表本身不展示（防家人困惑）
      // 这里只确保没有 debug 段落
      assert.ok(!text.includes('命中关键词'), '不应有 debug 段落')
      assert.ok(!text.includes('matched'), '不应有英文 debug 标记')
    }
  })

  test('包含 createdAt（可追溯）', () => {
    const card = makeCard('对方让我转账')
    const text = serializeHandoffCard(card)
    assert.ok(text.includes(card.createdAt))
  })
})
