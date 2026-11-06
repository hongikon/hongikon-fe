import { test } from 'node:test'
import assert from 'node:assert/strict'

import {
  INITIAL_NEARBY_STATE,
  onDisable,
  onEnter,
  onExit,
  onPosition,
  onPrefs,
  onRegister,
  settle,
  type NearbyState,
} from '../../src/lib/nearbyPartners/engine.ts'
import { DWELL_MS } from '../../src/lib/nearbyPartners/rules.ts'

/** 한국 시간 2026-10-28 hh:mm 의 epoch ms. */
function kst(hh: number, mm = 0): number {
  return Date.UTC(2026, 9, 28, hh - 9, mm)
}
const MIN = 60_000

const base: NearbyState = {
  ...INITIAL_NEARBY_STATE,
  enabled: true,
  targets: ['a', 'b', 'c'].map((id) => ({ id, name: `업체${id}`, lat: 37.55, lng: 126.92, benefit: '10% 할인' })),
}

test('들어와서 머물면 5분 뒤 알림 하나를 예약한다', () => {
  const { state, actions } = onEnter(base, 'a', kst(12, 0))
  assert.deepEqual(actions, [{ kind: 'schedule', alert: { partnerId: 'a', fireAt: kst(12, 0) + DWELL_MS, othersCount: 0 } }])
  assert.equal(state.pending?.partnerId, 'a')
})

test('5분 안에 나가면 예약을 취소한다', () => {
  const entered = onEnter(base, 'a', kst(12, 0)).state
  const { state, actions } = onExit(entered, 'a', kst(12, 2))
  assert.deepEqual(actions, [{ kind: 'cancel' }])
  assert.equal(state.pending, null)
})

test('GPS 흔들림: 3분 안에 다시 들어오면 처음 들어온 때부터 센다', () => {
  let s = onEnter(base, 'a', kst(12, 0)).state
  s = onExit(s, 'a', kst(12, 2)).state
  const { actions } = onEnter(s, 'a', kst(12, 4))
  assert.deepEqual(actions, [{ kind: 'schedule', alert: { partnerId: 'a', fireAt: kst(12, 5), othersCount: 0 } }])
})

test('같은 업체 진입이 두 번 오면(등록 직후 중복) 예약을 바꾸지 않는다', () => {
  const first = onEnter(base, 'a', kst(12, 0)).state
  const { state, actions } = onEnter(first, 'a', kst(12, 1))
  assert.deepEqual(actions, [])
  assert.deepEqual(state.pending, first.pending)
})

test('들어온 기록 없는 이탈(Android 등록 직후)은 무시한다', () => {
  const { state, actions } = onExit(base, 'b', kst(12, 0))
  assert.deepEqual(actions, [])
  assert.deepEqual(state.stays, {})
})

test('대상이 아닌 업체·꺼진 상태는 아무것도 하지 않는다', () => {
  assert.deepEqual(onEnter(base, 'zzz', kst(12, 0)).actions, [])
  assert.deepEqual(onEnter({ ...base, enabled: false }, 'a', kst(12, 0)).actions, [])
})

test('여러 곳이 겹치면 예약은 하나 — 가장 오래 머문 곳 + N곳 더', () => {
  let s = onEnter(base, 'a', kst(12, 0)).state
  const { state, actions } = onEnter(s, 'b', kst(12, 1))
  assert.deepEqual(actions, [
    { kind: 'cancel' },
    { kind: 'schedule', alert: { partnerId: 'a', fireAt: kst(12, 5), othersCount: 1 } },
  ])
  s = state
  // 먼저 들어온 a 에서 나가면 b 가 이어받는다(b 는 12:01 부터 머묾).
  const after = onExit(s, 'a', kst(12, 3))
  assert.deepEqual(after.actions, [
    { kind: 'cancel' },
    { kind: 'schedule', alert: { partnerId: 'b', fireAt: kst(12, 6), othersCount: 0 } },
  ])
})

test('알림이 뜬 뒤에는 보낸 것으로 기록하고, 옆 가게 알림은 30분 안에 다시 오지 않는다', () => {
  let s = onEnter(base, 'a', kst(12, 0)).state
  s = onEnter(s, 'b', kst(12, 1)).state
  // 12:05 에 알림이 떴다. 12:10 에 c 에 들어옴.
  const { state, actions } = onEnter(s, 'c', kst(12, 10))
  assert.deepEqual(state.sent, [{ partnerId: 'a', at: kst(12, 5) }])
  assert.equal(state.pending, null)
  assert.deepEqual(actions, [])
})

