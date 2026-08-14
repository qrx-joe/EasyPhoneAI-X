# 爸妈别急 · 安心下一步

> 面向银发用户的数字生活安全副驾。系统看懂用户当前所在步骤，只给出安全的下一步；遇到风险或无法确认时停下来，并把必要上下文交给家人。

## 这是什么

一个帮老人安全使用手机的产品。老人遇到问题时，系统：

1. **看懂**当前在哪个 App、哪个页面（文字描述 + 可选截图）
2. **只给一个安全的下一步**（来自人工审核的白名单教程）
3. **遇到风险立刻停下来**（转账、验证码、屏幕共享等），生成脱敏求助卡发给家人
4. **看不懂时不瞎猜**（进入 UNKNOWN，给三个出口，绝不 fail-open）

核心安全理念：**一次只给一个可逆步骤**；**AI 只能升级风险，不能降级**。

## 比赛路径（P0 三条演示）

| 路径 | 场景 | 系统行为 |
|---|---|---|
| 低风险 | 微信没声音 / 字太小 | 一步指导，每步一个可逆动作 + 成功信号 |
| 中风险 | 电商退款 | 只允许已审核步骤（教程 maxLevel 硬校验）；无可用教程时给谨慎求助卡 |
| 高风险 | 转账 / 验证码 / 屏幕共享 | 直接停止，生成脱敏求助卡 |

三条路径共用同一条生产决策链（`/assist` → `/api/v2/decision` → `decideNext`），
不使用隐藏分支伪造成功。

## 证据等级与已知边界（诚实声明）

本项目按 P0 构建方案分 6 阶段实施。以下证据等级严格区分（方案 §15）：

### ✅ 已实现 + 单元测试覆盖

| 能力 | 证据 |
|---|---|
| 风险关键词分类（~80 条）+ MAX 合并 | 27 个测试（classify-risk + assess-observation-risk + risk-policy） |
| 决策链保险丝（高风险必停 + 教程 maxLevel 硬校验 + medium 谨慎求助卡） | 47 个测试（decide-next + guide-next-step + tutorial） |
| 求助卡构建 + 危险话术过滤 + 数字脱敏 | 32 个测试（handoff + card-serialization + question） |
| 教练闭环（语音确认不提交 + 服务端步骤推进 + 每步成功信号） | 8 个单元测试（advance-step）+ 7 条 E2E |
| 白名单教程匹配 + 防御过滤（含退款教程） | tutorial.test |
| 决策契约（GuidanceDecision 四分支 + 错误码） | 41 个测试（risk-policy + error-codes + ui-observation + decision-client） |
| 决策链编排（guide/stop/clarify/unsupported） | 22 个测试（decide-next.test，含 mock Vision） |
| Qwen Vision 解析逻辑 | 17 个测试（adapter-internals，mock，非真实调用） |
| WCAG 对比度 + 设计令牌契约 | 14 个测试（contrast.test，含代码扫描） |
| **合计** | **196 个测试，195 pass / 1 skip / 0 fail** |

### ✅ 本地构建验证

- `pnpm typecheck`（TypeScript strict）通过
- `pnpm build`（Next.js 生产构建）通过，4 个路由编译（`/`、`/assist`、`/api/v2/decision`、`/api/v2/step/advance`）
- `pnpm dev` 开发服务器可启动
- `pnpm test:e2e` 7 条移动端 Chrome 用例通过（低/中/高风险、教程全流程推进、语音确认不提交）

### ⚠️ 固定回放样例（非真实模型调用）

- `tests/fixtures/vision-fixtures.ts` 含 4 个脱敏 fixture
- 全部标注 `[固定回放样例]`
- 用于离线回归、状态机验证、无网络演示兜底
- **不得描述为真实 Qwen 调用结果**

### ❌ 未验证 / 未做

- **真实 Qwen 调用**：adapter 已实现但未用真实 API Key 测试过（Key 需从百炼控制台获取）
- **线上部署**：未部署到任何生产环境
- **真实用户验证**：未做老年用户可用性测试
- **截图同意/预览/手动遮挡 UI**：已实现浏览器本地 canvas 涂抹、撤销、取消和明确同意；客户端门禁有单测，仍缺真实设备操作验收
- **教程步骤状态机**：服务端会话已实现（opaque stateId + 推进时重跑风险检查，内存存储重启即回退）；`ReviewedTaskStep` 版本化任务包与 Allowed Action 状态机留待后续
- **无障碍人工验收**：aria-busy / 焦点管理 / live region 已接入，TalkBack、键盘全流程、200% 缩放和真实设备记录未做（见 `docs/无障碍手机教练执行方案.md` 阶段 A）
- **家属端**：方案 §2.3 明确不做账号/数据库/家属收件箱
- **自动操作**：方案 §2.3 明确不做（无障碍 Service、远程控制、自动点击）

## 技术栈

- Next.js 16.2.7（App Router）/ React 19.2.4 / TypeScript 5 strict
- Tailwind CSS 4 / Node.js 24 / pnpm 10
- 测试：Node.js 原生 Test Runner（`node --test`）
- 视觉：百炼 Qwen Vision（OpenAI 兼容接口）

## 架构（方案 §4）

六层分层，依赖方向严格单向：

```
app/components  ──▶  application  ──▶  domain
     │                   │              ▲
     │                   ▼              │（只读 type）
     ▼               ports ◀── infrastructure
 contracts
```

- `domain/`：纯函数安全核心（risk/guidance/handoff/question/text），无 React/fetch/env
- `application/`：用例编排（decide-next/observe-screen），依赖 ports 接口
- `contracts/`：跨边界协议（GuidanceDecision/UIObservation/错误码）
- `infrastructure/`：Provider 实现（Qwen Vision/Telemetry），含 fetch/env
- `lib/`：无业务含义工具（contrast/speech）
- `components/`：适老化 UI（voice-input-button）

详见 `docs/adr/0002-layered-architecture-dependency-rules.md`。

## 安全不变量（方案 §6.2）

1. 规则命中 high/critical 后，普通指导立即终止
2. AI 只能维持或升级风险，不能降级（`mergeRiskByMax`）
3. 截图缺失/模糊/模型冲突/Schema 无效 → UNKNOWN（不 fail-open）
4. UNKNOWN 不得进入 guide
5. 模型自由文本不直接驱动页面跳转或操作
6. 一个指导步骤只含一个已审核动作 + 成功信号
7. 教程 maxLevel 硬校验：风险等级高于教程 maxLevel 时绝不给教程；
   medium 无可用教程时产出谨慎求助卡，不降级、不静默

## 本地运行

```bash
pnpm install
pnpm dev        # 开发服务器 http://localhost:3000
pnpm test       # 运行测试
pnpm typecheck  # 类型检查
pnpm build      # 生产构建
```

截图识别需要配置百炼 API Key（`.env.local`，参考 `.env.example`）。
无 Key 时系统以纯关键词规则运行，截图功能降级。

## 项目文档

- [P0 构建方案](docs/安心下一步-P0-构建方案.md) —— 完整设计与实施计划
- [ADR 0001：独立新项目](docs/adr/0001-new-project-isolated-from-legacy.md)
- [ADR 0002：分层依赖方向](docs/adr/0002-layered-architecture-dependency-rules.md)

## 来源

本项目是 `021-EasyPhone_AI` 的独立新主线，旧项目仅作已验证资产迁移来源。
迁移过程重新验证，不继承旧比赛材料、模拟功能或 fail-open 语义。
