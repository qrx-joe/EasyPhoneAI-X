import { NextRequest, NextResponse } from 'next/server'

import { decideNext } from '@/application/decide-next'
import { loadQwenConfigFromEnv, createQwenVisionProvider } from '@/infrastructure/ai/qwen-vision-adapter'
import { createConsoleTelemetry } from '@/infrastructure/telemetry/console-telemetry'
import { ERROR_CODES, type ErrorResponse } from '@/contracts/error-codes'
import type { DecisionResponse } from '@/contracts/decision-api'
import { randomUUID } from 'node:crypto'

/**
 * POST /api/v2/decision —— 方案 §8.1 决策 API。
 *
 * P0 单次 multipart/form-data 请求，一个请求内携带文本 + 可选截图。
 * 服务端必须重新计算风险；客户端传入的风险等级一律不可信。
 *
 * 错误响应语义（与 error-codes.ts 契约一致）：
 *   - 本路由只产 ErrorResponse（HTTP 4xx/5xx），用于「请求无法解析成决策输入」的
 *     传输/参数层错误（缺字段、multipart 格式错、图片超限/格式不支持）。
 *   - 决策级「不支持」（空白文本、缺 consentId、无匹配教程）由 decideNext 以
 *     HTTP 200 + decision.kind='unsupported' + reasonCode 返回，UI 温和渲染。
 *
 * 错误响应不含堆栈、密钥、模型原始输出（方案 §8.2）。
 */

/** 截图大小上限 4MB（方案 §8.2 IMAGE_TOO_LARGE） */
const MAX_IMAGE_BYTES = 4 * 1024 * 1024

/** 允许的图片 MIME */
const ALLOWED_IMAGE_MIMES = ['image/png', 'image/jpeg', 'image/webp']

export async function POST(request: NextRequest): Promise<NextResponse> {
  const traceId = randomUUID()

  let formData: FormData
  try {
    formData = await request.formData()
  } catch {
    return errorResponse(traceId, ERROR_CODES.INVALID_INPUT, '请求格式不对，需要 multipart/form-data')
  }

  // ── 解析字段 ──
  const text = formData.get('text')
  const locale = formData.get('locale')
  const consentId = formData.get('consentId')
  const screenshotFile = formData.get('screenshot')

  if (typeof text !== 'string') {
    return errorResponse(traceId, ERROR_CODES.INVALID_INPUT, '缺少 text 字段')
  }

  // ── 截图处理 ──
  let screenshot: { bytes: Uint8Array; mime: string } | null = null
  if (screenshotFile !== null && screenshotFile instanceof File) {
    if (screenshotFile.size > MAX_IMAGE_BYTES) {
      return errorResponse(traceId, ERROR_CODES.IMAGE_TOO_LARGE, '图片太大了，最大 4MB')
    }
    const mime = screenshotFile.type
    if (!ALLOWED_IMAGE_MIMES.includes(mime)) {
      return errorResponse(traceId, ERROR_CODES.UNSUPPORTED_IMAGE, '只支持 PNG、JPG、WebP')
    }
    const arrayBuffer = await screenshotFile.arrayBuffer()
    screenshot = { bytes: new Uint8Array(arrayBuffer), mime }
  }

  // ── 组装依赖 ──
  const qwenConfig = loadQwenConfigFromEnv()
  const vision = qwenConfig ? createQwenVisionProvider(qwenConfig) : null
  const telemetry = createConsoleTelemetry()

  // ── 决策 ──
  try {
    const result = await decideNext(
      {
        text,
        locale: typeof locale === 'string' ? locale : 'zh-CN',
        consentId: typeof consentId === 'string' ? consentId : null,
        screenshot,
        traceId,
      },
      {
        vision,
        telemetry,
        modelVersion: qwenConfig?.model ?? null,
      },
    )

    const response: DecisionResponse = {
      traceId: result.traceId,
      decision: result.decision,
      policyVersion: result.policyVersion,
      modelVersion: result.modelVersion,
    }
    return NextResponse.json(response)
  } catch {
    // 不泄漏堆栈/内部路径（方案 §8.2）
    return errorResponse(traceId, ERROR_CODES.INTERNAL_ERROR, '出了点问题，请重试')
  }
}

function errorResponse(traceId: string, code: typeof ERROR_CODES[keyof typeof ERROR_CODES], message: string): NextResponse {
  const body: ErrorResponse = {
    traceId,
    error: { code, message },
  }
  return NextResponse.json(body, { status: statusForCode(code) })
}

function statusForCode(code: string): number {
  switch (code) {
    case ERROR_CODES.INVALID_INPUT:
    case ERROR_CODES.CONSENT_REQUIRED:
    case ERROR_CODES.IMAGE_TOO_LARGE:
    case ERROR_CODES.UNSUPPORTED_IMAGE:
      return 400
    default:
      return 500
  }
}
