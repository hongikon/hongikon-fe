import { test } from 'node:test'
import assert from 'node:assert/strict'
import { notificationTarget } from '../../src/utils/notificationRouting.ts'

test('근처 제휴 알림 탭: 한 곳이면 그 업체, 여러 곳이면 목록', () => {
  assert.deepEqual(notificationTarget({ type: 'NEARBY_PARTNER', partnerId: 'a' }), {
    kind: 'map',
    focusReportId: null,
    focusPartnerId: 'a',
  })
  assert.deepEqual(notificationTarget({ type: 'NEARBY_PARTNER', partnerId: 'a', partnerIds: ['a'] }), {
    kind: 'map',
    focusReportId: null,
    focusPartnerId: 'a',
  })
  assert.deepEqual(notificationTarget({ type: 'NEARBY_PARTNER', partnerId: 'a', partnerIds: ['a', 'b', 'b', ' '] }), {
    kind: 'map',
    focusReportId: null,
    focusPartnerId: 'a',
    nearbyPartnerIds: ['a', 'b'],
  })
  assert.deepEqual(notificationTarget({ type: 'NEARBY_PARTNER', partnerId: '' }), { kind: 'none' })
})
