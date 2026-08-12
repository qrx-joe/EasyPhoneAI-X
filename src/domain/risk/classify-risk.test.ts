/**
 * 风险分类规则测试。锁住 16 个验收 case + MAX/归一化/边界/契约。
 *
 * 改 classify-risk.ts 必须跑这个文件全过。
 * 数据源来自旧项目 docs/07-risk-keywords-library.md §10 的 16 个验收 case。
 */
import assert from 'node:assert/strict'
import { describe, test } from 'node:test'

import { classifyRiskByRules } from './classify-risk.ts'
import { shouldStopGuidance, type RiskLevel } from './types.ts'

// ─────────────────────────────────────────────────────────────────────
// 16 条主验收用例
// ─────────────────────────────────────────────────────────────────────

interface Case {
  input: string
  expected: RiskLevel
  // 调试用：期望命中的关键词（至少一个）。可选。
  expectKeyword?: string
}

const SPEC_CASES: Case[] = [
  { input: '微信没有声音了',         expected: 'low' },
  { input: '手机字太小',             expected: 'low' },
  { input: '手机空间不够',           expected: 'medium',  expectKeyword: '空间不够' },
  { input: '对方让我开屏幕共享',     expected: 'critical', expectKeyword: '屏幕共享' },
  { input: '让我转账才能退款',       expected: 'critical', expectKeyword: '转账' },
  { input: '点这个陌生链接领奖',     expected: 'high',    expectKeyword: '陌生链接' },
  { input: '你是公安局的',           expected: 'high',    expectKeyword: '公安局' },
  { input: '垫付一下手续费',         expected: 'critical', expectKeyword: '垫付' },
  { input: '你那 6 位数字念给我听',  expected: 'critical', expectKeyword: '6 位数字' },
  { input: '扫这个码领奖',           expected: 'high',    expectKeyword: '扫这个码' },
  { input: '我是 95588 银行客服,你的卡有异常', expected: 'high',    expectKeyword: '95588' },
  { input: '医保卡异常,登录这个网址核实',      expected: 'high',    expectKeyword: '医保卡异常' },
  { input: '把身份证正反面拍给我',   expected: 'critical', expectKeyword: '身份证正反面' },
  { input: '下载向日葵让我帮你',     expected: 'critical', expectKeyword: '向日葵' },
  // 原 spec 期望偏离（故意修正，见旧项目注释）：按取 MAX 原则保留 critical
  { input: '短信让我输验证码',       expected: 'critical', expectKeyword: '验证码' },
  { input: '中奖了,先交个人所得税', expected: 'critical', expectKeyword: '先交个人所得税' },
]

describe('classifyRiskByRules — 16 个验收 case', () => {
  for (const { input, expected, expectKeyword } of SPEC_CASES) {
    test(`「${input}」 -> ${expected}`, () => {
      const result = classifyRiskByRules(input)
      assert.equal(
        result.level,
        expected,
        `level 不对。matchedKeywords=[${result.matchedKeywords.join(', ')}]`,
      )
      if (expectKeyword) {
        assert.ok(
          result.matchedKeywords.some((k) => k.includes(expectKeyword.toLowerCase())),
          `期望命中包含「${expectKeyword}」的关键词,实际命中=[${result.matchedKeywords.join(', ')}]`,
        )
      }
    })
  }
})

// ─────────────────────────────────────────────────────────────────────
// 多关键词命中：必须取 MAX（安全保险丝）
// ─────────────────────────────────────────────────────────────────────

describe('多关键词命中取 MAX（安全保险丝）', () => {
  test('「中奖+垫付」必须升到 critical，而不是停在中奖的 high', () => {
    const r = classifyRiskByRules('您中奖了请先垫付手续费')
    assert.equal(r.level, 'critical')
    assert.ok(r.matchedKeywords.length >= 2, `命中关键词应 ≥ 2，实际 ${r.matchedKeywords.length}`)
  })

  test('「公安局+转账+安全账户」典型公检法诈骗 → critical', () => {
    const r = classifyRiskByRules('我是公安局的,把钱转账到所谓的安全账户')
    assert.equal(r.level, 'critical')
    assert.ok(r.matchedKeywords.includes('转账'))
    assert.ok(r.matchedKeywords.includes('安全账户'))
  })
})

