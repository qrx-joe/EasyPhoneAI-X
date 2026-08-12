/**
 * 风险关键词库（MVP / Milestone 1 落地版）。
 *
 * 数据源来自旧项目 021-EasyPhone_AI 的 7 桶关键词脑暴，经真实漏报驱动迭代。
 * 逻辑在 classify-risk.ts，数据在这里。增删关键词只动这个文件，不动 classify-risk.ts。
 *
 * 扩库三道闸：真实漏报驱动 → 测试覆盖 → 老年用户测试；不凭想象写。
 * 改 level 必过 classify-risk.test.ts 的验收用例。
 *
 * 与旧项目的关键偏离（已验证，保留）：
 *  - 「充值/充话费」=critical 降到 medium：老人日常会用，真正危险的是组合话术。
 *  - 「生物信息」（人脸/指纹）升 high：刷脸+转账=立刻被盗刷。
 *  - 整体 ~80 条核心，覆盖 16 个验收用例；新增按真实漏报驱动。
 */

import type { RiskLevel } from './types.ts'

/**
 * 场景标签。主键依然是 RiskLevel，场景是元数据，用于：
 * (1) 给求助卡生成「为什么危险」的人话理由；
 * (2) 未来按场景维度做统计；
 * (3) 给开发者审视关键词覆盖度。
 */
export type ScenarioTag =
  | 'money_transfer'      // 1. 金钱直接转出
  | 'code_or_password'    // 2. 验证码 / 密码 / 隐私信息索取
  | 'remote_control'      // 3. 屏幕共享 / 远程控制
  | 'stranger_link'       // 4. 陌生链接 / 二维码
  | 'fake_identity'       // 5. 假冒身份（亲属 / 公检法 / 机构）
  | 'lottery_or_benefit'  // 6. 中奖 / 补贴 / 高回报投资
  | 'account_or_privacy'  // 7. 账号 / 隐私 / 生物信息
  | 'ecommerce_refund'    // 电商退款 / 售后入口核验
  | 'colloquial'          // 老人口语化变体（不是规范词，是真实会说的话）
  | 'phrase_snippet'      // 典型骗术原话片段（长关键词，精确打击）

/**
 * 单条关键词记录。
 *
 * - keyword:  匹配的关键字符串。includes 子串匹配，匹配前对输入做 normalize
 *             （toLowerCase + 全角转半角），所以这里全部小写、半角形式存。
 * - level:    这个关键词单独命中能升到的风险等级。
 *             多关键词命中时，取所有命中关键词 level 的最大值。
 * - scenario: 7 桶中的哪一桶。一个关键词只属于一个主场景。
 * - reason:   一句给老人/家人看的人话，在风险提醒页和求助卡显示。
 */
export interface RiskKeyword {
  keyword: string
  level: RiskLevel
  scenario: ScenarioTag
  reason: string
}

