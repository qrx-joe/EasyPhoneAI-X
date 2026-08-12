import assert from 'node:assert/strict'
import { describe, test } from 'node:test'

import { assessObservationRisk } from './assess-observation-risk.ts'

describe('assessObservationRisk', () => {
  test('可见验证码文字升级为 critical', () => {
    const result = assessObservationRisk({
      appId: 'taobao',
      screenState: '退款确认',
      elements: [{ kind: 'input', label: '请输入短信验证码' }],
      confidence: 0.9,
      uncertainties: [],
    })
    assert.equal(result.level, 'critical')
  })

  test('普通退款页面只升到 medium', () => {
    const result = assessObservationRisk({
      appId: 'taobao',
      screenState: '申请退款',
      elements: [{ kind: 'button', label: '选择退款原因' }],
      confidence: 0.9,
      uncertainties: [],
    })
    assert.equal(result.level, 'medium')
  })
})
