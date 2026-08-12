/**
 * 脱敏视觉 fixtures —— 方案 §7.3。
 *
 * 固定的脱敏样例，覆盖三条比赛路径和故障路径。
 * 用于离线回归、状态机验证和无网络时的演示兜底。
 *
 * 证据口径（方案 §7.3 + §15）：
 *   - 回放演示必须标注为固定样例，不得描述为实时模型结果。
 *   - 这些是人工构造的脱敏数据，不是真实模型输出。
 *   - 真实 Qwen 调用、固定回放、代码推导图分别保存证据标签。
 *
 * 三条比赛路径（方案 §2.2）：
 *   1. 低风险：微信通话（一步指导）
 *   2. 中风险：电商退款（已审核步骤 + 升级）
 *   3. 高风险：屏幕共享/验证码/转账（直接停止）
 * 故障路径：模糊截图、错误 App、Prompt Injection、低置信度。
 */

import type { UIObservation } from '../../src/contracts/ui-observation.ts'

/**
 * 单个 fixture。label 是证据标签，标注它是固定回放样例。
 */
export interface VisionFixture {
  /** 证据标签（方案 §7.3：固定回放样例） */
  readonly label: string
  /** 对应的比赛路径或故障类型 */
  readonly scenario: string
  /** 预期的观察结果 */
  readonly observation: UIObservation
}

export const VISION_FIXTURES: readonly VisionFixture[] = Object.freeze([
  // ─── 路径 1：低风险（微信通话设置页）───
  {
    label: '[固定回放样例] 微信通知设置页',
    scenario: 'low-risk-wechat-call',
    observation: {
      appId: 'com.tencent.mm',
      screenState: 'wechat_settings_chat',
      elements: [
        { kind: 'text', label: '新消息通知' },
        { kind: 'button', label: '新消息通知' },
        { kind: 'text', label: '语音和视频通话提醒' },
        { kind: 'button', label: '语音和视频通话提醒' },
      ],
      confidence: 0.88,
      uncertainties: [],
    },
  },

  // ─── 路径 2：中风险（电商退款页，含升级信号）───
  {
    label: '[固定回放样例] 电商退款页面',
    scenario: 'medium-risk-refund',
    observation: {
      appId: 'com.example.shop',
      screenState: 'order_refund',
      elements: [
        { kind: 'text', label: '申请退款' },
        { kind: 'button', label: '提交申请' },
        { kind: 'text', label: '退款金额：￥199' },
      ],
      confidence: 0.82,
      uncertainties: ['页面底部部分被遮挡'],
    },
  },

  // ─── 路径 3：高风险（支付/转账页）───
  {
    label: '[固定回放样例] 银行转账确认页',
    scenario: 'high-risk-transfer',
    observation: {
      appId: 'com.bank.app',
      screenState: 'transfer_confirm',
      elements: [
        { kind: 'input', label: '转账金额' },
        { kind: 'input', label: '支付密码' },
        { kind: 'button', label: '确认转账' },
      ],
      confidence: 0.91,
      uncertainties: [],
    },
  },

  // ─── 故障路径：低置信度（模糊截图）───
  {
    label: '[固定回放样例] 模糊截图（低置信度）',
    scenario: 'failure-blurry',
    observation: {
      appId: 'unknown',
      screenState: 'unknown',
      elements: [],
      confidence: 0.2,
      uncertainties: ['图片严重模糊，无法识别内容', '可能是截图时手机移动了'],
    },
  },
])

/**
 * 创建一个回放用 VisionProvider，从 fixtures 里按 scenario 返回预设观察。
 *
 * 用于：离线回归测试、无网络演示、E2E。
 * 不得用于冒充真实模型调用（方案 §7.3）。
 */
export function createFixtureVisionProvider(
  fixtures: readonly VisionFixture[],
  scenario: string,
): import('../../src/application/ports/vision-provider.ts').VisionProvider {
  const fixture = fixtures.find((f) => f.scenario === scenario)
  return {
    async observe() {
      if (!fixture) {
        return { ok: false, reason: 'unknown' as const }
      }
      return { ok: true, observation: fixture.observation }
    },
  }
}
