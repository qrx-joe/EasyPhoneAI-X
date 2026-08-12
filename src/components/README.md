# components/ — 适老化 UI 组件

无业务决策的展示层组件。

## 依赖方向（硬约束）

**允许依赖**：
- `application/`（调用用例获取决策）
- `contracts/`（消费 DTO 与错误码）
- `lib/`（通用工具）
- React / Next.js

**严禁依赖**：
- ❌ `domain/`（不得直接拼接领域规则或定义风险策略）
- ❌ `infrastructure/`（不得直接调用 Provider 或读环境变量）
- ❌ `fetch` 直接调用模型 API

## 设计原则（方案 9.2 适老化约束）

- 每屏一个主要动作，最多两个次要动作。
- 主要文字不小于 18px，关键步骤 24–32px；主按钮高度不低于 64px。
- 正确使用 `button`、`label`、heading、`status`、`alert` 语义。
- 不仅依靠颜色表达风险或状态；动效遵循 `prefers-reduced-motion`。
- 在 375px 竖屏和 200% 文本缩放下不裁切关键操作。
