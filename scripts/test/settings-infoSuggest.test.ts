import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  EMPTY_DRAFT,
  MAX_CONTENT_LENGTH,
  buildContent,
  filterBuildingNames,
  formatCoord,
  formatLocation,
  missingFields,
  retypeDraft,
  type Draft,
} from '../../src/utils/settings/infoSuggest'
import { INFO_SUGGESTION_PREFIXES } from '../../src/constants/feedback'

const pin = { lat: 37.5512345, lng: 126.9254321, buildingName: '홍문관' }
const draft = (patch: Partial<Draft>): Draft => ({ ...EMPTY_DRAFT, ...patch })

test('위치 표시', () => {
  assert.equal(formatLocation(pin), '홍문관 근처 (37.551234, 126.925432)')
  assert.equal(formatLocation({ ...pin, buildingName: null }), '37.551234, 126.925432')
  assert.equal(formatCoord(pin), '37.5512345, 126.9254321 (홍문관 근처)')
})

test('빈 필수 칸: 제휴', () => {
  assert.deepEqual(missingFields(draft({}), null), ['name', 'location'])
  assert.deepEqual(missingFields(draft({ name: ' a ' }), pin), [])
  assert.deepEqual(missingFields(draft({ name: 'a', address: 'x' }), null), [])
})

test('빈 필수 칸: 전시·행사는 장소(건물·주소·핀·온라인 중 하나)와 기간', () => {
  assert.deepEqual(missingFields(draft({ type: 'event' }), null), ['name', 'place', 'period'])
  assert.deepEqual(missingFields(draft({ type: 'event', name: 'a', period: 'p', online: true }), null), [])
  assert.deepEqual(missingFields(draft({ type: 'exhibition', name: 'a', period: 'p', building: 'R' }), null), [])
})

test('빈 필수 칸: 시설·기타', () => {
  assert.deepEqual(missingFields(draft({ type: 'facility' }), pin), ['facilityKind', 'building', 'detail'])
  assert.deepEqual(missingFields(draft({ type: 'other', detail: '  ' }), null), ['detail'])
})

test('보낼 줄글: 제휴', () => {
  const content = buildContent(
    draft({ name: ' 가게 ', address: '1층', affiliationCustom: '동아리', affiliation: '총학생회' as never, detail: '할인' }),
    pin,
  )
  assert.equal(
    content,
    [
      `${INFO_SUGGESTION_PREFIXES.partner} 새 제휴 업체`,
      '가게: 가게',
      '위치: 1층',
      '좌표: 37.5512345, 126.9254321 (홍문관 근처)',
      '소속: 동아리',
      '혜택: 할인',
    ].join('\n'),
  )
})

test('보낼 줄글: 온라인 행사는 좌표를 넣지 않는다, 길이 상한', () => {
  const content = buildContent(draft({ type: 'event', name: 'n', online: true, address: 'Zoom', period: '5월' }), pin)
  assert.equal(content, [INFO_SUGGESTION_PREFIXES.event, '이름: n', '장소: 온라인 · Zoom', '기간: 5월'].join('\n'))
  const site = buildContent(draft({ type: 'exhibition', name: 'n', building: 'R동', period: 'p' }), pin)
  assert.match(site, /장소: R동\n좌표: /)
  assert.equal(buildContent(draft({ type: 'other', detail: 'x'.repeat(2000) }), null).length, MAX_CONTENT_LENGTH)
})

test('종류를 바꾸면 종류별 칸만 비운다', () => {
  const next = retypeDraft(draft({ name: 'n', kind: 'fix', source: 's', period: 'p', facilityKind: 'f', contact: 'c' }), 'facility')
  assert.deepEqual(next, draft({ type: 'facility', name: 'n', contact: 'c' }))
})

test('건물 거르기: 공백·대소문자 무시, 고른 건물은 맨 앞', () => {
  const all = ['홍문관 R동', '제1공학관 T동', 'K동']
  assert.deepEqual(filterBuildingNames(all, '', null), all)
  assert.deepEqual(filterBuildingNames(all, 'r 동', null), ['홍문관 R동'])
  assert.deepEqual(filterBuildingNames(all, 'k', 'K동'), ['K동'])
  assert.deepEqual(filterBuildingNames(all, 't동', 'K동'), ['K동', '제1공학관 T동'])
})
