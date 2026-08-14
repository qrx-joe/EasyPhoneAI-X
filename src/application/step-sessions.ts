/**
 * 教程步骤会话存储 —— 服务端权威的步骤推进状态（无障碍教练方案 阶段 A-2）。
 *
 * 安全规则：
 * 1. 步骤索引只存在这里；客户端只拿 opaque stateId，传任何索引都无效。
 * 2. 会话查不到（刷新 / 服务重启 / 过期 / 超限清理）→ 调用方按 session_lost 处理，
 *    客户端安全回到重新描述，绝不猜测进度。
 * 3. riskFloor 记录会话创建时的合并风险等级；推进时重跑规则以此为下限，
 *    保证「AI/视觉升级过的风险不可被降级」（与 mergeRiskByMax 同向）。
 *
 * P0 内存实现：本项目无账号、无数据库（方案 §2.3），进程重启即全部回到
 * 重新描述 —— 正是文档要求的失败方向（fail-closed）。仅服务端使用；
 * 客户端组件不得 import 本模块。
 */

import { randomUUID } from 'node:crypto'

import type { RiskLevel } from '../domain/risk/types.ts'
import type { StepStateView } from '../contracts/step-api.ts'

/** 会话有效期：2 小时未推进即过期（老人中途放下手机是常态） */
const SESSION_TTL_MS = 2 * 60 * 60 * 1000

/** 并发会话上限：超限时清理最旧会话（防内存泄漏；被清的会话走 session_lost 回退） */
const MAX_SESSIONS = 2000

export interface StepSessionRecord {
  readonly stateId: string
  /** 会话原文：推进时服务端用它重跑风险检查 */
  readonly text: string
  readonly tutorialId: string
  /** 当前已展示给用户的步骤索引（0 起，服务端权威） */
  stepIndex: number
  /** 创建会话时的合并风险等级；重跑时的下限 */
  readonly riskFloor: RiskLevel
  readonly createdAt: number
  lastAdvancedAt: number
}

const sessions = new Map<string, StepSessionRecord>()

function pruneExpired(now: number): void {
  for (const [id, record] of sessions) {
    if (now - record.lastAdvancedAt > SESSION_TTL_MS) {
      sessions.delete(id)
    }
  }
  // 仍超上限 → 按创建时间淘汰最旧
  while (sessions.size > MAX_SESSIONS) {
    let oldestId: string | null = null
    let oldestAt = Infinity
    for (const [id, record] of sessions) {
      if (record.createdAt < oldestAt) {
        oldestAt = record.createdAt
        oldestId = id
      }
    }
    if (oldestId === null) break
    sessions.delete(oldestId)
  }
}

/**
 * 创建会话。guide 决策首次展示某步骤时调用。
 */
export function createStepSession(input: {
  readonly text: string
  readonly tutorialId: string
  readonly stepIndex: number
  readonly riskFloor: RiskLevel
}): StepSessionRecord {
  const now = Date.now()
  pruneExpired(now)
  const record: StepSessionRecord = {
    stateId: randomUUID(),
    text: input.text,
    tutorialId: input.tutorialId,
    stepIndex: input.stepIndex,
    riskFloor: input.riskFloor,
    createdAt: now,
    lastAdvancedAt: now,
  }
  sessions.set(record.stateId, record)
  return record
}

export function findStepSession(stateId: string): StepSessionRecord | null {
  const record = sessions.get(stateId)
  if (!record) return null
  if (Date.now() - record.lastAdvancedAt > SESSION_TTL_MS) {
    sessions.delete(stateId)
    return null
  }
  return record
}

/** 服务端权威推进：索引只能 +1，不接受任何客户端值 */
export function advanceStepSessionIndex(stateId: string): StepSessionRecord | null {
  const record = sessions.get(stateId)
  if (!record) return null
  record.stepIndex += 1
  record.lastAdvancedAt = Date.now()
  return record
}

export function deleteStepSession(stateId: string): void {
  sessions.delete(stateId)
}

/** 会话总数（测试用） */
export function stepSessionCount(): number {
  return sessions.size
}

/** 清空（仅测试用） */
export function clearStepSessionsForTest(): void {
  sessions.clear()
}

/** 导出给客户端的脱敏视图（不含原文、不含 riskFloor） */
export function toStepStateView(record: StepSessionRecord, totalSteps: number): StepStateView {
  return {
    stateId: record.stateId,
    tutorialId: record.tutorialId,
    stepIndex: record.stepIndex,
    totalSteps,
  }
}
