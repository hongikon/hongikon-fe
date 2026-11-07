import { test } from 'node:test'
import assert from 'node:assert/strict'

import { defaultGuides, guidesFromIds, isGreeting } from '../../src/utils/askGreeting'

test('짧은 인사만 인사로 본다', () => {
  for (const text of ['ㅎㅇ', 'ㅎㅇ~', '하이!', '안녕하세요', '안녕ㅋㅋ', 'Hi', 'hello!!', '헬로우', '반가워요 ㅎㅎ']) {
    assert.equal(isGreeting(text), true, text)
  }
  for (const text of ['안녕 T동 어디야', '하이 휴학 신청', '휴학', '학생증', 'ㅎ', '']) {
    assert.equal(isGreeting(text), false, text)
  }
})

test('기본 안내는 모두 앱 안 안내로 열린다', () => {
  const guides = defaultGuides()
  assert.equal(guides.length, 6)
  for (const guide of guides) assert.ok(guide.flowId && guide.nodeId, guide.label)
})

test('서버 id → 이름 붙은 칩, 모르는 id 는 뺀다', () => {
  const guides = guidesFromIds(['leave-of-absence/start', 'leave-of-absence/military', 'gone/start', 'none', 'wifi/start'])
  assert.deepEqual(guides.map((guide) => `${guide.flowId}/${guide.nodeId}`), ['leave-of-absence/start', 'leave-of-absence/military', 'wifi/start'])
  for (const guide of guides) assert.ok(guide.label.length > 0 && guide.label.length <= 16)
  console.log(guides.map((guide) => guide.label).join(' / '))
})
