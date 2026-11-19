import { test } from 'node:test'
import assert from 'node:assert/strict'

import { LAT_RANGE, linkErrors, optional, parseCoordinate, tooLong } from '../../src/admin/utils/mapFormRules'
import {
  buildPartnerInput,
  emptyPartnerDraft,
  partnerDraftFrom,
  partnerMatches,
  type PartnerDraft,
} from '../../src/admin/utils/partnerDraft'
import type { AdminPartner } from '../../src/admin/types'

test('parseCoordinate: 비면 null, 숫자 아니거나 범위 밖이면 문구, 값은 그대로', () => {
  assert.equal(parseCoordinate('  ', LAT_RANGE, '위도'), null)
  assert.equal(parseCoordinate('abc', LAT_RANGE, '위도'), '위도는 숫자로 입력해 주세요.')
  assert.equal(parseCoordinate('127', LAT_RANGE, '위도'), '위도는 33~39 사이여야 해요.')
  assert.equal(parseCoordinate(' 37.5512345678 ', LAT_RANGE, '위도'), 37.5512345678)
})

test('optional·tooLong', () => {
  assert.equal(optional('  '), undefined)
  assert.equal(optional(' a '), 'a')
  assert.equal(tooLong('abc', 3, '이름'), null)
  assert.equal(tooLong('abcd', 3, '이름'), '이름은(는) 3자까지 쓸 수 있어요.')
})

test('linkErrors', () => {
  assert.deepEqual(linkErrors('', ''), [])
  assert.deepEqual(linkErrors('열기', 'http://x'), ['링크 주소는 https:// 로 시작해야 해요.'])
  assert.deepEqual(linkErrors('', 'https://x'), ['링크 이름을 입력해 주세요(버튼에 보이는 글자).'])
  assert.deepEqual(linkErrors('열기', ''), ['링크 주소를 입력해 주세요.'])
})

const PARTNER: AdminPartner = {
  id: 'cafe-a',
  name: '카페 A',
  category: '카페',
  affiliations: ['총학생회', '기숙사'],
  lat: 37.55,
  lng: 126.92,
  benefit: '10% 할인',
  affiliationBenefits: [{ affiliation: '기숙사', benefit: '15% 할인' }],
  link: { label: '쿠폰', url: 'https://example.com' },
  endsOn: '2026-12-31',
} as AdminPartner

test('partnerDraftFrom → buildPartnerInput 은 같은 값을 다시 보낸다', () => {
  const draft = partnerDraftFrom(PARTNER)
  assert.equal(draft.originalCode, 'cafe-a')
  assert.equal(draft.lat, '37.55')
  assert.deepEqual(draft.exceptions, { 기숙사: '15% 할인' })
  const result = buildPartnerInput(draft)
  assert.ok('input' in result)
  assert.equal(result.input.id, 'cafe-a')
  assert.equal(result.input.lat, 37.55)
  assert.deepEqual(result.input.affiliationBenefits, [{ affiliation: '기숙사', benefit: '15% 할인' }])
  assert.deepEqual(result.input.link, { label: '쿠폰', url: 'https://example.com' })
  assert.equal(result.input.endsOn, '2026-12-31')
  assert.equal(result.input.nearbyAlert, false)
  assert.equal(result.input.mapIcon, undefined)
})

test('buildPartnerInput: 빈 초안은 필수 항목 오류를 순서대로', () => {
  const result = buildPartnerInput(emptyPartnerDraft())
  assert.ok('errors' in result)
  assert.deepEqual(result.errors, ['이름은 1~100자로 입력해 주세요.', '업종을 골라 주세요.', '위도·경도를 모두 입력해 주세요.'])
})

test('buildPartnerInput: 새 업체는 코드가 비면 id 를 빼고, 잘못된 종료일을 막는다', () => {
  const draft: PartnerDraft = { ...emptyPartnerDraft(), name: '새 가게', category: '카페', lat: '37.5', lng: '126.9' }
  const ok = buildPartnerInput(draft)
  assert.ok('input' in ok)
  assert.equal(ok.input.id, undefined)
  const bad = buildPartnerInput({ ...draft, endsOn: '2026-02-30' })
  assert.ok('errors' in bad)
  assert.deepEqual(bad.errors, ['종료일을 YYYY-MM-DD 형식의 실제 날짜로 입력해 주세요(예: 2026-12-31).'])
})

test('partnerMatches 는 normalize 한 검색어로 찾는다', () => {
  assert.equal(partnerMatches(PARTNER, ''), true)
  assert.equal(partnerMatches(PARTNER, '기숙사'), true)
  assert.equal(partnerMatches(PARTNER, 'cafe-a'), true)
  assert.equal(partnerMatches(PARTNER, '없는말'), false)
})
