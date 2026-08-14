/**
 * 教程匹配 + 库覆盖测试。
 *
 * 重点：
 * 1. 真实老人会用的几种说法（同义词）都能匹配。
 * 2. 不相关输入匹配不到 → 返回 null。
 * 3. 高风险输入即使关键词匹配上，也不应被 safeTutorialsFor 放出来。
 * 4. 关键词多的教程（更具体）优先命中。
 */
import assert from 'node:assert/strict'
import { describe, test } from 'node:test'

import { TUTORIALS, findTutorial, safeTutorialsFor, tutorialAllowsRisk } from './tutorial.ts'

describe('TUTORIALS 库', () => {
  test('至少有 3 个教程（含中风险退款）', () => {
    assert.ok(TUTORIALS.length >= 3)
    const ids = TUTORIALS.map((t) => t.id)
    assert.ok(ids.includes('wechat-no-sound'))
    assert.ok(ids.includes('font-too-small'))
    assert.ok(ids.includes('ecommerce-refund'))
  })

  test('每个教程至少有 1 个匹配关键词 + 1 个步骤', () => {
    for (const tut of TUTORIALS) {
      assert.ok(tut.matchKeywords.length >= 1, `${tut.id} 没有匹配关键词`)
      assert.ok(tut.steps.length >= 1, `${tut.id} 没有步骤`)
      for (const step of tut.steps) {
        assert.ok(step.title.length > 0, `${tut.id}/${step.id} 缺 title`)
        assert.ok(step.instruction.length > 0, `${tut.id}/${step.id} 缺 instruction`)
      }
    }
  })

  test('步骤 id 在教程内唯一', () => {
    for (const tut of TUTORIALS) {
      const ids = tut.steps.map((s) => s.id)
      assert.equal(new Set(ids).size, ids.length, `${tut.id} 步骤 id 重复`)
    }
  })

  test('所有教程 maxLevel <= medium（高风险路由到风险页）', () => {
    for (const tut of TUTORIALS) {
      assert.ok(
        tut.maxLevel === 'low' || tut.maxLevel === 'medium',
        `${tut.id} 的 maxLevel 应该是 low/medium,不能是 high/critical`,
      )
    }
  })

  test('app 字段（如有）必须是已知 App', () => {
    const KNOWN_APPS = ['wechat', 'sms', 'whatsapp', 'system', 'ecommerce']
    for (const tut of TUTORIALS) {
      if (tut.app !== undefined) {
        assert.ok(
          KNOWN_APPS.includes(tut.app),
          `${tut.id} 的 app 不在已知列表,AppIcon 会渲染不出磁贴`,
        )
      }
    }
  })
})

describe('findTutorial', () => {
  test('微信没声音（同义说法）都能匹配到 wechat-no-sound', () => {
    const cases = [
      '微信没有声音了',
      '微信没声音',
      '微信没声',
      '微信没有声音',
      '微信没声音了',
    ]
    for (const input of cases) {
      const tut = findTutorial(input)
      assert.ok(tut, `「${input}」 应该匹配到教程`)
      assert.equal(tut!.id, 'wechat-no-sound')
    }
  })

  test('字太小（同义说法）都能匹配到 font-too-small', () => {
    const cases = [
      '手机字太小',
      '字太小',
      '字体太小',
      '字太小看不清',
      '看不清字',
    ]
    for (const input of cases) {
      const tut = findTutorial(input)
      assert.ok(tut, `「${input}」 应该匹配到教程`)
      assert.equal(tut!.id, 'font-too-small')
    }
  })

  test('电商退款说法匹配到人工审核退款教程', () => {
    for (const input of ['淘宝退款', '我要申请退款', '京东退款']) {
      assert.equal(findTutorial(input)?.id, 'ecommerce-refund')
    }
  })

  test('大小写不敏感', () => {
    const tut = findTutorial('WECHAT 没声音')
    assert.ok(tut)
    assert.equal(tut!.id, 'wechat-no-sound')
  })

  test('全角输入归一化后仍匹配（ＷＥＣＨＡＴ 等价 wechat）', () => {
    const tut = findTutorial('ＷＥＣＨＡＴ 没声音')
    assert.ok(tut, '全角输入应命中教程')
    assert.equal(tut!.id, 'wechat-no-sound')
  })

  test('首尾空白不影响', () => {
    const tut = findTutorial('   微信没有声音了   ')
    assert.ok(tut)
    assert.equal(tut!.id, 'wechat-no-sound')
  })

  test('不相关输入返回 null（不是 bug，是设计）', () => {
    const tut = findTutorial('今天天气真好')
    assert.equal(tut, null)
  })

  test('空字符串返回 null', () => {
    assert.equal(findTutorial(''), null)
    assert.equal(findTutorial('   '), null)
  })
})

describe('safeTutorialsFor(level) / tutorialAllowsRisk —— maxLevel 硬校验', () => {
  test('low：返回全部 maxLevel >= low 的教程', () => {
    const low = safeTutorialsFor('low')
    assert.equal(low.length, TUTORIALS.length)
  })

  test('medium：只返回 maxLevel >= medium 的教程（low 教程不给）', () => {
    const medium = safeTutorialsFor('medium')
    assert.deepEqual(
      medium.map((t) => t.id),
      ['ecommerce-refund'],
      `medium 只应有退款教程，实际 ${JSON.stringify(medium.map((t) => t.id))}`,
    )
  })

  test('high：返回空数组（高风险不该进分步指导）', () => {
    assert.equal(safeTutorialsFor('high').length, 0)
  })

  test('critical：返回空数组', () => {
    assert.equal(safeTutorialsFor('critical').length, 0)
  })

  test('tutorialAllowsRisk：medium 输入 + low 教程 → false（审计复现的硬校验）', () => {
    const wechat = TUTORIALS.find((t) => t.id === 'wechat-no-sound')!
    assert.equal(tutorialAllowsRisk(wechat, 'low'), true)
    assert.equal(tutorialAllowsRisk(wechat, 'medium'), false, 'medium 不能拿 maxLevel=low 的教程')
    assert.equal(tutorialAllowsRisk(wechat, 'high'), false)
    assert.equal(tutorialAllowsRisk(wechat, 'critical'), false)
  })

  test('tutorialAllowsRisk：medium 输入 + medium 教程 → true', () => {
    const refund = TUTORIALS.find((t) => t.id === 'ecommerce-refund')!
    assert.equal(tutorialAllowsRisk(refund, 'low'), true)
    assert.equal(tutorialAllowsRisk(refund, 'medium'), true)
    assert.equal(tutorialAllowsRisk(refund, 'high'), false)
  })
})
