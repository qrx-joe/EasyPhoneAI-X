/**
 * 浏览器 Web Speech Recognition API 的 typed 封装。
 *
 * 跨浏览器兼容：
 *   - Chrome / Edge: window.SpeechRecognition
 *   - Safari (含 iOS): window.webkitSpeechRecognition
 *   - Firefox: 默认不开启，要当不支持处理
 *
 * 设计原则（语音识别必须有文本兜底）：
 *   1. 永远假设可降级 —— isSupported() 返回 false 时，UI 切到文本输入
 *   2. typed 严格 —— 不用 any，把 any 全 cast 成 unknown 再 narrow
 *   3. 不依赖 server —— 纯 client 端 API
 *   4. 不保存音频 —— 不录音、不上传，只用识别结果文本
 */

// ─────────────────────────────────────────────────────────────────────
// 类型（覆盖 W3C Web Speech API spec 的 SpeechRecognition 子集）
// ─────────────────────────────────────────────────────────────────────

export type SpeechRecognitionErrorCode =
  | 'no-speech'
  | 'aborted'
  | 'audio-capture'
  | 'network'
  | 'not-allowed'
  | 'service-not-allowed'
  | 'language-not-supported'
  | 'unknown'

export interface SpeechRecognitionResult {
  readonly transcript: string
  readonly isFinal: boolean
}

export interface SpeechRecognitionHandle {
  start(): void
  stop(): void
  abort(): void
  onResult(cb: (results: readonly SpeechRecognitionResult[]) => void): void
  onError(cb: (code: SpeechRecognitionErrorCode, message: string) => void): void
  onEnd(cb: () => void): void
}

/** 创建 SpeechRecognition 实例的工厂（便于测试时注入 mock）。 */
export type SpeechRecognitionFactory = () => SpeechRecognitionHandle | null

// ─────────────────────────────────────────────────────────────────────
// 浏览器能力检测
// ─────────────────────────────────────────────────────────────────────

/**
 * 当前浏览器是否支持 Web Speech Recognition。
 * 必须在 client 端调用（window 对象存在的前提下）。
 */
export function isSpeechRecognitionSupported(): boolean {
  if (typeof window === 'undefined') return false
  const w = window as unknown as {
    SpeechRecognition?: unknown
    webkitSpeechRecognition?: unknown
  }
  return (
    typeof w.SpeechRecognition !== 'undefined' ||
    typeof w.webkitSpeechRecognition !== 'undefined'
  )
}

// ─────────────────────────────────────────────────────────────────────
// 默认工厂（浏览器原生）
// ─────────────────────────────────────────────────────────────────────

/**
 * 默认工厂：用浏览器原生 SpeechRecognition / webkitSpeechRecognition。
 *
 * 返回的 handle 把 spec 里的 EventTarget 风格 API 折成 onResult/onError/onEnd
 * 三个 callback，React 用起来更直观（useEffect 订阅）。
 */
export function defaultSpeechRecognitionFactory(
  lang = 'zh-CN',
): SpeechRecognitionFactory {
  return () => {
    if (!isSpeechRecognitionSupported()) return null

    const w = window as unknown as {
      SpeechRecognition?: new () => unknown
      webkitSpeechRecognition?: new () => unknown
    }
    const Ctor = w.SpeechRecognition || w.webkitSpeechRecognition
    if (!Ctor) return null

    // 用 unknown 收敛类型，再 cast 成最小化的 internal interface
    const recognition = new (Ctor as new () => {
      lang: string
      continuous: boolean
      interimResults: boolean
      maxAlternatives: number
      start(): void
      stop(): void
      abort(): void
      onresult: ((event: unknown) => void) | null
      onerror: ((event: unknown) => void) | null
      onend: ((event: unknown) => void) | null
    })()

    recognition.lang = lang
    recognition.continuous = false
    recognition.interimResults = true
    recognition.maxAlternatives = 1

    let resultCb: ((r: readonly SpeechRecognitionResult[]) => void) | null =
      null
    let errorCb:
      | ((code: SpeechRecognitionErrorCode, message: string) => void)
      | null = null
    let endCb: (() => void) | null = null

    recognition.onresult = (event: unknown) => {
      if (!resultCb) return
      const e = event as {
        resultIndex: number
        results: ArrayLike<{
          isFinal: boolean
          0: { transcript: string }
        }>
      }
      const out: SpeechRecognitionResult[] = []
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i]
        out.push({ transcript: r[0].transcript, isFinal: r.isFinal })
      }
      resultCb(out)
    }

    recognition.onerror = (event: unknown) => {
      if (!errorCb) return
      const e = event as { error?: string; message?: string }
      const code = (e.error ?? 'unknown') as SpeechRecognitionErrorCode
      errorCb(code, e.message ?? code)
    }

    recognition.onend = () => {
      if (endCb) endCb()
    }

    return {
      start: () => recognition.start(),
      stop: () => recognition.stop(),
      abort: () => recognition.abort(),
      onResult: (cb) => {
        resultCb = cb
      },
      onError: (cb) => {
        errorCb = cb
      },
      onEnd: (cb) => {
        endCb = cb
      },
    }
  }
}

// ─────────────────────────────────────────────────────────────────────
// 用户可见的英文错误 → 中文文案（适老化，说人话）
// ─────────────────────────────────────────────────────────────────────

/**
 * 把 API 错误码翻译成给老人看的中文提示。
 *
 * 不甩锅给用户（不说"您的网络有问题"），而是给下一步动作。
 */
export function explainSpeechError(
  code: SpeechRecognitionErrorCode,
): string {
  switch (code) {
    case 'no-speech':
      return '没听清您说什么,再试一次吧'
    case 'aborted':
      return '已停止'
    case 'audio-capture':
      return '麦克风没声音,检查一下是不是没插好'
    case 'not-allowed':
    case 'service-not-allowed':
      return '麦克风被禁用了,在浏览器里允许一下试试'
    case 'network':
      return '网络不太好,等会儿再试'
    case 'language-not-supported':
      return '您的手机不支持中文识别,用打字告诉我吧'
    case 'unknown':
    default:
      return '出了点小问题,先用打字告诉我吧'
  }
}
