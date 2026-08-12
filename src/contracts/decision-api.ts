/**
 * 决策 API 契约 —— 方案 §8.1。
 *
 * P0 采用单次 multipart/form-data 请求，在一个请求内携带文本、上下文和可选截图，
 * 不建立对象存储。
 *
 * 服务端必须重新计算风险；客户端传入的风险等级、理由和关键词一律不可信。
 */

import type { GuidanceDecision } from './guidance-decision.ts'

/**
 * 客户端非权威提示（方案 §8.1 clientContext）。
 * 这些字段是辅助信息，服务端不得据此跳过风险重算。
 */
export interface ClientContext {
  /** App 提示（用户当前所在 App，非权威） */
  readonly appHint?: string
  /** 任务包版本提示（非权威，服务端以自己的版本为准） */
  readonly taskPackVersion?: string
}

/**
 * 决策请求（multipart/form-data 各字段，由 Route Handler 解析后传入）。
 *
 * 方案 §8.1 字段：
 *   - text:       用户文字或语音转写
 *   - locale:     默认 zh-CN
 *   - consentId:  提交截图时必填
 *   - screenshot: 可选，单张经过本地遮挡的图片（这里用已读取的字节 + 类型）
 *   - clientContext: 可选的非权威提示
 */
export interface DecisionRequest {
  readonly text: string
  readonly locale: string
  readonly consentId: string | null
  /** 截图字节（可选）。Route Handler 读取后传入，application 层不直接读文件。 */
  readonly screenshot: { readonly bytes: Uint8Array; readonly mime: string } | null
  readonly clientContext: ClientContext | null
}

/**
 * 决策响应结构（方案 §8.1）。
 */
export interface DecisionResponse {
  readonly traceId: string
  readonly decision: GuidanceDecision
  readonly policyVersion: string
  /** 模型版本（无截图或回放时为 null） */
  readonly modelVersion: string | null
}
