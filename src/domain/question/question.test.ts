/**
 * QuestionRecord 工厂测试。锁住工厂边界 + 不可变性。
 * 不测 risk 分类（那是 classify-risk.test.ts）。
 */
import assert from 'node:assert/strict'
import { describe, test } from 'node:test'

import { classifyRiskByRules } from '../risk/classify-risk.ts'
import { createQuestion } from './question.ts'

describe('createQuestion', () => {
  test('正常：返回包含 id/text/source/risk/createdAt 的 record', () => {
    const risk = classifyRiskByRules('微信没有声音了')
    const q = createQuestion('微信没有声音了', 'text', risk)

    assert.equal(q.text, '微信没有声音了')
    assert.equal(q.source, 'text')
    assert.equal(q.risk.level, 'low')
    assert.ok(q.id.startsWith('q-'))
    assert.ok(q.createdAt)
    // ISO 8601 格式校验
    assert.ok(!Number.isNaN(Date.parse(q.createdAt)))
  })

  test('trim 空白：首尾空白被去除', () => {
    const risk = classifyRiskByRules('  hello  ')
    const q = createQuestion('  hello  ', 'text', risk)
    assert.equal(q.text, 'hello')
  })

  test('空字符串抛错（防御性：不该让空 record 进入系统）', () => {
    const risk = classifyRiskByRules('随便')
    assert.throws(
      () => createQuestion('', 'text', risk),
      /text 不能为空/,
    )
  })

  test('纯空白抛错', () => {
    const risk = classifyRiskByRules('随便')
    assert.throws(
      () => createQuestion('   ', 'text', risk),
      /text 不能为空/,
    )
  })

  test('id 唯一性：连续调用产生不同 id', () => {
    const risk = classifyRiskByRules('x')
    const a = createQuestion('x', 'text', risk)
    const b = createQuestion('x', 'text', risk)
    assert.notEqual(a.id, b.id)
  })

  test('冻结：record 不可写', () => {
    const risk = classifyRiskByRules('hi')
    const q = createQuestion('hi', 'text', risk)
    assert.throws(() => {
      ;(q as { text: string }).text = '改不了'
    })
  })
})

describe('createQuestion — 数字脱敏（方案 §10.1 数据最小化）', () => {
  function textOf(input: string): string {
    const risk = classifyRiskByRules(input)
    return createQuestion(input, 'text', risk).text
  }

  test('6 位验证码被隐藏', () => {
    const text = textOf('验证码是 123456')
    assert.ok(!text.includes('123456'), `不应包含验证码原文: ${text}`)
    assert.ok(text.includes('[数字已隐藏]'))
  })

  test('11 位手机号被隐藏', () => {
    const text = textOf('对方要我报手机号 13812345678')
    assert.ok(!text.includes('13812345678'), `不应包含手机号原文: ${text}`)
  })

  test('空格/短横线分隔的卡号形态被整体隐藏', () => {
    for (const card of ['6222 0210 1234 5678', '6222-0210-1234-5678']) {
      const text = textOf(`卡号 ${card} 泄露了`)
      assert.ok(!/6222/.test(text), `不应保留卡号片段: ${text}`)
      assert.ok(!/[0-9]{4}/.test(text), `不应残留 4 位以上数字: ${text}`)
    }
  })

  test('全角数字同样被隐藏', () => {
    const text = textOf('验证码是１２３４５６')
    assert.ok(!/１２３４５６|123456/.test(text), `全角数字也应隐藏: ${text}`)
  })

  test('短数字（<= 3 位）不误伤', () => {
    const text = textOf('把字调到 18 号大小')
    assert.ok(text.includes('18'), `3 位以内数字应保留: ${text}`)
  })
})
