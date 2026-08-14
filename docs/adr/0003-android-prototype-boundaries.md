# ADR 0003：Android 只读观察原型的工程边界

- 状态：提案（评审通过后进入方案阶段 B 实施）
- 日期：2026-08-14
- 决策来源：无障碍手机教练执行方案 §5 阶段 B、§8 工作包 5

## 背景

无障碍教练方案把 Android 能力分为四段：只读观察（阶段 B）→ 高亮提示（阶段 C）→
极少量确认后操作（阶段 D）。进入阶段 B 前必须先决定工程边界：

1. Android 工程放在当前仓库还是独立仓库（方案明确要求由 ADR 决定，不预设）。
2. `AccessibilityService` 的使用边界 —— 代码层面如何保证「只读、无点击路径」。
3. 观察数据的最小契约与脱敏前置。
4. 权限声明与用户控制（开启、可见状态、一键暂停）。

## 决策

### D1：独立仓库

Android 原型放在**独立仓库**，不进入本仓库。

理由：
- 构建工具链完全不同（Gradle/Kotlin vs Node/pnpm），同仓库会让 CI 门禁、
  代码扫描和依赖审计互相污染。
- 本仓库是参赛交付主线（Web/PWA 闭环 + 证据链），保持干净便于评审。
- 安全策略与教程仍由本仓库的 Next.js 服务承载（方案 §5B）；Android 端只是
  受控客户端，通过 HTTP 契约对齐，不需要共享源码。

代价：跨仓库契约同步需要纪律 —— 由 D3 的契约版本化弥补。

### D2：只读边界 —— 代码层面排除点击路径

- 原型只读取无障碍节点树（`AccessibilityNodeInfo` 的可见子集），**不调用**
  `performAction(ACTION_CLICK)`、`performAction(ACTION_LONG_CLICK)`、
  `dispatchGesture`、`findFocus` 之外的任何写入型 API。
- 观察层代码不 import `GestureDescription`；该约束写进 Android 仓库的
  架构测试（静态扫描禁止符号），与本项目 `forbidden-patterns` 同思路。
- 阶段 C/D 的写入能力**不预埋开关**。需要时新开 ADR、新分支、重新评审，
  避免「代码已具备、只差打开」的漂移。

### D3：数据契约 = 方案 §5B 的 `AccessibilityObservation`，版本化对齐

- Android 端只发送 `AccessibilityObservation`（packageName、screenSignature、
  visibleElements 最小字段、observedAt、consentId），不上传完整节点树、
  不上传截图、不记录完整页面文本。
- 本仓库 `contracts/` 保持该契约的**单一语义来源**：阶段 B 开工时在
  `contracts/` 增加 `accessibility-observation.ts`（Schema + 校验），
  并导出 JSON Schema 供 Android 仓库生成数据类；两边以
  `contractVersion` 字段对齐，版本不一致时服务端拒绝并返回 clarify。
- 脱敏前置：密码框（`isPassword`）、验证码、长数字串（手机号/卡号形态，
  复用本项目 `question.ts` 的同款正则语义）在 Android 本地过滤，
  永不进入上传字段。

### D4：权限声明与用户控制

- 仅声明 `BIND_ACCESSIBILITY_SERVICE`；不申请悬浮窗、通知监听、通讯录、定位。
- 服务只能由用户在系统设置里手动开启；App 内持续显示服务状态，提供一键暂停。
- App 切换、息屏、锁屏或服务暂停 → 立即清除内存中的观察结果。
- 日志只记录脱敏 trace、策略版本、决策类型与失败原因（与本仓库
  `telemetry` 端口的禁记清单一致）。

### D5：进入与停止条件

- 进入条件：阶段 A 全部验收通过（含 TalkBack / 375px / 200% 缩放 / Web Speech
  降级的人工记录）、本 ADR 评审通过、测试设备与目标 App 版本明确、
  用户明确同意并手动开启服务。
- 停止条件（立即回退）：敏感信息泄露、后台持续读取、无法可靠暂停、
  页面状态误判可能引导支付。

## 后果

- 正面：参赛主线不受 Android 工程复杂度影响；「只读」由静态可验证的边界
  保证而不是口头承诺；契约版本化让两端演进可追溯。
- 负面：跨仓库协作成本；JSON Schema 生成链路需要一次性搭建；
  阶段 C/D 必须走新 ADR，节奏变慢（这是有意为之）。
- 本 ADR 不构成任何「已实现」声明：阶段 B 原型未开工，相关能力证据等级
  仍为 ❌ 未做。
