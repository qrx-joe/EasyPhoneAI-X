'use client'

/**
 * 语音识别的 React 生命周期 hook。
 *
 * 状态机：
 *   idle      —— 还没启动
 *   listening —— 正在听（浏览器在录音）
 *   ending    —— 收到 final 结果，正在收尾（很快回到 idle）
 *
 * 终止路径：
 *   - 用户点停止  → stop() → onend → idle
 *   - 识别到 final → 自动 stop → onend → idle
 *   - 出错         → onerror → idle（error 只记 message，不停留状态）
 *
 * 设计取舍：
 *   - 不做"按住说话" —— 老人容易误触。改成"点一下开始，识别到 final 自动结束"。
 *   - interim transcript 实时更新，让老人看到"系统在听什么" —— 关键的"我按对了"反馈。
 *   - 错误不留在状态 —— 出错时把 message 设出去然后立刻回到 idle。
 */

import { useCallback, useEffect, useRef, useState } from 'react'

import {
  defaultSpeechRecognitionFactory,
  explainSpeechError,
  isSpeechRecognitionSupported,
  type SpeechRecognitionFactory,
} from './web-speech.ts'

export type SpeechRecognitionState = 'idle' | 'listening' | 'ending'

export interface UseSpeechRecognitionOptions {
  /** 注入 factory 便于测试；不传就用浏览器原生 */
  factory?: SpeechRecognitionFactory
  /** 识别语言，默认 zh-CN */
  lang?: string
  /**
   * 收到 final transcript 时的回调。
   * 如果父组件想要直接跳走，onFinal 收到非空字符串时调用 stop() 然后走流程。
   */
  onFinal?: (transcript: string) => void
}

export interface UseSpeechRecognitionReturn {
  state: SpeechRecognitionState
  /** 实时识别的文本（interim + final 拼接） */
  transcript: string
  /** 错误时的中文提示，显示后 3s 自动清空 */
  errorMessage: string | null
  isSupported: boolean
  start: () => void
  stop: () => void
  reset: () => void
}

export function useSpeechRecognition(
  opts: UseSpeechRecognitionOptions = {},
): UseSpeechRecognitionReturn {
  const { factory, lang = 'zh-CN', onFinal } = opts

  const [state, setState] = useState<SpeechRecognitionState>('idle')
  const [transcript, setTranscript] = useState('')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  // 用 ref 持有 handle，避免 React 闭包陷阱
  const handleRef = useRef<ReturnType<SpeechRecognitionFactory> | null>(null)
  // 标记是否已经触发过 onFinal（防止 onend 时再触发一次）
  const finalFiredRef = useRef(false)
  const [isSupported, setIsSupported] = useState(false)
  // 标记 onFinal 的最新值，避免 useEffect 闭包过期
  const onFinalRef = useRef(onFinal)
  onFinalRef.current = onFinal

  // 错误消息 3s 自动清空
  useEffect(() => {
    if (!errorMessage) return
    const t = setTimeout(() => setErrorMessage(null), 3000)
    return () => clearTimeout(t)
  }, [errorMessage])

  useEffect(() => {
    setIsSupported(isSpeechRecognitionSupported())
  }, [])

  const start = useCallback(() => {
    if (state === 'listening' || state === 'ending') return
    const supportsSpeech = isSpeechRecognitionSupported()
    setIsSupported(supportsSpeech)
    if (!supportsSpeech) {
      setErrorMessage('您的浏览器不支持语音输入,用打字告诉我吧')
      return
    }

    const factoryFn = factory ?? defaultSpeechRecognitionFactory(lang)
    const handle = factoryFn()
    if (!handle) {
      setErrorMessage('语音功能没准备好,先用打字告诉我吧')
      return
    }
    handleRef.current = handle
    finalFiredRef.current = false
    setTranscript('')
    setState('listening')

    handle.onResult((results) => {
      const all = results.map((r) => r.transcript).join('')
      setTranscript(all)
      // 收到 final 就停
      const hasFinal = results.some((r) => r.isFinal)
      if (hasFinal && !finalFiredRef.current) {
        finalFiredRef.current = true
        setState('ending')
        handle.stop()
        if (all.trim()) {
          onFinalRef.current?.(all.trim())
        }
      }
    })

    handle.onError((code, _message) => {
      setErrorMessage(explainSpeechError(code))
      setState('idle')
      // 不 cleanup handleRef —— onend 还会触发，正常清空
    })

    handle.onEnd(() => {
      // 浏览器在 stop() / 超时 / 错误 后都会触发 onend
      setState('idle')
      handleRef.current = null
    })

    try {
      handle.start()
    } catch (err) {
      console.error('[speech] start() 抛错:', err)
      setErrorMessage('启动语音失败,先用打字告诉我吧')
      setState('idle')
      handleRef.current = null
    }
  }, [factory, lang, state])

  const stop = useCallback(() => {
    if (state !== 'listening') return
    const h = handleRef.current
    if (h) {
      try {
        h.stop()
      } catch {
        // 静默 —— onend 仍会触发清理
      }
    }
  }, [state])

  const reset = useCallback(() => {
    setTranscript('')
    setErrorMessage(null)
  }, [])

  return { state, transcript, errorMessage, isSupported, start, stop, reset }
}
