import { redirect } from 'next/navigation'

import { guardGuidanceRoute } from '@/domain/routing/deep-link-guard'
import { findTutorial } from '@/domain/guidance/tutorial'
import { TutorialClient } from './tutorial-client'

/**
 * 一步指导页 —— 展示当前步骤、目标位置、成功信号、播报（方案 §9.1）。
 *
 * 高风险输入不得进入此页。
 * guardGuidanceRoute 调用必须在 findTutorial 之前（位置不变量）。
 */
export default async function TutorialPage({
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

  const tutorial = findTutorial(cleanText)
  if (!tutorial) {
    // 没有匹配教程，转到未知页让用户补充描述
    redirect(`/unknown?text=${encodeURIComponent(cleanText)}`)
  }

  return <TutorialClient tutorial={tutorial} />
}
