/**
 * 用户输入 → 页面路由 —— 单一安全核心入口。
 *
 * 多个入口（文本提交 / 语音输入 / 未来 demo 路由 / deep link）共用同一份分流。
 *
 * 安全不变量（必须 100% 维持）：
 *   1. 高风险输入（critical/high）绝不进入确认/教程引导路径
 *   2. 跳转永远带 text 参数
 *   3. 空文本兜底回首页
 *
 * 注意：P0 第二阶段保持确定性关键词路由（无 AI 增强）。
 * 第三阶段定义 GuidanceDecision 契约、第五阶段接入页面后，
 * 这里的 href 路径会随实际页面命名调整。
 */

import { classifyRiskByRules } from '../risk/classify-risk.ts'
import { shouldStopGuidance, type RiskClassification } from '../risk/types.ts'

/**
 * 路由结果。
 *   - href: 实际跳转的 URL
 *   - level: 风险等级（给 UI 决策用）
 */
export interface RouteDecision {
  readonly href: string
  readonly level: 'low' | 'medium' | 'high' | 'critical'
}

/**
 * 空文本兜底用的占位 classification。
 */
const EMPTY_CLASSIFICATION: RiskClassification = {
  level: 'low',
  matchedKeywords: [],
  reason: '',
}

/**
 * 给定用户输入，决定跳哪个页面。
 *
 * 纯函数。不读 router、不读 history、不读 window —— 测试友好。
 *
 * 返回值在原有 { href, level } 之上叠加 classification 字段，
 * 方便上游复用同一份分类对象，避免二次跑 classifyRiskByRules 的非确定性风险。
 *
 * @param text 用户输入的原始文本
 */
export function buildRouteForInput(
  text: string,
): RouteDecision & { readonly classification: RiskClassification } {
  const trimmed = text.trim()
  if (!trimmed) {
    // 空文本兜底：回首页让用户重新输入
    return { href: '/', level: 'low', classification: EMPTY_CLASSIFICATION }
  }

  const r = classifyRiskByRules(trimmed)
  const qs = new URLSearchParams({ text: trimmed })

  if (shouldStopGuidance(r.level)) {
    // 高风险：把分类结果也带上，风险页会重新跑分类做防篡改校验
    qs.set('level', r.level)
    qs.set('keywords', r.matchedKeywords.join(','))
    qs.set('reason', r.reason)
    return {
      href: `/risk-alert?${qs.toString()}`,
      level: r.level,
      classification: r,
    }
  }

  // 低/中风险：进确认页，后续会再路由到教程
  return {
    href: `/confirm?${qs.toString()}`,
    level: r.level,
    classification: r,
  }
}

/**
 * Router 的最小接口（避免直接依赖 next/navigation 的 Router 类型，便于测试）。
 */
export interface MinimalRouter {
  push(href: string): void
}

/**
 * 实际执行跳转 —— 给页面 / 语音按钮共用。
 */
export function routeToInput(router: MinimalRouter, text: string): void {
  const { href } = buildRouteForInput(text)
  router.push(href)
}
