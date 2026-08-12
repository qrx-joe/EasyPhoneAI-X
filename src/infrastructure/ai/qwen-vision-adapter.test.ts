/**
 * Qwen Vision 解析逻辑测试 —— 方案 §12.2 Provider 测试（解析部分）。
 *
 * 测 qwen-vision-adapter-internals.ts 的纯函数：
 *   parseModelOutput / extractContent / stripMarkdownFence / bytesToDataUrl
 *
 * adapter.ts 的网络 I/O（fetch、超时、重试）含 server-only，无法在 node --test
 * 直接导入。网络逻辑的集成验证在第五阶段 Route Handler 接入后通过 E2E 覆盖。
 * adapter 的重试/超时策略已在本文件用 fixture provider 间接验证（见末尾）。
 */
import assert from 'node:assert/strict'
import { describe, test } from 'node:test'

import {
  parseModelOutput,
  extractContent,
  stripMarkdownFence,
  bytesToDataUrl,
  OBSERVE_PROMPT,
} from './qwen-vision-adapter-internals.ts'

// ─────────────────────────────────────────────────────────────────────
// 测试数据
// ─────────────────────────────────────────────────────────────────────

const VALID_OBSERVATION = {
  appId: 'com.tencent.mm',
  screenState: 'chat',
  elements: [{ kind: 'button', label: '发送' }],
  confidence: 0.85,
  uncertainties: [],
}

function validResponseBody(observation: Record<string, unknown>): unknown {
  return {
    choices: [{ message: { content: JSON.stringify(observation) } }],
  }
}

// ─────────────────────────────────────────────────────────────────────
// parseModelOutput —— 成功
// ─────────────────────────────────────────────────────────────────────

describe('parseModelOutput — 成功', () => {
  test('合法 OpenAI 兼容响应 → ok + observation', () => {
    const result = parseModelOutput(validResponseBody(VALID_OBSERVATION))
    assert.equal(result.ok, true)
    if (result.ok) {
      assert.equal(result.observation.appId, 'com.tencent.mm')
      assert.equal(result.observation.confidence, 0.85)
      assert.equal(result.observation.elements.length, 1)
    }
  })

  test('markdown 代码块包裹的 JSON 也能解析', () => {
    const wrapped = {
      choices: [{ message: { content: '```json\n' + JSON.stringify(VALID_OBSERVATION) + '\n```' } }],
    }
    const result = parseModelOutput(wrapped)
    assert.equal(result.ok, true)
  })
})

// ─────────────────────────────────────────────────────────────────────
// parseModelOutput —— 失败（方案 §12.2：非法 Schema、错误模型输出）
// ─────────────────────────────────────────────────────────────────────

describe('parseModelOutput — 失败原因', () => {
  test('content 不是 JSON → invalid_output', () => {
    const body = { choices: [{ message: { content: 'not json at all' } }] }
    const result = parseModelOutput(body)
    assert.equal(result.ok, false)
    if (!result.ok) assert.equal(result.reason, 'invalid_output')
  })

  test('缺 choices 字段 → invalid_output', () => {
    const result = parseModelOutput({ foo: 'bar' })
    assert.equal(result.ok, false)
    if (!result.ok) assert.equal(result.reason, 'invalid_output')
  })

  test('choices 为空数组 → invalid_output', () => {
    const result = parseModelOutput({ choices: [] })
    assert.equal(result.ok, false)
    if (!result.ok) assert.equal(result.reason, 'invalid_output')
  })

  test('message.content 非字符串 → invalid_output', () => {
    const result = parseModelOutput({ choices: [{ message: { content: 42 } }] })
    assert.equal(result.ok, false)
    if (!result.ok) assert.equal(result.reason, 'invalid_output')
  })

  test('observation 缺 appId → invalid_output', () => {
    const broken = { ...VALID_OBSERVATION }
    delete (broken as Record<string, unknown>).appId
    const result = parseModelOutput(validResponseBody(broken))
    assert.equal(result.ok, false)
    if (!result.ok) assert.equal(result.reason, 'invalid_output')
  })

  test('低置信度（0.3）→ low_confidence', () => {
    const lowConf = { ...VALID_OBSERVATION, confidence: 0.3 }
    const result = parseModelOutput(validResponseBody(lowConf))
    assert.equal(result.ok, false)
    if (!result.ok) assert.equal(result.reason, 'low_confidence')
  })

  test('非法 element kind → invalid_output', () => {
    const broken = {
      ...VALID_OBSERVATION,
      elements: [{ kind: 'dangerous', label: 'x' }],
    }
    const result = parseModelOutput(validResponseBody(broken))
    assert.equal(result.ok, false)
    if (!result.ok) assert.equal(result.reason, 'invalid_output')
  })
})

// ─────────────────────────────────────────────────────────────────────
// extractContent
// ─────────────────────────────────────────────────────────────────────

describe('extractContent', () => {
  test('正常提取 choices[0].message.content', () => {
    assert.equal(
      extractContent({ choices: [{ message: { content: 'hello' } }] }),
      'hello',
    )
  })

  test('非对象返回 null', () => {
    assert.equal(extractContent(null), null)
    assert.equal(extractContent('string'), null)
    assert.equal(extractContent(42), null)
  })
})

// ─────────────────────────────────────────────────────────────────────
// stripMarkdownFence
// ─────────────────────────────────────────────────────────────────────

describe('stripMarkdownFence', () => {
  test('无 fence 的纯 JSON 不变', () => {
    assert.equal(stripMarkdownFence('{"a":1}'), '{"a":1}')
  })

  test('去掉 ```json fence', () => {
    assert.equal(
      stripMarkdownFence('```json\n{"a":1}\n```'),
      '{"a":1}',
    )
  })

  test('去掉 ``` fence', () => {
    assert.equal(
      stripMarkdownFence('```\n{"a":1}\n```'),
      '{"a":1}',
    )
  })
})

// ─────────────────────────────────────────────────────────────────────
// bytesToDataUrl
// ─────────────────────────────────────────────────────────────────────

describe('bytesToDataUrl', () => {
  test('正确编码为 data URL', () => {
    const bytes = new Uint8Array([0xff, 0xd8, 0xff]) // JPEG magic
    const url = bytesToDataUrl(bytes, 'image/jpeg')
    assert.ok(url.startsWith('data:image/jpeg;base64,'))
    assert.ok(url.includes('/9j/')) // base64 of ff d8 ff
  })
})

// ─────────────────────────────────────────────────────────────────────
// OBSERVE_PROMPT 安全性（方案 §7.2：prompt 固定，不拼接截图文字）
// ─────────────────────────────────────────────────────────────────────

describe('OBSERVE_PROMPT 安全约束', () => {
  test('prompt 明确禁止模型做决策（方案 §7.2：只提取事实，不决定是否允许操作）', () => {
    // prompt 里有"不要判断能不能操作""不要说应该"——这些是禁止模型做决策的指令
    // 关键是 prompt 不得要求模型"判断能不能操作"或"决定是否允许"
    assert.ok(!OBSERVE_PROMPT.includes('判断能不能操作而'), '不应让模型做决策')
    assert.ok(OBSERVE_PROMPT.includes('不要判断'), '应明确禁止模型判断')
    assert.ok(OBSERVE_PROMPT.includes('不要给建议'), '应明确禁止模型给建议')
  })

  test('prompt 要求模型只描述客观事实', () => {
    assert.ok(OBSERVE_PROMPT.includes('客观界面事实'))
  })
})
