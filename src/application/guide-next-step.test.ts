/**
 * guide-next-step 用例测试 —— 教程 maxLevel 硬校验 + guide 分支构造。
 *
 * 重点（审计 P1-1）：
 * 1. medium 输入命中 maxLevel=low 的教程 → no_match（绝不给 guide）。
 * 2. medium 输入命中 maxLevel=medium 的教程 → ok 且 decision.risk='medium'。
 * 3. high/critical → stopped。
 * 4. decideNext 的 guide 分支复用本函数，这里的行为即决策链行为。
 */
import assert from 'node:assert/strict'
import { describe, test } from 'node:test'

import { guideNextStep } from './guide-next-step.ts'

describe('guideNextStep — ok 分支', () => {
  test('low + 微信教程 → ok，risk=low，返回第一步 + 步骤级成功信号', () => {
    const result = guideNextStep('微信没有声音了', 'low')
    assert.equal(result.kind, 'ok')
    if (result.kind === 'ok') {
      assert.equal(result.decision.kind, 'guide')
      assert.equal(result.decision.risk, 'low')
      assert.equal(result.decision.step.id, 'wechat-no-sound-1')
      assert.equal(result.decision.successSignal, result.decision.step.successSignal)
      assert.equal(result.tutorial.id, 'wechat-no-sound')
    }
  })

  test('medium + 退款教程（maxLevel=medium）→ ok，risk=medium', () => {
    const result = guideNextStep('淘宝退款', 'medium')
    assert.equal(result.kind, 'ok')
    if (result.kind === 'ok') {
      assert.equal(result.decision.risk, 'medium')
      assert.equal(result.tutorial.id, 'ecommerce-refund')
    }
  })
})

describe('guideNextStep — maxLevel 硬校验（审计 P1-1）', () => {
  test('medium + low 教程（微信没声音）→ no_match，绝不给 guide', () => {
    const result = guideNextStep('微信没声音 对方问我手机号', 'medium')
    assert.equal(result.kind, 'no_match', 'medium 不能被 maxLevel=low 的教程吞掉')
  })

  test('low + 无匹配教程 → no_match', () => {
    assert.equal(guideNextStep('今天天气真好', 'low').kind, 'no_match')
  })

  test('high / critical → stopped（高风险不进指导）', () => {
    assert.equal(guideNextStep('微信没声音', 'high').kind, 'stopped')
    assert.equal(guideNextStep('微信没声音', 'critical').kind, 'stopped')
  })
})
