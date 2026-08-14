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

## 页面与路由

- `/` — 首页（文字 / 语音 / 示例入口）
- `/assist` — 决策页：文字 + 可选截图（本地涂抹脱敏 + 同意）一次提交，
  四种决策结果（guide / stop / clarify / unsupported）就地渲染
- `POST /api/v2/decision` — 决策 API（服务端重算风险，方案 §8.1）

早期多页流（/confirm、/tutorial、/unknown、/risk-alert）已被 /assist 决策流
取代并移除：三条演示路径共用同一条决策链，无第二条并行路由。