test('위치를 알면 묶음에서 가장 가까운 업체 이름으로, 시각은 처음 들어온 때 기준', () => {
  const spread: NearbyState = {
    ...base,
    targets: [
      { id: 'a', name: '업체a', lat: 37.55, lng: 126.92, benefit: '10%' },
      { id: 'b', name: '업체b', lat: 37.5508, lng: 126.92, benefit: '10%' },
    ],
  }
  let s = onEnter(spread, 'a', kst(12, 0)).state
  // b 쪽(북쪽 90m)에 있다는 위치와 함께 b 진입 → b 이름, 알림은 a 에 들어온 12:00 + 5분
  const { actions } = onEnter(s, 'b', kst(12, 1), { lat: 37.5508, lng: 126.92 })
  assert.deepEqual(actions, [
    { kind: 'cancel' },
    { kind: 'schedule', alert: { partnerId: 'b', fireAt: kst(12, 5), othersCount: 1 } },
  ])
  // 위치 없는 신호(이탈 등)는 이미 고른 업체를 바꾸지 않는다
  s = onEnter(s, 'b', kst(12, 1), { lat: 37.5508, lng: 126.92 }).state
  assert.equal(onExit(s, 'zzz', kst(12, 2)).state.pending?.partnerId, 'b')
})

test('밤 21~8시: 기본은 예약하지 않고, 야간 수신 동의(quietNight false)면 예약한다(11-01)', () => {
  assert.deepEqual(onEnter(base, 'a', kst(20, 57)).actions, [])
  assert.deepEqual(onEnter({ ...base, quietNight: false }, 'a', kst(20, 57)).actions, [
    { kind: 'schedule', alert: { partnerId: 'a', fireAt: kst(21, 2), othersCount: 0 } },
  ])
})

test('등록: 이미 안에 있는 업체는 지금 들어온 것으로, 감시에서 빠진 업체는 나간 것으로', () => {
  const s = onEnter(base, 'a', kst(12, 0)).state
  const { state, actions } = onRegister(s, ['b', 'c'], ['b'], kst(12, 2))
  assert.equal(state.stays.a.exitedAt, kst(12, 2))
  assert.deepEqual(state.stays.b, { enteredAt: kst(12, 2), exitedAt: null })
  assert.deepEqual(actions, [
    { kind: 'cancel' },
    { kind: 'schedule', alert: { partnerId: 'b', fireAt: kst(12, 7), othersCount: 0 } },
  ])
})

test('끄면 예약을 취소하고 머무름을 지우되 보낸 기록은 남긴다', () => {
  let s = onEnter(base, 'a', kst(12, 0)).state
  s = settle(s, kst(12, 6))
  s = onEnter(s, 'b', kst(14, 30)).state
  const { state, actions } = onDisable(s, kst(14, 31))
  assert.deepEqual(actions, [{ kind: 'cancel' }])
  assert.equal(state.enabled, false)
  assert.deepEqual(state.stays, {})
  assert.equal(state.sent.length, 1)
})

test('오래된 기록 정리: 보낸 지 2일, 나간 지 3분이 넘으면 지운다', () => {
  const old: NearbyState = {
    ...base,
    sent: [{ partnerId: 'a', at: kst(12, 0) - 3 * 24 * 60 * MIN }],
    stays: { a: { enteredAt: kst(11, 0), exitedAt: kst(11, 50) }, b: { enteredAt: kst(11, 59), exitedAt: null } },
  }
  const s = settle(old, kst(12, 0))
  assert.deepEqual(s.sent, [])
  assert.deepEqual(Object.keys(s.stays), ['b'])
})

test('끈 가게는 머물러도 알리지 않고, 예약해 둔 가게를 끄면 예약을 취소한다', () => {
  const muted: NearbyState = { ...base, muted: ['a'] }
  assert.deepEqual(onEnter(muted, 'a', kst(12, 0)).actions, [])

  const entered = onEnter(base, 'a', kst(12, 0)).state
  const off = onPrefs(entered, { muted: ['a'] }, kst(12, 1))
  assert.deepEqual(off.actions, [{ kind: 'cancel' }])
  assert.equal(off.state.pending, null)
  // 함께 있던 다른 가게는 그대로 알린다.
  const both = onEnter(onEnter(base, 'a', kst(12, 0)).state, 'b', kst(12, 1)).state
  const onlyB = onPrefs(both, { muted: ['a'] }, kst(12, 2))
  assert.equal(onlyB.state.pending?.partnerId, 'b')
  assert.equal(onlyB.state.pending?.othersCount, 0)
})

