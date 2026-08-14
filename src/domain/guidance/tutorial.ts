/**
 * 教程领域 —— 类型 + 匹配函数 + 首批教程库（白名单）。
 *
 * 设计原则：
 * 1. 白名单教程优先 —— 教程步骤必须由人工维护，AI 不自由编造。
 * 2. 教程是数据，不是组件 —— 步骤里只有 title + instruction 文本，
 *    按钮状态放 UI 层。
 * 3. 匹配靠 keyword 子串，不靠正则。
 * 4. 首个匹配的教程生效 —— 教程库按特异性排序，更具体的放前面。
 */

import { RISK_RANK, shouldStopGuidance, type RiskLevel } from '../risk/types.ts'
import { normalizeInput } from '../text/normalize.ts'

// ─────────────────────────────────────────────────────────────────────
// 类型
// ─────────────────────────────────────────────────────────────────────

/**
 * 教程涉及的 App。
 * UI 层按这个字段渲染「App 磁贴图标」——老人认 App 靠桌面图标的颜色块。
 * 'system' = 手机系统设置。
 */
export type TutorialApp = 'wechat' | 'sms' | 'whatsapp' | 'system' | 'ecommerce'

/**
 * 单个教程步骤。
 *
 * - title:       5-10 字，告诉老人「这一步要做什么」。
 * - instruction: 1-2 句，具体到按钮/菜单名称。
 * - alternative: 替代表达（可选）。老人点了「没看到」时展示 —— 用另一种说法解释同一操作。
 * - successSignal: 做完这一步用户能看到/听到的页面变化（人工逐步审核）。
 *   必须是可观察的页面状态（如「页面出现『账号与安全』设置项」），
 *   禁止用「问题解决了」这类不可验证结果替代（无障碍教练方案 阶段 A-3）。
 *
 * alternative 放数据层不放 UI state：它是教学内容，跟 instruction 同源、跟 step 强绑定，
 * 聚合反而更内聚；放 UI state 会导致每个客户端组件各自维护副本（冗余）。
 */
export interface TutorialStep {
  readonly id: string
  readonly title: string
  readonly instruction: string
  readonly alternative?: string
  readonly successSignal: string
}

export interface Tutorial {
  readonly id: string
  /** 给 UI 渲染的标题，如「让微信声音回来」 */
  readonly title: string
  /** 教程涉及的 App（可选）。UI 层按它渲染 App 磁贴图标。 */
  readonly app?: TutorialApp
  /**
   * 匹配关键词（小写）。任一关键词 includes 命中即匹配。
   * 多关键词覆盖同义词（「微信没声音」「微信没有声音」「微信声音没了」）。
   */
  readonly matchKeywords: readonly string[]
  /**
   * 该教程能服务的最高风险等级。
   * 输入的风险等级高于 maxLevel 时，即使匹配上也不展示该教程
   * （必须走风险确认/求助路径，见 tutorialAllowsRisk）。
   */
  readonly maxLevel: RiskLevel
  readonly steps: readonly TutorialStep[]
}

// ─────────────────────────────────────────────────────────────────────
// 匹配函数
// ─────────────────────────────────────────────────────────────────────

/**
 * 从一段用户输入找到最合适的教程。
 *
 * 返回 null 的语义：不是 bug，是设计。意味着这段输入不应该进分步指导。
 * 教程特异性排序：keywords 数量越多越具体，排前面；同数量按数组顺序。
 */
export function findTutorial(text: string): Tutorial | null {
  const normalized = normalizeInput(text)
  if (!normalized) return null

  // 按关键词数量倒序 —— 关键词多的更具体
  const sorted = [...TUTORIALS].sort(
    (a, b) => b.matchKeywords.length - a.matchKeywords.length,
  )

  for (const tut of sorted) {
    if (tut.matchKeywords.some((kw) => normalized.includes(kw))) {
      return tut
    }
  }
  return null
}

/**
 * maxLevel 硬校验：教程能否服务该风险等级的输入。
 *
 * 两条规则（安全核心，不可绕过）：
 * 1. high/critical 输入一律不进教程（shouldStopGuidance）；
 *    教程自身声明 maxLevel 为 high/critical 属于库配置错误，同样一律不给。
 * 2. 输入风险等级高于教程 maxLevel 时不给教程 ——
 *    「微信没声音 + 对方问手机号」（medium）不能被 maxLevel=low 的教程吞掉。
 */
export function tutorialAllowsRisk(tutorial: Tutorial, level: RiskLevel): boolean {
  if (shouldStopGuidance(level)) return false
  if (shouldStopGuidance(tutorial.maxLevel)) return false
  return RISK_RANK[level] <= RISK_RANK[tutorial.maxLevel]
}

/**
 * 给定风险等级，过滤出可以展示的教程（防御性过滤，避免 UI 误调）。
 *
 * 在 shouldStopGuidance 之外，同时执行 maxLevel 校验：
 * medium 输入只能拿到 maxLevel >= medium 的教程。
 */
export function safeTutorialsFor(level: RiskLevel): readonly Tutorial[] {
  return TUTORIALS.filter((t) => tutorialAllowsRisk(t, level))
}

// ─────────────────────────────────────────────────────────────────────
// 教程库。新增内容必须经过人工审核和安全回归。
// ─────────────────────────────────────────────────────────────────────

