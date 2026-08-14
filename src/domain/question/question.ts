/**
 * 用户提出的一次问题（已分类快照）。
 *
 * 设计原则：
 * 1. 风险是 QuestionRecord 的内在属性，不是后加的修饰。
 *    一旦被记为 QuestionRecord，意味着它已经过了 classifyRiskByRules。
 *    还没分类的「原始输入」应该用 string，别用这个类型。
 * 2. text 不允许空字符串 —— 由工厂函数在边界强制。
 * 3. 字段全 readonly，避免外部代码偷偷改 ID 或时间戳。
 * 4. createdAt 用 ISO 8601 字符串（序列化安全）。
 */

import type { RiskClassification } from '../risk/types.ts'

/** 问题来源。后续要扩字段（语音时长等）再开新接口。 */
export type QuestionSource = 'voice' | 'text' | 'demo'

export interface QuestionRecord {
  readonly id: string
  /** 脱敏后的回显文本（连续 4+ 位数字已隐藏，方案 §10.1 数据最小化）。 */
  readonly text: string
  readonly source: QuestionSource
  readonly risk: RiskClassification
  readonly createdAt: string
}

// ─────────────────────────────────────────────────────────────────────
// 工厂
// ─────────────────────────────────────────────────────────────────────

let counter = 0

/**
 * 生成单调递增的 ID。时间戳保唯一性，counter 避免同一毫秒内多次调用冲突。
 */
function genId(): string {
  counter += 1
  return `q-${Date.now().toString(36)}-${counter.toString(36)}`
}

/**
 * 工厂函数：把「原始输入 + 来源 + 已分类的风险」打包成 QuestionRecord。
 *
 * 抛错而不是返回 null —— 这是安全相关的数据结构，「建了一个残缺的 QuestionRecord」
 * 是比抛错更糟糕的失败模式。
 *
 * 数据最小化（方案 §10.1）：text 在这里做数字脱敏 —— 连续 4 位及以上数字
 * （含全角、以及空格/短横线分隔的分组，即手机号/验证码/卡号/证件号形态）
 * 整体替换为「[数字已隐藏]」。老人可能把验证码、卡号原样敲进输入框，
 * QuestionRecord 会随求助卡和 API 响应离开决策链，不得携带这些内容。
 * 注意：风险分类和教程匹配都在工厂之前、用原始文本跑，脱敏不影响判断。
 *
 * @param text   用户原始输入。空白会被 trim，敏感数字会被隐藏。
 * @param source 输入来源。
 * @param risk   必填，调用方必须先跑 classifyRiskByRules。
 */

/** 疑似验证码/手机号/卡号：4 位以上连续数字（含全角），或以空格、短横线分隔的多个 4+ 位分组。 */
const SENSITIVE_NUMBER_PATTERN = /[0-9０-９]{4,}(?:[ \-–—][0-9０-９]{4,})*/g

/** 数字脱敏：整体替换，不保留任何数字片段。 */
function maskSensitiveNumbers(text: string): string {
  return text.replace(SENSITIVE_NUMBER_PATTERN, '[数字已隐藏]')
}

export function createQuestion(
  text: string,
  source: QuestionSource,
  risk: RiskClassification,
): QuestionRecord {
  const trimmed = text.trim()
  if (!trimmed) {
    throw new Error('createQuestion: text 不能为空')
  }
  return Object.freeze({
    id: genId(),
    text: maskSensitiveNumbers(trimmed),
    source,
    risk,
    createdAt: new Date().toISOString(),
  })
}