test('카페는 2분 머물면 알린다', () => {
  const cafe: NearbyState = { ...base, targets: base.targets.map((t) => (t.id === 'a' ? { ...t, category: '카페' } : t)) }
  assert.equal(onEnter(cafe, 'a', kst(12, 0)).state.pending?.fireAt, kst(12, 2))
  assert.equal(onEnter(cafe, 'b', kst(12, 0)).state.pending?.fireAt, kst(12, 5))
})

test('머무는 시간을 바꾸면 그 시간으로, 바꾸면 지금 예약도 다시 맞춘다', () => {
  const cafe: NearbyState = { ...base, targets: base.targets.map((t) => (t.id === 'a' ? { ...t, category: '카페' } : t)) }
  const custom: NearbyState = { ...cafe, dwellMinutes: { cafe: 1, other: 8 } }
  assert.equal(onEnter(custom, 'a', kst(12, 0)).state.pending?.fireAt, kst(12, 1))
  assert.equal(onEnter(custom, 'b', kst(12, 0)).state.pending?.fireAt, kst(12, 8))
  // 머무는 중에 바꾸면 새 시각으로 다시 예약
  const entered = onEnter(cafe, 'b', kst(12, 0)).state
  const changed = onPrefs(entered, { dwellMinutes: { cafe: 2, other: 3 } }, kst(12, 1))
  assert.equal(changed.state.pending?.fireAt, kst(12, 3))
  // 범위 밖 값은 1~10분으로
  assert.equal(onEnter({ ...cafe, dwellMinutes: { cafe: 0, other: 30 } }, 'b', kst(12, 0)).state.pending?.fireAt, kst(12, 10))
})

test('안팎이 그대로여도 위치가 바뀌면 대표 가게를 가장 가까운 곳으로 다시 고른다(11-03)', () => {
  const spread: NearbyState = {
    ...base,
    targets: [
      { id: 'a', name: '업체a', lat: 37.55, lng: 126.92, benefit: '10%' },
      { id: 'c', name: '업체c', lat: 37.5502, lng: 126.92, benefit: '10%' },
    ],
  }
  // c 쪽에서 둘 다 들어옴 → c 이름
  let s = onEnter(spread, 'c', kst(12, 0), { lat: 37.5502, lng: 126.92 }).state
  s = onEnter(s, 'a', kst(12, 1), { lat: 37.5502, lng: 126.92 }).state
  assert.equal(s.pending?.partnerId, 'c')
  // a 앞으로 걸어감(진입·이탈 없음) → a 이름으로 다시 예약, 시각은 그대로
  const moved = onPosition(s, kst(12, 2), { lat: 37.55, lng: 126.92 })
  assert.deepEqual(moved.actions, [
    { kind: 'cancel' },
    { kind: 'schedule', alert: { partnerId: 'a', fireAt: kst(12, 5), othersCount: 1 } },
  ])
  // 같은 자리에서 또 위치가 오면 할 일 없음
  assert.deepEqual(onPosition(moved.state, kst(12, 3), { lat: 37.55, lng: 126.92 }).actions, [])
})

test('현장 테스트: 같은 가게에 머무는 동안 5분마다 다시 예약, 나가면 멈춤(11-04)', () => {
  const field: NearbyState = { ...base, perVisit: true }
  const s = onEnter(field, 'a', kst(12, 0)).state
  assert.equal(s.pending?.fireAt, kst(12, 5))
  // 12:05 에 떴다 → 12:06 위치 갱신에서 보냄으로 기록하고 12:10 으로 다시 예약
  const again = onPosition(s, kst(12, 6), { lat: 37.55, lng: 126.92 })
  assert.deepEqual(again.state.sent, [{ partnerId: 'a', at: kst(12, 5) }])
  assert.deepEqual(again.actions, [{ kind: 'schedule', alert: { partnerId: 'a', fireAt: kst(12, 10), othersCount: 0 } }])
  // 12:08 에 나감 → 예약 취소
  const left = onExit(again.state, 'a', kst(12, 8))
  assert.deepEqual(left.actions, [{ kind: 'cancel' }])
  // 운영(perVisit 아님)은 같은 가게에 머물러도 다시 예약하지 않는다
  const prod = onPosition(onEnter(base, 'a', kst(12, 0)).state, kst(12, 6), { lat: 37.55, lng: 126.92 })
  assert.deepEqual(prod.actions, [])
})
