import 'server-only'

/**
 * 控制台 Telemetry —— P0 最简单的审计后端。
 *
 * 方案 §11.1：每个决策生成 traceId，记录脱敏结构化事件。
 * 方案 §11.2：审计记录失败不得影响主流程。
 *
 * P0 用 console.log 输出 JSON 行（structured logging），
 * 生产环境可被容器日志收集器（如 Vercel）捕获。
 * 不引入外部日志后端依赖（方案 §2.3：不引入与 P0 无关的生产依赖）。
 *
 * 禁止记录（方案 §11.1）：原始文本、截图、OTP、密码、完整 prompt/response、API Key。
 * AuditEvent 结构本身已脱敏（只含 hash/长度/版本/决策类型）。
 */

import type { Telemetry, AuditEvent } from '../../application/ports/telemetry.ts'

export function createConsoleTelemetry(): Telemetry {
  return {
    record(event: AuditEvent): void {
      // 结构化 JSON 行，便于日志系统解析
      // 用 console.info 而非 console.log（生产环境 info 级别）
      console.info(JSON.stringify({ type: 'audit', ...event }))
    },
  }
}
