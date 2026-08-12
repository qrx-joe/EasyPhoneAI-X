'use client'

/**
 * 「念给我听」按钮 —— 调一次 speak() 念指定文本。
 *
 * 状态机：
 *   idle      —— 没在念
 *   speaking  —— 正在念（按钮变红色 + 「停下来」）
 *
 * 行为：
 *   - 点击：如果 idle → 开始念，切换 speaking；如果 speaking → 停
 *   - 念完：onend → 回 idle
 *   - 组件 unmount / text 变化：自动 cancel（避免卸载后还在念 / 切步骤还在念旧的）
 */

import { useEffect, useRef, useState } from 'react'

import {
  cancelSpeech,
  isSpeechSynthesisSupported,
  speak,
  type SpeakOptions,
} from './speech-synthesis.ts'

interface Props {
  /** 要念的文本（必填）。步骤内容或建议项。 */
  text: string
  /** 透传到 speak() 的其他选项，适合父组件做"语速/音色"控制 */
  options?: Omit<SpeakOptions, 'text' | 'onEnd' | 'onError'>
  /** 自定义样式 className，留出来给父组件调适老化（默认 min-h-64，text-xl） */
  className?: string
  /** 自定义按钮文本（默认「念给我听」） */
  label?: string
}

export function SpeakButton({
  text,
  options,
  className,
  label = '念给我听',
}: Props) {
  const [speaking, setSpeaking] = useState(false)
  const [unsupported, setUnsupported] = useState(false)
  const cancelRef = useRef<(() => void) | null>(null)

  // 组件 unmount / text 变化时取消正在念的（防"切步骤还在念旧的"）
  useEffect(() => {
    if (!isSpeechSynthesisSupported()) {
      setUnsupported(true)
      return
    }
    return () => {
      // unmount cleanup
      cancelRef.current?.()
    }
  }, [])

  useEffect(() => {
    // text 变了 → 立即停旧的
    cancelRef.current?.()
    setSpeaking(false)
  }, [text])

  if (unsupported) {
    // 不支持时直接不渲染按钮（适老化：不显示"无效控件"）
    return null
  }

  function handleClick() {
    if (speaking) {
      // 用户主动停
      cancelRef.current?.()
      cancelRef.current = null
      setSpeaking(false)
      return
    }

    const cancel = speak({
      ...options,
      text,
      onEnd: () => {
        setSpeaking(false)
        cancelRef.current = null
      },
      onError: (msg) => {
        console.error('[speak] error:', msg)
        setSpeaking(false)
        cancelRef.current = null
      },
    })
    cancelRef.current = cancel
    setSpeaking(true)
  }

  // 兜底：即使在组件 unmount 路径外 cancelSpeech 全局调一下，
  // 防止上一个 SpeakButton 的 utterance 残留
  useEffect(() => {
    return () => {
      cancelSpeech()
    }
  }, [])

  const classNameFinal =
    className ??
    (speaking
      ? 'w-full min-h-[64px] px-6 py-3 rounded-xl bg-(--color-danger) text-white text-xl font-medium shadow-sm'
      : 'w-full min-h-[64px] px-6 py-3 rounded-xl bg-(--color-soft) hover:bg-(--color-soft-hover) active:scale-[0.99] transition text-(--color-foreground) text-xl font-medium border border-(--color-border)')

  return (
    <button
      type="button"
      onClick={handleClick}
      className={classNameFinal}
      aria-label={speaking ? '停止念' : '念给我听'}
      aria-pressed={speaking}
    >
      {speaking ? '停下来' : label}
    </button>
  )
}