// ─────────────────────────────────────────────────────────────────────
// 1. 金钱直接转出类 (CRITICAL)
// 「充值/充话费」按偏离降级到 medium，不在本桶。
// ─────────────────────────────────────────────────────────────────────
const MONEY_TRANSFER: RiskKeyword[] = [
  // 规范动词
  { keyword: '转账',        level: 'critical', scenario: 'money_transfer',
    reason: '对方要求转账,这是最常见的诈骗方式' },
  { keyword: '转钱',        level: 'critical', scenario: 'money_transfer',
    reason: '对方要求转钱,先停下来跟家人确认' },
  { keyword: '汇款',        level: 'critical', scenario: 'money_transfer',
    reason: '对方要求汇款,先停下来跟家人确认' },
  { keyword: '打款',        level: 'critical', scenario: 'money_transfer',
    reason: '对方要求打款,先停下来跟家人确认' },
  { keyword: '付款',        level: 'critical', scenario: 'money_transfer',
    reason: '对方要求付款,先停下来跟家人确认' },
  { keyword: '扫码付款',     level: 'critical', scenario: 'money_transfer',
    reason: '扫码付款 = 钱直接转出,千万别扫陌生人发来的码' },
  { keyword: '扫码付',       level: 'critical', scenario: 'money_transfer',
    reason: '扫码付钱 = 钱直接转出,千万别扫陌生人发来的码' },
  { keyword: '收款码',       level: 'critical', scenario: 'money_transfer',
    reason: '对方说「收款码」很可能是骗你扫付款码,钱会直接转走' },
  { keyword: '付款码',       level: 'critical', scenario: 'money_transfer',
    reason: '把付款码给别人 = 钱被直接划走' },
  { keyword: '安全账户',     level: 'critical', scenario: 'money_transfer',
    reason: '「安全账户」是公检法诈骗的标志性话术,警察绝不会让你转账到「安全账户」' },
  // 高频骗术片段(长关键词)
  { keyword: '垫付',         level: 'critical', scenario: 'money_transfer',
    reason: '「先垫付」是诈骗剧本,你的钱不会原路退回' },
  { keyword: '解冻费',       level: 'critical', scenario: 'money_transfer',
    reason: '账户不存在「解冻费」,这是百分百诈骗' },
  { keyword: '保证金',       level: 'critical', scenario: 'money_transfer',
    reason: '陌生人让你交「保证金」就是骗你打款' },
  { keyword: '手续费',       level: 'critical', scenario: 'money_transfer',
    reason: '陌生人让你交「手续费」就是骗你打款' },
  { keyword: '激活',         level: 'high', scenario: 'money_transfer',
    reason: '「先充钱激活」是常见话术,正经业务不会让你先付钱' },
  // 中奖骗术原话片段(误报极低,见即 critical)
  { keyword: '先交个人所得税', level: 'critical', scenario: 'phrase_snippet',
    reason: '「中奖了先交个人所得税」是教科书级别诈骗,真中奖税款由发奖方代扣' },
  { keyword: '交个人所得税',   level: 'critical', scenario: 'phrase_snippet',
    reason: '让你「交个人所得税」才能领奖 = 骗你打款' },
  { keyword: '交所得税',       level: 'high', scenario: 'phrase_snippet',
    reason: '陌生场景让你「交所得税」基本是中奖类诈骗' },
  // 口语变体(与规范词同等对待,直停)
  { keyword: '打钱',         level: 'critical', scenario: 'colloquial',
    reason: '对方让你打钱,先停下来跟家人确认' },
  { keyword: '转给我',       level: 'critical', scenario: 'colloquial',
    reason: '对方让你「转给我」,先停下来跟家人确认' },
  { keyword: '转过去',       level: 'critical', scenario: 'colloquial',
    reason: '对方让你「转过去」,先停下来跟家人确认' },
  { keyword: '转过来',       level: 'critical', scenario: 'colloquial',
    reason: '对方让你「转过来」,先停下来跟家人确认' },
]

