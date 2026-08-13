/**
 * Playwright 录制脚本 v2 —— 驱动「爸妈别急」四条页面演示场景。
 *
 * 改进（相比 v1）：
 *  - 用 page.video().path() 拿到真实文件路径再改名，避免 hash 文件名遗留
 *  - scene4 加长等待，确保红色风险页和求助卡充分展示
 *  - 每个场景用独立 page（同 context），video 自动按 page 分文件
 */
import { chromium, devices } from '@playwright/test'
import { mkdirSync, readdirSync, renameSync, copyFileSync, existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const RAW_DIR = join(__dirname, '..', 'raw')
const BASE = 'http://127.0.0.1:3100'

mkdirSync(RAW_DIR, { recursive: true })

const VIEWPORT = { width: 393, height: 851 }

/** 等待并落盘一个场景的视频，返回保存后的文件名 */
async function recordScene(context, name, driver) {
  const page = await context.newPage()
  console.log(`  ▶ ${name} ...`)
  try {
    await driver(page)
  } catch (err) {
    console.error(`    ERROR in ${name}: ${err.message}`)
  }
  const video = page.video()
  const tmpPath = await video.path()
  await page.close()
  await context.close() // 确保 video 落盘

  const destPath = join(RAW_DIR, `${name}.webm`)
  // 视频可能在 page.close 后还在写，等一下再复制
  await new Promise((r) => setTimeout(r, 500))
  copyFileSync(tmpPath, destPath)
  console.log(`    ✓ saved ${name}.webm`)
  return destPath
}

// ─── 场景 1：首页展示 ───────────────────────────────────
async function scene1_home(page) {
  await page.goto(BASE + '/', { waitUntil: 'networkidle' })
  await page.waitForTimeout(3000)
  // 缓慢向下滚动，展示示例磁贴
  await page.evaluate(() => {
    document.querySelector('main')?.scrollTo({ top: 250, behavior: 'smooth' })
  })
  await page.waitForTimeout(4000)
  await page.evaluate(() => {
    document.querySelector('main')?.scrollTo({ top: 0, behavior: 'smooth' })
  })
  await page.waitForTimeout(5000)
}

// ─── 场景 2：低风险 — 微信没声音 ──────────────────────────
async function scene2_low_risk(page) {
  await page.goto(BASE + '/', { waitUntil: 'networkidle' })
  await page.waitForTimeout(2000)
  await page.getByRole('button', { name: '微信没有声音了' }).click()
  await page.waitForURL('**/assist**')
  await page.waitForLoadState('networkidle')
  await page.waitForTimeout(2000)
  await page.getByRole('button', { name: '给我安全的下一步' }).click()
  await page.getByText('现在只做这一步').waitFor({ state: 'visible' })
  await page.waitForTimeout(2500)
  // 念给我听
  const speakBtn = page.getByRole('button', { name: /念给我听/ })
  if (await speakBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
    await speakBtn.click()
    await page.waitForTimeout(9000)
  }
  await page.waitForTimeout(8000)
}

// ─── 场景 3：中风险 — 淘宝退款 ────────────────────────────
async function scene3_mid_risk(page) {
  await page.goto(BASE + '/assist', { waitUntil: 'networkidle' })
  await page.waitForTimeout(2000)
  const textarea = page.getByLabel('用文字描述问题')
  await textarea.click()
  for (const ch of '淘宝退款') {
    await textarea.type(ch, { delay: 180 })
  }
  await page.waitForTimeout(2000)
  // 滚动到按钮
  await page.getByRole('button', { name: '给我安全的下一步' }).scrollIntoViewIfNeeded()
  await page.waitForTimeout(1000)
  await page.getByRole('button', { name: '给我安全的下一步' }).click()
  await page.getByRole('heading', { name: '先打开订单详情' }).waitFor({ state: 'visible' })
  await page.waitForTimeout(3000)
  // 展示安全警告
  await page.evaluate(() => {
    document.querySelector('main')?.scrollTo({ top: 150, behavior: 'smooth' })
  })
  await page.waitForTimeout(6000)
  await page.evaluate(() => {
    document.querySelector('main')?.scrollTo({ top: 0, behavior: 'smooth' })
  })
  await page.waitForTimeout(7000)
}

// ─── 场景 4：高风险 — 银行冻结/屏幕共享 ───────────────────
async function scene4_high_risk(page) {
  await page.goto(BASE + '/', { waitUntil: 'networkidle' })
  await page.waitForTimeout(2500)
  // 滚动展示带风险角标的磁贴
  await page.evaluate(() => {
    document.querySelector('main')?.scrollTo({ top: 350, behavior: 'smooth' })
  })
  await page.waitForTimeout(2500)
  // 点击高风险示例
  await page.getByRole('button', { name: '银行短信说账户被冻结' }).click()
  await page.waitForURL('**/assist**')
  await page.waitForLoadState('networkidle')
  await page.waitForTimeout(2000)
  await page.getByRole('button', { name: '给我安全的下一步' }).scrollIntoViewIfNeeded()
  await page.waitForTimeout(500)
  await page.getByRole('button', { name: '给我安全的下一步' }).click()
  // 等待红色"先停下来"出现
  await page.getByRole('heading', { name: '先停下来' }).waitFor({ state: 'visible', timeout: 5000 })
  await page.waitForTimeout(4000)
  // 缓慢滚动展示求助卡内容
  await page.evaluate(() => {
    document.querySelector('main')?.scrollTo({ top: 300, behavior: 'smooth' })
  })
  await page.waitForTimeout(5000)
  await page.evaluate(() => {
    document.querySelector('main')?.scrollTo({ top: 600, behavior: 'smooth' })
  })
  await page.waitForTimeout(5000)
  // 展示"发给家人"按钮
  await page.evaluate(() => {
    document.querySelector('main')?.scrollTo({ top: 100, behavior: 'smooth' })
  })
  await page.waitForTimeout(3000)
  await page.getByRole('button', { name: '发给家人' }).scrollIntoViewIfNeeded()
  await page.waitForTimeout(2000)
  // 不真的点击分享（headless 下 navigator.share 行为不确定）
  // 只展示按钮即可
  await page.waitForTimeout(5000)
}

const SCENES = [
  { name: 'scene1-home', fn: scene1_home },
  { name: 'scene2-low-risk', fn: scene2_low_risk },
  { name: 'scene3-mid-risk', fn: scene3_mid_risk },
  { name: 'scene4-high-risk', fn: scene4_high_risk },
]

async function main() {
  // --use-gl=swiftshader is required: without it, headless Chrome's video
  // recording captures a blank white surface (known Playwright/Chrome issue).
  const browser = await chromium.launch({
    headless: true,
    channel: 'chrome',
    args: ['--use-gl=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist'],
  })
  console.log(`Recording ${SCENES.length} scenes...`)

  for (const scene of SCENES) {
    const context = await browser.newContext({
      ...devices['Pixel 5'],
      viewport: VIEWPORT,
      recordVideo: { dir: RAW_DIR, size: VIEWPORT },
    })
    await recordScene(context, scene.name, scene.fn)
  }

  await browser.close()

  // 清理遗留的 hash 文件名
  for (const f of readdirSync(RAW_DIR)) {
    if (f.startsWith('page@') && f.endsWith('.webm')) {
      // 这些是旧的残留，删除
      const { unlinkSync } = await import('node:fs')
      try { unlinkSync(join(RAW_DIR, f)) } catch {}
    }
  }
  console.log('Done. Files:')
  for (const f of readdirSync(RAW_DIR).filter((f) => f.endsWith('.webm')).sort()) {
    console.log(`  ${f}`)
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
