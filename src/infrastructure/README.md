# infrastructure/ — 基础设施层

Provider 与 Telemetry 的具体实现。实现 `application/ports/` 定义的接口。

## 依赖方向（硬约束）

**允许依赖**：
- `application/ports/`（实现其接口）
- `contracts/`（用 Schema 校验模型输出）
- `domain/`（只读纯类型与纯函数）
- `lib/`（通用工具）
- `fetch` / 环境变量 / 供应商 SDK（这一层是唯一允许接触外部 I/O 的地方）

**严禁依赖**：
- ❌ `app/` / `components/`（UI 层）
- ❌ 反向定义业务规则（规则只能在 `domain/`）

## 子模块职责

- `ai/qwen-vision-adapter.ts` — 百炼 Qwen Vision 实现（第四阶段）
  - 模型名、端点、价格只存在于环境配置与本层，不写入领域层
  - 视觉请求硬超时 5 秒，最多一次受控重试
  - 模型输出必须通过 Schema、Risk Policy、Allowed Action 三道闸
- `telemetry/` — 脱敏结构化事件（方案 11.1）
  - 每个 `traceId` 记录事件类型、版本、输入 hash、决策结果、延迟
  - 禁止记录原始文本、截图、OTP、密码、完整 prompt/response

## 设计原则

- 这一层的故障必须按方案 11.2 分类处理：
  技术故障可降级到确定性规则；安全不确定性必须进入 `UNKNOWN` 或 `STOP`。
- 旧系统曾出现真实模型超时回退到低风险路径（fail-open）。新系统禁止此语义：
  技术故障回退和安全不确定性必须分开。
