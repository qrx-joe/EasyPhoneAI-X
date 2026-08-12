/**
 * Deep link 守卫 wiring 测试（结构化合同测试）。
 *
 * 锁住"页面真的接上 guardGuidanceRoute"这件事：读页面源码做正则断言，
 * 验证页面在主逻辑之前调用了 guard 并条件 redirect。
 *
 * 重要：本测试依赖第五阶段才创建的页面文件：
 *   - src/app/tutorial/page.tsx
 *   - src/app/confirm/page.tsx
 *
 * 第二阶段这些页面还不存在，所有用例 test.skip。
 * 第五阶段页面就位后，逐个移除 .skip 恢复执行。
 *
 * 不变量（页面就位后生效）：
 * - 存在性不变量：guard 必须被真实赋值 + 真实条件 redirect
 * - 位置不变量：guard 调用必须在主逻辑之前
 */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, test } from 'node:test'

// HERE = <project_root>/src/domain/routing/
// 3 层回退到 project root
const HERE = dirname(fileURLToPath(import.meta.url))
const PROJECT_ROOT = resolve(HERE, '..', '..', '..')

function readPageSource(relativePath: string): string {
  return readFileSync(resolve(PROJECT_ROOT, relativePath), 'utf8')
}

describe('deep link guard — 页面 wiring 回归（第五阶段页面就位后启用）', () => {
  test.skip('/tutorial/page.tsx 真实调了 guardGuidanceRoute(cleanText) 并 redirect', () => {
    const src = readPageSource('src/app/tutorial/page.tsx')
    assert.ok(
      /const\s+guard\s*=\s*guardGuidanceRoute\(\s*cleanText\s*\)/.test(src),
      '/tutorial/page.tsx 必须有真实赋值 const guard = guardGuidanceRoute(cleanText)',
    )
    assert.ok(
      /if\s*\(\s*guard\s*\)\s*\{\s*redirect\(\s*guard\s*\)/.test(src),
      '/tutorial/page.tsx 必须有真实条件 redirect if (guard) { redirect(guard) }',
    )
  })

  test.skip('/tutorial/page.tsx 的 guard 调用在 findTutorial 之前（位置不变量）', () => {
    const src = readPageSource('src/app/tutorial/page.tsx')
    const guardIdx = src.search(/guardGuidanceRoute\(\s*cleanText\s*\)/)
    const findIdx = src.search(/findTutorial\(\s*cleanText\s*\)/)
    assert.ok(guardIdx > 0, '先确保 guard 调用存在')
    assert.ok(findIdx > 0, '先确保 findTutorial 调用存在')
    assert.ok(
      guardIdx < findIdx,
      `guard 调用必须在 findTutorial 之前,实际 guard@${guardIdx}, findTutorial@${findIdx}`,
    )
  })

  test.skip('/confirm/page.tsx 真实调了 guardGuidanceRoute(cleanText) 并 redirect', () => {
    const src = readPageSource('src/app/confirm/page.tsx')
    assert.ok(
      /const\s+guard\s*=\s*guardGuidanceRoute\(\s*cleanText\s*\)/.test(src),
      '/confirm/page.tsx 必须有真实赋值 const guard = guardGuidanceRoute(cleanText)',
    )
    assert.ok(
      /if\s*\(\s*guard\s*\)\s*\{\s*redirect\(\s*guard\s*\)/.test(src),
      '/confirm/page.tsx 必须有真实条件 redirect if (guard) { redirect(guard) }',
    )
  })

  test.skip('/confirm/page.tsx 的 guard 调用在主渲染之前（位置不变量）', () => {
    const src = readPageSource('src/app/confirm/page.tsx')
    const guardIdx = src.search(/guardGuidanceRoute\(\s*cleanText\s*\)/)
    const actionsIdx = src.search(/<ConfirmActions\s/)
    assert.ok(guardIdx > 0, '先确保 guard 调用存在')
    assert.ok(actionsIdx > 0, '先确保 ConfirmActions 渲染存在')
    assert.ok(
      guardIdx < actionsIdx,
      `guard 调用必须在 ConfirmActions 之前,实际 guard@${guardIdx}, ConfirmActions@${actionsIdx}`,
    )
  })
})
