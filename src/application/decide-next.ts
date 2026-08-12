/**
 * decide-next 用例 —— 决策链编排（方案 §6.2 核心）。
 *
 * 决策顺序：
 *   输入校验
 *     -> 确定性风险规则
 *     -> 截图观察（可选）
 *     -> 风险结果取 MAX
 *     -> 任务包状态匹配
 *     -> Allowed Action 检查
 *     -> GuidanceDecision
 *
 * 安全不变量（方案 §6.2）：
 *   - 规则命中 high/critical 后，普通指导立即终止。
 *   - AI 只能维持或升级规则风险，不能降级（mergeRiskByMax 保证）。
 *   - 截图缺失、模糊、模型冲突、Schema 无效或任务状态不匹配时返回 unknown。
 *   - unknown 不得进入 guide。
 *   - 模型自由文本不得直接驱动页面跳转、自动操作或外部消息发送。
 *
 * 依赖方向：只依赖 domain + contracts + ports，不依赖 infrastructure。
 */

import { classifyRiskByRules } from '../domain/risk/classify-risk.ts'
import { assessObservationRisk } from '../domain/risk/assess-observation-risk.ts'
import { findTutorial, safeTutorialsFor } from '../domain/guidance/tutorial.ts'
import { createQuestion } from '../domain/question/question.ts'
import { buildHandoffCard } from '../domain/handoff/handoff-templates.ts'

import {
  mergeRiskByMax,
  RISK_POLICY_VERSION,
  type RiskAssessment,
} from '../contracts/risk-policy.ts'
import type {
  GuidanceDecision,
  GuideDecision,
  StopDecision,
  ClarifyDecision,
  UnsupportedDecision,
} from '../contracts/guidance-decision.ts'
import { ERROR_CODES } from '../contracts/error-codes.ts'

import type { VisionProvider, VisionFailure } from './ports/vision-provider.ts'
import type { Telemetry } from './ports/telemetry.ts'
import { observeScreen, type ObserveScreenResult } from './observe-screen.ts'

/**
 * decide-next 用例的输入。
 * 由 Route Handler 从 multipart 请求解析后传入。
 */
export interface DecideNextInput {
  readonly text: string
  readonly locale: string
  readonly consentId: string | null
  readonly screenshot: { readonly bytes: Uint8Array; readonly mime: string } | null
  readonly traceId: string
}

/**
 * decide-next 用例依赖注入（便于测试 mock）。
 */
export interface DecideNextDeps {
  readonly vision: VisionProvider | null
  readonly telemetry: Telemetry | null
  /** 模型版本（无截图时为 null） */
  readonly modelVersion: string | null
}

/**
 * decide-next 用例输出。
 *
 * decision 是 GuidanceDecision 联合类型（guide/stop/clarify/unsupported），
 * 调用方必须穷尽处理所有分支（方案 §6.1）。
 * stop 分支的求助卡通过 decision.handoff 获取（无需旁路字段）。
 */
export interface DecideNextOutput {
  readonly traceId: string
  readonly decision: GuidanceDecision
  readonly policyVersion: string
  readonly modelVersion: string | null
}

/**
 * 执行决策链。
 */
