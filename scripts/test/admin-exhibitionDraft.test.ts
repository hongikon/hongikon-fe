import { test } from 'node:test'
import assert from 'node:assert/strict'

import {
  buildExhibitionInput,
  emptyExhibitionDraft,
  exhibitionDraftFrom,
  groupExhibitions,
  venueLabel,
} from '../../src/admin/utils/exhibitions/exhibitionDraft'
import { ymdToDayIndex } from '../../src/utils/map/exhibitions'
import type { AdminExhibition, AdminFacility } from '../../src/admin/types'

const ex = (id: number, startsOn: string, endsOn: string) =>
  ({ id, facilityId: 'v1', title: `전시 ${id}`, startsOn, endsOn }) as AdminExhibition

test('exhibitionDraftFrom → buildExhibitionInput', () => {
  const draft = exhibitionDraftFrom({ ...ex(1, '2026-10-12', '2026-10-16'), hours: '10:00~18:00', link: { label: '안내', url: 'https://a' } })
  const result = buildExhibitionInput(draft)
  assert.ok('input' in result)
  assert.deepEqual(result.input, {
    facilityId: 'v1',
    title: '전시 1',
    startsOn: '2026-10-12',
    endsOn: '2026-10-16',
    hours: '10:00~18:00',
    description: undefined,
    link: { label: '안내', url: 'https://a' },
  })
})

test('buildExhibitionInput: 필수·날짜 순서·링크', () => {
  const empty = buildExhibitionInput(emptyExhibitionDraft(null))
  assert.ok('errors' in empty)
  assert.equal(empty.errors[0], '전시장을 골라 주세요.')
  assert.equal(empty.errors[1], '전시 제목을 입력해 주세요.')
  const reversed = buildExhibitionInput({ ...emptyExhibitionDraft('v1'), title: 'a', startsOn: '2026-10-16', endsOn: '2026-10-12', linkLabel: '안내' })
  assert.ok('errors' in reversed)
  assert.deepEqual(reversed.errors, ['종료일은 시작일과 같거나 뒤여야 해요.', '링크 주소를 입력해 주세요.'])
})

test('groupExhibitions: 단계별로 묶고 정렬한다', () => {
  const today = ymdToDayIndex('2026-11-19')!
  const groups = groupExhibitions(
    [ex(1, '2026-11-01', '2026-11-30'), ex(2, '2026-11-10', '2026-11-20'), ex(3, '2026-12-05', '2026-12-10'), ex(4, '2026-11-25', '2026-11-28'), ex(5, '2026-10-01', '2026-10-05'), ex(6, '2026-11-01', '2026-11-18')],
    today,
  )
  assert.deepEqual(groups.current.map((e) => e.id), [2, 1])
  assert.deepEqual(groups.upcoming.map((e) => e.id), [4, 3])
  assert.deepEqual(groups.past.map((e) => e.id), [6, 5])
})

test('venueLabel', () => {
  assert.equal(venueLabel({ buildingName: '현대미술관', floor: 1, note: '1관' } as AdminFacility), '현대미술관 1F 1관')
  assert.equal(venueLabel({ buildingName: '박물관' } as AdminFacility), '박물관')
})