// ─────────────────────────────────────────────────────────────────────
// 2. 验证码 / 密码 / 身份证 / 银行卡 索取 (CRITICAL)
// ─────────────────────────────────────────────────────────────────────
const CODE_OR_PASSWORD: RiskKeyword[] = [
  { keyword: '验证码',       level: 'critical', scenario: 'code_or_password',
    reason: '验证码 = 一次性钥匙,告诉别人就等于把钱包给别人' },
  { keyword: '短信验证码',    level: 'critical', scenario: 'code_or_password',
    reason: '银行/平台的人绝不会问你的短信验证码' },
  { keyword: '银行验证码',    level: 'critical', scenario: 'code_or_password',
    reason: '银行的人绝不会问你的银行验证码' },
  { keyword: 'verification code', level: 'critical', scenario: 'code_or_password',
    reason: 'Verification code is a one-time key; no bank or platform staff should ask for it' },
  { keyword: 'one-time password', level: 'critical', scenario: 'code_or_password',
    reason: 'One-time password is a payment/account key; never tell it to anyone' },
  { keyword: 'otp',           level: 'critical', scenario: 'code_or_password',
    reason: 'OTP is a one-time password; sharing it can let scammers take over an account' },
  { keyword: '支付密码',     level: 'critical', scenario: 'code_or_password',
    reason: '支付密码是最后一道关,告诉任何人都=丢钱' },
  { keyword: '银行卡密码',    level: 'critical', scenario: 'code_or_password',
    reason: '银行卡密码绝不能告诉任何人,包括自称银行的人' },
  { keyword: '取款密码',     level: 'critical', scenario: 'code_or_password',
    reason: '取款密码绝不能告诉任何人' },
  { keyword: '登录密码',     level: 'critical', scenario: 'code_or_password',
    reason: '登录密码告诉别人 = 账户被盗' },
  { keyword: 'apple id',     level: 'critical', scenario: 'code_or_password',
    reason: 'Apple ID 被骗后整个手机会被远程锁住勒索' },
  { keyword: '苹果id',       level: 'critical', scenario: 'code_or_password',
    reason: 'Apple ID 被骗后整个手机会被远程锁住勒索' },
  { keyword: '苹果账号',     level: 'critical', scenario: 'code_or_password',
    reason: '苹果账号被骗后整个手机会被远程锁住勒索' },
  { keyword: '微信密码',     level: 'critical', scenario: 'code_or_password',
    reason: '微信密码 = 钱包钥匙,绝不能告诉任何人' },
  { keyword: '身份证号',     level: 'critical', scenario: 'code_or_password',
    reason: '身份证号 + 其他信息可以被冒名贷款,绝不轻易告诉陌生人' },
  { keyword: '身份证正反面',  level: 'critical', scenario: 'code_or_password',
    reason: '身份证拍照 = 被冒名注册账户、贷款的关键材料' },
  { keyword: '银行卡号',     level: 'critical', scenario: 'code_or_password',
    reason: '银行卡号 + 验证码 = 钱被直接划走' },
  { keyword: 'bank card number', level: 'critical', scenario: 'code_or_password',
    reason: 'Bank card number plus OTP can let scammers charge the card' },
  { keyword: 'credit card number', level: 'critical', scenario: 'code_or_password',
    reason: 'Credit card number plus security code can lead to card fraud' },
  { keyword: 'cvv',          level: 'critical', scenario: 'code_or_password',
    reason: '信用卡背面 3 位数 = 国外消费时的免密钥匙,绝不能告诉别人' },
  { keyword: '信用卡背面',    level: 'critical', scenario: 'code_or_password',
    reason: '信用卡背面 3 位数告诉别人 = 卡被盗刷' },
  // 口语变体(与规范词同等对待,直停)
  { keyword: '6位数字',      level: 'critical', scenario: 'colloquial',
    reason: '对方让你念「6 位数字」十有八九就是验证码,千万不要念出来' },
  { keyword: '6 位数字',     level: 'critical', scenario: 'colloquial',
    reason: '对方让你念「6 位数字」十有八九就是验证码,千万不要念出来' },
  { keyword: '六位数字',     level: 'critical', scenario: 'colloquial',
    reason: '对方让你念「六位数字」十有八九就是验证码,千万不要念出来' },
  { keyword: '六个数字',     level: 'critical', scenario: 'colloquial',
    reason: '对方让你念「六个数字」十有八九就是验证码,千万不要念出来' },
  { keyword: '那串数字',     level: 'critical', scenario: 'colloquial',
    reason: '对方说的「那串数字」很可能是验证码,千万不要念出来' },
  { keyword: '念给我听',     level: 'critical', scenario: 'colloquial',
    reason: '让你「念出来」短信里的数字 = 骗验证码' },
  { keyword: '报一下',       level: 'critical', scenario: 'colloquial',
    reason: '让你「报一下」短信里的数字 = 骗验证码' },
  // 典型话术片段
  { keyword: '系统发的',     level: 'high', scenario: 'phrase_snippet',
    reason: '「这是系统发的码」是骗验证码的固定话术' },
  { keyword: '不告诉别人',    level: 'high', scenario: 'phrase_snippet',
    reason: '「不能告诉别人,只告诉我」是骗子怕你跟家人核实的标志' },
]

