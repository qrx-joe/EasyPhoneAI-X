/**
 * risk-policy 契约测试 —— 锁住"风险取 MAX"安全不变量。
 *
 * 方案 §6.2：AI 只能维持或升级规则风险，不能降级。
 * 方案 §12.3：风险规则与模型结果取最高等级。
 *
 * 重点：
 * 1. 规则 high + 视觉 low → high（不能降级）
 * 2. 规则 low + 视觉 high → high（视觉能升级）
 * 3. 规则 critical 永远不会被降到 low
 * 4. 无视觉时以规则为准
 * 5. policyVersion 存在且非空（审计追溯用）
 */
import assert from 'node:assert/strict'
import { describe, test } from 'node:test'

import {
  mergeRiskByMax,
  RISK_POLICY_VERSION,
  type RiskAssessment,
} from './risk-policy.ts'

describe('mergeRiskByMax — 安全不变量（不可降级）', () => {
  test('规则 high + 视觉 low → high（视觉不能降级规则风险）', () => {
    const rule: RiskAssessment = { level: 'high', source: 'rule' }
    const vision: RiskAssessment = { level: 'low', source: 'vision' }
    const merged = mergeRiskByMax(rule, vision)
    assert.equal(merged.level, 'high')
    assert.equal(merged.source, 'merged')
  })

  test('规则 critical + 视觉 low → critical（最高风险不可降级）', () => {
    const rule: RiskAssessment = { level: 'critical', source: 'rule' }
    const vision: RiskAssessment = { level: 'low', source: 'vision' }
    assert.equal(mergeRiskByMax(rule, vision).level, 'critical')
  })

  test('规则 low + 视觉 high → high（视觉能升级风险）', () => {
    const rule: RiskAssessment = { level: 'low', source: 'rule' }
    const vision: RiskAssessment = { level: 'high', source: 'vision' }
    assert.equal(mergeRiskByMax(rule, vision).level, 'high')
  })

  test('规则 low + 视觉 critical → critical', () => {
    const rule: RiskAssessment = { level: 'low', source: 'rule' }
    const vision: RiskAssessment = { level: 'critical', source: 'vision' }
    assert.equal(mergeRiskByMax(rule, vision).level, 'critical')
  })

  test('规则 medium + 视觉 medium → medium（维持）', () => {
    const rule: RiskAssessment = { level: 'medium', source: 'rule' }
    const vision: RiskAssessment = { level: 'medium', source: 'vision' }
    assert.equal(mergeRiskByMax(rule, vision).level, 'medium')
  })

  test('规则 high + 视觉 critical → critical（取最高）', () => {
    const rule: RiskAssessment = { level: 'high', source: 'rule' }
    const vision: RiskAssessment = { level: 'critical', source: 'vision' }
    assert.equal(mergeRiskByMax(rule, vision).level, 'critical')
  })
})

describe('mergeRiskByMax — 无视觉输入', () => {
  test('vision 为 null → 以规则结果为准', () => {
    const rule: RiskAssessment = { level: 'high', source: 'rule' }
    const merged = mergeRiskByMax(rule, null)
    assert.equal(merged.level, 'high')
    assert.equal(merged.source, 'rule')
  })

  test('vision 为 null + 规则 low → low', () => {
    const rule: RiskAssessment = { level: 'low', source: 'rule' }
    assert.equal(mergeRiskByMax(rule, null).level, 'low')
  })
})

describe('RISK_POLICY_VERSION', () => {
  test('存在且非空（审计追溯依赖它）', () => {
    assert.ok(typeof RISK_POLICY_VERSION === 'string')
    assert.ok(RISK_POLICY_VERSION.length > 0)
  })
})
