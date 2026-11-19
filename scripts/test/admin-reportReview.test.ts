import { test } from 'node:test'
import assert from 'node:assert/strict'

import {
  actionsFor,
  applyReportUpdate,
  belongsTo,
  emptyReportsMessage,
  formatDayLabel,
  googleMapsSearchUrl,
  inRange,
  kstDate,
  periodRange,
  reportLocationText,
  reportMapPreviewDetail,
  shiftDay,
  splitsActive,
  withFocusedFirst,
} from '../../src/admin/utils/reportReview'
import type { AdminReport } from '../../src/admin/types'

// 서버 시각은 존 없는 UTC. 한국 시간 = UTC + 9.
const kst = (iso: string) => Date.parse(`${iso}+09:00`)

function report(over: Partial<AdminReport> = {}): AdminReport {
  return {
    id: 1,
    status: 'ACTIVE',
    category: 'ETC' as AdminReport['category'],
    customCategoryLabel: null,
    title: '제목',
    content: null,
    buildingId: null,
    buildingName: null,
    floor: null,
    lat: null,
    lng: null,
    startsAt: '2020-01-01T00:00:00',
    endsAt: '2099-01-01T00:00:00',
    createdAt: '2026-11-10T03:00:00',
    authorId: 7,
    flagCount: 0,
    moderationNote: null,
    reviewedAt: null,
    ...over,
  }
}

test('kstDate 는 UTC 15시 이후를 다음 날로 본다', () => {
  assert.equal(kstDate(Date.parse('2026-11-18T14:59:00Z')), '2026-11-18')
  assert.equal(kstDate(Date.parse('2026-11-18T15:00:00Z')), '2026-11-19')
})

test('formatDayLabel·shiftDay', () => {
  assert.equal(formatDayLabel('2026-10-05'), '2026.10.5 (월)')
  assert.equal(shiftDay('2026-03-01', -1), '2026-02-28')
  assert.equal(shiftDay('2026-12-31', 1), '2027-01-01')
})

test('periodRange', () => {
  const now = kst('2026-11-19T10:00:00')
  assert.deepEqual(periodRange('all', '2026-11-01', now), {})
  assert.deepEqual(periodRange('today', '2026-11-01', now), { from: '2026-11-19', to: '2026-11-19' })
  assert.deepEqual(periodRange('week', '2026-11-01', now), { from: '2026-11-13', to: '2026-11-19' })
  assert.deepEqual(periodRange('month', '2026-11-01', now), { from: '2026-10-21', to: '2026-11-19' })
  assert.deepEqual(periodRange('day', '2026-11-01', now), { from: '2026-11-01', to: '2026-11-01' })
})

test('inRange 는 등록일(한국 날짜)로 거른다', () => {
  // UTC 2026-11-10 16:00 = 한국 11-11 01:00
  const r = report({ createdAt: '2026-11-10T16:00:00' })
  assert.equal(inRange(r, {}), true)
  assert.equal(inRange(r, { from: '2026-11-11', to: '2026-11-11' }), true)
  assert.equal(inRange(r, { from: '2026-11-10', to: '2026-11-10' }), false)
})

test('belongsTo 는 ACTIVE 를 노출 중·예정·종료로 나눈다', () => {
  const live = report()
  const ended = report({ endsAt: '2000-01-01T00:00:00' })
  const upcoming = report({ startsAt: '2099-01-01T00:00:00', endsAt: '2099-02-01T00:00:00' })
  assert.equal(belongsTo(live, 'ACTIVE'), true)
  assert.equal(belongsTo(ended, 'ACTIVE'), false)
  assert.equal(belongsTo(ended, 'ENDED'), true)
  assert.equal(belongsTo(upcoming, 'UPCOMING'), true)
  assert.equal(belongsTo(upcoming, 'ACTIVE'), false)
  assert.equal(belongsTo(report({ status: 'HIDDEN' }), 'HIDDEN'), true)
  assert.equal(belongsTo(report({ status: 'HIDDEN' }), 'ALL'), true)
  assert.equal(belongsTo(report({ status: 'HIDDEN', endsAt: '2000-01-01T00:00:00' }), 'ENDED'), false)
})

test('splitsActive', () => {
  assert.equal(splitsActive('ACTIVE'), true)
  assert.equal(splitsActive('ENDED'), true)
  assert.equal(splitsActive('UPCOMING'), true)
  assert.equal(splitsActive('PENDING'), false)
  assert.equal(splitsActive('ALL'), false)
})

test('actionsFor: 반려된 제보는 삭제만', () => {
  assert.deepEqual(actionsFor('PENDING'), ['approve', 'reject', 'hide', 'delete'])
  assert.deepEqual(actionsFor('ACTIVE'), ['hide', 'reject', 'delete'])
  assert.deepEqual(actionsFor('HIDDEN'), ['reopen', 'reject', 'delete'])
  assert.deepEqual(actionsFor('REJECTED'), ['delete'])
  assert.deepEqual(actionsFor('DELETED'), [])
})

test('withFocusedFirst 는 그 항목만 맨 위로', () => {
  const items = [{ id: 1 }, { id: 2 }, { id: 3 }]
  assert.deepEqual(withFocusedFirst(items, 3).map((i) => i.id), [3, 1, 2])
  assert.equal(withFocusedFirst(items, null), items)
  assert.equal(withFocusedFirst(items, 9), items)
})

test('applyReportUpdate: 삭제는 빼고 나머지는 그 자리에서 바꾼다', () => {
  const list = [report({ id: 1 }), report({ id: 2 })]
  assert.deepEqual(applyReportUpdate(list, report({ id: 2, status: 'DELETED' }))?.map((r) => r.id), [1])
  const hidden = applyReportUpdate(list, report({ id: 1, status: 'HIDDEN' }))
  assert.equal(hidden?.[0].status, 'HIDDEN')
  assert.equal(hidden?.length, 2)
  assert.equal(applyReportUpdate(null, report()), null)
})

test('emptyReportsMessage', () => {
  assert.equal(emptyReportsMessage('week', 'PENDING'), '이 기간에 등록된 제보가 없습니다.')
  assert.equal(emptyReportsMessage('all', 'PENDING'), '승인 대기 중인 제보가 없습니다.')
  assert.equal(emptyReportsMessage('all', 'HIDDEN'), '해당하는 제보가 없습니다.')
})

test('reportLocationText: 캠퍼스 밖은 장소 설명에 접두어', () => {
  assert.equal(reportLocationText(report({ buildingName: 'T동', floor: 3 })), 'T동 3층')
  assert.equal(reportLocationText(report({ placeLabel: ' 정문 앞 ' })), '캠퍼스 밖 · 정문 앞')
  assert.equal(reportLocationText(report()), '')
})

test('reportMapPreviewDetail·googleMapsSearchUrl', () => {
  assert.equal(reportMapPreviewDetail(report({ authorDisplayName: '홍**', placeLabel: '정문' })), '작성자 홍** · 정문')
  assert.equal(reportMapPreviewDetail(report()), '')
  assert.equal(googleMapsSearchUrl(37.5, 126.9), 'https://www.google.com/maps/search/?api=1&query=37.5,126.9')
})
