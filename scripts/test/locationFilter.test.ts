import { test } from 'node:test'
import assert from 'node:assert/strict'

import { filterFix, snapToRoute, MAX_ACCEPT_ACCURACY_M } from '../../src/utils/locationFilter'
import { haversineMeters } from '../../src/utils/geo'

const base = { lat: 37.55, lng: 126.925 }

test('오차가 큰 값은 버리고 이전 추정을 유지', () => {
  const first = filterFix(null, { ...base, accuracy: 10, at: 0 })!
  const jumped = filterFix(first, { lat: base.lat + 0.001, lng: base.lng, accuracy: MAX_ACCEPT_ACCURACY_M + 10, at: 1000 })
  assert.equal(jumped, first)
})

test('튄 값은 일부만 따라간다(부드럽게)', () => {
  const first = filterFix(null, { ...base, accuracy: 5, at: 0 })!
  // 1초 뒤 40m 북쪽(오차 30m)으로 튄 값
  const next = filterFix(first, { lat: base.lat + 40 / 111320, lng: base.lng, accuracy: 30, at: 1000 })!
  const moved = haversineMeters(base.lat, base.lng, next.lat, next.lng)
  assert.ok(moved > 0 && moved < 10, `moved ${moved}`)
})

test('경로에서 20m 안이면 경로선 위로, 멀면 붙이지 않음', () => {
  const route = [base, { lat: base.lat, lng: base.lng + 0.002 }] // 동서로 약 176m
  const near = snapToRoute({ lat: base.lat + 10 / 111320, lng: base.lng + 0.001 }, route)!
  assert.ok(Math.abs(near.lat - base.lat) < 1e-9)
  assert.equal(snapToRoute({ lat: base.lat + 40 / 111320, lng: base.lng + 0.001 }, route), null)
})
