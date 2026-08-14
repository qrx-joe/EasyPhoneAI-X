import { NextRequest, NextResponse } from 'next/server'

import { advanceStep } from '@/application/advance-step'
import { ERROR_CODES, type ErrorResponse } from '@/contracts/error-codes'
import type { StepAdvanceResponse } from '@/contracts/step-api'
import { RISK_POLICY_VERSION } from '@/contracts/risk-policy'
import { randomUUID } from 'node:crypto'

/**
 * POST /api/v2/step/advance —— 教程步骤推进（无障碍教练方案 阶段 A-2）。
 *
 * 请求体：{ "stateId": "..." } —— 只有 opaque 会话 id，没有索引、没有教程 id。
 * 推进前服务端重跑风险检查；会话不存在返回 session_lost（客户端安全回到重新描述）。
 *
 * 错误响应语义（与 error-codes.ts 契约一致）：本路由只产 ErrorResponse
 * 用于参数层错误（缺 stateId / 非 JSON）；session_lost 是正常业务结果，走 200。
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  const traceId = randomUUID()

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return errorResponse(traceId, ERROR_CODES.INVALID_INPUT, '请求格式不对，需要 JSON')
  }

  const stateId = (body as { stateId?: unknown } | null)?.stateId
  if (typeof stateId !== 'string' || !stateId.trim()) {
    return errorResponse(traceId, ERROR_CODES.INVALID_INPUT, '缺少 stateId 字段')
  }

  const result = advanceStep({ stateId: stateId.trim() })

  const response: StepAdvanceResponse = {
    traceId,
    result,
    policyVersion: RISK_POLICY_VERSION,
  }
  return NextResponse.json(response)
}

function errorResponse(traceId: string, code: typeof ERROR_CODES[keyof typeof ERROR_CODES], message: string): NextResponse {
  const body: ErrorResponse = {
    traceId,
    error: { code, message },
  }
  return NextResponse.json(body, { status: 400 })
}
