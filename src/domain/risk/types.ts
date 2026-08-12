/**
 * 风险等级枚举 + 等级数值映射 + "是否该停教程"判定函数。安全不变量源头之一。
 *
 * 整个 risk domain 的"协议层"。所有"什么算高/中/低"的判断都从这张表里出。
 * 不允许在任何 UI 组件里写死 level === 'high' || level === 'critical'，
 * 一律走 shouldStopGuidance()。
 *
 * 不导入任何 React / Next.js / I/O 相关模块（领域层纯净约束）。
 */

/**
 * 风险等级。
 *
 * - critical: 不可逆损失，一步到位的诈骗。
 *             例：转账、屏幕共享、读出短信验证码、远程控制。
 *             一旦命中，必须立刻停止任何教程，跳到「家人求助卡」。
 *
 * - high:     大概率是骗局，但还差一步操作。
 *             例：陌生链接、点击中奖二维码、假冒亲属/客服来电。
 *             仍需停止教程，但话术比 critical 略缓和。
 *
 * - medium:   涉及金钱/隐私但相对可控。
 *             例：误买理财、首次开通权限、绑定银行卡。
 *             教程可以继续，但需要额外的"二次确认"步骤。
 *
 * - low:      纯系统操作，基本无害。
 *             例：微信没有声音、字体太小、空间不足。
 *             正常走分步教程。
 */
export type RiskLevel = 'low' | 'medium' | 'high' | 'critical'

/**
 * 风险等级的数值优先级，数字越大风险越高。
 *
 * 用于"取最大值合并"的场景：同一段输入可能命中多个等级的关键词，
 * 永远按最高的算 —— 这是安全核心，不能反过来。
 */
export const RISK_RANK: Record<RiskLevel, number> = {
  low: 0,
  medium: 1,
  high: 2,
  critical: 3,
}

/**
 * 是否应当停止常规教程，转入风险提醒页。
 *
 * 抽成独立函数，避免在 UI、AI 合并、测试等多处写死
 * `level === 'high' || level === 'critical'` 这种重复判断。
 */
export function shouldStopGuidance(level: RiskLevel): boolean {
  return RISK_RANK[level] >= RISK_RANK.high
}

/**
 * 单次风险分类的结果。
 *
 * - level:           最终风险等级（取所有命中关键词的最高等级）。
 * - matchedKeywords: 命中的关键词列表。用于：
 *                    (1) 在测试里精确断言"为什么是这个等级"
 *                    (2) 给 AI 兜底场景提供"规则已经命中过哪些词"的上下文
 *                    (3) 给开发期的调试面板显示
 * - reason:          一句给老人看的人话解释（在风险提醒页显示）。
 *                    例："这条信息提到了'验证码'，骗子最常用这一招"
 */
export interface RiskClassification {
  level: RiskLevel
  matchedKeywords: string[]
  reason: string
}
