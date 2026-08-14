import { expect, test, type Page } from '@playwright/test'

/**
 * 阶段 A-5 Web 无障碍验收（可自动化部分）：
 * 1. 键盘可以完成：文字提问 → 指导 → 推进 → 停止并找家人 → 返回（方案阶段 A 验收）。
 * 2. 高风险停止路径的「发给家人」出口键盘可达。
 * 3. 200% 文字缩放下关键按钮不裁切（用 html font-size 翻倍近似文字缩放；
 *    真实系统文字缩放 / TalkBack 仍需人工记录，见 docs/证据清单.md）。
 */

/** 连续按 Tab 直到目标按钮成为焦点（不依赖精确的 Tab 序号，防止 UI 微调 brittle） */
async function tabToButton(page: Page, name: string, maxTabs = 25) {
  const target = page.getByRole('button', { name })
  for (let i = 0; i < maxTabs; i++) {
    if (await target.evaluate((el) => document.activeElement === el)) {
      return target
    }
    await page.keyboard.press('Tab')
  }
  throw new Error(`键盘无法到达按钮「${name}」（${maxTabs} 次 Tab 内）`)
}

test('键盘完成主流程：提问 → 指导 → 推进 → 停止并找家人 → 回首页', async ({ page }) => {
  await page.goto('/assist')

  // 仅用键盘：Tab 到文字输入框并填写
  await tabToButton(page, '点这里说问题') // 第一个可聚焦控件是语音按钮
  await page.keyboard.press('Tab') // 下一个是文字输入框
  await page.keyboard.type('微信没有声音了')

  // Tab 到提交按钮（中间会经过隐藏的文件选择控件）并回车
  const submit = await tabToButton(page, '给我安全的下一步')
  await submit.focus()
  await page.keyboard.press('Enter')

  // guide 面板：aria-live + 焦点在步骤标题上
  await expect(page.getByRole('heading', { name: '打开微信' })).toBeVisible()
  await expect(page.locator('main[aria-busy]')).toBeVisible()
  await expect(page.locator('main[aria-live="polite"]')).toBeVisible()
  await expect(page.getByRole('heading', { name: '打开微信' })).toBeFocused()

  // 键盘推进到第 2 步
  const seen = await tabToButton(page, '我看到了')
  await seen.focus()
  await page.keyboard.press('Enter')
  await expect(page.getByRole('heading', { name: '点右下角「我」' })).toBeFocused()

  // 键盘触发「停止并找家人」
  const stop = await tabToButton(page, '停止并找家人')
  await stop.focus()
  await page.keyboard.press('Enter')
  await expect(page.getByRole('heading', { name: '已经停下来了' })).toBeVisible()

  // 键盘返回首页
  const home = await tabToButton(page, '回首页')
  await home.focus()
  await page.keyboard.press('Enter')
  await expect(page.getByRole('heading', { name: '遇到什么问题了？' })).toBeVisible()
})

test('高风险停止路径：「发给家人」出口键盘可达', async ({ page }) => {
  await page.goto('/assist')
  await page.getByLabel('用文字描述问题').fill('对方让我开屏幕共享')
  await page.getByRole('button', { name: '给我安全的下一步' }).click()

  await expect(page.getByRole('heading', { name: '先停下来' })).toBeFocused()
  await tabToButton(page, '发给家人') // 断言可达，不实际点击（剪贴板/分享面板不适合无头验证）
})

test('200% 文字缩放下关键按钮不裁切（html font-size 翻倍近似）', async ({ page }) => {
  await page.goto('/assist')
  await page.addStyleTag({ content: 'html { font-size: 200% !important; }' })

  const viewportWidth = page.viewportSize()?.width ?? 393

  // 编辑页主按钮完整可见
  const submit = page.getByRole('button', { name: '给我安全的下一步' })
  await expect(submit).toBeVisible()
  const submitBox = await submit.boundingBox()
  expect(submitBox).not.toBeNull()
  expect(submitBox!.x + submitBox!.width).toBeLessThanOrEqual(viewportWidth + 1)

  // 提交后教练面板按钮同样不裁切
  await page.getByLabel('用文字描述问题').fill('微信没有声音了')
  await submit.click()
  const seen = page.getByRole('button', { name: '我看到了' })
  await expect(seen).toBeVisible()
  const seenBox = await seen.boundingBox()
  expect(seenBox).not.toBeNull()
  expect(seenBox!.x + seenBox!.width).toBeLessThanOrEqual(viewportWidth + 1)
  const stopBox = await page.getByRole('button', { name: '停止并找家人' }).boundingBox()
  expect(stopBox).not.toBeNull()
  expect(stopBox!.x + stopBox!.width).toBeLessThanOrEqual(viewportWidth + 1)
})