// ─────────────────────────────────────────────────────────────────────
// 3. 屏幕共享 / 远程控制 (CRITICAL)
// ─────────────────────────────────────────────────────────────────────
const REMOTE_CONTROL: RiskKeyword[] = [
  { keyword: '屏幕共享',     level: 'critical', scenario: 'remote_control',
    reason: '屏幕共享 = 对方实时看到你输入的密码和验证码' },
  { keyword: '共享屏幕',     level: 'critical', scenario: 'remote_control',
    reason: '屏幕共享 = 对方实时看到你输入的密码和验证码' },
  { keyword: 'screen sharing', level: 'critical', scenario: 'remote_control',
    reason: 'Screen sharing lets the other person see passwords and verification codes in real time' },
  { keyword: 'share your screen', level: 'critical', scenario: 'remote_control',
    reason: 'Sharing your screen can expose passwords, bank pages and verification codes' },
  { keyword: '远程控制',     level: 'critical', scenario: 'remote_control',
    reason: '远程控制 = 对方直接操作你的手机,绝对不能开' },
  { keyword: '远程协助',     level: 'critical', scenario: 'remote_control',
    reason: '远程协助 = 对方直接操作你的手机,绝对不能开' },
  { keyword: '远程操作',     level: 'critical', scenario: 'remote_control',
    reason: '让别人远程操作你的手机 = 直接被盗' },
  { keyword: '向日葵',       level: 'critical', scenario: 'remote_control',
    reason: '向日葵是远程控制软件,装了对方就能操作你的手机' },
  { keyword: 'todesk',       level: 'critical', scenario: 'remote_control',
    reason: 'ToDesk 是远程控制软件,装了对方就能操作你的手机' },
  { keyword: 'teamviewer',   level: 'critical', scenario: 'remote_control',
    reason: 'TeamViewer 是远程控制软件,装了对方就能操作你的手机' },
  { keyword: 'anydesk',      level: 'critical', scenario: 'remote_control',
    reason: 'AnyDesk is remote-control software; scammers can use it to operate the phone' },
  { keyword: 'airdroid',     level: 'critical', scenario: 'remote_control',
    reason: 'AirDroid 是远程控制软件,装了对方就能操作你的手机' },
  { keyword: 'qq远程',       level: 'critical', scenario: 'remote_control',
    reason: 'QQ 远程功能 = 对方能直接操作你的电脑/手机' },
  // 口语 / 诱导话术
  { keyword: '帮你操作',     level: 'high', scenario: 'colloquial',
    reason: '陌生人说「我帮你操作」往往是要开远程控制或屏幕共享' },
  { keyword: '我教你操作',    level: 'high', scenario: 'colloquial',
    reason: '陌生人说「视频会议教你」很多是骗屏幕共享' },
  { keyword: '视频会议',     level: 'high', scenario: 'colloquial',
    reason: '陌生人邀请你开视频会议,经常是为了让你共享屏幕' },
]

// ─────────────────────────────────────────────────────────────────────
// 4. 陌生链接 / 二维码 (HIGH)
// 注意:「点链接」单独不该 high(老人正常用淘宝也点链接),所以这里收
// 「短信链接」「领奖链接」「公众号链接」等带情境前缀的组合。
// ─────────────────────────────────────────────────────────────────────
const STRANGER_LINK: RiskKeyword[] = [
  { keyword: '陌生链接',     level: 'high', scenario: 'stranger_link',
    reason: '陌生链接可能是钓鱼网站,点开就可能被盗号' },
  { keyword: 'unknown link', level: 'high', scenario: 'stranger_link',
    reason: 'Unknown links may be phishing sites that steal accounts or card details' },
  { keyword: 'click the link', level: 'high', scenario: 'stranger_link',
    reason: 'A stranger asking you to click a link may be sending a phishing site' },
  { keyword: '短信里的网址',  level: 'high', scenario: 'stranger_link',
    reason: '陌生短信里的网址十有八九是钓鱼链接' },
  { keyword: '短信里的链接',  level: 'high', scenario: 'stranger_link',
    reason: '陌生短信里的链接十有八九是钓鱼链接' },
  { keyword: '领奖链接',     level: 'high', scenario: 'stranger_link',
    reason: '「领奖链接」基本上都是骗你填个人信息或交手续费' },
  { keyword: '激活链接',     level: 'high', scenario: 'stranger_link',
    reason: '陌生人发的「激活链接」一般是钓鱼' },
  { keyword: '验证链接',     level: 'high', scenario: 'stranger_link',
    reason: '陌生人发的「验证链接」一般是钓鱼' },
  { keyword: '点这个链接',    level: 'high', scenario: 'stranger_link',
    reason: '陌生人让你点链接,先停下来跟家人核实' },
  { keyword: '复制到浏览器',  level: 'high', scenario: 'stranger_link',
    reason: '让你「复制到浏览器打开」是绕过微信安全检测的常见做法' },
  // 二维码
  { keyword: '扫这个码',     level: 'high', scenario: 'stranger_link',
    reason: '陌生人让你扫码,可能是付款码也可能是钓鱼链接' },
  { keyword: '扫这个二维码',  level: 'high', scenario: 'stranger_link',
    reason: '陌生人让你扫码,可能是付款码也可能是钓鱼链接' },
  { keyword: '群二维码',     level: 'medium', scenario: 'stranger_link',
    reason: '陌生群二维码进群后常被推荐刷单或投资,小心' },
  // 伪装场景词(配合短信链接出现是 high)
  { keyword: '快递理赔',     level: 'high', scenario: 'stranger_link',
    reason: '「快递理赔」是高发骗术,真正快递理赔不会让你填银行卡' },
  { keyword: '快递异常',     level: 'high', scenario: 'stranger_link',
    reason: '「快递异常」常配合钓鱼链接出现' },
  { keyword: '账户异常',     level: 'high', scenario: 'stranger_link',
    reason: '「账户异常」配合链接是钓鱼标志,银行不会用短信链接通知' },
  { keyword: '账户被冻结',    level: 'high', scenario: 'stranger_link',
    reason: '「账户被冻结」+ 链接是诈骗剧本' },
  { keyword: 'account frozen', level: 'high', scenario: 'stranger_link',
    reason: 'Messages saying an account is frozen and asking for a link verification are common phishing scams' },
  { keyword: 'bank account frozen', level: 'high', scenario: 'stranger_link',
    reason: 'Banks do not ask seniors to verify a frozen account through a random message link' },
  { keyword: '账户要升级',    level: 'high', scenario: 'stranger_link',
    reason: '「账户要升级」+ 链接是钓鱼,银行不会这样通知' },
  { keyword: '实名认证',     level: 'high', scenario: 'stranger_link',
    reason: '「再次实名认证」+ 链接是钓鱼' },
  { keyword: '征信修复',     level: 'high', scenario: 'stranger_link',
    reason: '不存在「征信修复」服务,这是诈骗' },
  { keyword: '征信洗白',     level: 'high', scenario: 'stranger_link',
    reason: '不存在「征信洗白」服务,这是诈骗' },
  { keyword: '医保卡异常',    level: 'high', scenario: 'stranger_link',
    reason: '「医保卡异常」+ 链接是高发骗术,医保不会这样通知' },
  { keyword: '医保异常',     level: 'high', scenario: 'stranger_link',
    reason: '「医保异常」+ 链接是高发骗术,医保不会这样通知' },
]

