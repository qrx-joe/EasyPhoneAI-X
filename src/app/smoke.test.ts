/**
 * 冒烟测试 - 确保测试门禁管线可用。
 *
 * 第一阶段只有一个最小用例，证明 node test runner 能跑通。
 * 第二阶段迁移领域测试后，这里保留作为管线健康检查。
 */
import assert from 'node:assert/strict'
import { describe, test } from 'node:test'

describe('smoke - 测试门禁管线', () => {
  test('Node.js 原生 test runner 可用', () => {
    assert.equal(1 + 1, 2)
  })
})
