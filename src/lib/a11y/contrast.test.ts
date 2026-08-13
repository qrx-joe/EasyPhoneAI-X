/**
 * 对比度计算器的两层测试：
 * (A) WCAG 公式正确性（用官方已知值锁）
 * (B) 项目设计令牌契约（实际在用的前景 × 背景配对）
 *
 * 改 globals.css 的 --color-* 必须同步改这里的 COLORS 常量，并跑这个文件全过。
 */
import assert from 'node:assert/strict'
import { describe, test } from 'node:test'

import { contrastRatio, passesAA, passesAAA, relativeLuminance } from './contrast.ts'

// ─────────────────────────────────────────────────────────────
// Suite A：WCAG 公式正确性（用官方已知值锁，防止公式写错）
// ─────────────────────────────────────────────────────────────

describe('WCAG 公式正确性', () => {
  test('黑对白 = 21:1（理论最大）', () => {
    assert.equal(contrastRatio('#000000', '#ffffff'), 21)
    assert.equal(contrastRatio('#ffffff', '#000000'), 21) // 顺序无关
  })

  test('同色 = 1:1（理论最小）', () => {
    assert.equal(contrastRatio('#ffffff', '#ffffff'), 1)
    assert.equal(contrastRatio('#6b7280', '#6b7280'), 1)
  })

  test('#777777 对白 ≈ 4.48（WebAIM 官方示例，锁公式精度）', () => {
    // WebAIM contrast checker 对 #777777 on #ffffff 给出 4.48
    // 保留两位小数，允许 ±0.02 浮点误差
    const ratio = contrastRatio('#777777', '#ffffff')
    assert.ok(ratio >= 4.46 && ratio <= 4.50, `#777 on white 应 ≈ 4.48,实际 ${ratio}`)
  })

  test('相对亮度：纯黑 0、纯白 1', () => {
    assert.equal(relativeLuminance('#000000'), 0)
    assert.equal(relativeLuminance('#ffffff'), 1)
  })

  test('非法 hex 抛错（防止静默吞错）', () => {
    assert.throws(() => contrastRatio('#zzz', '#fff'))
    assert.throws(() => contrastRatio('red', '#fff')) // 不收命名色
    assert.throws(() => contrastRatio('#12', '#fff')) // 位数不对
  })

  test('3 位简写与 6 位展开结果一致', () => {
    assert.equal(contrastRatio('#fff', '#000'), contrastRatio('#ffffff', '#000000'))
    assert.equal(contrastRatio('#abc', '#fff'), contrastRatio('#aabbcc', '#ffffff'))
  })

  test('passesAA 阈值：正文 4.5 / 大字 3', () => {
    assert.equal(passesAA(4.5), true)
    assert.equal(passesAA(4.49), false)
    assert.equal(passesAA(3, { large: true }), true)
    assert.equal(passesAA(2.99, { large: true }), false)
  })
})

// ─────────────────────────────────────────────────────────────
// Suite B：设计令牌契约（项目真实在用的 fg × bg 配对）
//
// 这里的色值必须与 src/app/globals.css @theme 里的 --color-* 一致。
// 改 globals.css 时同步改这里，不然测试会立刻红。
// ─────────────────────────────────────────────────────────────

// 与 globals.css @theme 完全对应；改那边必须同步改这里。
const COLORS = {
  background: '#ffffff',
  foreground: '#182230',
  primary: '#1d5fd1',
  primaryHover: '#164ba7',
  primarySoft: '#eaf2ff',
  danger: '#c62828',
  dangerHover: '#a91f1f',
  dangerSoft: '#fff0f0',
  muted: '#596579',
  soft: '#f4f6f8',
  softHover: '#e8edf3',
  border: '#cbd5e1',
} as const

describe('设计令牌契约：实际在用的前景 × 背景配对', () => {
  test('foreground × background（全站正文基底）', () => {
    const r = contrastRatio(COLORS.foreground, COLORS.background)
    assert.ok(passesAA(r), `全站正文必须过 AA,实际 ${r}:1`)
    // 182230 接近纯黑，应远超阈值。
    assert.ok(r > 15, `foreground 应远超 AA,实际仅 ${r}:1`)
  })

  test('foreground × soft（教程/求助卡里的强调正文）', () => {
    const r = contrastRatio(COLORS.foreground, COLORS.soft)
    assert.ok(passesAA(r), `foreground on soft 必须过 AA,实际 ${r}:1`)
  })

  test('white × primary（蓝色主按钮文字）', () => {
    const r = contrastRatio('#ffffff', COLORS.primary)
    assert.ok(passesAA(r), `主按钮白字必须过 AA,实际 ${r}:1`)
  })

  test('white × danger（求助卡标题文字）', () => {
    const r = contrastRatio('#ffffff', COLORS.danger)
    assert.ok(passesAA(r), `求助卡白字必须过 AA,实际 ${r}:1`)
  })

  test('white × primary-hover（hover 态白字）', () => {
    const r = contrastRatio('#ffffff', COLORS.primaryHover)
    assert.ok(passesAA(r), `primary-hover 白字必须过 AA,实际 ${r}:1`)
  })

  // ─── 已知临界值，如实记录跟踪（不调色、不 fail）──────────
  // muted × white 已过 AA；AAA 仍留作长期目标。
  // 刻意 test.skip 跟踪：不偷偷调深（调色是设置页该解决的）。
  test.skip('muted × white 应 ≥ 7:1（目标 AAA，留待设置页统一调）', () => {
    const r = contrastRatio(COLORS.muted, COLORS.background)
    assert.ok(passesAAA(r), `muted on white 当前 ${r}:1,目标 AAA ≥ 7`)
  })

  test('muted × soft（柔和容器内的辅助文字）', () => {
    const r = contrastRatio(COLORS.muted, COLORS.soft)
    assert.ok(passesAA(r), `muted on soft 必须过 AA,实际 ${r}:1`)
  })
})
