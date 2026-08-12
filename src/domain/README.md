# domain/ — 领域层

安全核心与业务规则的纯净层。只包含类型、纯函数、策略和状态机。

## 依赖方向（硬约束）

**允许依赖**：
- 本目录内部模块互相依赖（如 `guidance` 依赖 `risk`）
- `contracts/`（领域层可定义并导出契约类型）

**严禁依赖**：
- ❌ React / Next.js（任何 UI）
- ❌ `fetch` / HTTP 客户端 / 数据库 / 文件系统
- ❌ 环境变量（`process.env`）
- ❌ `application/` / `infrastructure/` / `app/` / `components/`

## 子模块职责

- `risk/` — 风险等级（low/medium/high/critical）、关键词规则、MAX 不变量、`shouldStopGuidance`
- `guidance/` — 任务状态机、允许动作（Allowed Action）、一步指导步骤
- `handoff/` — 求助卡构建、危险话术过滤、纯文本序列化

## 设计原则

- 安全不变量是这里的最高优先级。规则命中 `high`/`critical` 后普通指导立即终止；
  AI 只能维持或升级规则风险，不能降级。
- 纯函数、无副作用、无 I/O，方便测试和未来在 Server Component 里调用。
- 任何外部输入和模型输出必须先在 `contracts/` 通过运行时校验后才进入领域层。
