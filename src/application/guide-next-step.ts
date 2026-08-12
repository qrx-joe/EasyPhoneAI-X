/**
 * guide-next-step 用例 —— 下一步指导（方案 §4.1）。
 *
 * 职责：给定用户输入 + 当前风险等级，返回一个已审核的下一步指导。
 *
 * 安全不变量：
 *   - 只有 low/medium 风险才能产出 guide（high/critical 抛错）
 *   - 一个指导步骤只能包含一个已审核动作（方案 §6.2）
 *   - 返回的 step 必须来自白名单教程库（findTutorial），不自由编造
 *
 * 这个用例被 decide-next 内联调用，也暴露为独立函数供测试和其他调用方使用。
 */

import type { RiskLevel } from '../domain/risk/types.ts'
import { shouldStopGuidance } from '../domain/risk/types.ts'
import {
  findTutorial,
  type Tutorial,
  type TutorialStep,
} from '../domain/guidance/tutorial.ts'

import type { GuideDecision } from '../contracts/guidance-decision.ts'

/**
 * 指导结果。
 * - ok: 找到了匹配教程，返回第一步
 * - no_match: 没有匹配的白名单教程
 * - stopped: 风险过高，不该进指导（调用方应走 stop 路径）
 */
export type GuideNextStepResult =
  | { readonly kind: 'ok'; readonly decision: GuideDecision; readonly tutorial: Tutorial }
  | { readonly kind: 'no_match' }
  | { readonly kind: 'stopped' }

/**
 * 给定用户输入 + 风险等级，产出下一步指导。
 *
 * @param text  用户输入
 * @param risk  已评估的风险等级（来自决策链的 MAX 合并结果）
 */
export function guideNextStep(
  text: string,
  risk: RiskLevel,
): GuideNextStepResult {
  // 防御性：高风险不进指导（decide-next 已分流，这里再卡一次）
  if (shouldStopGuidance(risk)) {
    return { kind: 'stopped' }
  }

  const tutorial = findTutorial(text)
  if (tutorial === null) {
    return { kind: 'no_match' }
  }

  // P0 阶段：返回教程第一步。第五阶段接入完整状态机后按当前步骤索引推进。
  const firstStep: TutorialStep = tutorial.steps[0]
  const decision: GuideDecision = {
    kind: 'guide',
    risk: risk === 'medium' ? 'medium' : 'low',
    step: firstStep,
    successSignal: tutorial.title,
  }

  return { kind: 'ok', decision, tutorial }
}
