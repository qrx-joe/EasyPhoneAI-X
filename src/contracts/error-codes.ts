/**
 * 稳定错误码契约 —— 方案 §8.2。
 *
 * 错误响应不得包含堆栈、密钥、内部路径或模型原始输出。
 * 这些错误码是面向调用方的稳定协议，改名需走版本兼容。
 */

/**
 * 九个稳定错误码（方案 §8.2）。
 */
export const ERROR_CODES = {
  /** 请求参数非法（缺字段、格式错） */
  INVALID_INPUT: 'INVALID_INPUT',
  /** 提交截图但未带 consentId（方案 §8.1） */
  CONSENT_REQUIRED: 'CONSENT_REQUIRED',
  /** 截图超过大小限制 */
  IMAGE_TOO_LARGE: 'IMAGE_TOO_LARGE',
  /** 截图格式不支持 */
  UNSUPPORTED_IMAGE: 'UNSUPPORTED_IMAGE',
  /** 视觉请求超时（方案 §7.2 硬超时 5 秒） */
  VISION_TIMEOUT: 'VISION_TIMEOUT',
  /** 模型输出无法通过 Schema 校验（方案 §7.2） */
  INVALID_MODEL_OUTPUT: 'INVALID_MODEL_OUTPUT',
  /** 任务包状态机匹配失败（方案 §8.2） */
  TASK_STATE_NOT_FOUND: 'TASK_STATE_NOT_FOUND',
  /** 触发限流（方案 §11.2 故障分类） */
  RATE_LIMITED: 'RATE_LIMITED',
  /** 未分类内部错误（兜底，不泄露细节） */
  INTERNAL_ERROR: 'INTERNAL_ERROR',
} as const

export type ErrorCode = (typeof ERROR_CODES)[keyof typeof ERROR_CODES]

/**
 * 错误响应结构。
 *
 * 方案 §8.2：错误响应不得包含堆栈、密钥、内部路径或模型原始输出。
 * message 是面向用户的简短说明，不含技术细节。
 */
export interface ErrorResponse {
  readonly traceId: string
  readonly error: {
    readonly code: ErrorCode
    readonly message: string
  }
}
