import { redirect } from 'next/navigation'

import { guardGuidanceRoute } from '@/domain/routing/deep-link-guard'
import { ConfirmActions } from './confirm-actions'

/**
 * 目标确认页 —— 复述用户目标，确认后进入教程（方案 §9.1）。
 *
 * 高风险输入不得进入此页（方案 §9.1）。
 * guardGuidanceRoute 是反向守卫，防止手拼 URL 绕过首页分流。
 * 调用必须在主逻辑之前（位置不变量）。
 */
export default async function ConfirmPage({
  searchParams,
}: {
  searchParams: Promise<{ text?: string }>
}) {
  const { text } = await searchParams
  const cleanText = (text ?? '').trim()

  if (!cleanText) {
    redirect('/')
  }

  const guard = guardGuidanceRoute(cleanText)
  if (guard) {
    redirect(guard)
  }

  // 到这里说明是低/中风险，可以安全确认目标
  return <ConfirmActions text={cleanText} />
}
