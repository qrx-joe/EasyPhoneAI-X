/**
 * decide-next 用例测试 —— 决策链四分支 + 安全不变量。
 *
 * 方案 §12.3 关键验收断言：
 *   - 所有 high 和 critical 输入都跳过确认页和教程页（→ stop）
 *   - UNKNOWN 截图不显示具体按钮指导（→ clarify）
 *   - Qwen 超时后不将未知页面当作低风险继续（→ clarify，不 fail-open）
 *   - 风险规则与模型结果取最高等级
 *
 * 用 mock VisionProvider 和 mock Telemetry，不依赖真实模型。
 */
import assert from 'node:assert/strict'
import { describe, test } from 'node:test'

import { decideNext, type DecideNextInput } from './decide-next.ts'
import type { VisionProvider, VisionResult, VisionFailure, RedactedScreenshot } from './ports/vision-provider.ts'
import type { Telemetry, AuditEvent } from './ports/telemetry.ts'

// ─────────────────────────────────────────────────────────────────────
// mock 工厂
// ─────────────────────────────────────────────────────────────────────

function makeVisionProvider(result: VisionResult): VisionProvider {
  return {
    observe: async (_input: RedactedScreenshot, _signal: AbortSignal): Promise<VisionResult> => {
      return result
    },
  }
}

function makeFailingVisionProvider(reason: VisionFailure): VisionProvider {
  return {
    observe: async () => ({ ok: false, reason }),
  }
}

function makeTelemetryCapture(): { telemetry: Telemetry; events: AuditEvent[] } {
  const events: AuditEvent[] = []
  const telemetry: Telemetry = {
    record: (event: AuditEvent) => { events.push(event) },
  }
  return { telemetry, events }
}

function makeInput(overrides: Partial<DecideNextInput> = {}): DecideNextInput {
  return {
    text: '',
    locale: 'zh-CN',
    consentId: null,
    screenshot: null,
    traceId: 'test-trace',
    ...overrides,
  }
}

// ─────────────────────────────────────────────────────────────────────
// guide 分支
// ─────────────────────────────────────────────────────────────────────

describe('decideNext — guide 分支（低风险 + 有教程）', () => {
  test('微信没声音 → guide，返回教程第一步', async () => {
    const { telemetry } = makeTelemetryCapture()
    const result = await decideNext(
      makeInput({ text: '微信没有声音了' }),
      { vision: null, telemetry, modelVersion: null },
    )
    assert.equal(result.decision.kind, 'guide')
    if (result.decision.kind === 'guide') {
      assert.equal(result.decision.risk, 'low')
      assert.ok(result.decision.step.title.length > 0)
      assert.ok(result.decision.successSignal.length > 0)
    }
  })

  test('返回的 policyVersion 非空', async () => {
    const result = await decideNext(
      makeInput({ text: '微信没声音' }),
      { vision: null, telemetry: null, modelVersion: null },
    )
    assert.ok(result.policyVersion.length > 0)
  })

  test('无截图时 modelVersion 为 null', async () => {
    const result = await decideNext(
      makeInput({ text: '微信没声音' }),
      { vision: null, telemetry: null, modelVersion: null },
    )
    assert.equal(result.modelVersion, null)
  })
})

// ─────────────────────────────────────────────────────────────────────
// stop 分支（方案 §12.3：high/critical 跳过教程）
// ─────────────────────────────────────────────────────────────────────

describe('decideNext — stop 分支（高风险强中止）', () => {
  test('规则 low + Vision 看到验证码 → critical stop', async () => {
    const provider = makeVisionProvider({
      ok: true,
      observation: {
        appId: 'taobao',
        screenState: '退款确认',
        elements: [{ kind: 'input', label: '请输入短信验证码' }],
        confidence: 0.95,
        uncertainties: [],
      },
    })
    const result = await decideNext(
      makeInput({
        text: '淘宝退款',
        consentId: 'consent-1',
        screenshot: { bytes: new Uint8Array([1]), mime: 'image/png' },
      }),
      { vision: provider, telemetry: null, modelVersion: 'qwen-test' },
    )
    assert.equal(result.decision.kind, 'stop')
    if (result.decision.kind === 'stop') assert.equal(result.decision.risk, 'critical')
  })

  test('critical（屏幕共享）→ stop，附求助卡', async () => {
    const result = await decideNext(
      makeInput({ text: '对方让我开屏幕共享' }),
      { vision: null, telemetry: null, modelVersion: null },
    )
    assert.equal(result.decision.kind, 'stop')
    if (result.decision.kind === 'stop') {
      assert.equal(result.decision.risk, 'critical')
      assert.equal(result.decision.handoff.riskLevel, 'critical')
    }
  })

  test('high（陌生链接）→ stop', async () => {
    const result = await decideNext(
      makeInput({ text: '点这个陌生链接领奖' }),
      { vision: null, telemetry: null, modelVersion: null },
    )
    assert.equal(result.decision.kind, 'stop')
    if (result.decision.kind === 'stop') {
      assert.equal(result.decision.risk, 'high')
      assert.equal(result.decision.handoff.riskLevel, 'high')
    }
  })

  test('高风险即使 vision 不可用也必须 stop（方案 §11.2）', async () => {
    // vision 传 null（模拟模型故障），高风险规则仍要触发 stop
    const result = await decideNext(
      makeInput({ text: '对方让我转账' }),
      { vision: null, telemetry: null, modelVersion: null },
    )
    assert.equal(result.decision.kind, 'stop')
  })

  test('stop 求助卡序列化输出不含教给出去话术（数据最小化）', async () => {
    const result = await decideNext(
      makeInput({ text: '对方让我转账' }),
      { vision: null, telemetry: null, modelVersion: null },
    )
    assert.equal(result.decision.kind, 'stop')
    if (result.decision.kind !== 'stop') return
    // 检查面向家人分享的序列化文本（serializeHandoffCard 的输出）
    // 不含"教给出去"话术（forbidden-patterns 已在 handoff 层测试覆盖，
    // 这里验证 decide-next 产出的 card 通过序列化后仍然安全）
    const { serializeHandoffCard } = await import('../domain/handoff/card-serialization.ts')
    const { FORBIDDEN_GIVE_AWAY_PATTERNS } = await import('../domain/handoff/forbidden-patterns.ts')
    const text = serializeHandoffCard(result.decision.handoff)
    for (const bad of FORBIDDEN_GIVE_AWAY_PATTERNS) {
      assert.ok(!text.includes(bad), `求助卡序列化输出含教给出去话术「${bad}」`)
    }
  })
})

