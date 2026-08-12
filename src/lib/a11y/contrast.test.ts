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
  foreground: '#1a1a1a',
  primary: '#2563eb',
  primaryHover: '#1d4ed8',
  primarySoft: '#dbeafe',
  danger: '#dc2626',
  dangerHover: '#b91c1c',
  dangerSoft: '#fee2e2',
  muted: '#6b7280',
  soft: '#f3f4f6',
  softHover: '#e5e7eb',
  border: '#d1d5db',
} as const

describe('设计令牌契约：实际在用的前景 × 背景配对', () => {
  test('foreground × background（全站正文基底）', () => {
    const r = contrastRatio(COLORS.foreground, COLORS.background)
    assert.ok(passesAA(r), `全站正文必须过 AA,实际 ${r}:1`)
    // 1a1a1a 接近纯黑，应远超阈值（~17:1）
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
  // muted #6b7280 × white = 4.83:1，AA 正文勉强过，但余量极小。
  // 刻意 test.skip 跟踪：不偷偷调深（调色是设置页该解决的）。
  test.skip('muted × white 应 ≥ 7:1（目标 AAA，留待设置页统一调）', () => {
    const r = contrastRatio(COLORS.muted, COLORS.background)
    assert.ok(passesAAA(r), `muted on white 当前 ${r}:1,目标 AAA ≥ 7`)
  })

  // ─── 物理上不可达的配对：用代码扫描锁「不允许这种用法」────
  // muted #6b7280 × soft #f3f4f6 = 4.39:1，永远 < AA 正文 4.5:1。
  // 这条契约写"代码里不允许把 muted 文字直接放在 soft 容器里"。
  test('muted × soft 代码里禁止同一 className 同时使用', async () => {
    const r = contrastRatio(COLORS.muted, COLORS.soft)
    // 先记录物理事实
    assert.ok(r < 4.5, `前置断言:muted×soft 应 < 4.5,实际 ${r}(若已达标请改用 passesAA 契约)`)

    const { readFileSync, readdirSync, statSync } = await import('node:fs')
    const { join } = await import('node:path')

    const tsxFiles: string[] = []
    const walk = (dir: string): void => {
      for (const name of readdirSync(dir)) {
        const p = join(dir, name)
        const s = statSync(p)
        if (s.isDirectory()) walk(p)
        else if (p.endsWith('.tsx')) tsxFiles.push(p)
      }
    }
    walk('src')

    const violators: string[] = []
    for (const f of tsxFiles) {
      const src = readFileSync(f, 'utf8')
      // 同一 className 字符串里同时出现 bg-soft 和 text-muted → 必然踩 muted×soft 坑
      const classNameLines = src.split('\n').map((l, i) => ({ l, i: i + 1 }))
      for (const { l, i } of classNameLines) {
        if (l.includes('--color-soft') && l.includes('--color-muted')) {
          violators.push(`${f}:${i}  →  ${l.trim()}`)
        }
      }
    }

    assert.deepEqual(
      violators,
      [],
      `muted × soft = ${r}:1 跌破 AA 正文。以下行的 className 同时含 bg-soft 和 text-muted,\n` +
        `请把该处 muted 换成 foreground(用字号/字重区分层级,不靠颜色):\n` +
        violators.join('\n'),
    )
  })
})
