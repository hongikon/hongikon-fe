import { test } from 'node:test'
import assert from 'node:assert/strict'

import { backgroundDisclosure, foregroundDisclosure, type LocationPurpose } from '../../src/lib/nearbyPartners/locationDisclosure'

const PURPOSES: LocationPurpose[] = ['nearby', 'myLocation', 'route', 'settings']

// Google Play 백그라운드 위치 "눈에 띄는 고지": 'location', 앱이 닫혀 있을 때에도, 쓰는 기능, 광고 여부가 공개 문장에 있어야 한다.
test('근처 알림 영어 공개 문장에 위치·백그라운드·기능·광고가 모두 있다', () => {
  const { lead } = backgroundDisclosure(false, 150)
  assert.match(lead, /location/)
  assert.match(lead, /even when the app is closed or not in use/)
  assert.match(lead, /partner store/)
  assert.match(lead, /advertising/)
})

test('근처 알림 한국어 공개 문장은 그대로(위치·앱이 닫혀 있을 때에도·제휴 혜택 알림·광고성 정보)', () => {
  const copy = backgroundDisclosure(true, 150)
  assert.match(copy.lead, /위치 정보/)
  assert.match(copy.lead, /앱이 닫혀 있거나 사용 중이 아닐 때에도/)
  assert.match(copy.lead, /학생 혜택 알림\(광고성 정보\)/)
  assert.ok(copy.bullets.some((line) => line.includes('150m')))
})

test('두 언어 안내의 항목 수가 같다(한쪽만 빠지지 않게)', () => {
  assert.equal(backgroundDisclosure(true, 150).bullets.length, backgroundDisclosure(false, 150).bullets.length)
})

test('앱 사용 중 위치 안내는 기능마다 두 언어 모두 위치와 목적을 적는다', () => {
  for (const purpose of PURPOSES) {
    const en = foregroundDisclosure(purpose, false)
    assert.match(en.message, /location to \S/)
    assert.match(en.message, /while you are using the app/)
    const ko = foregroundDisclosure(purpose, true)
    assert.match(ko.message, /위치 정보\(정확한 위치\)에 액세스합니다/)
    assert.equal(ko.agree, '동의하고 계속')
  }
})
