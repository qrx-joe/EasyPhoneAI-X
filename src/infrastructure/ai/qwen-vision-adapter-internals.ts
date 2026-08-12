/**
 * Qwen Vision 解析内部逻辑 —— 纯函数，无 fetch、无 server-only。
 *
 * 从 qwen-vision-adapter.ts 拆出来，便于在 node --test 环境直接测试。
 * adapter.ts 负责网络 I/O 和组装，这里只负责模型输出的解析与校验。
 */

import { parseUIObservation, MIN_CONFIDENCE } from '../../contracts/ui-observation.ts'
import type { VisionResult } from '../../application/ports/vision-provider.ts'

/**
 * prompt 固定，不拼接截图文字（方案 §7.2：截图文字是不可信数据）。
 */
export const OBSERVE_PROMPT = `你在看一位老人发来的手机截图。只描述你看到的客观界面事实，不要判断能不能操作。
请严格输出下面这个 JSON 格式（不要输出任何其他文字、不要 markdown 代码块）：

{
  "appId": "App 的包名或名字，如 com.tencent.mm 或 微信。看不出来就填 unknown",
  "screenState": "当前是什么页面，如 chat_detail（聊天页）、settings（设置页）、payment（支付页）",
  "elements": [
    {"kind": "button 或 link 或 input 或 text 或 icon 或 other", "label": "按钮上或文字的实际内容"}
  ],
  "confidence": 0.0 到 1.0 之间的数字，表示你对这次观察有多确定,
  "uncertainties": ["如果图片模糊、被遮挡、你不确定的地方写在这里"]
}

注意：只描述看到的，不要给建议，不要说"应该"或"不要"。`

/**
 * 解析模型输出。提取 message.content → JSON.parse → parseUIObservation → 置信度检查。
 *
 * 返回值：
 *   - ok: 校验通过的 UIObservation
 *   - invalid_output: 结构非法
 *   - low_confidence: 置信度低于阈值
 */
export function parseModelOutput(json: unknown): VisionResult {
  const content = extractContent(json)
  if (content === null) {
    return { ok: false, reason: 'invalid_output' }
  }

  const cleaned = stripMarkdownFence(content)

  let parsed: unknown
  try {
    parsed = JSON.parse(cleaned)
  } catch {
    return { ok: false, reason: 'invalid_output' }
  }

  const observation = parseUIObservation(parsed)
  if (observation === null) {
    return { ok: false, reason: 'invalid_output' }
  }

  if (observation.confidence < MIN_CONFIDENCE) {
    return { ok: false, reason: 'low_confidence' }
  }

  return { ok: true, observation }
}

/**
 * 从 OpenAI 兼容响应提取 choices[0].message.content。
 */
export function extractContent(json: unknown): string | null {
  if (typeof json !== 'object' || json === null) return null
  const obj = json as Record<string, unknown>
  const choices = obj.choices
  if (!Array.isArray(choices) || choices.length === 0) return null
  const first = choices[0]
  if (typeof first !== 'object' || first === null) return null
  const msg = (first as Record<string, unknown>).message
  if (typeof msg !== 'object' || msg === null) return null
  const content = (msg as Record<string, unknown>).content
  if (typeof content !== 'string') return null
  return content
}

/**
 * 去除 markdown 代码块标记（模型有时会用 ```json 包裹）。
 */
export function stripMarkdownFence(text: string): string {
  const trimmed = text.trim()
  if (trimmed.startsWith('```')) {
    const lines = trimmed.split('\n')
    if (lines.length >= 2) {
      const middle = lines.slice(1).join('\n')
      return middle.replace(/```\s*$/, '').trim()
    }
  }
  return trimmed
}

/**
 * Uint8Array → base64 data URL。
 */
export function bytesToDataUrl(bytes: Uint8Array, mime: string): string {
  const base64 = Buffer.from(bytes).toString('base64')
  return `data:${mime};base64,${base64}`
}