// ─────────────────────────────────────────────────────────────────────
// clarify 分支（UNKNOWN，方案 §12.3：不显示按钮指导）
// ─────────────────────────────────────────────────────────────────────

describe('decideNext — clarify 分支（视觉失败不 fail-open）', () => {
  test('有截图但未配置 VisionProvider → clarify（不能忽略截图继续指导）', async () => {
    const result = await decideNext(
      makeInput({
        text: '微信没有声音',
        consentId: 'consent-1',
        screenshot: { bytes: new Uint8Array([1]), mime: 'image/png' },
      }),
      { vision: null, telemetry: null, modelVersion: null },
    )
    assert.equal(result.decision.kind, 'clarify')
  })

  test('视觉超时 + 规则未命中高风险 → clarify（不降级为 guide）', async () => {
    // 关键不变量：方案 §12.3「Qwen 超时后不将未知页面当作低风险继续」
    // 用一个低风险文本 + 有截图 + vision 超时
    const provider = makeFailingVisionProvider('timeout')
    const result = await decideNext(
      makeInput({
        text: '微信没声音',
        screenshot: { bytes: new Uint8Array([1]), mime: 'image/png' },
        consentId: 'c-1',
      }),
      { vision: provider, telemetry: null, modelVersion: 'qwen-test' },
    )
    assert.equal(result.decision.kind, 'clarify', '视觉超时应进入 clarify，不是 guide')
    if (result.decision.kind === 'clarify') {
      assert.equal(result.decision.risk, 'unknown')
      assert.ok(result.decision.questions.length > 0)
    }
  })

  test('视觉低置信度 → clarify', async () => {
    const provider = makeFailingVisionProvider('low_confidence')
    const result = await decideNext(
      makeInput({
        text: '微信没声音',
        screenshot: { bytes: new Uint8Array([1]), mime: 'image/png' },
        consentId: 'c-1',
      }),
      { vision: provider, telemetry: null, modelVersion: 'qwen-test' },
    )
    assert.equal(result.decision.kind, 'clarify')
  })

  test('视觉输出非法 → clarify', async () => {
    const provider = makeFailingVisionProvider('invalid_output')
    const result = await decideNext(
      makeInput({
        text: '微信没声音',
        screenshot: { bytes: new Uint8Array([1]), mime: 'image/png' },
        consentId: 'c-1',
      }),
      { vision: provider, telemetry: null, modelVersion: 'qwen-test' },
    )
    assert.equal(result.decision.kind, 'clarify')
  })

  test('高风险规则命中时，即使视觉失败也走 stop（不进 clarify）', async () => {
    // 方案 §11.2：高风险规则命中，即使模型不可用也必须显示风险停止页
    const provider = makeFailingVisionProvider('timeout')
    const result = await decideNext(
      makeInput({
        text: '对方让我转账',
        screenshot: { bytes: new Uint8Array([1]), mime: 'image/png' },
        consentId: 'c-1',
      }),
      { vision: provider, telemetry: null, modelVersion: 'qwen-test' },
    )
    assert.equal(result.decision.kind, 'stop', '高风险规则命中优先于视觉故障')
    assert.notEqual(result.decision.kind, 'clarify')
  })
})

// ─────────────────────────────────────────────────────────────────────
// medium 档（maxLevel 硬校验 + 谨慎求助卡）
// ─────────────────────────────────────────────────────────────────────