// ─────────────────────────────────────────────────────────────────────
// 5. 假冒身份 (HIGH)
// ─────────────────────────────────────────────────────────────────────
const FAKE_IDENTITY: RiskKeyword[] = [
  // 亲属类
  { keyword: '我是你儿子',    level: 'high', scenario: 'fake_identity',
    reason: '陌生号码自称是你的孩子,先打孩子常用号码核实' },
  { keyword: '我是你女儿',    level: 'high', scenario: 'fake_identity',
    reason: '陌生号码自称是你的孩子,先打孩子常用号码核实' },
  { keyword: '我换号了',     level: 'high', scenario: 'fake_identity',
    reason: '「我换号了」是冒充亲属诈骗的开场白' },
  { keyword: '我新号',       level: 'high', scenario: 'fake_identity',
    reason: '「我用新号」是冒充亲属诈骗的开场白' },
  { keyword: '我出事了',     level: 'high', scenario: 'fake_identity',
    reason: '「我出事了快汇钱」是经典骗术,先打孩子原号码核实' },
  { keyword: '我被抓了',     level: 'high', scenario: 'fake_identity',
    reason: '「我被抓了快保释」是经典骗术,正经案件不会这样要钱' },
  // 公检法类
  { keyword: '公安局',       level: 'high', scenario: 'fake_identity',
    reason: '公安局不会电话办案,不会要你转账到「安全账户」' },
  { keyword: '检察院',       level: 'high', scenario: 'fake_identity',
    reason: '检察院不会电话办案,不会要你转账到「安全账户」' },
  { keyword: '反诈中心',     level: 'high', scenario: 'fake_identity',
    reason: '反诈中心不会要你转账,反诈中心只会让你「别转账」' },
  { keyword: 'government officer', level: 'high', scenario: 'fake_identity',
    reason: 'A stranger claiming to be a government officer should be verified through official channels' },
  { keyword: 'immigration officer', level: 'high', scenario: 'fake_identity',
    reason: 'Immigration officers will not ask for passwords, OTPs or money through chat messages' },
  { keyword: 'bank officer', level: 'high', scenario: 'fake_identity',
    reason: 'Bank staff will not ask for passwords, OTPs or screen sharing through chat messages' },
  { keyword: '涉嫌洗钱',     level: 'critical', scenario: 'fake_identity',
    reason: '「你涉嫌洗钱」是公检法诈骗的标志话术,真公安不会这样说' },
  { keyword: '涉嫌诈骗',     level: 'high', scenario: 'fake_identity',
    reason: '「你涉嫌诈骗」是公检法诈骗的标志话术,真公安不会这样说' },
  { keyword: '配合调查',     level: 'high', scenario: 'fake_identity',
    reason: '「配合调查」+「转账」组合是公检法诈骗剧本' },
  { keyword: '资金清查',     level: 'critical', scenario: 'fake_identity',
    reason: '没有「资金清查」业务,这是公检法诈骗话术' },
  // 机构类
  { keyword: '95588',        level: 'high', scenario: 'fake_identity',
    reason: '工行不会主动给你打电话要密码或验证码' },
  { keyword: '95533',        level: 'high', scenario: 'fake_identity',
    reason: '建行不会主动给你打电话要密码或验证码' },
  { keyword: '10086',        level: 'high', scenario: 'fake_identity',
    reason: '移动客服不会要你转账或提供验证码' },
  { keyword: '医保局',       level: 'high', scenario: 'fake_identity',
    reason: '医保局不会用电话/短信让你点链接或转账' },
  { keyword: '社保局',       level: 'high', scenario: 'fake_identity',
    reason: '社保局不会用电话/短信让你点链接或转账' },
]

