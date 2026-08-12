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
