/**
 * 把 HandoffCard 序列化成「可以直接发微信/短信」的人话纯文本。
 *
 * 用途：求助卡点「复制」或「系统分享」后，落到剪贴板/分享面板的内容。
 *
 * 设计原则（适老化 + 数据最小化）：
 * 1. 文本不嵌 HTML/Markdown —— 家人可能用短信/微信直接转发，纯文本最稳。
 * 2. 不重复 matched keywords —— 关键词是给开发/调试看的，家人看到反而困惑。
 * 3. 结构清晰 —— 标题/总结/建议/风险等级 一目了然。
 * 4. 顶部带「爸妈别急」产品签名 —— 家人收到知道是哪来的，降低「诈骗短信」误判。
 */

import type { HandoffCard } from './handoff-request.ts'

const PRODUCT_TAG = '【爸妈别急 - 请您帮个忙】'

/**
 * 风险等级人话标签。
 */
function riskLevelLabel(level: HandoffCard['riskLevel']): string {
  switch (level) {
    case 'critical':
      return '极高风险(请立刻协助)'
    case 'high':
      return '高风险(请尽快协助)'
    case 'medium':
      return '需谨慎(请核实)'
    case 'low':
      // low 不应该生成 HandoffCard，但 type 上 low 是合法值，兜底一下
      return '需关注'
  }
}

/**
 * 把 HandoffCard 序列化成纯文本卡片。
 */
export function serializeHandoffCard(card: HandoffCard): string {
  const lines: string[] = []

  lines.push(PRODUCT_TAG)
  lines.push('')
  lines.push('我刚才遇到了需要警惕的事:')
  lines.push(card.summary)
  lines.push('')
  lines.push('请帮我:')
  card.suggestions.forEach((s, i) => {
    lines.push(`${i + 1}. ${s}`)
  })
  lines.push('')
  lines.push(`风险等级:${riskLevelLabel(card.riskLevel)}`)
  lines.push(`时间:${card.createdAt}`)

  return lines.join('\n')
}
