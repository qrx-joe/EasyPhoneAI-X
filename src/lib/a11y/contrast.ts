/**
 * WCAG 2.x 对比度计算的纯函数：hex → 相对亮度 → 对比度比值 → AA/AAA 判定。
 *
 * 适老化对比度的「计量器」。无副作用、无 IO、不读 globals.css
 * （测试文件把设计令牌的 hex 显式喂进来，这样改 CSS 变量时测试不会静默失效）。
 *
 * 参考：
 * - WCAG 2.x §1.4.3 Contrast (Minimum)
 * - 相对亮度公式：https://www.w3.org/TR/WCAG21/#dfn-relative-luminance
 * - 阈值：正文 ≥4.5:1；大字（≥18.66px 常规 或 ≥14px 粗体）≥3:1；AAA 正文 ≥7:1。
 */

/**
 * 把 hex（#rgb 或 #rrggbb）转成 [r,g,b]，每通道 0~1 线性 sRGB。
 * 不接受 alpha / 命名色 / hsl —— 这个项目所有色值都是 hex，保持窄而严。
 */
function hexToRgb01(hex: string): readonly [number, number, number] {
  const clean = hex.trim().replace(/^#/, '').toLowerCase()
  if (!/^[0-9a-f]{3}([0-9a-f]{3})?$/.test(clean)) {
    throw new Error(`contrast: 不支持的 hex 格式(只收 #rgb / #rrggbb): ${hex}`)
  }
  const full = clean.length === 3
    ? clean.split('').map((c) => c + c).join('')
    : clean
  const r8 = parseInt(full.slice(0, 2), 16)
  const g8 = parseInt(full.slice(2, 4), 16)
  const b8 = parseInt(full.slice(4, 6), 16)
  return [r8 / 255, g8 / 255, b8 / 255] as const
}

/** sRGB 通道值 → 线性亮度（WCAG 定义）。 */
function channelToLinear(c: number): number {
  return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
}

/**
 * WCAG 相对亮度 L（0=全黑，1=全白）。
 * 公式：L = 0.2126*R + 0.7152*G + 0.0722*B（R/G/B 为线性化后的通道值）。
 */
export function relativeLuminance(hex: string): number {
  const [r, g, b] = hexToRgb01(hex)
  return 0.2126 * channelToLinear(r) + 0.7152 * channelToLinear(g) + 0.0722 * channelToLinear(b)
}

/**
 * WCAG 对比度比值（1.0~21.0，保留两位小数）。
 * 公式：(L_light + 0.05) / (L_dark + 0.05)。
 * fg/bg 顺序无关 —— 内部取大除小，符合 WCAG 定义。
 */
export function contrastRatio(fg: string, bg: string): number {
  const lf = relativeLuminance(fg)
  const lb = relativeLuminance(bg)
  const light = Math.max(lf, lb)
  const dark = Math.min(lf, lb)
  return Math.round(((light + 0.05) / (dark + 0.05)) * 100) / 100
}

/** 「大字」阈值选项。 */
export interface ContrastThresholdOptions {
  /** true = 按 WCAG 大字阈值判定（正文 4.5:1 → 3:1；AAA 7:1 → 4.5:1）。默认 false（按正文）。 */
  large?: boolean
}

/**
 * AA 是否通过（正文 ≥4.5:1，大字 ≥3:1）。
 * 这是项目显式承诺的合规线，也是 PR 必过的硬门。
 */
export function passesAA(ratio: number, opts: ContrastThresholdOptions = {}): boolean {
  return ratio >= (opts.large ? 3 : 4.5)
}

/**
 * AAA 是否通过（正文 ≥7:1，大字 ≥4.5:1）。
 * 项目未承诺 AAA，这里只作为「最佳实践参考」暴露。
 */
export function passesAAA(ratio: number, opts: ContrastThresholdOptions = {}): boolean {
  return ratio >= (opts.large ? 4.5 : 7)
}
