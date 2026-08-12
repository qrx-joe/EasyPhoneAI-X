/**
 * guardGuidanceRoute 安全不变量测试 —— 锁住 deep link 守卫的 4 风险等级
 * 行为、混合输入、空白兜底。
 *
 * 不测风险判断本身（那是 classify-risk.test.ts）；
 * 只测 deep link 守卫对各风险等级的决策。
 */
import assert from 'node:assert/strict'
import { describe, test } from 'node:test'

import { guardGuidanceRoute } from './deep-link-guard.ts'

describe('guardGuidanceRoute — 风险等级分流', () => {
  test('critical 风险（屏幕共享）→ 返回 /risk-alert href', () => {
    const href = guardGuidanceRoute('对方让我开屏幕共享')
    assert.ok(href?.startsWith('/risk-alert?'), `应返回 /risk-alert href,实际 ${href}`)
  })

  test('high 风险（陌生链接）→ 返回 /risk-alert href', () => {
    const href = guardGuidanceRoute('点这个陌生链接领奖')
    assert.ok(href?.startsWith('/risk-alert?'))
  })

  test('medium 风险（手机号）→ null（中风险仍走 /confirm 二次确认，guard 不升级）', () => {
    // 关键断言：guard 不改写 shouldStopGuidance() 的产品决策
    assert.equal(
      guardGuidanceRoute('对方问我手机号'),
      null,
      'medium 不应被 guard 升级到 /risk-alert —— deep link guard 不应改写产品分级语义',
    )
  })

  test('low 风险（微信没声音）→ null', () => {
    assert.equal(guardGuidanceRoute('微信没有声音了'), null)
  })
})

describe('guardGuidanceRoute — 混合输入（防 deep link 绕过）', () => {
  test('教程关键词 + 高风险关键词混合 → 返回 /risk-alert href', () => {
    // 这是漏洞复现：原本 /tutorial 接受此输入会渲染 wechat-no-sound 教程
    const href = guardGuidanceRoute('微信没有声音了，对方让我输验证码')
    assert.ok(
      href?.startsWith('/risk-alert?'),
      `混合输入应被守卫到 /risk-alert,实际 ${href}`,
    )
    // 进一步断言：href 里应带"验证码"作为匹配关键词
    const params = new URL(href ?? '', 'http://x').searchParams
    assert.ok(
      params.get('keywords')?.includes('验证码'),
      `混合输入应命中"验证码"关键词,实际 keywords=${params.get('keywords')}`,
    )
  })
})

describe('guardGuidanceRoute — 兜底', () => {
  test('空字符串 → null（各页面 own 兜底 redirect("/")）', () => {
    assert.equal(guardGuidanceRoute(''), null)
  })

  test('纯空白 → null', () => {
    assert.equal(guardGuidanceRoute('   \t\n  '), null)
  })
})