// ─────────────────────────────────────────────────────────────────────
// 归一化：全角 / 大小写 / 空白
// ─────────────────────────────────────────────────────────────────────

describe('输入归一化', () => {
  test('全角字母小写 应等价于半角小写', () => {
    const r = classifyRiskByRules('请告诉我你的 ａｐｐｌｅ　ｉｄ 密码')
    assert.equal(r.level, 'critical')
    assert.ok(r.matchedKeywords.includes('apple id'))
  })

  test('英文大小写不敏感', () => {
    const r = classifyRiskByRules('Tell me your APPLE ID')
    assert.equal(r.level, 'critical')
  })

  test('首尾空白不影响匹配', () => {
    const r = classifyRiskByRules('   你那串数字念给我听   ')
    assert.equal(r.level, 'critical')
  })

  test('空字符串 → low + 空 matchedKeywords', () => {
    const r = classifyRiskByRules('')
    assert.equal(r.level, 'low')
    assert.deepEqual(r.matchedKeywords, [])
  })

  test('纯空白 → low', () => {
    const r = classifyRiskByRules('   ')
    assert.equal(r.level, 'low')
  })
})

// ─────────────────────────────────────────────────────────────────────
// 海外华人家庭 / 英文诈骗话术
// ─────────────────────────────────────────────────────────────────────

describe('overseas scam phrases for Chinese diaspora families', () => {
  const overseasCases: Case[] = [
    {
      input: 'I got a message saying my bank account frozen and I need to click the link',
      expected: 'high',
      expectKeyword: 'account frozen',
    },
    {
      input: 'A bank officer asked me for the OTP',
      expected: 'critical',
      expectKeyword: 'otp',
    },
    {
      input: 'Someone on WhatsApp told me to share your screen',
      expected: 'critical',
      expectKeyword: 'share your screen',
    },
    {
      input: 'An immigration officer asked for my verification code',
      expected: 'critical',
      expectKeyword: 'verification code',
    },
  ]

  for (const { input, expected, expectKeyword } of overseasCases) {
    test(`overseas case -> ${expected}`, () => {
      const result = classifyRiskByRules(input)
      assert.equal(result.level, expected)
      if (expectKeyword) {
        assert.ok(
          result.matchedKeywords.includes(expectKeyword),
          `期望命中「${expectKeyword}」,实际命中=[${result.matchedKeywords.join(', ')}]`,
        )
      }
    })
  }
})

// ─────────────────────────────────────────────────────────────────────
// shouldStopGuidance 行为：只在 high / critical 停
// ─────────────────────────────────────────────────────────────────────

describe('shouldStopGuidance', () => {
  test('low → 继续教程', () => {
    assert.equal(shouldStopGuidance('low'), false)
  })
  test('medium → 继续教程（中风险只做二次确认，不直停）', () => {
    assert.equal(shouldStopGuidance('medium'), false)
  })
  test('high → 必须停', () => {
    assert.equal(shouldStopGuidance('high'), true)
  })
  test('critical → 必须停', () => {
    assert.equal(shouldStopGuidance('critical'), true)
  })
})

// ─────────────────────────────────────────────────────────────────────
// 返回结构：RiskClassification 三字段都得有
// ─────────────────────────────────────────────────────────────────────

describe('RiskClassification 结构契约', () => {
  test('命中时三字段都不为空', () => {
    const r = classifyRiskByRules('对方让我转账')
    assert.ok(typeof r.level === 'string')
    assert.ok(Array.isArray(r.matchedKeywords))
    assert.ok(r.matchedKeywords.length > 0)
    assert.ok(typeof r.reason === 'string' && r.reason.length > 0)
  })

  test('未命中时 matchedKeywords 空数组，reason 空字符串', () => {
    const r = classifyRiskByRules('今天天气真好')
    assert.equal(r.level, 'low')
    assert.deepEqual(r.matchedKeywords, [])
    assert.equal(r.reason, '')
  })
})
