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

- `decide-next.ts` — 合并输入、风险、观察与任务状态，产出最终决策
- `observe-screen.ts` — 截图观察用例（调用 VisionProvider port）
- `guide-next-step.ts` — 下一步指导用例
- `build-handoff.ts` — 求助卡用例
- `ports/` — Provider、Telemetry 等接口定义（依赖倒置的抽象端）

## 设计原则

- 用例编排不包含业务规则本身（规则在 `domain/`），只负责按决策顺序（方案 6.2）串联。
- 通过 `ports/` 访问外部能力，实现可测试性（测试时注入 mock）和可替换性。
