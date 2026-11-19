import { test } from 'node:test'
import assert from 'node:assert/strict'

import { allSameHours, effectiveDays, initialHours, pinDailyHours, reportDaysFor } from '../../src/utils/map/reportDays'

// 서버 시각은 존 없는 UTC. 한국 시간 = UTC + 9.
const kst = (iso: string) => Date.parse(`${iso}+09:00`)

test('처음 켤 때의 매일 시간: 고른 시작~종료, 지금이면 정각으로', () => {
  assert.deepEqual(initialHours(kst('2026-11-14T14:00:00'), kst('2026-11-14T18:00:00'), false), { open: 14 * 60, close: 18 * 60 })
  assert.deepEqual(initialHours(kst('2026-11-14T14:37:00'), kst('2026-11-14T18:00:00'), true), { open: 14 * 60, close: 18 * 60 })
  // 끝이 시작보다 이르면 4시간짜리
  assert.deepEqual(initialHours(kst('2026-11-14T14:00:00'), kst('2026-11-16T09:00:00'), false), { open: 14 * 60, close: 18 * 60 })
})

test('날짜 목록: 첫날 시작·마지막 날 끝은 고른 시각, 가운데 쉬는 날만 남는다', () => {
  const start = kst('2026-11-14T14:00:00')
  const end = kst('2026-11-16T18:00:00')
  const days = effectiveDays(start, end, [{ date: '2026-11-15', startMs: kst('2026-11-15T14:00:00'), endMs: kst('2026-11-15T18:00:00'), off: true }])
  assert.equal(days.length, 3)
  assert.equal(days[0].startMs, start)
  assert.equal(days[2].endMs, end)
  assert.deepEqual(days.map((day) => !!day.off), [false, true, false])
  assert.equal(allSameHours(days, false), true)
})

test('보낼 날짜별 시간: 꺼져 있거나 하루짜리면 null, 쉬는 날은 뺀다', () => {
  const start = kst('2026-11-14T14:00:00')
  const end = kst('2026-11-16T18:00:00')
  assert.equal(reportDaysFor(false, start, end, []), null)
  assert.equal(reportDaysFor(true, start, kst('2026-11-14T18:00:00'), []), null)
  const days = reportDaysFor(true, start, end, [])
  assert.equal(days?.length, 3)
  const withOff = reportDaysFor(true, start, end, [{ date: '2026-11-15', startMs: 0, endMs: 0, off: true }])
  assert.equal(withOff?.length, 2)
})

test('시작을 옮겨도 고치지 않은 날은 지금 매일 시각을 지킨다', () => {
  const start = kst('2026-11-14T14:00:00')
  const end = kst('2026-11-16T18:00:00')
  const pinned = pinDailyHours(start, end, [], kst('2026-11-14T09:00:00'), kst('2026-11-17T18:00:00'))
  assert.deepEqual(pinned.map((day) => day.date), ['2026-11-14', '2026-11-15', '2026-11-16', '2026-11-17'])
  assert.equal(pinned[1].startMs, kst('2026-11-15T14:00:00'))
  assert.equal(pinned[3].endMs, kst('2026-11-17T18:00:00'))
})
