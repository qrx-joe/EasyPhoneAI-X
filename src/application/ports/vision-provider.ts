/**
 * VisionProvider 端口 —— 截图观察的抽象接口（依赖倒置）。
 *
 * 方案 §7.2：P0 默认接入百炼 Qwen Vision，但具体模型名、区域端点和价格
 * 在实施时根据官方控制台重新核验。模型名和端点只存在于环境配置及基础设施层，
 * 不写入领域层。
 *
 * application 层只依赖这个接口，不依赖具体供应商实现。
 * 第四阶段在 infrastructure/ai/qwen-vision-adapter.ts 实现它。
 *
 * 安全不变量（方案 §7.2）：
 *   - 只提取可观察的 UI 事实，不决定是否允许操作。
 *   - 返回结果必须通过 UIObservationSchema 校验（由调用方负责）。
 *   - 视觉请求硬超时 5 秒，最多一次受控重试（由实现负责）。
 *   - 超时、无法解析、低置信度或输出冲突 → 调用方据此返回 UNKNOWN。
 */

import type { UIObservation } from '../../contracts/ui-observation.ts'

/**
 * 经过本地遮挡的截图（方案 §7.1）。
 * 用户手动涂抹敏感区域后提交的图片，以字节形式传入。
 */
export interface RedactedScreenshot {
  readonly bytes: Uint8Array
  readonly mime: string
}

/**
 * VisionProvider 观察结果。
 * 成功时返回校验通过的 UIObservation；失败时返回失败原因（供决策链进入 UNKNOWN）。
 */
export type VisionResult =
  | { readonly ok: true; readonly observation: UIObservation }
  | { readonly ok: false; readonly reason: VisionFailure }

/**
 * 视觉失败原因。对应方案 §7.2 的几种失败场景。
 * 调用方根据 reason 决定是否重试或直接进入 UNKNOWN。
 */
export type VisionFailure =
  | 'timeout'           // 请求超时（含重试后仍超时）
  | 'invalid_output'    // 模型输出未通过 Schema 校验
  | 'low_confidence'    // 置信度低于阈值
  | 'unsupported_image' // 图片格式不支持或损坏
  | 'aborted'           // 调用方主动 abort（signal）
  | 'unknown'           // 其他未分类故障

/**
 * VisionProvider 接口。
 *
 * 实现方（infrastructure/ai/qwen-vision-adapter.ts）负责：
 *   - 读取环境变量获取模型名/端点/Key
 *   - 硬超时 5 秒 + 最多一次受控重试
 *   - 原始响应通过 parseUIObservation 校验
 *
 * 调用方（application/observe-screen.ts）负责：
 *   - 传入已遮挡的截图
 *   - 传入 AbortSignal 供上层取消
 *   - 失败时进入 UNKNOWN 决策（不 fail-open）
 */
export interface VisionProvider {
  observe(
    input: RedactedScreenshot,
    signal: AbortSignal,
  ): Promise<VisionResult>
}
