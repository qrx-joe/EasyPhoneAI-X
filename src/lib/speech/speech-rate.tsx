'use client'

/**
 * 语速档位控制 —— 适老化 3 档（慢/较慢/正常）。
 *
 * 设计原则（适老化）：
 * 1. 不暴露 0.5/0.85/1.0 这种数字 —— 老人看不懂，改用文字档位
 * 2. 3 档不多不少 —— 多了记不住，少了没梯度
 * 3. 持久化 —— 老人调一次就记住（localStorage）
 * 4. 跨页可共用
 *
 * 默认「较慢」（rate 0.85）—— 经验值，老人反应速度能跟上。
 *
 * 不用 slider：触屏 slider 老人滑不准，档位按钮所见即所得 + 大按钮。
 */

import { useCallback, useEffect, useState } from 'react'

// ─────────────────────────────────────────────────────────────────────
// 档位定义（单一数据源）
// ─────────────────────────────────────────────────────────────────────

export type SpeechRateTier = 'slow' | 'normal' | 'fast'

export interface SpeechRateOption {
  tier: SpeechRateTier
  /** 给老人看的中文标签（2-3 字） */
  label: string
  /** SpeechSynthesisUtterance.rate 的实际值 */
  rate: number
}

export const SPEECH_RATE_OPTIONS: readonly SpeechRateOption[] = Object.freeze([
  { tier: 'slow', label: '慢', rate: 0.7 },
  { tier: 'normal', label: '较慢', rate: 0.85 },
  { tier: 'fast', label: '正常', rate: 1.0 },
])

const DEFAULT_TIER: SpeechRateTier = 'normal'

const STORAGE_KEY = 'easyphone.speech.rate'

function tierToRate(tier: SpeechRateTier): number {
  return SPEECH_RATE_OPTIONS.find((o) => o.tier === tier)?.rate ?? 0.85
}

function isValidTier(v: unknown): v is SpeechRateTier {
  return v === 'slow' || v === 'normal' || v === 'fast'
}

// ─────────────────────────────────────────────────────────────────────
// Hook（暴露当前档位 + setter）
// ─────────────────────────────────────────────────────────────────────

/**
 * 当前语速档位 + setter。
 *
 * 持久化：用户改动时立刻写 localStorage，下次启动读取。
 * SSR 安全：服务端返回 default tier，客户端 mount 后再读 localStorage，
 * 避免 hydration mismatch。
 */
export function useSpeechRate(): {
  tier: SpeechRateTier
  rate: number
  setTier: (tier: SpeechRateTier) => void
} {
  const [tier, setTierState] = useState<SpeechRateTier>(DEFAULT_TIER)

  // mount 后从 localStorage 读取
  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY)
      if (isValidTier(stored)) {
        setTierState(stored)
      }
    } catch {
      // localStorage 可能被禁用（隐私模式 / SSR），静默用默认值
    }
  }, [])

  const setTier = useCallback((next: SpeechRateTier) => {
    setTierState(next)
    try {
      window.localStorage.setItem(STORAGE_KEY, next)
    } catch {
      // 静默 —— 不阻塞 UI
    }
  }, [])

  return { tier, rate: tierToRate(tier), setTier }
}

// ─────────────────────────────────────────────────────────────────────
// UI 组件（3 档按钮）
// ─────────────────────────────────────────────────────────────────────

interface SpeechRateControlProps {
  /** 受控值（可选，父组件持有状态） */
  value?: SpeechRateTier
  /** 状态变化回调（可选） */
  onChange?: (tier: SpeechRateTier) => void
  /** 自定义 className（适老化） */
  className?: string
}

/**
 * 语速档位控制 —— 3 档大按钮（适老化：min-h ≥ 56px，大字）。
 *
 * 受控/非受控都支持：
 *   - 不传 value/onChange：自己用 useSpeechRate 管理（最常用）
 *   - 传了：父组件管理（便于测试 / 全局档位联动）
 */
export function SpeechRateControl({
  value,
  onChange,
  className,
}: SpeechRateControlProps = {}) {
  const { tier: hookTier, setTier: hookSetTier } = useSpeechRate()
  const tier = value ?? hookTier
  const setTier = onChange ?? hookSetTier

  return (
    <div
      className={className ?? 'w-full'}
      role="radiogroup"
      aria-label="语音播报语速"
    >
      <p className="text-base text-(--color-muted) mb-2 px-1">念的速度</p>
      <div className="grid grid-cols-3 gap-2">
        {SPEECH_RATE_OPTIONS.map((opt) => {
          const selected = opt.tier === tier
          return (
            <button
              key={opt.tier}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => setTier(opt.tier)}
              className={
                selected
                  ? 'min-h-[56px] px-3 py-3 rounded-xl bg-(--color-primary) text-white text-xl font-semibold shadow-sm border-2 border-(--color-primary)'
                  : 'min-h-[56px] px-3 py-3 rounded-xl bg-white hover:bg-(--color-soft) active:scale-[0.99] transition text-(--color-foreground) text-xl font-medium border-2 border-(--color-border)'
              }
            >
              {opt.label}
            </button>
          )
        })}
      </div>
    </div>
  )
}
