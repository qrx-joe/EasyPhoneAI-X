/**
 * 错误码稳定性测试 —— 方案 §8.2。
 *
 * 这些错误码是面向调用方的稳定协议，改名会破坏客户端兼容。
 * 本测试锁住七个错误码的字符串值，防止误改。
 * （VISION_TIMEOUT / RATE_LIMITED 未接线已删除，见 error-codes.ts 注释。）
 */
import assert from 'node:assert/strict'
import { describe, test } from 'node:test'

import { ERROR_CODES } from './error-codes.ts'

describe('ERROR_CODES — 方案 §8.2 七个稳定错误码', () => {
  test('INVALID_INPUT', () => {
    assert.equal(ERROR_CODES.INVALID_INPUT, 'INVALID_INPUT')
  })
  test('CONSENT_REQUIRED', () => {
    assert.equal(ERROR_CODES.CONSENT_REQUIRED, 'CONSENT_REQUIRED')
  })
  test('IMAGE_TOO_LARGE', () => {
    assert.equal(ERROR_CODES.IMAGE_TOO_LARGE, 'IMAGE_TOO_LARGE')
  })
  test('UNSUPPORTED_IMAGE', () => {
    assert.equal(ERROR_CODES.UNSUPPORTED_IMAGE, 'UNSUPPORTED_IMAGE')
  })
  test('INVALID_MODEL_OUTPUT', () => {
    assert.equal(ERROR_CODES.INVALID_MODEL_OUTPUT, 'INVALID_MODEL_OUTPUT')
  })
  test('TASK_STATE_NOT_FOUND', () => {
    assert.equal(ERROR_CODES.TASK_STATE_NOT_FOUND, 'TASK_STATE_NOT_FOUND')
  })
  test('INTERNAL_ERROR', () => {
    assert.equal(ERROR_CODES.INTERNAL_ERROR, 'INTERNAL_ERROR')
  })

  test('恰好七个错误码（方案 §8.2，未接线的预留码已删）', () => {
    const values = Object.values(ERROR_CODES)
    assert.equal(values.length, 7, `应有 7 个错误码，实际 ${values.length}`)
  })

  test('所有错误码值唯一', () => {
    const values = Object.values(ERROR_CODES)
    assert.equal(new Set(values).size, values.length, '错误码值有重复')
  })

  test('已删除的未接线码不再出现（防回归）', () => {
    const values: string[] = Object.values(ERROR_CODES)
    assert.ok(!values.includes('VISION_TIMEOUT'), 'VISION_TIMEOUT 已删除：视觉超时应走 clarify 决策')
    assert.ok(!values.includes('RATE_LIMITED'), 'RATE_LIMITED 已删除：限流未实现，接线时再走版本兼容加回')
  })
})