const TUTORIAL_WEIXIN_NO_SOUND: Tutorial = {
  id: 'wechat-no-sound',
  title: '让微信声音回来',
  app: 'wechat',
  matchKeywords: [
    '微信没有声音',
    '微信没声音',
    '微信没声',
    '微信没有声音了',
    '微信没声音了',
    // 英文说法：年轻人帮忙时可能用
    'wechat',
    'weixin',
  ],
  maxLevel: 'low',
  steps: [
    {
      id: 'wechat-no-sound-1',
      title: '打开微信',
      instruction: '在桌面上找到绿色的微信图标,点一下。',
      alternative:
        '退回到手机最开始的页面(就是显示时间的那一页),然后找绿色方块图标,上面写着「微信」。',
      successSignal: '屏幕变成微信的聊天列表,能看到最近聊过的人',
    },
    {
      id: 'wechat-no-sound-2',
      title: '点右下角「我」',
      instruction: '微信最下面有一排按钮,最右边那个写着「我」。',
      alternative: '看微信屏幕最下面一行,有「微信」「通讯录」「发现」「我」,点最右边的「我」。',
      successSignal: '页面最上面变成你的头像和名字',
    },
    {
      id: 'wechat-no-sound-3',
      title: '点「设置」',
      instruction: '在「我」的页面里,往下滑,找到「设置」两个字,点一下。',
      alternative: '「我」的页面最上面是头像和名字,中间是各种功能,最下面能找到「设置」,点它。',
      successSignal: '出现「账号与安全」「通用」这样一排设置项',
    },
    {
      id: 'wechat-no-sound-4',
      title: '点「聊天」',
      instruction: '在「设置」里,找到「聊天」两个字,点一下。',
      alternative: '「设置」页面前几项是「账号与安全」「通用」「聊天」「隐私」之类,点「聊天」。',
      successSignal: '进入聊天设置,能看到「新消息通知」这一项',
    },
    {
      id: 'wechat-no-sound-5',
      title: '打开「通知」和「声音」',
      instruction:
        '在「聊天」里,找到「新消息通知」「语音和视频通话提醒」两项,后面的开关都打开。',
      alternative:
        '「聊天」里有「新消息通知」「语音和视频通话提醒」,每一项右边有个开关,点一下变成绿色就是打开了。',
      successSignal: '每一项右边的开关都变成绿色打开的样子',
    },
  ],
}

const TUTORIAL_FONT_TOO_SMALL: Tutorial = {
  id: 'font-too-small',
  title: '把手机字变大',
  app: 'system',
  matchKeywords: [
    '手机字太小',
    '字太小',
    '字体太小',
    '字太小看不清',
    '看不清字',
  ],
  maxLevel: 'low',
  steps: [
    {
      id: 'font-too-small-1',
      title: '打开手机的「设置」',
      instruction: '在桌面上找齿轮形状的图标,叫「设置」,点一下。',
      alternative: '退回到手机首页,往四周找,有个齿轮形状的图标,就是「设置」。',
      successSignal: '看到「WLAN」「蓝牙」这样一排设置项',
    },
    {
      id: 'font-too-small-2',
      title: '找「显示」',
      instruction:
        '在「设置」里找「显示」或「显示与亮度」,点进去。每个手机名字可能稍有不同。',
      alternative: '「设置」里有一项叫「显示」或者「壁纸与显示」,点进去。',
      successSignal: '进入显示设置,能看到「亮度」「字体大小」等选项',
    },
    {
      id: 'font-too-small-3',
      title: '找「字体大小」',
      instruction:
        '在「显示」里往下找,找到「字体大小」或「文字大小」,点进去。',
      alternative:
        '在「显示」里往下找,会有「字体大小」或「显示大小」,点进去。',
      successSignal: '看到一行从小到大的示例字和下面的滑块',
    },
    {
      id: 'font-too-small-4',
      title: '把滑块拉到最大',
      instruction: '页面下方有一个小滑块,把它从左拉到最右边,字就会变大了。',
      alternative: '下面有个拉条,把它从左拉到最右,或者点右边的「A 大」「A 最大」按钮,字就变大了。',
      successSignal: '示例字跟着滑块明显变大了',
    },
  ],
}

const TUTORIAL_ECOMMERCE_REFUND: Tutorial = {
  id: 'ecommerce-refund',
  title: '从订单页申请退款',
  app: 'ecommerce',
  matchKeywords: [
    '淘宝退款',
    '淘宝退货',
    '京东退款',
    '拼多多退款',
    '电商退款',
    '商品退款',
    '申请退款',
    '我要退款',
  ],
  maxLevel: 'medium',
  steps: [
    {
      id: 'ecommerce-refund-1',
      title: '先打开订单详情',
      instruction: '回到购买商品的平台，打开「我的订单」，找到这件商品并进入订单详情。不要点击聊天里收到的退款链接。',
      alternative: '只从淘宝、京东或拼多多 App 里的「我的订单」进入，不要从短信或陌生人发来的链接进入。',
      successSignal: '看到这件商品的金额、订单状态和「申请退款」入口',
    },
    {
      id: 'ecommerce-refund-2',
      title: '找平台内的退款入口',
      instruction: '在订单详情里找「申请退款」或「退换售后」。如果页面要求先付款、转账或提供验证码，马上停下来。',
      alternative: '退款入口应在订单详情里。客服让你下载软件、共享屏幕或去别的平台时，不要继续。',
      successSignal: '出现退款原因或退款表单，全程没有离开购物 App',
    },
    {
      id: 'ecommerce-refund-3',
      title: '核对退款去向',
      instruction: '提交前确认页面写着原路退回。正规退款不需要你先交手续费，也不需要提供短信验证码。',
      alternative: '看到「先付款」「保证金」「刷流水」或「安全账户」时，立即退出并找家人核实。',
      successSignal: '页面显示退款将原路退回，全程没有被要求先付钱',
    },
  ],
}

export const TUTORIALS: readonly Tutorial[] = Object.freeze([
  TUTORIAL_ECOMMERCE_REFUND,
  TUTORIAL_WEIXIN_NO_SOUND,
  TUTORIAL_FONT_TOO_SMALL,
])
