/**
 * UIObservation 契约测试 —— 锁住 Schema 校验的不变量。
 *
 * 方案 §7.2：模型输出必须通过 Schema 校验。
 * 方案 §12.2：Contract 测试覆盖合法请求、非法 JSON、缺字段、错误模型输出。
 *
 * 重点：
 * 1. 合法结构能通过校验
 * 2. 各种非法结构（缺字段、类型错、越界）一律返回 null
 * 3. confidence 边界值
 * 4. elements 的 kind 枚举校验
 */
import assert from 'node:assert/strict'
import { describe, test } from 'node:test'

import {
  parseUIObservation,
  MIN_CONFIDENCE,
  type UIObservation,
} from './ui-observation.ts'

// ─────────────────────────────────────────────────────────────────────
// 合法结构基准
// ─────────────────────────────────────────────────────────────────────

function validObservation(): Record<string, unknown> {
  return {
    appId: 'com.tencent.mm',
    screenState: 'chat_detail',
    elements: [
      { kind: 'button', label: '发送' },
      { kind: 'input', label: '输入消息' },
    ],
    confidence: 0.85,
    uncertainties: ['顶部状态栏被遮挡'],
  }
}

describe('parseUIObservation — 合法结构', () => {
  test('完整合法结构通过校验', () => {
    const result = parseUIObservation(validObservation())
    assert.ok(result !== null)
    assert.equal(result!.appId, 'com.tencent.mm')
    assert.equal(result!.screenState, 'chat_detail')
    assert.equal(result!.elements.length, 2)
    assert.equal(result!.confidence, 0.85)
    assert.equal(result!.uncertainties.length, 1)
  })

  test('空 elements 和空 uncertainties 合法', () => {
    const obs = { ...validObservation(), elements: [], uncertainties: [] }
    const result = parseUIObservation(obs)
    assert.ok(result !== null)
    assert.equal(result!.elements.length, 0)
    assert.equal(result!.uncertainties.length, 0)
  })

  test('confidence 边界值 0 和 1 合法', () => {
    assert.ok(parseUIObservation({ ...validObservation(), confidence: 0 }) !== null)
    assert.ok(parseUIObservation({ ...validObservation(), confidence: 1 }) !== null)
  })

  test('所有 kind 枚举值都能通过', () => {
    const kinds = ['button', 'link', 'input', 'text', 'icon', 'other']
    for (const kind of kinds) {
      const obs = {
        ...validObservation(),
        elements: [{ kind, label: 'x' }],
      }
      assert.ok(
        parseUIObservation(obs) !== null,
        `kind=${kind} 应该合法`,
      )
    }
  })
})

// ─────────────────────────────────────────────────────────────────────
// 非法结构（方案 §12.2：缺字段、错误模型输出）
// ─────────────────────────────────────────────────────────────────────

describe('parseUIObservation — 非法结构返回 null', () => {
  test('非对象返回 null', () => {
    assert.equal(parseUIObservation(null), null)
    assert.equal(parseUIObservation(undefined), null)
    assert.equal(parseUIObservation('string'), null)
    assert.equal(parseUIObservation(42), null)
    assert.equal(parseUIObservation([]), null)
  })

  test('缺 appId 返回 null', () => {
    const obs = validObservation()
    delete (obs as Record<string, unknown>).appId
    assert.equal(parseUIObservation(obs), null)
  })

  test('appId 空字符串返回 null', () => {
    assert.equal(parseUIObservation({ ...validObservation(), appId: '' }), null)
    assert.equal(parseUIObservation({ ...validObservation(), appId: '   ' }), null)
  })

  test('缺 screenState 返回 null', () => {
    const obs = validObservation()
    delete (obs as Record<string, unknown>).screenState
    assert.equal(parseUIObservation(obs), null)
  })

  test('confidence 越界返回 null', () => {
    assert.equal(parseUIObservation({ ...validObservation(), confidence: -0.1 }), null)
    assert.equal(parseUIObservation({ ...validObservation(), confidence: 1.1 }), null)
  })

  test('confidence 非数字返回 null', () => {
    assert.equal(parseUIObservation({ ...validObservation(), confidence: 'high' }), null)
  })

  test('elements 非数组返回 null', () => {
    assert.equal(parseUIObservation({ ...validObservation(), elements: 'not array' }), null)
  })

  test('element 缺 kind 返回 null', () => {
    const obs = {
      ...validObservation(),
      elements: [{ label: 'x' }],
    }
    assert.equal(parseUIObservation(obs), null)
  })

  test('element kind 非法枚举返回 null', () => {
    const obs = {
      ...validObservation(),
      elements: [{ kind: 'dangerous_button', label: 'x' }],
    }
    assert.equal(parseUIObservation(obs), null)
  })

  test('element 缺 label 返回 null', () => {
    const obs = {
      ...validObservation(),
      elements: [{ kind: 'button' }],
    }
    assert.equal(parseUIObservation(obs), null)
  })

  test('uncertainties 非数组返回 null', () => {
    assert.equal(parseUIObservation({ ...validObservation(), uncertainties: '模糊' }), null)
  })

  test('uncertainties 元素非字符串返回 null', () => {
    const obs = {
      ...validObservation(),
      uncertainties: [123],
    }
    assert.equal(parseUIObservation(obs), null)
  })
})

// ─────────────────────────────────────────────────────────────────────
// MIN_CONFIDENCE 阈值
// ─────────────────────────────────────────────────────────────────────

describe('MIN_CONFIDENCE 阈值', () => {
  test('阈值为 0.6（方案 §7.2 低置信度 → UNKNOWN）', () => {
    assert.equal(MIN_CONFIDENCE, 0.6)
  })
})
