import { test } from 'node:test'
import assert from 'node:assert/strict'

import {
  MULTI_PHOTO_HEIGHT,
  SINGLE_PHOTO_MAX_HEIGHT,
  contentNeedsMore,
  contentPreview,
  daySpansSummary,
  photoRowHeight,
} from '../../src/utils/map/report/reportSheet'
import { parseReportDays } from '../../src/utils/map/report/reportSchedule'

const kst = (iso: string) => Date.parse(`${iso}+09:00`)

test('본문 미리보기는 줄바꿈을 한 칸으로 접는다', () => {
  assert.equal(contentPreview('  첫 줄\n\n  둘째 줄 \n셋째  '), '첫 줄 둘째 줄 셋째')
})

test('줄바꿈이 있거나 60자를 넘으면 본문 보기', () => {
  assert.equal(contentNeedsMore('짧은 글'), false)
  assert.equal(contentNeedsMore('a\nb'), true)
  assert.equal(contentNeedsMore('가'.repeat(61)), true)
  assert.equal(contentNeedsMore(` ${'가'.repeat(60)} `), false)
})

test('날짜별 시간 요약: 오늘 / 가장 가까운 날 / 끝남', () => {
  const spans = parseReportDays({
    days: [
      { date: '2026-11-14', start: '14:00', end: '18:00' },
      { date: '2026-11-16', start: '10:00', end: '12:00' },
    ],
  })
  assert.ok(spans)
  assert.equal(daySpansSummary(spans, kst('2026-11-14T15:00:00')), '오늘 14:00~18:00')
  const later = daySpansSummary(spans, kst('2026-11-15T09:00:00'))
  assert.notEqual(later, '운영이 끝났어요')
  assert.ok(!later.startsWith('오늘'))
  assert.equal(daySpansSummary(spans, kst('2026-11-17T09:00:00')), '운영이 끝났어요')
})

test('사진 줄 높이: 폭을 모르면 기본, 넘치면 줄인다', () => {
  assert.equal(photoRowHeight([1], 0), SINGLE_PHOTO_MAX_HEIGHT)
  assert.equal(photoRowHeight([1, 1], 0), MULTI_PHOTO_HEIGHT)
  assert.equal(photoRowHeight([], 300), SINGLE_PHOTO_MAX_HEIGHT)
  // 정사각형 1장, 폭 300 → 200 상한
  assert.equal(photoRowHeight([1], 300), 200)
  // 가로 사진 3장(비율 2) · 폭 306 → (306 - 12) / 6 = 49
  assert.equal(photoRowHeight([2, 2, 2], 306), 49)
})
