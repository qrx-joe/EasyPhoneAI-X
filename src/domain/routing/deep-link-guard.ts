/**
 * Deep link 守卫：对手拼 URL（如 /tutorial?text=... 或 /confirm?text=...）
 * 绕过首页 buildRouteForInput() 的情况，统一复用 buildRouteForInput() 决定
 * 是否必须先 redirect 到风险页。
 *
 * 安全核心补充。buildRouteForInput() 是"用户输入→跳转"的入口，
 * 本函数是"页面被 deep link 进入→是否需要再分流"的反向守卫。
 * 两者方向相反，共用同一份 shouldStopGuidance() 决策。
 *
 * 判 level 而非判 href 字符串，未来高风险路径改名自动跟随。
 */

import { buildRouteForInput } from './user-routing.ts'
import { shouldStopGuidance } from '../risk/types.ts'

/**
 * Deep link 守卫。
 *
 * - 返回 string：必须先 redirect(guard) 到该 href
 * - 返回 null：文本安全，当前页面可继续正常逻辑
 *
 * @param text 来自 searchParams.text 的原始输入（调用方已 trim）
 */
export function guardGuidanceRoute(text: string): string | null {
  const decision = buildRouteForInput(text)
  if (shouldStopGuidance(decision.level)) {
    return decision.href
  }
  return null
}
