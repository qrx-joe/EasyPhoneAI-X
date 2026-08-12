/**
 * HandoffCard 模板层 —— 根据 question.risk 生成对应的 summary + suggestions。
 *
 * 关注点分离：类型/工厂在 handoff-request.ts，模板策略在这里。
 * 未来接 AI 改写 summary 时，只换这个文件，UI/工厂不动。
 *
 * 为什么是「按等级兜底」而不是「按场景分桶」：
 *   - 场景在 classify-risk 内部有 9 个，但给家人的建议并不需要这么细 ——
 *     老人被骗时，家人的动作几乎都是同一套（问清楚、别转账、报警）。
 *   - 等级细分有意义：medium = 谨慎，high = 拒绝，critical = 立刻停下。
 *   - summary 部分会带上 scenario 的人话 reason（用 question.risk.reason）。
 */

import type { RiskLevel } from '../risk/types.ts'
import type { QuestionRecord } from '../question/question.ts'
import { createHandoffCard, type HandoffCard } from './handoff-request.ts'

/**
 * 按风险等级兜底的建议（老人 + 家人通用版）。
 */
const SUGGESTIONS_BY_LEVEL: Record<
  Exclude<RiskLevel, 'low'>,
  readonly string[]
> = {
  medium: [
    '先问清楚对方是谁、是哪家机构的',
    '不要在电话/短信里说验证码、密码、身份证号',
    '可以回拨对方声称的机构官方电话核实',
  ],
  high: [
    '不要转账、不要扫码、不要点链接',
    '不要告诉对方验证码、密码、身份证号',
    '把这个情况跟其他家人说一下,大家帮忙判断',
    '真有事就打 110 或 96110(反诈专线)',
  ],
  critical: [
    '立刻停下来,不要再操作手机',
    '不要转账、不要扫码、不要点链接、不要开屏幕共享',
    '不要告诉对方任何验证码、密码、身份证号',
    '马上把这件事告诉身边的家人',
    '真有事就打 110 或 96110(反诈专线)',
  ],
}

/**
 * 给定 question 生成 HandoffCard。
 *
 * - summary 优先用 question.risk.reason（关键词库已经写好的人话解释），
 *   兜底用「遇到了需要您帮忙的事」（防止 reason 为空时卡片白板）。
 * - suggestions 按风险等级从模板里取。
 *
 * 抛错（同 createHandoffCard）：question.risk.level === 'low' 时抛错。
 */
export function buildHandoffCard(question: QuestionRecord): HandoffCard {
  if (question.risk.level === 'low') {
    throw new Error(
      'buildHandoffCard: 低风险不应该生成求助卡,走教程路径',
    )
  }

  const summary = question.risk.reason || '遇到了需要您帮忙的事'
  const suggestions = SUGGESTIONS_BY_LEVEL[question.risk.level]

  return createHandoffCard(question, summary, suggestions)
}
