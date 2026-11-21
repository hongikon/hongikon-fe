import { test } from 'node:test'
import assert from 'node:assert/strict'

import { splitFacilityNote } from '../../src/utils/map/facilityNote'

test('시설 설명: 첫 조각은 이름, 나머지는 한 줄씩', () => {
  assert.deepEqual(splitFacilityNote('학생식당 · 11:00~14:00 · 카드 결제'), {
    title: '학생식당',
    lines: ['11:00~14:00', '카드 결제'],
  })
})

test('괄호 뒤 쉼표로 이어진 기간도 줄을 나눈다', () => {
  assert.deepEqual(splitFacilityNote('열람실 · 학기 중 07:00~23:00(주말 휴관), 방학 중 09:00~18:00').lines, [
    '학기 중 07:00~23:00(주말 휴관)',
    '방학 중 09:00~18:00',
  ])
})

test('구분점이 없으면 통째로 이름', () => {
  assert.deepEqual(splitFacilityNote('ATM'), { title: 'ATM', lines: [] })
  assert.deepEqual(splitFacilityNote(''), { title: '', lines: [] })
})