// ─────────────────────────────────────────────────────────────────────
// 6. 中奖 / 补贴 / 高回报投资 (HIGH)
// ─────────────────────────────────────────────────────────────────────
const LOTTERY_OR_BENEFIT: RiskKeyword[] = [
  { keyword: '中奖',         level: 'high', scenario: 'lottery_or_benefit',
    reason: '你没参加的抽奖不会中奖,「中奖」+「交税」 = 诈骗' },
  { keyword: '恭喜中奖',     level: 'high', scenario: 'lottery_or_benefit',
    reason: '陌生短信「恭喜中奖」基本是诈骗' },
  { keyword: '抽奖中了',     level: 'high', scenario: 'lottery_or_benefit',
    reason: '你没参加的抽奖不会中奖' },
  { keyword: '抽到你',       level: 'high', scenario: 'lottery_or_benefit',
    reason: '「节目组抽到你」是常见诈骗开场' },
  { keyword: '幸运观众',     level: 'high', scenario: 'lottery_or_benefit',
    reason: '「幸运观众」基本是诈骗开场' },
  { keyword: '领奖',         level: 'high', scenario: 'lottery_or_benefit',
    reason: '陌生人让你「领奖」十有八九是诈骗' },
  { keyword: '兑奖',         level: 'high', scenario: 'lottery_or_benefit',
    reason: '陌生人让你「兑奖」基本是诈骗' },
  // 补贴福利
  { keyword: '国家补贴',     level: 'high', scenario: 'lottery_or_benefit',
    reason: '国家补贴不会用陌生短信发链接通知' },
  { keyword: '政府补贴',     level: 'high', scenario: 'lottery_or_benefit',
    reason: '政府补贴不会用陌生短信发链接通知' },
  { keyword: '退休金补发',    level: 'high', scenario: 'lottery_or_benefit',
    reason: '退休金不会让你点链接或交手续费' },
  { keyword: '医保返还',     level: 'high', scenario: 'lottery_or_benefit',
    reason: '「医保返还」基本是诈骗,真医保不会这样发钱' },
  { keyword: '退税',         level: 'medium', scenario: 'lottery_or_benefit',
    reason: '陌生「退税」短信常是钓鱼,真退税请去官方 App' },
  { keyword: '免费领',       level: 'medium', scenario: 'lottery_or_benefit',
    reason: '「免费领」常用来骗注册或运费' },
  // 投资类
  { keyword: '保本',         level: 'high', scenario: 'lottery_or_benefit',
    reason: '「保本理财」是金融诈骗话术,合规理财都不保本' },
  { keyword: '稳赚不赔',     level: 'high', scenario: 'lottery_or_benefit',
    reason: '「稳赚不赔」是诈骗话术,没有这种投资' },
  { keyword: '年化30',       level: 'high', scenario: 'lottery_or_benefit',
    reason: '年化 30% 以上的「投资」基本都是骗局' },
  { keyword: '年化20',       level: 'high', scenario: 'lottery_or_benefit',
    reason: '年化 20% 以上的「投资」基本都是骗局' },
  { keyword: '老师带单',     level: 'high', scenario: 'lottery_or_benefit',
    reason: '「老师带单」基本是杀猪盘开场' },
  { keyword: '内部消息',     level: 'high', scenario: 'lottery_or_benefit',
    reason: '「内部消息」「牛股推荐」基本是杀猪盘' },
  { keyword: '刷单',         level: 'high', scenario: 'lottery_or_benefit',
    reason: '「刷单返利」是诈骗,合规平台不存在刷单业务' },
  { keyword: '兼职刷单',     level: 'high', scenario: 'lottery_or_benefit',
    reason: '「兼职刷单」是诈骗,合规平台不存在刷单业务' },
]

