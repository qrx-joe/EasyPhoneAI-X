'use client'

/**
 * 风险停止交互 —— 显示停止原因 + 求助卡 + 系统分享/复制。
 *
 * 方案 §12.3：高风险页面不存在"继续操作"或模拟成功按钮。
 * 方案 §10.2：分享由用户点击触发，优先 navigator.share()，降级复制。
 */
import { useState } from 'react'
import { useRouter } from 'next/navigation'

import type { HandoffCard } from '@/domain/handoff/handoff-request'
import { serializeHandoffCard } from '@/domain/handoff/card-serialization'

interface Props {
  handoff: HandoffCard
}

export function RiskAlertClient({ handoff }: Props) {
  const router = useRouter()
  const [shareStatus, setShareStatus] = useState<'idle' | 'shared' | 'copied' | 'failed'>('idle')

  const cardText = serializeHandoffCard(handoff)

  async function handleShare() {
    setShareStatus('idle')
    // 方案 §10.2：优先 navigator.share()
    if (typeof navigator !== 'undefined' && 'share' in navigator) {
      try {
        await navigator.share({
          title: '爸妈别急 - 求您帮个忙',
          text: cardText,
        })
        setShareStatus('shared')
        return
      } catch {
        // 用户取消或分享失败，降级到复制
      }
    }
    // 降级：复制纯文本（方案 §10.2）
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      try {
        await navigator.clipboard.writeText(cardText)
        setShareStatus('copied')
        return
      } catch {
        // 复制失败，允许用户长按选择
      }
    }
    setShareStatus('failed')
  }

  return (
    <main className="flex-1 flex flex-col px-5 py-6 gap-4 max-w-md mx-auto w-full">
      {/* 停止警示 */}
      <div
        className="px-5 py-4 rounded-xl bg-(--color-danger-soft) border-2 border-(--color-danger)"
        role="alert"
      >
        <h1 className="text-2xl font-bold text-(--color-danger) mb-2">先停下来</h1>
        <p className="text-lg text-(--color-foreground) leading-relaxed">{handoff.summary}</p>
      </div>

      {/* 安全动作（方案 §9.1：三条以内安全动作）*/}
      <div className="px-4 py-3 rounded-lg bg-(--color-soft) border border-(--color-border)">
        <p className="text-base text-(--color-muted) mb-2">现在该做的</p>
        <ul className="space-y-2">
          {handoff.suggestions.slice(0, 3).map((s, i) => (
            <li key={i} className="text-lg text-(--color-foreground) leading-relaxed">
              {i + 1}. {s}
            </li>
          ))}
        </ul>
      </div>

      {/* 求助卡（方案 §10.1：脱敏上下文）*/}
      <div className="px-4 py-3 rounded-lg bg-white border-2 border-(--color-border)">
        <p className="text-base text-(--color-muted) mb-2">发给家人求助（点下面按钮）</p>
        <pre className="text-base text-(--color-foreground) whitespace-pre-wrap font-sans leading-relaxed">{cardText}</pre>
      </div>

      {/* 分享按钮（方案 §10.2：用户点击触发）*/}
      <button
        type="button"
        onClick={handleShare}
        className="w-full min-h-[64px] px-6 py-3 rounded-xl bg-(--color-primary) hover:bg-(--color-primary-hover) active:scale-[0.99] transition text-white text-xl font-semibold shadow-sm"
      >
        发给家人
      </button>

      {shareStatus === 'shared' && (
        <p className="text-base text-(--color-primary) text-center" role="status">已打开分享</p>
      )}
      {shareStatus === 'copied' && (
        <p className="text-base text-(--color-primary) text-center" role="status">已复制，去微信里粘贴给家人</p>
      )}
      {shareStatus === 'failed' && (
        <p className="text-base text-(--color-muted) text-center" role="status">
          复制没成功，上面的文字可以长按选择
        </p>
      )}

      <button
        type="button"
        onClick={() => router.push('/')}
        className="w-full min-h-[56px] px-6 py-3 rounded-xl bg-white hover:bg-(--color-soft) transition text-(--color-foreground) text-base font-normal border border-(--color-border)"
      >
        回首页
      </button>
    </main>
  )
}
