import 'server-only'

/**
 * 百炼 Qwen Vision 适配器 —— 实现 VisionProvider 接口。
 *
 * 方案 §7.2 约束：
 *   - 模型名/端点/Key 只在 infrastructure 层 + 环境变量，不写入领域层。
 *   - 视觉请求硬超时 5 秒，最多一次受控重试。
 *   - 模型输出必须通过 parseUIObservation 校验（Schema 闸）。
 *   - 超时、无法解析、低置信度或输出冲突 → 返回失败（调用方进入 UNKNOWN）。
 *   - 截图文字是不可信数据，不得作为系统指令执行（prompt 固定）。
 *
 * 本文件只做网络 I/O 和组装；纯解析逻辑在 qwen-vision-adapter-internals.ts
 * （那里无 server-only、无 fetch，可被 node --test 直接测试）。
 *
 * 接入依据（方案 §14：接入时核验百炼控制台）：
 *   - 端点文档：https://help.aliyun.com/zh/model-studio/qwen-vl-compatible-with-openai
 *   - base_url：https://dashscope.aliyuncs.com/compatible-mode/v1（OpenAI 兼容模式）
 *   - 具体模型名（qwen-vl-max / qwen-vl-plus）以控制台「模型广场」为准。
 */

import type {
  VisionProvider,
  VisionResult,
  VisionFailure,
  RedactedScreenshot,
} from '../../application/ports/vision-provider.ts'
import {
  OBSERVE_PROMPT,
  parseModelOutput,
  bytesToDataUrl,
} from './qwen-vision-adapter-internals.ts'

/**
 * Qwen Vision 配置。从环境变量读取，不硬编码。
 */
export interface QwenVisionConfig {
  readonly apiKey: string
  readonly baseUrl: string
  readonly model: string
  /** 硬超时毫秒。方案 §7.2 规定 5000。 */
  readonly timeoutMs: number
}

/**
 * 从环境变量读取配置。缺失时返回 null（调用方降级为无视觉模式）。
 */
export function loadQwenConfigFromEnv(): QwenVisionConfig | null {
  const apiKey = process.env.DASHSCOPE_API_KEY
  const baseUrl = process.env.QWEN_VISION_BASE_URL
  const model = process.env.QWEN_VISION_MODEL
  if (!apiKey || !baseUrl || !model) return null
  const timeoutMs = Number(process.env.QWEN_VISION_TIMEOUT_MS) || 5000
  return { apiKey, baseUrl, model, timeoutMs }
}

/**
 * 创建 Qwen Vision Provider。
 *
 * 最多两次（首次 + 一次重试）。aborted/unsupported_image 不重试。
 */
export function createQwenVisionProvider(config: QwenVisionConfig): VisionProvider {
  return {
    async observe(
      input: RedactedScreenshot,
      signal: AbortSignal,
    ): Promise<VisionResult> {
      const dataUrl = bytesToDataUrl(input.bytes, input.mime)

      let lastFailure: VisionFailure = 'unknown'
      for (let attempt = 0; attempt < 2; attempt++) {
        if (signal.aborted) {
          return { ok: false, reason: 'aborted' }
        }

        const result = await callOnce(config, dataUrl, signal)
        if (result.ok) return result

        lastFailure = result.reason

        // aborted / unsupported_image 不重试
        if (result.reason === 'aborted' || result.reason === 'unsupported_image') {
          return result
        }
        // 其他失败（timeout / invalid_output / unknown）重试一次
      }

      return { ok: false, reason: lastFailure }
    },
  }
}

/**
 * 单次调用。含硬超时。
 *
 * 用 timedOut 标志区分"硬超时"和"外部取消"：
 *   - timedOut: 超时触发 → reason='timeout'
 *   - outerSignal.aborted 且未超时: 调用方取消 → reason='aborted'
 */
async function callOnce(
  config: QwenVisionConfig,
  dataUrl: string,
  outerSignal: AbortSignal,
): Promise<VisionResult> {
  const timeoutCtrl = new AbortController()
  let timedOut = false
  const timer = setTimeout(() => {
    timedOut = true
    timeoutCtrl.abort()
  }, config.timeoutMs)

  const onOuterAbort = () => timeoutCtrl.abort()
  if (outerSignal.aborted) {
    timeoutCtrl.abort()
  } else {
    outerSignal.addEventListener('abort', onOuterAbort, { once: true })
  }

  try {
    const url = `${config.baseUrl}/chat/completions`
    const body = {
      model: config.model,
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: OBSERVE_PROMPT },
            { type: 'image_url', image_url: { url: dataUrl } },
          ],
        },
      ],
    }

    let resp: Response
    try {
      resp = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${config.apiKey}`,
        },
        body: JSON.stringify(body),
        signal: timeoutCtrl.signal,
      })
    } catch (err) {
      if (timeoutCtrl.signal.aborted) {
        return timedOut
          ? { ok: false, reason: 'timeout' }
          : { ok: false, reason: 'aborted' }
      }
      const msg = err instanceof Error ? err.message : String(err)
      if (msg.includes('image') || msg.includes('format')) {
        return { ok: false, reason: 'unsupported_image' }
      }
      return { ok: false, reason: 'unknown' }
    }

    if (!resp.ok) {
      if (resp.status === 400 || resp.status === 422) {
        return { ok: false, reason: 'unsupported_image' }
      }
      // 429 限流 / 5xx → unknown（调用方进入 UNKNOWN，不 fail-open）
      return { ok: false, reason: 'unknown' }
    }

    let json: unknown
    try {
      json = await resp.json()
    } catch {
      return { ok: false, reason: 'invalid_output' }
    }

    return parseModelOutput(json)
  } finally {
    clearTimeout(timer)
    outerSignal.removeEventListener('abort', onOuterAbort)
  }
}