export async function decideNext(
  input: DecideNextInput,
  deps: DecideNextDeps,
): Promise<DecideNextOutput> {
  const startTime = Date.now()

  // ── 1. 输入校验 ──
  const trimmedText = input.text.trim()
  if (!trimmedText) {
    return finish(input, deps, startTime, {
      kind: 'unsupported',
      reasonCode: ERROR_CODES.INVALID_INPUT,
    }, null, 'rule_only')
  }

  // 有截图但无 consentId → 拒绝（方案 §8.1）
  if (input.screenshot !== null && !input.consentId) {
    return finish(input, deps, startTime, {
      kind: 'unsupported',
      reasonCode: ERROR_CODES.CONSENT_REQUIRED,
    }, null, 'rule_only')
  }

  // ── 2. 确定性风险规则（永远先跑，不可跳过）──
  const ruleClassification = classifyRiskByRules(trimmedText)
  const ruleAssessment: RiskAssessment = {
    level: ruleClassification.level,
    source: 'rule',
  }

  // ── 3. 截图观察（可选）──
  let observeResult: ObserveScreenResult = { kind: 'skipped' }
  if (input.screenshot !== null) {
    observeResult = deps.vision === null
      ? { kind: 'failed', reason: 'unknown' }
      : await observeScreen(input.screenshot, deps.vision)
  }

  // ── 4. 风险取 MAX ──
  const visionAssessment = extractVisionRisk(observeResult)
  const merged = mergeRiskByMax(ruleAssessment, visionAssessment)

  // ── 5. 高风险 → 立即终止，生成求助卡 ──
  // 安全不变量：规则命中 high/critical 后，普通指导立即终止。
  // 即使 vision 不可用，也必须显示风险停止页和求助卡（方案 §11.2）。
  //
  // 这里用字面量判断而非 shouldStopGuidance()，是为了让 TypeScript 把
  // merged.level 收窄为 'high' | 'critical'（StopDecision.risk 的类型要求）。
  // shouldStopGuidance 的逻辑与此等价，由测试和 safeTutorialsFor 间接覆盖。
  if (merged.level === 'high' || merged.level === 'critical') {
    const finalClassification = ruleClassification.level === merged.level
      ? ruleClassification
      : {
          level: merged.level,
          matchedKeywords: [],
          reason: merged.level === 'critical'
            ? '截图中出现了验证码、转账或远程操作等极高风险信息，请立即停止。'
            : '截图中出现了需要家人或官方渠道核实的高风险信息。',
        }
    const question = createQuestion(trimmedText, 'text', finalClassification)
    const handoff = buildHandoffCard(question)
    const stopDecision: StopDecision = {
      kind: 'stop',
      risk: merged.level,
      handoff,
    }
    return finish(input, deps, startTime, stopDecision, merged.level, 'rule_only')
  }

  // ── 6. 视觉失败但规则未命中高风险 → UNKNOWN（不 fail-open）──
  // 方案 §11.2：图片无法判断、模型输出冲突或安全状态不确定 → UNKNOWN。
  // 这是与旧项目 fail-open 的核心区别：技术故障不降级到低风险。
  if (observeResult.kind === 'failed') {
    const clarify: ClarifyDecision = {
      kind: 'clarify',
      risk: 'unknown',
      questions: buildClarifyQuestions(observeResult.reason),
    }
    return finish(input, deps, startTime, clarify, 'unknown', `vision_${observeResult.reason}`)
  }

  // ── 7. 任务包状态匹配（P0 用 tutorial 匹配替代完整状态机）──
  const tutorial = findTutorial(trimmedText)
  if (tutorial === null) {
    // 没有匹配的白名单教程 → unsupported
    return finish(input, deps, startTime, {
      kind: 'unsupported',
      reasonCode: ERROR_CODES.TASK_STATE_NOT_FOUND,
    }, merged.level, 'no_tutorial')
  }

  // 防御性过滤：即使前面过了，这里再卡一次（safeTutorialsFor 用 shouldStopGuidance）
  if (safeTutorialsFor(merged.level).length === 0) {
    return finish(input, deps, startTime, {
      kind: 'clarify',
      risk: 'unknown',
      questions: ['这种情况我不太确定,能再描述一下吗?'],
    }, 'unknown', 'safe_filter')
  }

  // ── 8. 低/中风险 + 有匹配教程 → guide ──
  // P0 阶段：返回教程第一步。第五阶段接入完整状态机后按任务包步骤推进。
  const firstStep = tutorial.steps[0]
  const guideDecision: GuideDecision = {
    kind: 'guide',
    risk: merged.level === 'medium' ? 'medium' : 'low',
    step: firstStep,
    successSignal: tutorial.title,
  }

  return finish(input, deps, startTime, guideDecision, merged.level, 'ok')
}

// ─────────────────────────────────────────────────────────────────────
// 内部辅助
// ─────────────────────────────────────────────────────────────────────

/**
 * 从视觉观察结果提取风险评估。
 * 成功且置信度够 → 提取；失败/低置信度 → 返回 null（由 mergeRiskByMax 处理）。
 */
function extractVisionRisk(observe: ObserveScreenResult): RiskAssessment | null {
  if (observe.kind !== 'ok') return null
  const classification = assessObservationRisk(observe.observation)
  return { level: classification.level, source: 'vision' }
}

/**
 * 根据视觉失败原因生成给用户的澄清问题。
 */
function buildClarifyQuestions(reason: VisionFailure): string[] {
  switch (reason) {
    case 'timeout':
      return ['网络有点慢,能再试一次吗?或者用打字告诉我']
    case 'low_confidence':
      return ['这张截图我没看清楚,能重新拍一张吗?']
    case 'unsupported_image':
      return ['这张图片我打不开,换个格式试试?或者用打字告诉我']
    case 'invalid_output':
    case 'aborted':
    case 'unknown':
    default:
      return ['我没看明白这个画面,能用文字描述一下吗?']
  }
}

/**
 * 统一构造结果 + 记录审计事件。
 *
 * decision 是完整的 GuidanceDecision（含 stop 分支）。
 * riskLevel 用于审计（stop 时是 high/critical，clarify 时是 unknown，等）。
 */
function finish(
  input: DecideNextInput,
  deps: DecideNextDeps,
  startTime: number,
  decision: GuidanceDecision,
  riskLevel: string | null,
  fallback: string,
): DecideNextOutput {
  const durationMs = Date.now() - startTime

  // 记录审计事件（失败不影响主流程）
  if (deps.telemetry !== null) {
    try {
      deps.telemetry.record({
        traceId: input.traceId,
        eventType: 'decision',
        policyVersion: RISK_POLICY_VERSION,
        taskPackVersion: null,
        modelVersion: deps.modelVersion,
        inputHash: hashText(input.text),
        inputLength: input.text.length,
        hasScreenshot: input.screenshot !== null,
        decisionKind: decision.kind,
        reasonCode: decision.kind === 'unsupported' ? decision.reasonCode : null,
        riskLevel: riskLevel ?? 'unknown',
        durationMs,
        fallback,
      })
    } catch {
      // 审计失败不影响决策返回（方案 §11.2：分享 API 故障不影响风险停止结果）
    }
  }

  return {
    traceId: input.traceId,
    decision,
    policyVersion: RISK_POLICY_VERSION,
    modelVersion: deps.modelVersion,
  }
}

/**
 * 简单 hash（用于审计日志的输入指纹，非加密用途）。
 * FNV-1a 变体，足够区分不同输入即可。
 */
function hashText(text: string): string {
  let hash = 0x811c9dc5
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i)
    hash = (hash * 0x01000193) >>> 0
  }
  return hash.toString(16).padStart(8, '0')
}
