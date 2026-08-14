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
 * 路由：文字、语音和示例统一进入 /assist，由正式决策 API 重新计算风险。
 * 语音识别只填入文本，用户点「对，就是这个」确认后才跳转（阶段 A-1）。
 */
import { useCallback, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'

import { VoiceInputButton } from '@/components/voice-input-button'
import wechatIcon from '../../docs/assets/official-app-icons/wechat.jpg'
import whatsappIcon from '../../docs/assets/official-app-icons/whatsapp.jpg'

const EXAMPLES = [
  { label: '微信没有声音了', icon: 'wechat', risky: false },
  { label: '手机字太小看不清', icon: 'settings', risky: false },
  { label: '银行短信说账户被冻结', icon: 'message', risky: true },
  { label: 'WhatsApp 让开屏幕共享', icon: 'whatsapp', risky: true },
] as const

function ExampleIcon({ icon, risky }: { icon: (typeof EXAMPLES)[number]['icon']; risky: boolean }) {
  const image = icon === 'wechat' ? wechatIcon : icon === 'whatsapp' ? whatsappIcon : null
  return (
    <span className="relative shrink-0">
      {image ? (
        // 这里需要真实 App 图标帮助老人按桌面外观识别；文字仍承担完整语义。
        <img className="app-tile object-cover" src={image.src} alt="" />
      ) : (
        <span className={icon === 'message' ? 'app-tile bg-[linear-gradient(180deg,#5bd669,#34c759)]' : 'app-tile'} aria-hidden="true">
          {icon === 'message' ? '信' : '⚙'}
        </span>
      )}
      {risky && <span className="risk-badge" aria-hidden="true">!</span>}
    </span>
  )
}

export function HomeClient() {
  const router = useRouter()
  const [text, setText] = useState('')
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const submit = useCallback(() => {
    if (!text.trim()) return
    router.push(`/assist?text=${encodeURIComponent(text.trim())}`)
  }, [router, text])

  // 语音识别结果只填入文本框，确认后才跳转（阶段 A-1：未确认不提交）
  const onVoiceFinal = useCallback((transcript: string) => {
    setText(transcript)
  }, [])

  const onVoiceConfirm = useCallback((transcript: string) => {
    router.push(`/assist?text=${encodeURIComponent(transcript)}`)
  }, [router])

  const onVoiceEdit = useCallback(() => {
    textareaRef.current?.focus()
  }, [])

  return (
    <main className="flex-1 flex flex-col px-5 py-5 gap-4 max-w-md mx-auto w-full">
      <header className="flex items-center gap-3 mb-1">
        <span className="brand-icon" aria-hidden="true">♥</span>
        <span>
          <h1 className="text-2xl font-bold leading-tight">爸妈别急</h1>
          <p className="text-sm text-(--color-muted)">安心下一步</p>
        </span>
      </header>

      <div className="pt-1">
        <h2 className="text-3xl font-bold leading-tight">遇到什么问题了？</h2>
        <p className="mt-1 text-base text-(--color-muted)">点下面的大按钮，直接说给我听</p>
      </div>

      {/* 语音入口（主要动作）。识别后确认，未确认不跳转 */}
      <section aria-label="语音提问">
        <VoiceInputButton
          onFinal={onVoiceFinal}
          onConfirm={onVoiceConfirm}
          onEdit={onVoiceEdit}
        />
      </section>

      {/* 文字输入（次要动作，语音不可用时的兜底）*/}
      <div className="flex items-center gap-3 text-sm text-(--color-muted)" aria-hidden="true">
        <span className="h-px flex-1 bg-(--color-border)" />
        <span>不方便说话，也可以打字</span>
        <span className="h-px flex-1 bg-(--color-border)" />
      </div>

      <section aria-label="打字提问" className="rounded-[18px] border-2 border-(--color-border) p-3">
        <label htmlFor="text-input" className="flex items-center gap-2 text-base font-bold mb-1">
          <span className="text-(--color-primary)" aria-hidden="true">⌨</span>用文字告诉我
        </label>
        <textarea
          id="text-input"
          ref={textareaRef}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="例如：微信没有声音了"
          rows={3}
          className="w-full min-h-[72px] px-1 py-2 border-0 bg-white text-(--color-foreground) text-base resize-none focus:outline-none"
        />
        <button
          type="button"
          onClick={submit}
          disabled={!text.trim()}
          className="w-full min-h-[64px] mt-3 px-6 py-3 rounded-2xl bg-(--color-primary) hover:bg-(--color-primary-hover) active:scale-[0.99] transition text-(--color-foreground) text-lg font-bold shadow-sm disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <span aria-hidden="true">→</span> 帮我看看
        </button>
      </section>

      {/* 常见示例 */}
      <section aria-label="常见问题">
        <p className="text-sm font-semibold text-(--color-muted) mb-2 px-1">也可以点一个常见问题</p>
        <div className="grid grid-cols-1 gap-2">
          {EXAMPLES.map((ex) => (
            <button
              key={ex.label}
              type="button"
              onClick={() => router.push(`/assist?text=${encodeURIComponent(ex.label)}`)}
              className="w-full min-h-[74px] px-3 py-2.5 rounded-2xl bg-white hover:bg-(--color-soft) active:scale-[0.99] transition text-(--color-foreground) text-base font-bold text-left border border-[#d8dee8] shadow-[0_3px_12px_rgba(24,34,48,.07)] flex items-center gap-3"
            >
              <ExampleIcon icon={ex.icon} risky={ex.risky} />
              <span className="flex-1">{ex.label}</span>
              <span className="text-2xl font-normal text-[#94a0b3]" aria-hidden="true">›</span>
            </button>
          ))}
        </div>
      </section>

      {/* 隐私提示 */}
      <footer className="pt-1 pb-3">
        <p className="flex items-start justify-center gap-2 text-sm text-(--color-muted) leading-relaxed">
          <span className="text-(--color-safe)" aria-hidden="true">✓</span>
          <span>不会替你点按钮或付钱；发现危险会让你先停下来。</span>
        </p>
      </footer>
    </main>
  )
}
