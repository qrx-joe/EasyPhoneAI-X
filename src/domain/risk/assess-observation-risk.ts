import type { UIObservation } from '../../contracts/ui-observation.ts'
import { classifyRiskByRules } from './classify-risk.ts'
import type { RiskClassification } from './types.ts'

/**
 * 将 Vision 提取的可见事实交给同一套确定性风险规则。
 * 页面文本只能升级风险，不能决定路由、任务或具体按钮动作。
 */
export function assessObservationRisk(observation: UIObservation): RiskClassification {
  const visibleFacts = [
    observation.appId,
    observation.screenState,
    ...observation.elements.map((element) => element.label),
  ].join(' ')

  return classifyRiskByRules(visibleFacts)
}
