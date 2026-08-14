import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  // 并行度收敛到 4：Windows 上反复运行会积累 TIME_WAIT 连接，7 worker 并发时
  // 会出现连接被重置（页面报「网络连接失败」）和 evaluate 超时的环境抖动。
  workers: 4,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 1,
  reporter: 'list',
  use: {
    baseURL: 'http://127.0.0.1:3100',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'mobile-chrome',
      use: { ...devices['Pixel 5'], channel: 'chrome' },
    },
  ],
  webServer: process.env.PLAYWRIGHT_EXTERNAL_SERVER
    ? undefined
    : {
        command: 'node node_modules/next/dist/bin/next start --hostname 127.0.0.1 --port 3100',
        url: 'http://127.0.0.1:3100',
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
      },
})
