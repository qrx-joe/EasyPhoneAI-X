/**
 * Telemetry 端口 —— 脱敏结构化事件的抽象接口。
 *
 * 方案 §11.1 审计事件：每个决策生成 traceId，记录：
 *   - 事件类型
 *   - 策略、任务包和模型版本
 *   - 输入 hash 与长度
 *   - 决策结果和 reasonCode
 *   - 延迟与 fallback 状态
 *
 * 禁止记录（方案 §11.1）：
 *   - 原始文本和原始截图
 *   - OTP、银行卡号、支付密码和身份证号
 *   - 完整 prompt/response
 *   - API Key、Cookie 或其他凭据
 *
 * application 层只依赖这个接口；第四阶段在 infrastructure/telemetry/ 实现具体后端。
 */

/**
 * 审计事件结构。所有字段都已脱敏。
 */
export interface AuditEvent {
  readonly traceId: string
  /** 事件类型（如 'decision'/'vision'/'handoff'） */
  readonly eventType: string
  /** 策略版本 */
  readonly policyVersion: string
  /** 任务包版本（无匹配时为 null） */
  readonly taskPackVersion: string | null
  /** 模型版本（无截图时为 null） */
  readonly modelVersion: string | null
  /** 输入文本的 hash（不记录原文） */
  readonly inputHash: string
  /** 输入文本长度 */
  readonly inputLength: number
  /** 是否包含截图 */
  readonly hasScreenshot: boolean
  /** 决策结果 kind（guide/stop/clarify/unsupported） */
  readonly decisionKind: string
  /** reasonCode（unsupported 时有值） */
  readonly reasonCode: string | null
  /** 风险等级（unknown 决策时为 'unknown'） */
  readonly riskLevel: string
  /** 处理延迟（毫秒） */
  readonly durationMs: number
  /** fallback 状态（如 'rule_only'/'vision_failed'/'ok'） */
  readonly fallback: string
}

/**
 * Telemetry 接口。
 *
 * 实现方负责把 AuditEvent 写到安全的日志后端。
 * 记录失败不得影响主流程（决策必须先返回给用户）。
 */
export interface Telemetry {
  record(event: AuditEvent): void
}
