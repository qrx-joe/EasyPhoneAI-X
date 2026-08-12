/**
 * 求助卡（HandoffCard）类型 + 工厂。
 *
 * 当 question 被分类为 high/critical 时，生成"可发给家人的求助卡"数据。
 *
 * 设计原则（数据最小化 + 安全优先）：
 * 1. 不进卡片的内容 —— 验证码 / 银行卡号 / 身份证号 / 支付密码 / 通讯录 / 定位
 *    永不展示给家人。
 * 2. summary 是给家人一句话懂的总结。
 * 3. suggestions 是具体动作，按风险等级递增。
 * 4. 低风险不生成求助卡 —— 工厂函数会抛错。
 * 5. 字段全 readonly，数据一旦生成不允许修改。
 */

import type { RiskLevel } from '../risk/types.ts'
import type { QuestionRecord } from '../question/question.ts'

export interface HandoffCard {
  readonly id: string
  /** 关联的原始问题。卡片需要回显老人说了什么，让家人能确认场景。 */
  readonly question: QuestionRecord
  readonly riskLevel: RiskLevel
  /** 一句话总结，给家人一眼看懂发生了什么事。 */
  readonly summary: string
  /** 给家人的具体动作建议。 */
  readonly suggestions: readonly string[]
  readonly createdAt: string
}

// ─────────────────────────────────────────────────────────────────────
// 工厂
// ─────────────────────────────────────────────────────────────────────

let handoffCounter = 0

function genHandoffId(): string {
  handoffCounter += 1
  return `h-${Date.now().toString(36)}-${handoffCounter.toString(36)}`
}

/**
 * 工厂函数：从 question + summary + suggestions 生成 HandoffCard。
 *
 * 抛错的情况（都是写代码漏的迹象，不该静默吞）：
 *   - question.risk.level === 'low'    —— 不该给低风险生成求助卡
 *   - summary.trim() 为空              —— 卡片上没字等于没帮上忙
 *   - suggestions 为空数组              —— 没建议等于把问题甩给家人
 */
export function createHandoffCard(
  question: QuestionRecord,
  summary: string,
  suggestions: readonly string[],
): HandoffCard {
  if (question.risk.level === 'low') {
    throw new Error(
      'createHandoffCard: 低风险不需要生成求助卡（走教程路径）',
    )
  }
  if (!summary.trim()) {
    throw new Error('createHandoffCard: summary 不能为空')
  }
  if (suggestions.length === 0) {
    throw new Error('createHandoffCard: 至少需要 1 条建议')
  }
  return Object.freeze({
    id: genHandoffId(),
    question,
    riskLevel: question.risk.level,
    summary: summary.trim(),
    suggestions: Object.freeze([...suggestions]),
    createdAt: new Date().toISOString(),
  })
}
