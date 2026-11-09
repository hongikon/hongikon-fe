import { test } from 'node:test'
import assert from 'node:assert/strict'

import {
  canRunDaily,
  defaultReportDays,
  formatDaysRange,
  formatReportSchedule,
  parseReportDays,
  reportPhase,
  toReportDayHours,
} from '../../src/utils/reportSchedule'

// 서버 시각은 존 없는 UTC. 한국 시간 = UTC + 9.
const kst = (iso: string) => Date.parse(`${iso}+09:00`)
const SAME = {
  startsAt: '2026-11-14T05:00:00',
  endsAt: '2026-11-16T09:00:00',
  days: [
    { date: '2026-11-14', start: '14:00', end: '18:00' },
    { date: '2026-11-15', start: '14:00', end: '18:00' },
    { date: '2026-11-16', start: '14:00', end: '18:00:00' },
  ],
}
// 15일은 11~15시, 16일은 쉬고 17일 13~17시
const VARIED = {
  startsAt: '2026-11-14T05:00:00',
  endsAt: '2026-11-17T08:00:00',
  days: [
    { date: '2026-11-14', start: '14:00', end: '18:00' },
    { date: '2026-11-15', start: '11:00', end: '15:00' },
    { date: '2026-11-17', start: '13:00', end: '17:00' },
  ],
}

test('운영 시간은 이틀 이상이고 날마다 끝이 시작보다 늦을 때만', () => {
  assert.equal(parseReportDays(SAME)?.length, 3)
  assert.equal(parseReportDays({ days: [SAME.days[0]] }), null)
  assert.equal(parseReportDays({ days: [SAME.days[0], { date: '2026-11-15', start: '18:00', end: '14:00' }] }), null)
})

test('일정 한 줄: 날마다 같으면 매일, 다르면 날마다 시간 다름', () => {
  assert.equal(formatReportSchedule(SAME), '11/14(토) ~ 11/16(월) · 매일 14:00~18:00')
  assert.equal(formatReportSchedule(VARIED), '11/14(토) ~ 11/17(화) · 날마다 시간 다름')
})

test('일정 한 줄: 시간이 같고 가운데 쉬는 날이 있으면 쉬는 날 수를 붙인다', () => {
  const gap = { days: [SAME.days[0], SAME.days[2]] }
  assert.equal(formatReportSchedule(gap), '11/14(토) ~ 11/16(월) · 매일 14:00~18:00 · 쉬는 날 1일')
})

test('일정 한 줄: 첫날이 지금부터면 첫날 시작 시각은 보지 않는다', () => {
  const spans = parseReportDays({ days: [{ date: '2026-11-14', start: '09:30', end: '18:00' }, ...SAME.days.slice(1)] })!
  assert.equal(formatDaysRange(spans, { firstFromNow: true }), '지금 ~ 11/16(월) · 매일 14:00~18:00')
  assert.equal(formatDaysRange(spans), '11/14(토) ~ 11/16(월) · 날마다 시간 다름')
})

test('기간 시작 전은 예정', () => {
  assert.equal(reportPhase(SAME, kst('2026-11-13T12:00')).kind, 'upcoming')
})

test('운영 시간 전·중·끝나기 30분 안·끝난 뒤', () => {
  assert.deepEqual(reportPhase(SAME, kst('2026-11-15T10:00')), { kind: 'later', text: '오늘 14:00 시작' })
  assert.deepEqual(reportPhase(SAME, kst('2026-11-15T15:00')), { kind: 'live', text: '운영 중 · 18:00까지' })
  assert.deepEqual(reportPhase(SAME, kst('2026-11-15T17:30')), { kind: 'ending', text: '곧 종료 · 18:00' })
  assert.deepEqual(reportPhase(SAME, kst('2026-11-15T19:00')), { kind: 'later', text: '내일 14:00 시작' })
})

test('날마다 다른 시간과 쉬는 날', () => {
  assert.deepEqual(reportPhase(VARIED, kst('2026-11-14T20:00')), { kind: 'later', text: '내일 11:00 시작' })
  assert.deepEqual(reportPhase(VARIED, kst('2026-11-15T14:40')), { kind: 'ending', text: '곧 종료 · 15:00' })
  assert.deepEqual(reportPhase(VARIED, kst('2026-11-16T12:00')), { kind: 'later', text: '내일 13:00 시작' })
  assert.deepEqual(reportPhase(VARIED, kst('2026-11-15T16:00')), { kind: 'later', text: '11/17(화) 13:00 시작' })
})

test('한 번짜리: 평소엔 글 없음, 끝나기 30분 안이면 곧 종료', () => {
  const once = { startsAt: '2026-11-15T05:00:00', endsAt: '2026-11-15T07:00:00' } // 한국 14:00~16:00
  assert.deepEqual(reportPhase(once, kst('2026-11-15T14:30')), { kind: 'live', text: null })
  assert.deepEqual(reportPhase(once, kst('2026-11-15T15:40')), { kind: 'ending', text: '곧 종료 · 16:00' })
})

test('기본 운영 시간: 날마다 시작~끝 시각, 고친 날은 남기고 첫날·마지막 날은 고른 값', () => {
  assert.equal(canRunDaily(kst('2026-11-14T14:00'), kst('2026-11-16T18:00')), true)
  assert.equal(canRunDaily(kst('2026-11-14T14:00'), kst('2026-11-14T18:00')), false)
  // 마지막 날 끝이 첫날 시작 시각보다 일러도 켤 수 있고, 그날은 한 시간짜리로 맞춘다.
  assert.equal(canRunDaily(kst('2026-11-14T14:00'), kst('2026-11-16T13:00')), true)
  assert.deepEqual(toReportDayHours(defaultReportDays(kst('2026-11-14T14:00'), kst('2026-11-16T13:00'))).map((d) => `${d.start}-${d.end}`), [
    '14:00-15:00',
    '14:00-15:00',
    '12:00-13:00',
  ])
  const days = defaultReportDays(kst('2026-11-14T14:00'), kst('2026-11-16T18:00'))
  assert.deepEqual(toReportDayHours(days), SAME.days.map((d) => ({ ...d, end: '18:00' })))
  const edited = [days[0], { ...days[1], startMs: kst('2026-11-15T11:00'), endMs: kst('2026-11-15T15:00') }]
  const next = defaultReportDays(kst('2026-11-14T13:00'), kst('2026-11-17T18:00'), edited)
  assert.deepEqual(toReportDayHours(next).map((d) => `${d.date} ${d.start}-${d.end}`), [
    '2026-11-14 13:00-18:00',
    '2026-11-15 11:00-15:00',
    '2026-11-16 13:00-18:00',
    '2026-11-17 13:00-18:00',
  ])
})
