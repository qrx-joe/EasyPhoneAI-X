/**
 * 稳定错误码契约 —— 方案 §8.2。
 *
 * 错误码有两个出现位置，语义二选一、不混用：
 *   1. ErrorResponse.error.code —— 传输/参数层错误：请求无法解析成决策输入
 *      （缺字段、multipart 格式错、图片超限/格式不支持），返回 HTTP 4xx/5xx。
 *   2. UnsupportedDecision.reasonCode —— 决策级「不支持」：请求可解析、决策正常
 *      产出，但结果是「不支持」（空白文本、有截图缺 consentId、无匹配教程），
 *      返回 HTTP 200 + decision.kind = 'unsupported'，由 UI 温和渲染。
 * 同一个码出现在哪个位置由触发层决定：路由层解析失败 → 1；决策链内部判定 → 2。
 *
 * 错误响应不得包含堆栈、密钥、内部路径或模型原始输出。
 * 这些错误码是面向调用方的稳定协议，改名需走版本兼容。
 */

/**
 * 七个稳定错误码（方案 §8.2）。
 * 注：VISION_TIMEOUT / RATE_LIMITED 曾在方案里预留，但视觉超时实际走
 * clarify 决策（fail-closed）、限流未实现，为避免「看似有保障、实际未接线」
 * 已删除；真正接线时再走版本兼容加回。
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
  /** 模型输出无法通过 Schema 校验（方案 §7.2） */
  INVALID_MODEL_OUTPUT: 'INVALID_MODEL_OUTPUT',
  /** 任务包状态机匹配失败（方案 §8.2） */
  TASK_STATE_NOT_FOUND: 'TASK_STATE_NOT_FOUND',
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
