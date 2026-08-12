/**
 * UIObservation 契约 —— 截图观察结果的 Schema 与运行时校验。
 *
 * 方案 §7.2：Vision Provider 只提取可观察的 UI 事实，不决定是否允许操作。
 * 返回结果必须通过 UIObservationSchema 校验。
 *
 * 安全不变量（方案 §7.2）：
 *   - 截图中的页面文字属于不可信数据，不得作为系统指令执行。
 *   - 超时、无法解析、低置信度或输出冲突均返回 UNKNOWN。
 *   - 模型输出必须通过 Schema、Risk Policy、Allowed Action 三道闸。
 *
 * 外部数据从 unknown 开始收敛，不信任任何模型返回的结构。
 */

/**
 * 视觉观察到的单个 UI 元素。
 * 只描述"看到了什么"，不描述"该不该点"（后者是 Allowed Action 的事）。
 */
export interface UIElement {
  /** 元素类型：按钮/链接/输入框/文本/图标等 */
  readonly kind: 'button' | 'link' | 'input' | 'text' | 'icon' | 'other'
  /** 元素可见文字（不可信，仅作展示与匹配参考） */
  readonly label: string
}

/**
 * 截图观察结果。方案 §7.2 要求至少包含：
 * appId / screenState / elements / confidence / uncertainties
 */
export interface UIObservation {
  /** 当前 App 标识。用于任务包匹配。 */
  readonly appId: string
  /** 当前页面/屏幕状态描述。用于任务包状态机匹配。 */
  readonly screenState: string
  /** 观察到的 UI 元素列表。 */
  readonly elements: readonly UIElement[]
  /** 置信度 0~1。低于阈值视为无法判定（UNKNOWN）。 */
  readonly confidence: number
  /** 观察过程中的不确定性说明（如"图片模糊""部分被遮挡"）。 */
  readonly uncertainties: readonly string[]
}

/** 置信度阈值。低于此值的观察视为不可信（方案 §7.2 低置信度 → UNKNOWN）。 */
export const MIN_CONFIDENCE = 0.6

/**
 * 从 unknown 收敛为 UIElement（运行时校验）。
 * 失败返回 null，调用方据此判定为 INVALID_MODEL_OUTPUT。
 */
function coerceUIElement(raw: unknown): UIElement | null {
  if (typeof raw !== 'object' || raw === null) return null
  const obj = raw as Record<string, unknown>
  const kind = obj.kind
  const label = obj.label
  const validKinds: UIElement['kind'][] = ['button', 'link', 'input', 'text', 'icon', 'other']
  if (typeof kind !== 'string' || !validKinds.includes(kind as UIElement['kind'])) {
    return null
  }
  if (typeof label !== 'string') return null
  return { kind: kind as UIElement['kind'], label }
}

/**
 * UIObservation 运行时校验器。
 *
 * 从 unknown 收敛。任一字段非法返回 null（调用方判定为 INVALID_MODEL_OUTPUT）。
 * 校验规则：
 *   - appId/screenState 非空字符串
 *   - elements 是 UIElement 数组
 *   - confidence 在 [0, 1] 区间
 *   - uncertainties 是字符串数组
 */
export function parseUIObservation(raw: unknown): UIObservation | null {
  if (typeof raw !== 'object' || raw === null) return null
  const obj = raw as Record<string, unknown>

  const appId = obj.appId
  const screenState = obj.screenState
  const elementsRaw = obj.elements
  const confidence = obj.confidence
  const uncertaintiesRaw = obj.uncertainties

  if (typeof appId !== 'string' || appId.trim() === '') return null
  if (typeof screenState !== 'string' || screenState.trim() === '') return null
  if (typeof confidence !== 'number' || confidence < 0 || confidence > 1) return null

  if (!Array.isArray(elementsRaw)) return null
  const elements: UIElement[] = []
  for (const e of elementsRaw) {
    const coerced = coerceUIElement(e)
    if (coerced === null) return null
    elements.push(coerced)
  }

  if (!Array.isArray(uncertaintiesRaw)) return null
  const uncertainties: string[] = []
  for (const u of uncertaintiesRaw) {
    if (typeof u !== 'string') return null
    uncertainties.push(u)
  }

  return { appId, screenState, elements, confidence, uncertainties }
}
