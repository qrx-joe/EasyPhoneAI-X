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
  await expect(page.getByText('做完后应该看到：屏幕变成微信的聊天列表,能看到最近聊过的人')).toBeVisible()
})

test('教练闭环：微信教程可从第一步推进到最后一步（阶段 A 验收）', async ({ page }) => {
  await submitText(page, '微信没有声音了')

  // 5 步教程：每步「我看到了」推进，索引由服务端会话维护
  const stepTitles = [
    '打开微信',
    '点右下角「我」',
    '点「设置」',
    '点「聊天」',
    '打开「通知」和「声音」',
  ]
  for (let i = 0; i < stepTitles.length; i++) {
    await expect(page.getByRole('heading', { name: stepTitles[i] })).toBeVisible()
    await expect(page.getByText(`第 ${i + 1} 步，共 ${stepTitles.length} 步`)).toBeVisible()
    await page.getByRole('button', { name: '我看到了' }).click()
  }

  // 最后一步确认后进入完成面板，不可重复推进
  await expect(page.getByRole('heading', { name: '都做完了' })).toBeVisible()
})

test('「没看到」换一种说法，不自动进入下一步', async ({ page }) => {
  await submitText(page, '微信没有声音了')

  await page.getByRole('button', { name: '没看到' }).click()
  await expect(page.getByText('换一种说法')).toBeVisible()
  await expect(page.getByText(/退回到手机最开始的页面/)).toBeVisible()
  // 仍然停在第 1 步
  await expect(page.getByRole('heading', { name: '打开微信' })).toBeVisible()
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

test('语音确认：识别结果未经确认不会调用决策 API（阶段 A-1 验收）', async ({ page }) => {
  // 注入伪造的 SpeechRecognition：start() 后异步吐出一条 final 结果
  await page.addInitScript(() => {
    class FakeSpeechRecognition {
      lang = 'zh-CN'
      continuous = false
      interimResults = true
      maxAlternatives = 1
      onresult: ((event: unknown) => void) | null = null
      onerror: ((event: unknown) => void) | null = null
      onend: (() => void) | null = null
      start() {
        setTimeout(() => {
          this.onresult?.({
            resultIndex: 0,
            results: [{ isFinal: true, 0: { transcript: '微信没有声音了' } }],
          })
          setTimeout(() => this.onend?.(), 20)
        }, 60)
      }
      stop() {}
      abort() {}
    }
    ;(window as unknown as Record<string, unknown>).SpeechRecognition = FakeSpeechRecognition
  })

  let decisionCalls = 0
  await page.route('**/api/v2/decision', async (route) => {
    decisionCalls += 1
    await route.continue()
  })

  await page.goto('/assist')
  await page.getByRole('button', { name: '点这里说问题' }).click()

  // 识别结束 → 出现「我听到的是」确认面板，此时不得发起决策请求
  const confirmPanel = page.getByTestId('voice-confirm')
  await expect(confirmPanel).toBeVisible()
  await expect(confirmPanel.getByText('微信没有声音了')).toBeVisible()
  await page.waitForTimeout(200)
  expect(decisionCalls).toBe(0)

  // 确认后才提交，并走正式决策链出 guide
  await confirmPanel.getByRole('button', { name: '对，就是这个' }).click()
  await expect(page.getByRole('heading', { name: '打开微信' })).toBeVisible()
  expect(decisionCalls).toBe(1)
})

test('语音确认：「改一改」只填文本并聚焦编辑框，仍不提交', async ({ page }) => {
  await page.addInitScript(() => {
    class FakeSpeechRecognition {
      lang = 'zh-CN'
      continuous = false
      interimResults = true
      maxAlternatives = 1
      onresult: ((event: unknown) => void) | null = null
      onerror: ((event: unknown) => void) | null = null
      onend: (() => void) | null = null
      start() {
        setTimeout(() => {
          this.onresult?.({
            resultIndex: 0,
            results: [{ isFinal: true, 0: { transcript: '手机字太小看不清' } }],
          })
          setTimeout(() => this.onend?.(), 20)
        }, 60)
      }
      stop() {}
      abort() {}
    }
    ;(window as unknown as Record<string, unknown>).SpeechRecognition = FakeSpeechRecognition
  })

  let decisionCalls = 0
  await page.route('**/api/v2/decision', async (route) => {
    decisionCalls += 1
    await route.continue()
  })

  await page.goto('/assist')
  await page.getByRole('button', { name: '点这里说问题' }).click()

  const confirmPanel = page.getByTestId('voice-confirm')
  await expect(confirmPanel).toBeVisible()
  await confirmPanel.getByRole('button', { name: '改一改' }).click()

  // 文本已填入编辑框且焦点在编辑框；决策未被调用
  await expect(page.getByLabel('用文字描述问题')).toHaveValue('手机字太小看不清')
  await expect(page.getByLabel('用文字描述问题')).toBeFocused()
  expect(decisionCalls).toBe(0)
})
