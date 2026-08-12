/**
 * build-handoff 用例 —— 求助卡构建（方案 §4.1、§10）。
 *
 * 职责：给定已分类的用户输入，构建脱敏求助卡。
 *
 * 安全不变量（方案 §10.1）：
 *   - 求助卡不得包含 OTP、验证码、支付密码、完整银行卡号、身份凭据或未经同意的原始截图。
 *   - 低风险不生成求助卡（buildHandoffCard 内部抛错）。
 *
 * 这个用例被 decide-next 在 stop 分支内联调用，也暴露为独立函数。
 */

import { classifyRiskByRules } from '../domain/risk/classify-risk.ts'
import { createQuestion } from '../domain/question/question.ts'
import { buildHandoffCard } from '../domain/handoff/handoff-templates.ts'
import type { HandoffCard } from '../domain/handoff/handoff-request.ts'

/**
 * 构建结果。
 * - ok: 成功生成求助卡
 * - low_risk: 低风险，不需要求助卡（调用方应走 guide 路径）
 */
export type BuildHandoffResult =
  | { readonly kind: 'ok'; readonly card: HandoffCard }
  | { readonly kind: 'low_risk' }

/**
 * 给定用户文本，构建求助卡。
 *
 * 内部完成：分类 → createQuestion → buildHandoffCard。
 * 低风险文本返回 low_risk（不抛错，让调用方优雅处理）。
 *
 * @param text 用户原始输入
 */
export function buildHandoff(text: string): BuildHandoffResult {
  const trimmed = text.trim()
  if (!trimmed) {
    return { kind: 'low_risk' }
  }

  const risk = classifyRiskByRules(trimmed)
  if (risk.level === 'low') {
    return { kind: 'low_risk' }
  }

  const question = createQuestion(trimmed, 'text', risk)
  const card = buildHandoffCard(question)
  return { kind: 'ok', card }
}
