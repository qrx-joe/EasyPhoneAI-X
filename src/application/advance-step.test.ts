/**
 * advance-step + step-sessions 测试 —— 步骤状态机（无障碍教练方案 阶段 A-2）。
 *
 * 重点（安全不变量）：
 * 1. 步骤索引只存服务端：客户端只传 stateId，推进永远 +1，不能跳步。
 * 2. 每次推进重跑风险检查：会话中途风险升高 → blocked（stop 含求助卡）。
 * 3. 风险下限：会话创建时的合并风险不可被重算降级（medium 下限不许退回 low 教程）。
 * 4. 会话查不到 / 已完成 → session_lost，不猜测进度。
 * 5. 最后一步确认后 complete，会话删除，不可重复触发。
 */
import assert from 'node:assert/strict'
import { describe, test, beforeEach } from 'node:test'

import { advanceStep } from './advance-step.ts'
import { TUTORIALS } from '../domain/guidance/tutorial.ts'
import {
  clearStepSessionsForTest,
  createStepSession,
  stepSessionCount,
} from './step-sessions.ts'

const WECHAT = TUTORIALS.find((t) => t.id === 'wechat-no-sound')!

describe('advanceStep — 正常推进', () => {
  beforeEach(() => clearStepSessionsForTest())

  test('从第 1 步推进到第 2 步（索引服务端 +1，客户端无法传索引）', () => {
    const session = createStepSession({
      text: '微信没有声音了',
      tutorialId: WECHAT.id,
      stepIndex: 0,
      riskFloor: 'low',
    })
    const result = advanceStep({ stateId: session.stateId })
    assert.equal(result.kind, 'guide')
    if (result.kind !== 'guide') return
    assert.equal(result.decision.step.id, 'wechat-no-sound-2')
    assert.equal(result.decision.successSignal, result.decision.step.successSignal)
    assert.equal(result.stepState.stepIndex, 1)
    assert.equal(result.stepState.totalSteps, WECHAT.steps.length)
    assert.equal(result.stepState.tutorialId, WECHAT.id)
  })

  test('连续推进按顺序走，不能跳步', () => {
    const session = createStepSession({
      text: '微信没有声音',
      tutorialId: WECHAT.id,
      stepIndex: 0,
      riskFloor: 'low',
    })
    const first = advanceStep({ stateId: session.stateId })
    assert.equal(first.kind, 'guide')
    if (first.kind !== 'guide') return
    const second = advanceStep({ stateId: first.stepState.stateId })
    assert.equal(second.kind, 'guide')
    if (second.kind !== 'guide') return
    assert.equal(second.decision.step.id, 'wechat-no-sound-3')
    assert.equal(second.stepState.stepIndex, 2)
  })

  test('最后一步确认 → complete，会话删除，再推进 → session_lost', () => {
    const session = createStepSession({
      text: '微信没声音',
      tutorialId: WECHAT.id,
      stepIndex: WECHAT.steps.length - 1,
      riskFloor: 'low',
    })
    const done = advanceStep({ stateId: session.stateId })
    assert.equal(done.kind, 'complete')
    if (done.kind === 'complete') {
      assert.equal(done.tutorialTitle, WECHAT.title)
    }
    const again = advanceStep({ stateId: session.stateId })
    assert.equal(again.kind, 'session_lost')
  })
})

describe('advanceStep — 安全回退', () => {
  beforeEach(() => clearStepSessionsForTest())

  test('会话不存在 / 过期 → session_lost（刷新后安全回到重新描述）', () => {
    assert.equal(advanceStep({ stateId: 'not-a-real-id' }).kind, 'session_lost')
  })

  test('推进时重跑风险检查：会话中途升高到 critical → blocked stop + 求助卡', () => {
    // 直接构造一条"创建后规则命中 critical"的会话（模拟规则库更新后命中高危词）
    const session = createStepSession({
      text: '对方让我转账',
      tutorialId: WECHAT.id,
      stepIndex: 0,
      riskFloor: 'critical',
    })
    const result = advanceStep({ stateId: session.stateId })
    assert.equal(result.kind, 'blocked')
    if (result.kind !== 'blocked') return
    assert.equal(result.decision.kind, 'stop')
    if (result.decision.kind === 'stop') {
      assert.equal(result.decision.risk, 'critical')
      assert.ok(result.decision.handoff.suggestions.length > 0)
    }
    // 会话已终止：再推进不重复触发
    assert.equal(advanceStep({ stateId: session.stateId }).kind, 'session_lost')
  })

  test('风险下限不可降级：重算为 low 但会话 floor 是 medium → 不给 low 教程，给 medium 求助卡', () => {
    // 模拟：会话创建时视觉把风险升到 medium；推进时重算只有 low。
    // floor 生效 → 不降级给 font-too-small（maxLevel=low），而是 medium 谨慎求助卡。
    const session = createStepSession({
      text: '手机字太小',
      tutorialId: 'font-too-small',
      stepIndex: 0,
      riskFloor: 'medium',
    })
    const result = advanceStep({ stateId: session.stateId })
    assert.equal(result.kind, 'blocked')
    if (result.kind !== 'blocked') return
    assert.equal(result.decision.kind, 'stop')
    if (result.decision.kind === 'stop') {
      assert.equal(result.decision.risk, 'medium')
      assert.equal(result.decision.handoff.riskLevel, 'medium')
    }
  })

  test('medium 教程（退款）正常推进，risk=medium', () => {
    const session = createStepSession({
      text: '淘宝退款',
      tutorialId: 'ecommerce-refund',
      stepIndex: 0,
      riskFloor: 'medium',
    })
    const result = advanceStep({ stateId: session.stateId })
    assert.equal(result.kind, 'guide')
    if (result.kind !== 'guide') return
    assert.equal(result.decision.risk, 'medium')
    assert.equal(result.decision.step.id, 'ecommerce-refund-2')
  })
})

describe('step-sessions — 存储边界', () => {
  beforeEach(() => clearStepSessionsForTest())

  test('stateId 唯一且为 UUID 形态（opaque，不携带进度语义）', () => {
    const a = createStepSession({ text: 'a', tutorialId: 't', stepIndex: 0, riskFloor: 'low' })
    const b = createStepSession({ text: 'a', tutorialId: 't', stepIndex: 0, riskFloor: 'low' })
    assert.notEqual(a.stateId, b.stateId)
    assert.match(a.stateId, /^[0-9a-f-]{36}$/)
    assert.equal(stepSessionCount(), 2)
  })
})
