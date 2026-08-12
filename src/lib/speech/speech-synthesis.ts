/**
 * 浏览器 Web Speech Synthesis API 的 typed 封装：能力检测、取消、speak() 念文本。
 *
 * 与 web-speech.ts (recognition) 的差异：
 *   - SpeechSynthesis 是全局单例 window.speechSynthesis，不需要 new Ctor()。
 *   - 单例约束：同一时间只能播放一段语音，新调用 speak() 会打断正在播的。
 *
 * 设计原则（适老化）：
 *   1. typed 严格 —— 不用 any，unknown 收敛
 *   2. 适老化语速 —— rate 默认 0.85（比系统默认慢一点，老人反应速度跟得上）
 *   3. 永远假设可降级 —— 不支持时按钮隐藏
 *   4. 不阻塞 UI —— speak() 是异步的
 *   5. 不保存音频 —— TTS 输出由系统处理
 */

// ─────────────────────────────────────────────────────────────────────
// 类型
// ─────────────────────────────────────────────────────────────────────

export interface SpeakOptions {
  /** 要念的文本（纯文本） */
  text: string
  /** 语言 BCP-47 tag，默认 zh-CN */
  lang?: string
  /** 语速 0.1 - 10，默认 0.85（适老化） */
  rate?: number
  /** 音高 0 - 2，默认 1.0 */
  pitch?: number
  /** 音量 0 - 1，默认 1.0 */
  volume?: number
  /** 念完回调（被打断不触发） */
  onEnd?: () => void
  /** 错误回调（浏览器不支持/语音引擎失败） */
  onError?: (message: string) => void
}

// ─────────────────────────────────────────────────────────────────────
// 能力检测
// ─────────────────────────────────────────────────────────────────────

/**
 * 当前浏览器是否支持 Speech Synthesis。
 * 必须在 client 端调用。
 */
export function isSpeechSynthesisSupported(): boolean {
  if (typeof window === 'undefined') return false
  return typeof window.speechSynthesis !== 'undefined'
}

/**
 * 取消当前正在播放的语音（如果有）。
 * 安全可重复调用。
 */
export function cancelSpeech(): void {
  if (!isSpeechSynthesisSupported()) return
  try {
    window.speechSynthesis.cancel()
  } catch {
    // 静默：某些浏览器 cancel() 会抛 InvalidStateError
  }
}

/**
 * 念一段文本。
 *
 * 返回一个 cancel 函数，UI 可以用它打断当前播放。
 * 即使浏览器不支持 / 引擎失败，这个函数也不抛错 —— 错误通过 onError
 * 通知调用方，UI 继续工作（适老化原则：不打断主流程）。
 */
export function speak(opts: SpeakOptions): () => void {
  if (!isSpeechSynthesisSupported()) {
    opts.onError?.('当前浏览器不支持语音播报')
    return () => {}
  }

  const synth = window.speechSynthesis

  // 一些浏览器（Safari）在前一个 utterance 还没结束时不会播新的，
  // 强制 cancel 一下保证新语音能开始
  try {
    synth.cancel()
  } catch {
    // ignore
  }

  const utterance = new SpeechSynthesisUtterance(opts.text)
  utterance.lang = opts.lang ?? 'zh-CN'
  utterance.rate = opts.rate ?? 0.85
  utterance.pitch = opts.pitch ?? 1.0
  utterance.volume = opts.volume ?? 1.0

  if (opts.onEnd) {
    utterance.onend = () => opts.onEnd?.()
  }
  if (opts.onError) {
    utterance.onerror = (event) => {
      // 主动 cancel 不算"错误"，不通知 UI
      if (event.error === 'canceled' || event.error === 'interrupted') {
        return
      }
      opts.onError?.(event.error || '语音播报失败')
    }
  }

  try {
    synth.speak(utterance)
  } catch (err) {
    const msg = err instanceof Error ? err.message : '语音播报失败'
    opts.onError?.(msg)
    return () => {}
  }

  // 返回 cancel 闭包
  return () => {
    try {
      synth.cancel()
    } catch {
      // ignore
    }
  }
}
