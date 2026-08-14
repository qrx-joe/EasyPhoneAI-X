'use client'

/**
 * 「点一下说问题」按钮 —— 真实集成 Web Speech Recognition + 听写确认（阶段 A-1）。
 *
 * 行为：
 *   - 点一下：开始听，按钮变红色 + 显示实时识别文本
 *   - 识别到 final：只把文本交给 onFinal（填入输入框），**不提交**
 *     并弹出「我听到的是」确认面板，同时朗读一遍
 *   - 确认面板三出口（无障碍教练方案 阶段 A-1）：
 *       「对，就是这个」→ onConfirm（提交/跳转只发生在这里）
 *       「改一改」      → onEdit（聚焦编辑框，文本已填好）
 *       「重新说」      → 重新开始听
 *   - 再点：停止识别
 *   - 浏览器不支持 / 出错：显示中文错误提示，父组件用文本兜底继续可用
 *
 * 分层约束（方案 §4.2）：
 *   组件本身不调用 domain 决策，只通过回调把识别结果交给上层。
 *   路由由页面（app 层）负责：统一带文本进入 /assist，由服务端决策 API 判风险。
 *
 * 适老化：
 *   - 按钮足够大（min-h-112px），状态切换有视觉/文字双反馈
 *   - 实时 transcript 字号大，老人能看清「系统听到的是什么」
 *   - 出错时给「下一步怎么做」（用打字告诉我）
 */

import { useEffect, useState } from 'react'

import { useSpeechRecognition } from '@/lib/speech/use-speech-recognition.ts'
import { isSpeechSynthesisSupported, speak } from '@/lib/speech/speech-synthesis.ts'

interface VoiceInputButtonProps {
  /**
   * 收到 final transcript：只更新输入内容，不提交。
   * 未确认的语音不会触发决策（阶段 A-1 验收）。
   */
  onFinal: (transcript: string) => void
  /** 用户点「对，就是这个」：提交/跳转只发生在这里 */
  onConfirm?: (transcript: string) => void
  /** 用户点「改一改」：文本已通过 onFinal 填入，这里聚焦编辑框 */
  onEdit?: (transcript: string) => void
}

export function VoiceInputButton({ onFinal, onConfirm, onEdit }: VoiceInputButtonProps) {
  // 收到 final：挂起等确认 + 透传给上层填文本（不提交）
  const { state, transcript, errorMessage, isSupported, start, stop, reset } =
    useSpeechRecognition({
      onFinal: (text) => {
        setPending(text)
        onFinal(text)
      },
    })

  const [pending, setPending] = useState<string | null>(null)

  // 「我听到的是」确认面板出现时朗读一遍（显示 + 朗读双通道，阶段 A-1）
  useEffect(() => {
    if (pending === null || !isSpeechSynthesisSupported()) return
    speak({ text: `我听到的是，${pending}。对的话，点「对，就是这个」。` })
  }, [pending])

  const isListening = state === 'listening' || state === 'ending'
  const isUnavailable = Boolean(errorMessage && !isSupported)
  const idleLabel = errorMessage
    ? isUnavailable
      ? '语音暂时用不了'
      : '再点一次说问题'
    : '点这里说问题'
  const buttonLabel = isListening ? '我在听,慢慢说' : idleLabel

  function confirmTranscript() {
    if (pending === null) return
    const text = pending
    setPending(null)
    reset()
    onConfirm?.(text)
  }

  function editTranscript() {
    if (pending === null) return
    const text = pending
    setPending(null)
    onEdit?.(text)
  }

  function retryListening() {
    setPending(null)
    reset()
    start()
  }

  // 重新开始听之前清掉挂起的确认
  function handleMainClick() {
    if (isListening) {
      stop()
      return
    }
    setPending(null)
    start()
  }

  return (
    <div className="w-full flex flex-col gap-3">
      <button
        type="button"
        onClick={handleMainClick}
        className={
          isListening
            ? 'w-full min-h-[128px] px-6 py-5 rounded-[20px] bg-(--color-danger) text-white text-2xl font-bold flex flex-col items-center justify-center gap-2 shadow-[0_10px_22px_rgba(198,40,40,.24)] animate-pulse'
            : isUnavailable
              ? 'w-full min-h-[128px] px-6 py-5 rounded-[20px] bg-(--color-soft) hover:bg-(--color-soft-hover) active:scale-[0.99] transition text-(--color-foreground) text-2xl font-bold flex flex-col items-center justify-center gap-2 border-2 border-(--color-border)'
              : 'w-full min-h-[128px] px-6 py-5 rounded-[20px] bg-(--color-primary) hover:bg-(--color-primary-hover) active:scale-[0.99] transition text-(--color-foreground) text-2xl font-bold flex flex-col items-center justify-center gap-2 shadow-[0_10px_22px_rgba(221,107,32,.28)]'
        }
        aria-label={isListening ? '我在听,再点一下停止' : buttonLabel}
        aria-pressed={isListening}
      >
        <span className="flex items-center justify-center gap-3">
          <span className="ui-icon" aria-hidden="true">说</span>
          <span>{buttonLabel}</span>
        </span>
        {!isListening && !errorMessage && (
          <span className="text-sm font-medium opacity-90">点一下开始，再点一下停止</span>
        )}
        {errorMessage && !isListening && (
          <span
            className={
              isUnavailable
                ? 'text-base font-medium text-(--color-muted)'
                : 'text-base font-medium text-white'
            }
            role="status"
          >
            {errorMessage}
          </span>
        )}
      </button>

      {/* 实时 transcript 反馈（让老人知道系统听到了什么） */}
      {isListening && (
        <div
          className="w-full px-5 py-4 rounded-xl bg-white border-2 border-(--color-primary) text-left"
          aria-live="polite"
        >
          <p className="text-base text-(--color-muted) mb-1">我听到的是</p>
          <p className="text-2xl text-(--color-foreground) min-h-[1.5em] break-words">
            {transcript || '...'}
          </p>
        </div>
      )}

      {/* 听写确认（阶段 A-1）：识别结束后确认才提交，三出口 */}
      {pending !== null && !isListening && (
        <div
          className="w-full px-5 py-4 rounded-xl bg-white border-2 border-(--color-primary) text-left"
          role="status"
          data-testid="voice-confirm"
        >
          <p className="text-base text-(--color-muted) mb-1">我听到的是</p>
          <p className="text-2xl text-(--color-foreground) leading-relaxed break-words mb-4">
            {pending}
          </p>
          <p className="text-base text-(--color-foreground) mb-2">是这个问题吗？</p>
          <div className="flex flex-col gap-2">
            <button
              type="button"
              onClick={confirmTranscript}
              className="w-full min-h-[64px] px-6 py-3 rounded-xl bg-(--color-primary) hover:bg-(--color-primary-hover) active:scale-[0.99] transition text-(--color-foreground) text-xl font-semibold shadow-sm"
            >
              对，就是这个
            </button>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={editTranscript}
                className="w-full min-h-[56px] px-4 py-3 rounded-xl bg-white hover:bg-(--color-soft) transition text-(--color-foreground) text-lg font-medium border-2 border-(--color-border)"
              >
                改一改
              </button>
              <button
                type="button"
                onClick={retryListening}
                className="w-full min-h-[56px] px-4 py-3 rounded-xl bg-white hover:bg-(--color-soft) transition text-(--color-foreground) text-lg font-medium border-2 border-(--color-border)"
              >
                重新说
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
