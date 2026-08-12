# ADR 0002：分层架构与依赖方向约束

- 状态：已接受
- 日期：2026-08-12
- 决策来源：P0 构建方案 §4

## 背景

旧项目把领域逻辑（risk / routing / help）与 AI 客户端（`lib/ai/`）、
UI 组件混在同一层，导致：
- 领域规则与供应商 SDK 耦合，难以测试和替换。
- fail-open 安全语义散落在 AI 客户端里，与确定性规则混在一起。
- 模型自由文本能间接驱动页面跳转。

P0 需要明确的安全不变量：技术故障可降级到确定性规则，但安全不确定性
必须进入 `UNKNOWN` 或 `STOP`，二者不能混淆。

## 决策

采用六层架构，依赖方向严格单向（方案 §4.2）：

```
app/components  ──▶  application  ──▶  domain
     │                   │              ▲
     │                   ▼              │（只读 type）
     ▼               ports ◀── infrastructure
 contracts
```

### 分层职责与依赖规则

| 层 | 允许依赖 | 严禁依赖 |
|---|---|---|
| `domain/` | 本目录内部、`contracts/`（type） | React/Next、fetch、env、app、application、infrastructure |
| `application/` | `domain/`、`ports/`、`contracts/` | infrastructure（具体实现）、React/Next、fetch、env |
| `contracts/` | `domain/`（仅 type） | React/Next、fetch、env、任何运行时副作用 |
| `infrastructure/` | `ports/`、`contracts/`、`domain/`(type)、`lib/`、fetch、env | app、components、反向定义业务规则 |
| `components/` | `application/`、`contracts/`、`lib/`、React/Next | domain（不得直接拼领域规则）、infrastructure |
| `app/` | application、contracts、components、infrastructure(仅 Route Handler)、lib | 在页面里定义风险策略或拼接模型请求 |

### 关键不变量

1. **领域层纯净**：`domain/` 不导入 React、Next.js、`fetch`、数据库或环境变量。
   安全核心必须是可独立测试的纯函数。
2. **依赖倒置**：`application/` 通过 `ports/` 接口访问外部能力，
   `infrastructure/` 实现这些接口。测试时可注入 mock。
3. **供应商隔离**：模型名、端点、环境变量只存在于 `infrastructure/` 与环境配置，
   不写入领域层。
4. **契约校验**：任何外部输入和模型输出必须先通过 `contracts/` 的运行时校验
   才能进入领域层。外部数据从 `unknown` 开始收敛。

## 后果

- 目录边界由各层 README 与本 ADR 共同约束，review 时可按依赖方向检查违规。
- 迁移旧代码时必须重新归位：旧 `domain/` → 新 `domain/`，旧 `lib/ai/` →
  重新设计为 `infrastructure/ai/` + `application/ports/`。
- 短期成本是迁移时需要拆分旧代码的关注点；长期收益是安全不变量可验证、
  供应商可替换、测试可隔离。
