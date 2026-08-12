import { redirect } from 'next/navigation'

import { classifyRiskByRules } from '@/domain/risk/classify-risk'
import { createQuestion } from '@/domain/question/question'
import { buildHandoffCard } from '@/domain/handoff/handoff-templates'
import { RiskAlertClient } from './risk-alert-client'

/**
 * 风险停止页 —— 解释为什么停止，给出安全动作（方案 §9.1、§2.2）。
 *
 * 服务端重新计算风险（方案 §8.1：客户端传入的风险等级一律不可信）。
 * 高风险页面不存在"继续操作"或模拟成功按钮（方案 §12.3 验收）。
 */
export default async function RiskAlertPage({
  searchParams,
}: {
  searchParams: Promise<{ text?: string }>
}) {
  const { text } = await searchParams
  const cleanText = (text ?? '').trim()

  if (!cleanText) {
    redirect('/')
  }

  // 服务端重新分类（防篡改）
  const risk = classifyRiskByRules(cleanText)
  if (risk.level === 'low') {
    // 低风险不应该到这页，转回确认页
    redirect(`/confirm?text=${encodeURIComponent(cleanText)}`)
  }

  const question = createQuestion(cleanText, 'text', risk)
  const handoff = buildHandoffCard(question)

  return <RiskAlertClient handoff={handoff} />
}
