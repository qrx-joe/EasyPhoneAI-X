# src/app/ — Next.js 页面与 Route Handlers

App Router 的页面与服务端路由。

## 依赖方向（硬约束）

**允许依赖**：
- `application/`（调用用例）
- `contracts/`（DTO、错误码）
- `components/`（适老化 UI）
- `infrastructure/`（仅在 Route Handler 内组装 Provider，不暴露给客户端）
- `lib/`（通用工具）

**严禁依赖**：
- ❌ 在页面/组件里直接定义风险策略或拼接模型请求
- ❌ 信任客户端传入的风险等级、理由、关键词（服务端必须重新计算，方案 8.1）

## P0 页面（方案 9.1）

首页、目标确认页、截图页、一步指导页、风险停止页、求助卡页、`UNKNOWN` 页。
具体页面在第五阶段实现。
