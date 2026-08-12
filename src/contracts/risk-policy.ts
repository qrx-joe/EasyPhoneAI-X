/**
 * 风险策略契约 —— 决策链中"风险取 MAX"不变量的单一来源。
 *
 * 方案 §6.2 决策链：
 *   确定性风险规则 → 截图观察 → 风险结果取 MAX → ...
 *
 * 安全不变量（方案 §6.2）：
 *   - AI 只能维持或升级规则风险，不能降级。
 *   - 规则命中 high/critical 后，普通指导立即终止。
 *
 * 纯类型 + 纯函数，无运行时副作用，无 IO。
 * 风险等级本身的定义在 domain/risk/types.ts，这里只定义"如何合并两个风险来源"的策略契约。
 */

import type { RiskLevel } from '../domain/risk/types.ts'
import { RISK_RANK } from '../domain/risk/types.ts'

/**
 * 风险策略版本号。
 *
 * 每个决策响应回传 policyVersion（方案 §8.1），用于审计追溯。
 * 改 RISK_KEYWORDS 或合并算法时递增。
 */
export const RISK_POLICY_VERSION = '2026.08-v1'

/**
 * 风险来源标签。标识某个风险等级是从哪条路径得出的。
 *
 * 用于审计事件（方案 §11.1）和 fallback 状态记录。
 * 不得包含原始文本或截图内容。
 */
export type RiskSource =
  | 'rule'          // 确定性关键词规则
  | 'vision'        // 截图观察（Qwen Vision）
  | 'merged'        // 规则与视觉取 MAX 后
  | 'unknown'       // 无法判定（技术故障或安全不确定性）

/**
 * 带来源的风险等级。决策链内部传递的中间态。
 */
export interface RiskAssessment {
  readonly level: RiskLevel
  readonly source: RiskSource
}

/**
 * 取两个风险来源的 MAX（安全核心不变量）。
 *
 * 方案 §6.2：「AI 只能维持或升级规则风险，不能降级」。
 * 本函数是这条不变量的运行时实现：永远返回两者中更高的等级。
 *
 * 用途：合并确定性规则风险与截图观察风险。
 *
 * 特殊语义：
 *   - 任一来源为 high/critical → 结果 >= high（高风险不可被降级）
 *   - 两个来源都为 unknown/无法判定 → 返回 unknown 风险等级
 *
 * @param rule  确定性规则的风险评估
 * @param vision 截图观察的风险评估（可选，无截图时为 null）
 */
export function mergeRiskByMax(
  rule: RiskAssessment,
  vision: RiskAssessment | null,
): RiskAssessment {
  // 无截图观察：以规则结果为准
  if (vision === null) {
    return rule
  }

  // 两者都有：取 MAX。source 标记为 merged。
  const ruleRank = RISK_RANK[rule.level]
  const visionRank = RISK_RANK[vision.level]
  const maxLevel = ruleRank >= visionRank ? rule.level : vision.level
  return { level: maxLevel, source: 'merged' }
}
