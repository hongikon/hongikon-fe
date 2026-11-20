import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  fromCamera,
  fromLocation,
  fromMedia,
  fromNotification,
  locationPurpose,
  mapLocationUse,
  permissionActions,
  pillKey,
  unusedPermissionsCopy,
} from '../../src/utils/settings/permissions'
import { MY_LOCATION_BUTTON_FROM } from '../../src/constants/route'

test('권한 응답 → 화면 상태', () => {
  assert.deepEqual(fromNotification({ status: 'unknown' }), { kind: 'loading' })
  assert.deepEqual(fromNotification({ status: 'unsupported' }), { kind: 'loading' })
  assert.deepEqual(fromNotification({ status: 'denied', canAskAgain: false }), { kind: 'denied', canAskAgain: false })
  assert.deepEqual(fromCamera({ granted: false, status: 'undetermined', canAskAgain: true }), { kind: 'undetermined', canAskAgain: true })
  assert.deepEqual(fromMedia({ granted: true, status: 'granted', canAskAgain: true, accessPrivileges: 'limited' }), { kind: 'granted', limited: true })
  assert.deepEqual(fromLocation(null), { kind: 'loading' })
  assert.deepEqual(fromLocation({ status: 'granted', canAskAgain: true }), { kind: 'granted' })
})

test('알약·버튼', () => {
  assert.equal(pillKey({ kind: 'granted', limited: true }), 'limited')
  assert.equal(pillKey({ kind: 'granted' }), 'granted')
  assert.equal(pillKey({ kind: 'notNeeded' }), 'notNeeded')
  assert.deepEqual(permissionActions({ kind: 'denied', canAskAgain: true }), { canAsk: true, blocked: false })
  assert.deepEqual(permissionActions({ kind: 'undetermined', canAskAgain: false }), { canAsk: false, blocked: true })
  assert.deepEqual(permissionActions({ kind: 'granted' }), { canAsk: false, blocked: false })
})

test('위치 안내 문구', () => {
  assert.match(mapLocationUse(MY_LOCATION_BUTTON_FROM), /내 위치 켜기/)
  assert.doesNotMatch(mapLocationUse('2000-01-01'), /내 위치 켜기/)
  assert.match(locationPurpose(true, 'X.'), /X\. 근처 제휴 알림을 켰다면/)
  assert.match(locationPurpose(false, 'X.'), /X\. 저장하거나 서버로 보내지 않아요$/)
  assert.equal(unusedPermissionsCopy(true, true).title, '마이크·연락처는 사용하지 않아요')
  assert.equal(unusedPermissionsCopy(true, false).title, '백그라운드 위치·마이크·연락처는 사용하지 않아요')
  assert.equal(unusedPermissionsCopy(false, true).title, '위치(GPS)·마이크·연락처는 사용하지 않아요')
})
