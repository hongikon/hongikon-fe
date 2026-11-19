import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  loginProviderLabel,
  loginProviderName,
  pendingBadge,
  resolveMemberNumber,
  visibleProfile,
} from '../../src/utils/settings/account'
import {
  boardAlertsValue,
  isSystemNotificationBlocked,
  masterAlertDescription,
  permissionSummary,
  subscriptionNewsDescription,
  subscriptionNewsTargets,
} from '../../src/utils/settings/alerts'

const profile = (id: number) => ({ id, memberCode: null }) as never

test('다른 회원의 프로필은 보이지 않는다', () => {
  assert.ok(visibleProfile(profile(1), 1))
  assert.ok(visibleProfile(profile(1), null))
  assert.equal(visibleProfile(profile(1), 2), undefined)
  assert.equal(visibleProfile(null, 1), undefined)
  assert.equal(visibleProfile(undefined, 1), undefined)
})

test('회원 번호: 공개 번호 > 프로필 번호 > (없을 때만) #id', () => {
  const base = { memberId: 7, profileMemberCode: null, codeApiMissing: false }
  assert.equal(resolveMemberNumber({ ...base, codeData: { ownerId: 7, code: 'K7Q2' } }), 'K7Q2')
  // 다른 회원 응답은 쓰지 않는다
  assert.equal(resolveMemberNumber({ ...base, codeData: { ownerId: 8, code: 'OTHER' } }), null)
  assert.equal(resolveMemberNumber({ ...base, codeData: { ownerId: 8, code: 'OTHER' }, profileMemberCode: 'P1' }), 'P1')
  // 불러오는 중에는 id 를 내보이지 않는다
  assert.equal(resolveMemberNumber({ ...base, codeData: undefined }), null)
  // 서버가 빈 값을 주거나 API 가 없으면 #id
  assert.equal(resolveMemberNumber({ ...base, codeData: { ownerId: 7, code: null } }), '#7')
  assert.equal(resolveMemberNumber({ ...base, codeData: undefined, codeApiMissing: true }), '#7')
  assert.equal(resolveMemberNumber({ ...base, memberId: null, codeData: undefined, codeApiMissing: true }), null)
})

test('승인 대기 배지·로그인 방식 이름', () => {
  assert.equal(pendingBadge(0), undefined)
  assert.equal(pendingBadge(3), '승인 대기 3')
  assert.equal(pendingBadge(100), '승인 대기 99+')
  assert.equal(loginProviderName('apple'), 'Apple')
  assert.equal(loginProviderName('demo'), '심사용')
  assert.equal(loginProviderName('kakao'), '카카오')
  assert.equal(loginProviderName(null), '카카오')
  assert.equal(loginProviderLabel('demo'), '심사용 데모 계정으로 로그인됨')
  assert.equal(loginProviderLabel(null), '카카오 계정으로 로그인됨')
})

test('알림 권한 요약', () => {
  assert.equal(permissionSummary({ status: 'granted' }), undefined)
  assert.equal(permissionSummary({ status: 'unknown' }), undefined)
  assert.equal(permissionSummary({ status: 'unsupported' }), undefined)
  assert.equal(permissionSummary({ status: 'denied', canAskAgain: false }), '알림 꺼짐')
  assert.equal(permissionSummary({ status: 'undetermined', canAskAgain: true }), '알림 확인 필요')
  assert.equal(isSystemNotificationBlocked({ status: 'denied', canAskAgain: true }), true)
  assert.equal(isSystemNotificationBlocked({ status: 'undetermined', canAskAgain: true }), true)
  assert.equal(isSystemNotificationBlocked({ status: 'granted' }), false)
  assert.equal(isSystemNotificationBlocked({ status: 'unknown' }), false)
})

test('알림 줄 문구', () => {
  assert.equal(masterAlertDescription(true, false), '로그인하면 켤 수 있어요')
  assert.equal(masterAlertDescription(false, true), '아래에서 켜 둔 알림을 이 기기로 보내드려요')
  assert.equal(masterAlertDescription(false, false), '꺼져 있어 아래 설정과 관계없이 알림이 오지 않아요')
  assert.equal(subscriptionNewsDescription(false, 0, 0), '구독한 게시판이 없어요. 눌러서 게시판을 구독해 보세요')
  assert.equal(subscriptionNewsDescription(false, 2, 5), '구독한 게시판의 새 소식을 알려드려요 · 2/5개 켜짐')
  assert.equal(boardAlertsValue(true, 0, 3), '로그인 후 사용')
  assert.equal(boardAlertsValue(false, 1, 3), '1/3 켜짐')
  assert.equal(boardAlertsValue(false, 0, 0), '구독한 게시판 없음')
})

test('구독 알림 한 번에: 하나라도 켜져 있으면 모두 끄고, 모두 꺼져 있으면 모두 켠다', () => {
  const on = new Set(['a'])
  assert.deepEqual(subscriptionNewsTargets(['a', 'b'], (id) => on.has(id)), { next: false, targets: ['a'] })
  assert.deepEqual(subscriptionNewsTargets(['a', 'b'], () => false), { next: true, targets: ['a', 'b'] })
})
