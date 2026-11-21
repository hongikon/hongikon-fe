import { test } from 'node:test'
import assert from 'node:assert/strict'

import { clampEnd, defaultScheduledStart, initialReportSchedule, resolveSchedule } from '../../src/utils/map/reportScheduleState'

const HOUR = 60 * 60 * 1000

test('날짜·시간 선택의 첫 시작은 30분 뒤 이후의 첫 정각', () => {
  const now = Date.parse('2026-11-14T05:10:00Z')
  assert.equal(defaultScheduledStart(now), Date.parse('2026-11-14T06:00:00Z'))
  assert.equal(defaultScheduledStart(Date.parse('2026-11-14T05:30:00Z')), Date.parse('2026-11-14T06:00:00Z'))
})

test('처음 값과 지금 보이는 시작·종료', () => {
  const now = Date.parse('2026-11-14T05:10:00Z')
  const schedule = initialReportSchedule(2, now)
  assert.equal(schedule.startMode, 'now')
  assert.equal(schedule.customEndMs - schedule.scheduledStartMs, 2 * HOUR)
  assert.deepEqual(resolveSchedule(schedule, now), { startMs: now, endMs: now + 2 * HOUR })
  const custom = { ...schedule, startMode: 'scheduled' as const, endMode: 'custom' as const }
  assert.deepEqual(resolveSchedule(custom, now), { startMs: schedule.scheduledStartMs, endMs: schedule.customEndMs })
})

test('종료는 시작 뒤, 최대 7일 안 10분 단위로', () => {
  const start = Date.parse('2026-11-14T05:00:00Z')
  assert.equal(clampEnd(start - HOUR, start), start + 10 * 60 * 1000)
  assert.equal(clampEnd(start + 30 * 24 * HOUR, start), start + 7 * 24 * HOUR)
  assert.equal(clampEnd(start + 3 * HOUR, start), start + 3 * HOUR)
})
