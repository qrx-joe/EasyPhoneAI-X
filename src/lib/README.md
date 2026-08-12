# lib/ — 通用工具

无业务含义的通用工具函数。

## 依赖方向（硬约束）

**允许依赖**：
- 仅依赖语言标准库与其他 `lib/` 内部模块

**严禁依赖**：
- ❌ `domain/` / `application/` / `contracts/` / `infrastructure/`（任何业务层）
- ❌ React / Next.js（除非是明确的 client 工具，且标注 `'use client'`）

## 职责

放与业务无关的纯工具，例如：
- WCAG 对比度计算（`a11y/contrast.ts`）
- 语音能力封装（`speech/`：Web Speech Recognition、SpeechSynthesis、语速控制）
- 纯字符串/数值工具

## 设计原则

- 这里的任何函数都能独立于产品复用。如果某个工具需要知道「风险等级」或「求助卡」，
  它就属于 `domain/`，不属于这里。
