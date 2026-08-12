# contracts/ — 契约层

跨边界协议的单一来源。管理 API DTO、运行时 Schema、错误码。

## 依赖方向（硬约束）

**允许依赖**：
- `domain/` 的纯类型（只导入 type，不导入运行时逻辑）

**严禁依赖**：
- ❌ React / Next.js
- ❌ `fetch` / 环境变量
- ❌ 任何运行时副作用

## 职责

- **API DTO**：`POST /api/v2/decision` 的请求与响应结构（方案 8.1）
- **运行时 Schema**：`UIObservationSchema`、`GuidanceDecision` 等联合类型及其校验器
  （方案 6.1、7.2）。任何外部输入和模型输出必须先通过这里的运行时校验。
- **错误码**：`INVALID_INPUT` / `CONSENT_REQUIRED` / `IMAGE_TOO_LARGE` 等
  稳定错误码（方案 8.2），错误响应不得包含堆栈、密钥或模型原始输出。

## 设计原则

- 调用方必须穷尽处理 `GuidanceDecision` 的所有分支，禁止把 `unknown` 当作 `low`。
- 外部数据一律从 `unknown` 开始收敛，不信任任何客户端或模型返回的结构。
