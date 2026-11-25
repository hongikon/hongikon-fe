import { test } from 'node:test'
import assert from 'node:assert/strict'

import {
  buildFacilityInput,
  buildingNameOf,
  emptyFacilityDraft,
  facilityDraftFrom,
  facilityMatches,
  filterBuildingOptions,
} from '../../src/admin/utils/facilities/facilityDraft'
import type { AdminBuildingOption, AdminFacility } from '../../src/admin/types'

const FACILITY = {
  id: 'hi-r-9f-printer',
  kind: '프린터',
  buildingCode: 'R',
  buildingName: 'R동',
  floor: 9,
  note: 'PC실',
} as AdminFacility

const BUILDINGS = [
  { code: 'R', name: 'R동' },
  { code: 'T', name: '홍문관' },
  { code: 'K', name: 'K동' },
] as AdminBuildingOption[]

test('facilityDraftFrom → buildFacilityInput: 좌표 없으면 빼고 보낸다', () => {
  const draft = facilityDraftFrom(FACILITY)
  assert.equal(draft.floor, '9')
  assert.equal(draft.lat, '')
  const result = buildFacilityInput(draft)
  assert.ok('input' in result)
  assert.deepEqual(result.input, { id: 'hi-r-9f-printer', kind: '프린터', buildingCode: 'R', floor: 9, note: 'PC실', lat: undefined, lng: undefined, unavailable: false, unavailableReason: undefined, unavailableFrom: undefined, unavailableUntil: undefined })
})

test('buildFacilityInput: 이용 불가 기간 — 시작·끝을 보내고, 지난 끝·거꾸로 된 기간은 막는다(11-22)', () => {
  const now = new Date(2026, 10, 22, 10, 0)
  const draft = { ...facilityDraftFrom(FACILITY), unavailable: true, unavailableReason: ' 기기 고장 ', unavailableFrom: '2026-12-01 09:00', unavailableUntil: '2026-12-03' }
  const ok = buildFacilityInput(draft, now)
  assert.equal(ok.input?.unavailable, true)
  assert.equal(ok.input?.unavailableReason, '기기 고장')
  assert.equal(ok.input?.unavailableFrom, '2026-12-01T09:00')
  assert.equal(ok.input?.unavailableUntil, '2026-12-03T23:59')
  assert.deepEqual(buildFacilityInput({ ...draft, unavailableFrom: '', unavailableUntil: '2026-11-21' }, now).errors, ['끝이 이미 지났어요. 앞으로의 시각을 고르거나 비워 주세요.'])
  assert.deepEqual(buildFacilityInput({ ...draft, unavailableUntil: '2026-12-01 08:00' }, now).errors, ['끝이 시작보다 뒤여야 해요.'])
  assert.deepEqual(buildFacilityInput({ ...draft, unavailableFrom: '12/01' }, now).errors, ['시작은 2026-12-01 또는 2026-12-01 09:00 처럼 입력해 주세요.'])
  // 이용 가능으로 돌리면 사유·기간은 보내지 않는다.
  const reopened = buildFacilityInput({ ...draft, unavailable: false }, now)
  assert.equal(reopened.input?.unavailable, false)
  assert.equal(reopened.input?.unavailableFrom, undefined)
  assert.equal(reopened.input?.unavailableUntil, undefined)
})

test('buildFacilityInput: 필수·층·좌표 짝 검증', () => {
  const empty = buildFacilityInput(emptyFacilityDraft())
  assert.ok('errors' in empty)
  assert.deepEqual(empty.errors, ['시설 종류를 골라 주세요.', '건물을 골라 주세요.'])
  const draft = { ...facilityDraftFrom(FACILITY), floor: '1.5', lat: '37.5' }
  const bad = buildFacilityInput(draft)
  assert.ok('errors' in bad)
  assert.deepEqual(bad.errors, ['층은 정수로 입력해 주세요(지하는 음수, B1 = -1, 로비층 L = 0).', '위도·경도는 둘 다 넣거나 둘 다 비워 주세요.'])
})

test('facilityMatches', () => {
  assert.equal(facilityMatches(FACILITY, ''), true)
  assert.equal(facilityMatches(FACILITY, 'pc실'), true)
  assert.equal(facilityMatches(FACILITY, '홍문관'), false)
})

test('filterBuildingOptions: 고른 건물은 걸러져도 맨 앞에 남는다', () => {
  assert.equal(filterBuildingOptions(BUILDINGS, '', null), BUILDINGS)
  assert.deepEqual(filterBuildingOptions(BUILDINGS, '홍문', null).map((b) => b.code), ['T'])
  assert.deepEqual(filterBuildingOptions(BUILDINGS, '홍문', 'K').map((b) => b.code), ['K', 'T'])
  assert.deepEqual(filterBuildingOptions(BUILDINGS, 'k', 'K').map((b) => b.code), ['K'])
})

test('buildingNameOf', () => {
  assert.equal(buildingNameOf(BUILDINGS, 'T'), '홍문관')
  assert.equal(buildingNameOf(BUILDINGS, 'Z'), 'Z')
  assert.equal(buildingNameOf(BUILDINGS, null), '')
})
