'use client'

/**
 * 教程交互 —— 一次一步，播报 + 好了/没看到/点错了。
 *
 * 适老化（方案 §9.2）：
 *   - 一次只显示一个步骤
 *   - 关键步骤 24-32px
 *   - 「没看到」展示替代表达（alternative）
 *   - 主按钮 min-h-64px
 */
import { useState } from 'react'
import { useRouter } from 'next/navigation'

import type { Tutorial } from '@/domain/guidance/tutorial'
import { SpeakButton } from '@/lib/speech/speak-button'

interface Props {
  tutorial: Tutorial
}

export function TutorialClient({ tutorial }: Props) {
  const router = useRouter()
  const [stepIdx, setStepIdx] = useState(0)
  const [showAlternative, setShowAlternative] = useState(false)

  const step = tutorial.steps[stepIdx]
  const isLast = stepIdx >= tutorial.steps.length - 1
  const speakText = `${step.title}。${step.instruction}`

  return (
    <main className="flex-1 flex flex-col px-5 py-6 gap-4 max-w-md mx-auto w-full">
      <header>
        <p className="text-base text-(--color-muted) mb-1">第 {stepIdx + 1} 步 / 共 {tutorial.steps.length} 步</p>
        <h1 className="text-2xl font-bold text-(--color-foreground)">{tutorial.title}</h1>
      </header>

      {/* 当前步骤 */}
      <div className="px-5 py-4 rounded-xl bg-(--color-soft) border border-(--color-border)">
        <h2 className="text-xl font-semibold text-(--color-foreground) mb-2">{step.title}</h2>
        <p className="text-lg text-(--color-foreground) leading-relaxed">{step.instruction}</p>

        {showAlternative && step.alternative && (
          <div className="mt-4 pt-4 border-t border-(--color-border)">
            <p className="text-base text-(--color-muted) mb-1">另一种说法</p>
            <p className="text-lg text-(--color-foreground) leading-relaxed">{step.alternative}</p>
          </div>
        )}
      </div>

      {/* 播报 */}
      <SpeakButton text={speakText} />

      {/* 成功信号 */}
      <div className="px-4 py-3 rounded-lg bg-(--color-primary-soft) border border-(--color-primary)">
        <p className="text-base text-(--color-primary)">
          做完这一步，你会看到：{tutorial.title}
        </p>
      </div>

      {/* 导航按钮 */}
      <div className="flex flex-col gap-2 mt-2">
        {isLast ? (
          <button
            type="button"
            onClick={() => router.push('/')}
            className="w-full min-h-[64px] px-6 py-3 rounded-xl bg-(--color-primary) hover:bg-(--color-primary-hover) active:scale-[0.99] transition text-white text-xl font-semibold shadow-sm"
          >
            全部做完了
          </button>
        ) : (
          <button
            type="button"
            onClick={() => { setStepIdx(stepIdx + 1); setShowAlternative(false) }}
            className="w-full min-h-[64px] px-6 py-3 rounded-xl bg-(--color-primary) hover:bg-(--color-primary-hover) active:scale-[0.99] transition text-white text-xl font-semibold shadow-sm"
          >
            好了，下一步
          </button>
        )}

        {!showAlternative && step.alternative && (
          <button
            type="button"
            onClick={() => setShowAlternative(true)}
            className="w-full min-h-[56px] px-6 py-3 rounded-xl bg-white hover:bg-(--color-soft) transition text-(--color-foreground) text-lg font-medium border-2 border-(--color-border)"
          >
            没看到这个按钮
          </button>
        )}

        <button
          type="button"
          onClick={() => router.push('/')}
          className="w-full min-h-[56px] px-6 py-3 rounded-xl bg-white hover:bg-(--color-soft) transition text-(--color-foreground) text-base font-normal border border-(--color-border)"
        >
          不搞了，回首页
        </button>
      </div>
    </main>
  )
}
