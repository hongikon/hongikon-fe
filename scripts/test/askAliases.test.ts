import assert from 'node:assert/strict'
import { test } from 'node:test'

import { expandAliases, matchAskFlow } from '../../src/utils/officeAsk'

// 11-10 운영진: 학생들은 뜻 단위 첫 글자로 줄인다(중동·교환·대물·C프). 운영진이 확인한 줄임말만 앱이 넓혀 찾는다.
test('aliases expand only when the token is the alias plus a particle', () => {
  assert.match(expandAliases('중동에서 사람 뽑아?'), /중앙동아리/)
  assert.match(expandAliases('대물 어려워?'), /대학물리 대학물리실험/)
  assert.equal(expandAliases('중동지역 뉴스'), '중동지역 뉴스')
})

test('an alias question finds the guide only when the plain question finds nothing', () => {
  assert.equal(matchAskFlow('중동 가입 어떻게 해')?.flow.id, 'clubs')
  assert.equal(matchAskFlow('학생증 교환')?.flow.id, 'student-card')
})
