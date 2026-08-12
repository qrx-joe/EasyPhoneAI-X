/**
 * "教给出去"模式清单 —— 求助卡绝对不能包含这类话术。
 *
 * 注意方向性：
 *   - "不要告诉对方验证码" ✅ 反诈骗安全提示（应该出现）
 *   - "把验证码发给我"      ❌ 教给出去（绝不能出现）
 *
 * 只能加模式，不能删（删除 = 放松安全 lint，需 ADR + review）。
 * 纯字符串匹配，零依赖，可在任何环境跑（server / client / test）。
 */

export const FORBIDDEN_GIVE_AWAY_PATTERNS: readonly string[] = Object.freeze([
  '念给我听',
  '报一下',
  '发给我',
  '念给我',
  '读出来',
  '念出来',
  '把验证码发',
  '把密码发',
  '把身份证发',
  '把银行卡发',
  '告诉我验证码',
  '提供验证码',
  '输入验证码即可',
])

/**
 * 文本是否命中任一"教给出去"模式。
 *
 * 用途：
 *   1. 求助卡模板产物的 lint
 *   2. 未来 AI 生成 summary 时的运行时闸（AI 输出不可信）
 */
export function containsGiveAwayPattern(text: string): boolean {
  return FORBIDDEN_GIVE_AWAY_PATTERNS.some((p) => text.includes(p))
}
