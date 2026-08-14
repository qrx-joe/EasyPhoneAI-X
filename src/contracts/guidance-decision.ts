/**
 * GuidanceDecision 契约 —— 决策链的最终输出。
 *
 * 方案 §6.1：公开联合类型，调用方必须穷尽处理所有状态。
 * 禁止把 unknown 当作 low。
 *
 * 四个分支：
 *   - guide:      低/中风险，给出一个已审核的下一步
 *   - stop:       高/极高风险强中止；medium 在无可用已审核教程时谨慎求助（均附求助卡）
 *   - clarify:    风险未知，向用户提问以澄清
 *   - unsupported: 不支持的场景（如无法识别的 App）
 *
 * 这个类型是跨边界协议的单一来源（方案 §4.1 contracts 职责）。
 * 不依赖 React/Next/fetch/env。
 */

import type { RiskLevel } from '../domain/risk/types.ts'
import type { TutorialStep } from '../domain/guidance/tutorial.ts'
import type { HandoffCard } from '../domain/handoff/handoff-request.ts'
import type { StepStateView } from './step-api.ts'

/**
 * 一步指导的决策。
 *
 * 方案 §6.2 安全不变量：一个指导步骤只能包含一个已审核动作，
 * 并给出可观察的成功信号。
 */
export interface GuideDecision {
  readonly kind: 'guide'
  /** low 或 medium。high/critical 永远不会出现在 guide 分支。 */
  readonly risk: 'low' | 'medium'
  /** 当前要执行的步骤（来自白名单教程库）。 */
  readonly step: TutorialStep
  /** 成功信号：做完这一步用户能看到/听到的页面变化（步骤级，人工审核）。 */
  readonly successSignal: string
  /**
   * 步骤会话视图（无障碍教练方案 阶段 A-2）。
   * 由 decideNext 创建；客户端凭 stateId 调 /api/v2/step/advance 推进，
   * 索引只存服务端。缺省（如旧客户端）时 UI 不提供「我看到了」推进。
   */
  readonly stepState?: StepStateView
}

/**
 * 风险停止决策。
 *
 * 方案 §2.2：高风险强中止。
 * medium 档：没有能服务该风险等级的已审核教程时，同样停下并附谨慎求助卡
 * （README §2.2「二次确认」的产出形态；绝不降级给 low 教程）。
 * 方案 §12.3 验收：风险页面不存在"继续操作"或模拟成功按钮。
 */
export interface StopDecision {
  readonly kind: 'stop'
  /** medium（谨慎求助）/ high / critical（强中止）。low 永远不会停。 */
  readonly risk: 'medium' | 'high' | 'critical'
  /** 附带的求助卡（脱敏，供用户确认后分享）。 */
  readonly handoff: HandoffCard
}

/**
 * 风险未知决策。
 *
 * 方案 §6.2：截图缺失、模糊、模型冲突、Schema 无效或任务状态不匹配时返回 unknown。
 * 方案 §12.3：UNKNOWN 截图不显示具体按钮指导。
 */
export interface ClarifyDecision {
  readonly kind: 'clarify'
  readonly risk: 'unknown'
  /** 向用户提出的澄清问题（如"这是哪个 App？""能再拍清楚一点吗？"）。 */
  readonly questions: readonly string[]
}

/**
 * 不支持的场景决策。
 *
 * 方案 §8.2：reasonCode 对应稳定错误码（如 TASK_STATE_NOT_FOUND）。
 */
export interface UnsupportedDecision {
  readonly kind: 'unsupported'
  readonly reasonCode: string
}

/**
 * 决策联合类型。调用方必须穷尽处理所有分支。
 */
export type GuidanceDecision =
  | GuideDecision
  | StopDecision
  | ClarifyDecision
  | UnsupportedDecision

/**
 * 穷尽性检查辅助函数。
 *
 * TypeScript 的 never 类型保证：如果未来给 GuidanceDecision 加新分支，
 * 所有调用 handleDecision 的地方都会编译报错，强制处理新分支。
 *
 * @example
 *   switch (decision.kind) {
 *     case 'guide': ...
 *     case 'stop': ...
 *     case 'clarify': ...
 *     case 'unsupported': ...
 *     default: return assertNever(decision) // 编译期穷尽保护
 *   }
 */
export function assertNever(decision: never): never {
  throw new Error(
    `assertNever: GuidanceDecision 出现未处理的分支: ${JSON.stringify(decision)}`,
  )
}
