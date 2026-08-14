# application/ — 应用层

编排用例，合并输入、风险、观察与任务状态，产出 `GuidanceDecision`。

## 依赖方向（硬约束）

**允许依赖**：
- `domain/`（调用领域规则与状态机）
- `ports/`（通过接口访问 Provider、Telemetry 等外部能力）
- `contracts/`（用例的输入输出 DTO）

**严禁依赖**：
- ❌ `infrastructure/`（具体实现；只能依赖 `ports/` 接口）
- ❌ React / Next.js
- ❌ `fetch` / 环境变量 / 具体供应商 SDK

## 子模块职责

- `decide-next.ts` — 决策链编排：合并输入、风险、观察与教程匹配，产出最终决策（guide 附带步骤会话）
- `observe-screen.ts` — 截图观察用例（调用 VisionProvider port）
- `guide-next-step.ts` — 下一步指导用例（含教程 maxLevel 硬校验，decide-next 复用）
- `advance-step.ts` — 「我看到了」步骤推进用例（重跑风险检查，服务端权威索引）
- `step-sessions.ts` — 步骤会话内存存储（opaque stateId；刷新/重启 → 安全回到重新描述）
- `ports/` — Provider、Telemetry 等接口定义（依赖倒置的抽象端）

## 设计原则

- 用例编排不包含业务规则本身（规则在 `domain/`），只负责按决策顺序（方案 6.2）串联。
- 通过 `ports/` 访问外部能力，实现可测试性（测试时注入 mock）和可替换性。
