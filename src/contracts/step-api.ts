/**
 * 步骤推进 API 契约 —— 无障碍教练方案 阶段 A-2（教程步骤状态机）。
 *
 * 安全规则：
 * 1. 步骤索引只存在服务端会话里；客户端只持有 opaque stateId，
 *    请求里不传索引、不传教程 id —— 一律以服务端会话为准。
 * 2. 每次「我看到了」推进时，服务端对会话原文重跑风险检查；
 *    风险升级为 high/critical 时立即返回 stop（含求助卡），不推进。
 * 3. 会话查不到（刷新 / 服务重启 / 过期）→ 返回 session_lost，
 *    客户端安全回到「重新描述」，绝不猜测进度。
 */

import type { GuidanceDecision } from './guidance-decision.ts'

/**
 * 步骤会话的客户端视图。stateId 是 opaque 标识，不携带任何可被篡改的进度语义。
 */
export interface StepStateView {
  readonly stateId: string
  readonly tutorialId: string
  /** 当前已展示给用户的步骤（0 起，服务端权威） */
  readonly stepIndex: number
  readonly totalSteps: number
}

/**
 * POST /api/v2/step/advance 的请求体。
 */
export interface StepAdvanceRequest {
  readonly stateId: string
}

/**
 * 推进结果。
 * - guide:    推进到下一步（stepState 是新的服务端视图）
 * - complete: 最后一步确认完成，会话已删除
 * - blocked:  重跑风险检查后不允许继续（stop/clarify/unsupported 决策原样带回）
 * - session_lost: 会话不存在或已过期，客户端回到重新描述
 */
export type StepAdvanceResult =
  | { readonly kind: 'guide'; readonly decision: GuidanceDecision & { readonly kind: 'guide' }; readonly stepState: StepStateView }
  | { readonly kind: 'complete'; readonly tutorialTitle: string }
  | { readonly kind: 'blocked'; readonly decision: GuidanceDecision }
  | { readonly kind: 'session_lost' }

/**
 * 推进响应结构。
 */
export interface StepAdvanceResponse {
  readonly traceId: string
  readonly result: StepAdvanceResult
  readonly policyVersion: string
}
