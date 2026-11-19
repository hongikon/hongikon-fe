import { test } from 'node:test'
import assert from 'node:assert/strict'
import { categoryLabel, deleteConfirmMessage, placeLabel } from '../../src/utils/settings/myReports'
import { formatFloor } from '../../src/utils/floors'

const report = (patch: Record<string, unknown>) => ({ category: 'ETC', customCategoryLabel: null, buildingName: null, floor: null, placeLabel: null, ...patch }) as never

test('분류 이름: 기타에 직접 적은 이름 우선', () => {
  assert.equal(categoryLabel(report({ category: 'ETC', customCategoryLabel: '버스킹' })), '버스킹')
  assert.equal(categoryLabel(report({ category: 'ETC' })), '기타')
  assert.equal(categoryLabel(report({ category: '__unknown__' })), '기타')
})

test('장소: 건물·층, 없으면 적은 장소, 그것도 없으면 null', () => {
  assert.equal(placeLabel(report({ buildingName: 'R동', floor: 3 })), `R동 ${formatFloor(3)}`)
  assert.equal(placeLabel(report({ buildingName: 'R동' })), 'R동')
  assert.equal(placeLabel(report({ placeLabel: '  정문 앞 ' })), '정문 앞')
  assert.equal(placeLabel(report({})), null)
})

test('삭제 확인 문구', () => {
  assert.match(deleteConfirmMessage('ACTIVE'), /지도에서도 내려가고/)
  assert.match(deleteConfirmMessage('SCHEDULED'), /지도에서도 내려가고/)
  assert.match(deleteConfirmMessage('PENDING'), /승인 대기 중인/)
  assert.match(deleteConfirmMessage('REJECTED'), /내역에서 지우면/)
})
