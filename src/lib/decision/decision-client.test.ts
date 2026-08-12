import assert from 'node:assert/strict'
import { describe, test } from 'node:test'

import { DecisionClientError, parseDecisionResponse, submitDecision } from './decision-client.ts'

const base = { traceId: 'trace-1', policyVersion: 'risk-1', modelVersion: null }

describe('parseDecisionResponse', () => {
  test('接受 guide 分支', () => {
    const result = parseDecisionResponse({
      ...base,
      decision: {
        kind: 'guide', risk: 'low', successSignal: '看到设置页',
        step: { id: 's1', title: '打开设置', instruction: '点齿轮图标' },
      },
    })
    assert.equal(result?.decision.kind, 'guide')
  })

  test('接受 stop 分支', () => {
    const result = parseDecisionResponse({
      ...base,
      decision: {
        kind: 'stop', risk: 'critical',
        handoff: { id: 'h1', summary: '请停止操作', suggestions: ['联系家人'], createdAt: '2026-08-12' },
      },
    })
    assert.equal(result?.decision.kind, 'stop')
  })

  test('接受 clarify 和 unsupported 分支', () => {
    assert.equal(parseDecisionResponse({
      ...base,
      decision: { kind: 'clarify', risk: 'unknown', questions: ['能再说清楚一点吗？'] },
    })?.decision.kind, 'clarify')
    assert.equal(parseDecisionResponse({
      ...base,
      decision: { kind: 'unsupported', reasonCode: 'TASK_STATE_NOT_FOUND' },
    })?.decision.kind, 'unsupported')
  })

  test('拒绝未知分支和缺字段响应', () => {
    assert.equal(parseDecisionResponse({ ...base, decision: { kind: 'continue' } }), null)
    assert.equal(parseDecisionResponse({ decision: { kind: 'clarify', risk: 'unknown', questions: [] } }), null)
  })
})

describe('submitDecision', () => {
  test('截图缺少同意时不发请求', async () => {
    let called = false
    const fetcher = async () => {
      called = true
      return new Response()
    }
    await assert.rejects(
      submitDecision({ text: '帮我看看', screenshot: new Blob(['x'], { type: 'image/png' }) }, fetcher as typeof fetch),
      (error: unknown) => error instanceof DecisionClientError && error.code === 'CONSENT_REQUIRED',
    )
    assert.equal(called, false)
  })
})
