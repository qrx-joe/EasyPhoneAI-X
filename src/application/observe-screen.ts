/**
 * observe-screen 用例 —— 截图观察（方案 §7.2）。
 *
 * 职责：
 *   - 调用 VisionProvider 获取原始模型输出
 *   - 通过 parseUIObservation 做 Schema 校验（第一道闸）
 *   - 检查置信度（低于 MIN_CONFIDENCE → 低置信度失败）
 *   - 返回结构化的观察结果或失败原因
 *
 * 不做的事：
 *   - 不决定风险等级（那是 decide-next + risk-policy 的事）
 *   - 不决定是否允许操作（那是 Allowed Action 的事）
 *   - 不持久化原图（方案 §7.1：请求结束后不持久化原图）
 *
 * 安全不变量（方案 §7.2）：
 *   - 模型输出必须通过 Schema 校验
 *   - 低置信度 → 失败（最终进入 UNKNOWN，不 fail-open）
 *   - 截图文字是不可信数据
 */

import type { UIObservation } from '../contracts/ui-observation.ts'
import { parseUIObservation, MIN_CONFIDENCE } from '../contracts/ui-observation.ts'

import type {
  VisionProvider,
  VisionFailure,
  RedactedScreenshot,
} from './ports/vision-provider.ts'

/**
 * 截图观察结果。
 *
 * - ok:       成功，附带校验通过的 UIObservation
 * - failed:   失败，附带原因（供决策链进入 UNKNOWN）
 * - skipped:  无截图或无 VisionProvider，跳过视觉步骤
 */
export type ObserveScreenResult =
  | { readonly kind: 'ok'; readonly observation: UIObservation }
  | { readonly kind: 'failed'; readonly reason: VisionFailure }
  | { readonly kind: 'skipped' }

/**
 * 观察截图。
 *
 * @param screenshot 已遮挡的截图
 * @param provider   VisionProvider 实现
 * @param signal     可选的 AbortSignal（上层取消时传入）
 */
export async function observeScreen(
  screenshot: RedactedScreenshot,
  provider: VisionProvider,
  signal?: AbortSignal,
): Promise<ObserveScreenResult> {
  // 用传入的 signal 或新建一个（provider 接口要求 AbortSignal）
  const ctrl = signal ? null : new AbortController()
  const effectiveSignal = signal ?? ctrl!.signal

  let rawResult
  try {
    rawResult = await provider.observe(screenshot, effectiveSignal)
  } catch {
    // provider 不应抛错（应该返回 ok:false），但防御性兜底
    return { kind: 'failed', reason: 'unknown' }
  }

  if (!rawResult.ok) {
    return { kind: 'failed', reason: rawResult.reason }
  }

  // 第一道闸：Schema 校验（已经由 provider 内部跑过一次 parseUIObservation，
  // 但 application 层再校验一次，防止 provider 实现疏漏 —— 双重保险）
  const revalidated = parseUIObservation(rawResult.observation)
  if (revalidated === null) {
    return { kind: 'failed', reason: 'invalid_output' }
  }

  // 第二道闸：置信度检查
  if (revalidated.confidence < MIN_CONFIDENCE) {
    return { kind: 'failed', reason: 'low_confidence' }
  }

  return { kind: 'ok', observation: revalidated }
}