// ─────────────────────────────────────────────────────────────────────
// 7. 账号 / 隐私 / 生物信息 (MEDIUM / 生物信息升 HIGH)
// ─────────────────────────────────────────────────────────────────────
const ACCOUNT_OR_PRIVACY: RiskKeyword[] = [
  // 电商售后需要二次确认；出现转账、验证码等词时由 MAX 升到更高等级。
  { keyword: '申请退款',     level: 'medium', scenario: 'ecommerce_refund',
    reason: '退款要从购物平台的订单详情进入，不要按陌生客服要求去其他渠道操作' },
  { keyword: '淘宝退款',     level: 'medium', scenario: 'ecommerce_refund',
    reason: '淘宝退款要从 App 内订单详情进入，不要点聊天或短信里的退款链接' },
  { keyword: '京东退款',     level: 'medium', scenario: 'ecommerce_refund',
    reason: '京东退款要从 App 内订单详情进入，不要按陌生客服要求转账或给验证码' },
  { keyword: '拼多多退款',   level: 'medium', scenario: 'ecommerce_refund',
    reason: '拼多多退款要从 App 内订单详情进入，不要离开平台处理退款' },
  // 一般账号信息(medium)
  { keyword: '手机号',       level: 'medium', scenario: 'account_or_privacy',
    reason: '手机号属于个人信息,不要随意提供给陌生人' },
  { keyword: '家庭住址',     level: 'medium', scenario: 'account_or_privacy',
    reason: '家庭住址不要告诉陌生来电' },
  { keyword: '银行预留手机', level: 'high', scenario: 'account_or_privacy',
    reason: '银行预留手机号 + 验证码 = 钱被划走的标准组合' },
  // 系统层面的「伪故障」诱导(空间/电池/病毒清理等,常引向假 App)
  { keyword: '空间不够',     level: 'medium', scenario: 'account_or_privacy',
    reason: '手机空间不够本身不危险,但要警惕被诱导下载来源不明的「清理 App」' },
  { keyword: '内存不足',     level: 'medium', scenario: 'account_or_privacy',
    reason: '「内存不足」常被用来诱导你下载来源不明的清理 App' },
  { keyword: '清理手机',     level: 'medium', scenario: 'account_or_privacy',
    reason: '陌生 App 让你「一键清理手机」常带广告或恶意权限,先问家人再装' },

  // 生物信息(直接升 high:刷脸 + 转账 = 立刻被盗刷)
  { keyword: '人脸识别',     level: 'high', scenario: 'account_or_privacy',
    reason: '陌生人让你做「人脸识别」常是为了完成转账确认或贷款审核' },
  { keyword: '刷脸',         level: 'high', scenario: 'account_or_privacy',
    reason: '陌生人让你「刷脸」常是为了完成转账确认或贷款审核' },
  { keyword: '扫脸',         level: 'high', scenario: 'account_or_privacy',
    reason: '陌生人让你「扫脸」常是为了完成转账确认或贷款审核' },
  { keyword: '眨眼',         level: 'high', scenario: 'account_or_privacy',
    reason: '「眨眨眼」「点头」等动作配合人脸识别 = 正在帮骗子做活体认证' },
  { keyword: '指纹',         level: 'high', scenario: 'account_or_privacy',
    reason: '陌生人让你按指纹常是为了完成支付确认' },
]

/**
 * 全量关键词单一数据源。
 *
 * 顺序无意义 —— 匹配按 level 取最大值，先后不影响结果。
 */
export const RISK_KEYWORDS: readonly RiskKeyword[] = Object.freeze([
  ...MONEY_TRANSFER,
  ...CODE_OR_PASSWORD,
  ...REMOTE_CONTROL,
  ...STRANGER_LINK,
  ...FAKE_IDENTITY,
  ...LOTTERY_OR_BENEFIT,
  ...ACCOUNT_OR_PRIVACY,
])
