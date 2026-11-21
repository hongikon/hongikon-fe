import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  affiliationLabel,
  alwaysAllowCopy,
  missingItems,
  nearbyRowDescription,
  permissionSteps,
  stepDwell,
  toggleInList,
} from '../../src/utils/settings/nearby'
import { DEFAULT_DWELL_MINUTES, MAX_DWELL_MINUTES, MIN_DWELL_MINUTES } from '../../src/lib/nearbyPartners/rules'

test('소속 이름 뒤에 늘 총학생회', () => {
  assert.equal(affiliationLabel([]), '총학생회')
  assert.equal(affiliationLabel(['A', 'B'] as never), 'A·B·총학생회')
})

test('빠진 권한', () => {
  assert.deepEqual(missingItems(null), [])
  assert.deepEqual(missingItems({ notifications: true, always: true, precise: null }), [])
  assert.deepEqual(missingItems({ notifications: false, always: false, precise: false }), ['알림 허용', '위치 "항상"', '정확한 위치'])
})

test('근처 알림 줄 설명: 미지원 > 운영 중지 > 꺼짐 > 빠진 권한 > 받는 범위', () => {
  const base = { unsupported: false, serverPaused: false, enabled: true, missing: [], settings: null }
  assert.match(nearbyRowDescription({ ...base, unsupported: true, serverPaused: true }), /지오펜스/)
  assert.match(nearbyRowDescription({ ...base, serverPaused: true }), /잠시 멈췄어요/)
  assert.match(nearbyRowDescription({ ...base, enabled: false }), /혜택을 알려 드려요/)
  assert.equal(
    nearbyRowDescription({ ...base, missing: ['알림 허용', '정확한 위치'] }),
    '알림이 오려면 설정이 필요해요: 알림 허용, 정확한 위치. 눌러서 고칠 수 있어요.',
  )
  assert.equal(
    nearbyRowDescription(base),
    `총학생회 제휴 가게에 ${DEFAULT_DWELL_MINUTES.other}분(카페는 ${DEFAULT_DWELL_MINUTES.cafe}분) 넘게 머물면 알려 드려요.`,
  )
  const settings = { affiliations: ['A'], dwellMinutes: { cafe: 4, other: 6 } } as never
  assert.equal(nearbyRowDescription({ ...base, settings }), 'A·총학생회 제휴 가게에 6분(카페는 4분) 넘게 머물면 알려 드려요.')
})

test('머무는 시간은 범위 밖으로 나가지 않는다', () => {
  assert.equal(stepDwell(MIN_DWELL_MINUTES, -1), MIN_DWELL_MINUTES)
  assert.equal(stepDwell(MAX_DWELL_MINUTES, 1), MAX_DWELL_MINUTES)
  assert.equal(stepDwell(MIN_DWELL_MINUTES, 1), MIN_DWELL_MINUTES + 1)
})

test('소속 넣고 빼기', () => {
  assert.deepEqual(toggleInList(['a'], 'b'), ['a', 'b'])
  assert.deepEqual(toggleInList(['a', 'b'], 'a'), ['b'])
})

test('권한 그림: iOS 는 시스템 창/설정 목록, Android 는 설정 목록 첫 줄', () => {
  const iosPrompt = permissionSteps(false, true, true)
  assert.equal(iosPrompt.length, 1)
  assert.equal(iosPrompt[0].options[iosPrompt[0].pick], '항상 허용으로 변경')
  assert.equal(iosPrompt[0].list, undefined)
  const iosSettings = permissionSteps(true, false, true)
  assert.equal(iosSettings[0].options[iosSettings[0].pick], 'Always')
  assert.equal(iosSettings[0].list, true)
  const android = permissionSteps(true, true, false)
  assert.equal(android[0].caption, '휴대폰 설정 > 앱 > 홍익온 > 권한 > 위치에서')
  assert.equal(android[0].options[android[0].pick], '항상 허용')
})

test('"항상 허용" 안내 문구', () => {
  assert.equal(alwaysAllowCopy(false, true, true).title, '위치를 "항상 허용"으로 바꿔 주세요')
  assert.equal(alwaysAllowCopy(false, false, true).title, 'Change location to "Always"')
  assert.equal(alwaysAllowCopy(false, false, false).title, 'Change location to "Allow all the time"')
  assert.match(alwaysAllowCopy(true, true, false).body, /앱 사용 중에만 허용/)
  assert.match(alwaysAllowCopy(false, true, true).body, /이어서 뜨는 창에서/)
})
