import { expect, test } from '@playwright/test'

async function submitText(page: import('@playwright/test').Page, text: string) {
  await page.goto('/assist')
  await page.getByLabel('用文字描述问题').fill(text)
  await page.getByRole('button', { name: '给我安全的下一步' }).click()
}

test('低风险：微信声音返回一个审核步骤', async ({ page }) => {
  await submitText(page, '微信没有声音了')

  await expect(page.getByText('现在只做这一步')).toBeVisible()
  await expect(page.getByRole('heading', { name: '打开微信' })).toBeVisible()
  await expect(page.getByText('做完后应该看到：让微信声音回来')).toBeVisible()
})

test('中风险：退款只返回平台内审核步骤', async ({ page }) => {
  await submitText(page, '淘宝退款')

  await expect(page.getByRole('heading', { name: '先打开订单详情' })).toBeVisible()
  await expect(page.getByText(/不要点击聊天里收到的退款链接/)).toBeVisible()
  await expect(page.getByRole('button', { name: /发给家人/ })).toHaveCount(0)
})

test('高风险：屏幕共享直接停止且没有继续操作', async ({ page }) => {
  await submitText(page, '对方让我开屏幕共享')

  await expect(page.getByRole('heading', { name: '先停下来' })).toBeVisible()
  await expect(page.getByRole('button', { name: '发给家人' })).toBeVisible()
  await expect(page.getByRole('button', { name: /继续/ })).toHaveCount(0)
})
