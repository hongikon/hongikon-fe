import { test } from 'node:test'
import assert from 'node:assert/strict'

import { canAssignOfficial, hasNoAppNickname, memberLabel, memberName } from '../../src/admin/utils/userModeration'
import type { AdminUser } from '../../src/admin/types'

const user = (over: Partial<AdminUser>) => ({ id: 7, status: 'ACTIVE', role: 'USER', ...over }) as AdminUser

test('memberLabel: 회원 번호, 없으면 #id', () => {
  assert.equal(memberLabel({ id: 7, memberCode: 'K7Q2M9XA4D' }), 'K7Q2M9XA4D')
  assert.equal(memberLabel({ id: 7, memberCode: null }), '#7')
})

test('memberName: 앱 닉네임 → 표시 이름 → 이름 없음', () => {
  assert.equal(memberName({ appNickname: '홍길', displayName: '홍**' }), '홍길')
  assert.equal(memberName({ appNickname: null, displayName: '홍**' }), '홍**')
  assert.equal(memberName({ appNickname: null, displayName: null }), '이름 없음')
})

test('hasNoAppNickname: 키가 null 로 왔을 때만', () => {
  assert.equal(hasNoAppNickname(user({ appNickname: null })), true)
  assert.equal(hasNoAppNickname(user({ appNickname: '홍길' })), false)
  assert.equal(hasNoAppNickname(user({})), false)
})

test('canAssignOfficial', () => {
  assert.equal(canAssignOfficial(user({ officialName: null })), true)
  assert.equal(canAssignOfficial(user({ officialName: null, officialRequested: false })), false)
  assert.equal(canAssignOfficial(user({ officialName: null, status: 'SUSPENDED' })), false)
  // officialName 키가 없는 예전 서버
  assert.equal(canAssignOfficial(user({})), false)
})
