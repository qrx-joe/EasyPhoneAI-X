'use client'

/**
 * 「点一下说问题」按钮 —— 真实集成 Web Speech Recognition。
 *
 * 行为：
 *   - 点一下：开始听，按钮变红色 + 显示实时识别文本
 *   - 识别到 final：通过 onFinal 回调把文本交给调用方（由页面负责路由跳转）
 *   - 再点：停止识别
 *   - 浏览器不支持 / 出错：显示中文错误提示，父组件用文本兜底继续可用
 *
 * 分层约束（方案 §4.2）：
 *   组件本身不直接调用 domain 路由，只通过 onFinal 回调把识别结果交给上层。
 *   路由决策由页面（app 层）负责，调用 domain/routing 的 routeToInput。
 *   这样 components 不依赖 domain，保持依赖方向单向。
 *
 * 适老化：
 *   - 按钮足够大（min-h-112px），状态切换有视觉/文字双反馈
 *   - 实时 transcript 字号大，老人能看清「系统听到的是什么」
 *   - 出错时给「下一步怎么做」（用打字告诉我）
 */

import { useSpeechRecognition } from '@/lib/speech/use-speech-recognition.ts'

interface VoiceInputButtonProps {
  /**
   * 收到 final transcript 时的回调。
   * 调用方（页面）在这里调用 routeToInput(router, text) 完成路由跳转。
   */
  onFinal: (transcript: string) => void
}

export function VoiceInputButton({ onFinal }: VoiceInputButtonProps) {
  const { state, transcript, errorMessage, isSupported, start, stop } =
    useSpeechRecognition({
      onFinal,
    })

  const isListening = state === 'listening' || state === 'ending'
  const isUnavailable = Boolean(errorMessage && !isSupported)
  const idleLabel = errorMessage
    ? isUnavailable
      ? '语音暂时用不了'
      : '再点一次说问题'
    : '点这里说问题'
  const buttonLabel = isListening ? '我在听,慢慢说' : idleLabel

  return (
    <div className="w-full flex flex-col gap-3">
      <button
        type="button"
        onClick={isListening ? stop : start}
        className={
          isListening
            ? 'w-full min-h-[128px] px-6 py-5 rounded-[20px] bg-(--color-danger) text-white text-2xl font-bold flex flex-col items-center justify-center gap-2 shadow-[0_10px_22px_rgba(198,40,40,.24)] animate-pulse'
            : isUnavailable
              ? 'w-full min-h-[128px] px-6 py-5 rounded-[20px] bg-(--color-soft) hover:bg-(--color-soft-hover) active:scale-[0.99] transition text-(--color-foreground) text-2xl font-bold flex flex-col items-center justify-center gap-2 border-2 border-(--color-border)'
              : 'w-full min-h-[128px] px-6 py-5 rounded-[20px] bg-(--color-primary) hover:bg-(--color-primary-hover) active:scale-[0.99] transition text-white text-2xl font-bold flex flex-col items-center justify-center gap-2 shadow-[0_10px_22px_rgba(29,95,209,.25)]'
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
    </div>
  )
}
