/**
 * advance-step 用例 —— 教程步骤推进（无障碍教练方案 阶段 A-2）。
 *
 * 职责：处理「我看到了」—— 把服务端会话推进到下一步。
 *
 * 安全不变量：
 *   - 步骤索引只存在服务端会话；客户端只提交 opaque stateId（索引不可信、不可传）。
 *   - 每次推进都重跑风险检查（对会话原文），且以会话创建时的风险为下限：
 *     规则库更新或风险升级 → 立即 blocked（stop 含求助卡），绝不推进。
 *   - 会话查不到 → session_lost，调用方回到重新描述（不猜进度）。
 *   - 推进到超出最后一步 → complete，会话删除（不可重复推进）。
 */

import { classifyRiskByRules } from '../domain/risk/classify-risk.ts'
import { findTutorial, tutorialAllowsRisk, type TutorialStep } from '../domain/guidance/tutorial.ts'
import { createQuestion } from '../domain/question/question.ts'
import { buildHandoffCard } from '../domain/handoff/handoff-templates.ts'
import type { RiskLevel } from '../domain/risk/types.ts'
import { RISK_RANK } from '../domain/risk/types.ts'
import type { GuideDecision, StopDecision } from '../contracts/guidance-decision.ts'
import { ERROR_CODES } from '../contracts/error-codes.ts'
import type { StepAdvanceResult } from '../contracts/step-api.ts'

import {
  advanceStepSessionIndex,
  createStepSession,
  deleteStepSession,
  findStepSession,
  toStepStateView,
} from './step-sessions.ts'
import { classifyAtLevel } from './decide-next.ts'

/**
 * 推进步骤。输入只有 stateId —— 一切进度以服务端会话为准。
 */
export function advanceStep(input: { readonly stateId: string }): StepAdvanceResult {
  const record = findStepSession(input.stateId)
  if (record === null) {
    return { kind: 'session_lost' }
  }

  // ── 重跑风险检查（服务端权威，不信任客户端）──
  // 以会话创建时的合并风险为下限：规则重算结果更低也不降级（同 mergeRiskByMax 方向）。
  const ruleNow = classifyRiskByRules(record.text)
  const effective: RiskLevel =
    RISK_RANK[ruleNow.level] >= RISK_RANK[record.riskFloor]
      ? ruleNow.level
      : record.riskFloor

  if (effective === 'high' || effective === 'critical') {
    // 风险在会话中途升级（如规则库更新后命中高危词）→ 立即停止并给求助卡
    const question = createQuestion(record.text, 'text', classifyAtLevel(ruleNow, effective))
    const stopDecision: StopDecision = {
      kind: 'stop',
      risk: effective,
      handoff: buildHandoffCard(question),
    }
    deleteStepSession(record.stateId)
    return { kind: 'blocked', decision: stopDecision }
  }

  const tutorial = findTutorial(record.text)
  if (tutorial === null || !tutorialAllowsRisk(tutorial, effective)) {
    // 与 decideNext 的 medium 档语义一致：无可用已审核教程 → 谨慎求助卡 / unsupported
    if (effective === 'medium') {
      const question = createQuestion(record.text, 'text', classifyAtLevel(ruleNow, 'medium'))
      const stopDecision: StopDecision = {
        kind: 'stop',
        risk: 'medium',
        handoff: buildHandoffCard(question),
      }
      deleteStepSession(record.stateId)
      return { kind: 'blocked', decision: stopDecision }
    }
    deleteStepSession(record.stateId)
    return {
      kind: 'blocked',
      decision: { kind: 'unsupported', reasonCode: ERROR_CODES.TASK_STATE_NOT_FOUND },
    }
  }

  if (tutorial.id !== record.tutorialId) {
    // 教程库在会话中途变化 → 从新教程第一步重新开始（新会话，不猜旧进度）
    const restarted = createStepSession({
      text: record.text,
      tutorialId: tutorial.id,
      stepIndex: 0,
      riskFloor: effective,
    })
    deleteStepSession(record.stateId)
    const decision = buildGuideDecision(tutorial.steps[0], effective)
    return { kind: 'guide', decision, stepState: toStepStateView(restarted, tutorial.steps.length) }
  }

  // ── 服务端权威推进：索引 +1 ──
  const nextRecord = advanceStepSessionIndex(record.stateId)
  if (nextRecord === null) {
    return { kind: 'session_lost' }
  }

  if (nextRecord.stepIndex >= tutorial.steps.length) {
    // 最后一步确认完成：删除会话，complete 不可重复触发
    deleteStepSession(record.stateId)
    return { kind: 'complete', tutorialTitle: tutorial.title }
  }

  const step = tutorial.steps[nextRecord.stepIndex]
  const decision = buildGuideDecision(step, effective)
  return { kind: 'guide', decision, stepState: toStepStateView(nextRecord, tutorial.steps.length) }
}

function buildGuideDecision(
  step: TutorialStep,
  risk: RiskLevel,
): GuideDecision {
  return {
    kind: 'guide',
    risk: risk === 'medium' ? 'medium' : 'low',
    step,
    successSignal: step.successSignal,
  }
}
