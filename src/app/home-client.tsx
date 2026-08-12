'use client'

/**
 * 首页客户端交互 —— 文字输入 + 语音入口。
 *
 * 适老化（方案 §9.2）：
 *   - 每屏一个主要动作（说问题 / 打字）
 *   - 主按钮 min-h-64px、大字
 *   - 实时 transcript 反馈
 *   - 隐私提示用 role="status"
 *
 * 路由：提交后调 routeToInput（纯关键词分流），与语音入口共用同一决策路径。
 * 第三阶段定义的 /api/v2/decision 留给截图场景（第五阶段截图页接入）。
 */
import { useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'

import { routeToInput } from '@/domain/routing/user-routing'
import { VoiceInputButton } from '@/components/voice-input-button'

const EXAMPLES = [
  '微信没有声音了',
  '手机字太小',
  '对方让我转账',
  '对方让我开屏幕共享',
]

export function HomeClient() {
  const router = useRouter()
  const [text, setText] = useState('')

  const submit = useCallback(() => {
    if (!text.trim()) return
    routeToInput(router, text)
  }, [router, text])

  const onVoiceFinal = useCallback((transcript: string) => {
    routeToInput(router, transcript)
  }, [router])

  return (
    <main className="flex-1 flex flex-col px-5 py-6 gap-5 max-w-md mx-auto w-full">
      <header className="text-center pt-2">
        <h1 className="text-3xl font-bold text-(--color-foreground) mb-1">爸妈别急</h1>
        <p className="text-xl text-(--color-primary) font-semibold">安心下一步</p>
      </header>

      {/* 语音入口（主要动作）*/}
      <section aria-label="语音提问">
        <VoiceInputButton onFinal={onVoiceFinal} />
      </section>

      {/* 文字输入（次要动作，语音不可用时的兜底）*/}
      <section aria-label="打字提问">
        <label htmlFor="text-input" className="block text-base text-(--color-muted) mb-2 px-1">
          或者打字告诉我
        </label>
        <textarea
          id="text-input"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="遇到什么问题了？写在这里"
          rows={3}
          className="w-full min-h-[80px] px-4 py-3 rounded-xl border-2 border-(--color-border) bg-white text-(--color-foreground) text-lg resize-none focus:outline-none focus:border-(--color-primary)"
        />
        <button
          type="button"
          onClick={submit}
          disabled={!text.trim()}
          className="w-full min-h-[64px] mt-2 px-6 py-3 rounded-xl bg-(--color-primary) hover:bg-(--color-primary-hover) active:scale-[0.99] transition text-white text-xl font-semibold shadow-sm disabled:opacity-40 disabled:cursor-not-allowed"
        >
          帮我看看
        </button>
      </section>

      {/* 常见示例 */}
      <section aria-label="常见问题">
        <p className="text-base text-(--color-muted) mb-2 px-1">常见问题，点一下直接问</p>
        <div className="grid grid-cols-1 gap-2">
          {EXAMPLES.map((ex) => (
            <button
              key={ex}
              type="button"
              onClick={() => routeToInput(router, ex)}
              className="w-full min-h-[56px] px-4 py-3 rounded-xl bg-(--color-soft) hover:bg-(--color-soft-hover) active:scale-[0.99] transition text-(--color-foreground) text-lg text-left border border-(--color-border)"
            >
              {ex}
            </button>
          ))}
        </div>
      </section>

      {/* 隐私提示 */}
      <footer className="pt-2 pb-4">
        <p className="text-sm text-(--color-muted) text-center leading-relaxed">
          只帮你一步一步操作，遇到危险会停下来。
          <br />
          不会替你点按钮，不会替你付钱。
        </p>
      </footer>
    </main>
  )
}