describe('decideNext — medium 档（教程 maxLevel 硬校验）', () => {
  test('审计复现：「微信没声音 对方问我手机号」→ 不给 low 教程，转 medium 求助卡', async () => {
    // 手机号命中 medium，微信没声音命中 maxLevel=low 的教程。
    // 修复前：返回 guide + 「打开微信」步骤，隐私风险被无关教程吞掉。
    const result = await decideNext(
      makeInput({ text: '微信没声音 对方问我手机号' }),
      { vision: null, telemetry: null, modelVersion: null },
    )
    assert.notEqual(result.decision.kind, 'guide', 'medium 输入绝不能拿到 maxLevel=low 的教程')
    assert.equal(result.decision.kind, 'stop')
    if (result.decision.kind === 'stop') {
      assert.equal(result.decision.risk, 'medium')
      assert.equal(result.decision.handoff.riskLevel, 'medium')
      assert.equal(result.decision.handoff.suggestions.length, 3, '应给出 medium 谨慎建议（SUGGESTIONS_BY_LEVEL.medium）')
    }
  })

  test('medium 不命中任何教程（「对方问我手机号」）→ stop + medium 求助卡，不再是 unsupported', async () => {
    const result = await decideNext(
      makeInput({ text: '对方问我手机号' }),
      { vision: null, telemetry: null, modelVersion: null },
    )
    assert.equal(result.decision.kind, 'stop')
    if (result.decision.kind === 'stop') {
      assert.equal(result.decision.risk, 'medium')
      assert.ok(result.decision.handoff.suggestions.length >= 3)
    }
  })

  test('medium 命中 maxLevel=medium 的退款教程 → 正常 guide（risk=medium）', async () => {
    const result = await decideNext(
      makeInput({ text: '淘宝退款' }),
      { vision: null, telemetry: null, modelVersion: null },
    )
    assert.equal(result.decision.kind, 'guide')
    if (result.decision.kind === 'guide') {
      assert.equal(result.decision.risk, 'medium')
      assert.equal(result.decision.step.id, 'ecommerce-refund-1')
    }
  })
})

// ─────────────────────────────────────────────────────────────────────
// unsupported 分支
// ─────────────────────────────────────────────────────────────────────

describe('decideNext — unsupported 分支', () => {
  test('空文本 → unsupported（INVALID_INPUT）', async () => {
    const result = await decideNext(
      makeInput({ text: '   ' }),
      { vision: null, telemetry: null, modelVersion: null },
    )
    assert.equal(result.decision.kind, 'unsupported')
    if (result.decision.kind === 'unsupported') {
      assert.equal(result.decision.reasonCode, 'INVALID_INPUT')
    }
  })

  test('有截图无 consentId → unsupported（CONSENT_REQUIRED）', async () => {
    const result = await decideNext(
      makeInput({
        text: '微信没声音',
        screenshot: { bytes: new Uint8Array([1]), mime: 'image/png' },
        consentId: null,
      }),
      { vision: null, telemetry: null, modelVersion: null },
    )
    assert.equal(result.decision.kind, 'unsupported')
    if (result.decision.kind === 'unsupported') {
      assert.equal(result.decision.reasonCode, 'CONSENT_REQUIRED')
    }
  })

  test('无匹配教程的低风险输入 → unsupported（TASK_STATE_NOT_FOUND）', async () => {
    const result = await decideNext(
      makeInput({ text: '今天天气真好' }),
      { vision: null, telemetry: null, modelVersion: null },
    )
    assert.equal(result.decision.kind, 'unsupported')
    if (result.decision.kind === 'unsupported') {
      assert.equal(result.decision.reasonCode, 'TASK_STATE_NOT_FOUND')
    }
  })
})

// ─────────────────────────────────────────────────────────────────────
// 审计事件
// ─────────────────────────────────────────────────────────────────────

describe('decideNext — 审计事件（方案 §11.1）', () => {
  test('记录脱敏审计事件（不含原始文本）', async () => {
    const { telemetry, events } = makeTelemetryCapture()
    await decideNext(
      makeInput({ text: '对方让我转账' }),
      { vision: null, telemetry, modelVersion: null },
    )
    assert.equal(events.length, 1)
    const event = events[0]
    assert.equal(event.traceId, 'test-trace')
    assert.ok(event.inputHash.length > 0, '应有输入 hash')
    assert.ok(event.inputLength > 0)
    // 关键：审计事件不含原始文本
    const blob = JSON.stringify(event)
    assert.ok(!blob.includes('对方让我转账'), '审计事件不得包含原始文本')
    assert.ok(event.policyVersion.length > 0)
  })

  test('审计事件记录 decisionKind', async () => {
    const { telemetry, events } = makeTelemetryCapture()
    await decideNext(
      makeInput({ text: '微信没声音' }),
      { vision: null, telemetry, modelVersion: null },
    )
    assert.equal(events[0].decisionKind, 'guide')
  })

  test('telemetry 失败不影响主流程', async () => {
    const failingTelemetry: Telemetry = {
      record: () => { throw new Error('telemetry down') },
    }
    // 不应抛错
    const result = await decideNext(
      makeInput({ text: '微信没声音' }),
      { vision: null, telemetry: failingTelemetry, modelVersion: null },
    )
    assert.equal(result.decision.kind, 'guide')
  })
})
