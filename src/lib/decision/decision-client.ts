import type { DecisionResponse } from '../../contracts/decision-api.ts'
import type { ErrorResponse } from '../../contracts/error-codes.ts'

export interface SubmitDecisionInput {
  readonly text: string
  readonly screenshot?: Blob
  readonly consentId?: string
  readonly signal?: AbortSignal
}

export class DecisionClientError extends Error {
  readonly code: string
  readonly traceId: string | null

  constructor(message: string, code = 'NETWORK_ERROR', traceId: string | null = null) {
    super(message)
    this.name = 'DecisionClientError'
    this.code = code
    this.traceId = traceId
  }
}

/**
 * 调用正式决策 API。客户端只提交事实，不提交风险等级或路由结果。
 */
export async function submitDecision(
  input: SubmitDecisionInput,
  fetcher: typeof fetch = fetch,
): Promise<DecisionResponse> {
  const text = input.text.trim()
  if (!text) {
    throw new DecisionClientError('请先说说遇到了什么问题', 'INVALID_INPUT')
  }

  const form = new FormData()
  form.set('text', text)
  form.set('locale', 'zh-CN')

  if (input.screenshot) {
    if (!input.consentId) {
      throw new DecisionClientError('请先确认截图使用说明', 'CONSENT_REQUIRED')
    }
    form.set('consentId', input.consentId)
    form.set('screenshot', input.screenshot, 'redacted-screenshot.png')
  }

  let response: Response
  try {
    response = await fetcher('/api/v2/decision', {
      method: 'POST',
      body: form,
      signal: input.signal,
    })
  } catch (error) {
    if (input.signal?.aborted) {
      throw new DecisionClientError('请求已取消', 'ABORTED')
    }
    throw new DecisionClientError('网络连接失败，请重试或改用文字描述')
  }

  const body: unknown = await response.json().catch(() => null)
  if (!response.ok) {
    const parsedError = parseErrorResponse(body)
    throw new DecisionClientError(
      parsedError?.error.message ?? '系统暂时没有回应，请稍后重试',
      parsedError?.error.code ?? 'INTERNAL_ERROR',
      parsedError?.traceId ?? null,
    )
  }

  const parsed = parseDecisionResponse(body)
  if (parsed === null) {
    throw new DecisionClientError('系统返回了无法识别的结果，请重试', 'INVALID_RESPONSE')
  }
  return parsed
}

export function parseDecisionResponse(raw: unknown): DecisionResponse | null {
  if (!isRecord(raw)) return null
  if (typeof raw.traceId !== 'string' || typeof raw.policyVersion !== 'string') return null
  if (!(typeof raw.modelVersion === 'string' || raw.modelVersion === null)) return null
  if (!isRecord(raw.decision) || typeof raw.decision.kind !== 'string') return null

  const decision = raw.decision
  switch (decision.kind) {
    case 'guide':
      if ((decision.risk !== 'low' && decision.risk !== 'medium') || !isTutorialStep(decision.step)) return null
      if (typeof decision.successSignal !== 'string') return null
      break
    case 'stop':
      if ((decision.risk !== 'high' && decision.risk !== 'critical') || !isHandoffCard(decision.handoff)) return null
      break
    case 'clarify':
      if (decision.risk !== 'unknown' || !isStringArray(decision.questions)) return null
      break
    case 'unsupported':
      if (typeof decision.reasonCode !== 'string') return null
      break
    default:
      return null
  }

  return raw as unknown as DecisionResponse
}

function parseErrorResponse(raw: unknown): ErrorResponse | null {
  if (!isRecord(raw) || typeof raw.traceId !== 'string' || !isRecord(raw.error)) return null
  if (typeof raw.error.code !== 'string' || typeof raw.error.message !== 'string') return null
  return raw as unknown as ErrorResponse
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string')
}

function isTutorialStep(value: unknown): boolean {
  if (!isRecord(value)) return false
  return typeof value.id === 'string'
    && typeof value.title === 'string'
    && typeof value.instruction === 'string'
    && (value.alternative === undefined || typeof value.alternative === 'string')
}

function isHandoffCard(value: unknown): boolean {
  if (!isRecord(value)) return false
  return typeof value.id === 'string'
    && typeof value.summary === 'string'
    && isStringArray(value.suggestions)
    && typeof value.createdAt === 'string'
}
