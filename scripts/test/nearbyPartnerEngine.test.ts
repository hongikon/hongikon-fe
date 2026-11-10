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
  onSeen,
  settle,
  type NearbyState,
} from '../../src/lib/nearbyPartners/engine.ts'
import { DWELL_MS, STAY_CONFIRM_MS } from '../../src/lib/nearbyPartners/rules.ts'

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

const SEC = 1000
const A = { lat: 37.55, lng: 126.92 }

/** 들어온 뒤 위치 갱신으로 계속 안이라고 확인하며 `until` 까지 머문다(1분마다). 마지막 Step 을 돌려준다. */
function stayUntil(state: NearbyState, ids: string[], from: number, until: number, at?: { lat: number; lng: number }) {
  let step = { state, actions: [] as ReturnType<typeof onSeen>['actions'] }
  const actions: typeof step.actions = []
  for (let t = from; t <= until; t += MIN) {
    step = onSeen(step.state, ids, t, at)
    actions.push(...step.actions)
  }
  return { state: step.state, actions }
}

test('들어오는 순간에는 예약하지 않고, 머문 시간이 다 찼을 때 아직 안이면 알린다(11-10)', () => {
  const entered = onEnter(base, 'a', kst(12, 0))
  assert.deepEqual(entered.actions, [])
  assert.equal(entered.state.pending, null)
  assert.match(entered.state.lastReason ?? '', /대기\(12:05:00/)
  const { state, actions } = stayUntil(entered.state, ['a'], kst(12, 1), kst(12, 5))
  assert.deepEqual(actions, [{ kind: 'schedule', alert: { partnerId: 'a', fireAt: kst(12, 0) + DWELL_MS, othersCount: 0 } }])
  assert.equal(state.pending?.partnerId, 'a')
  assert.equal(state.lastReason, null)
})

test('잠깐 지나가면(5분 안에 나감) 아무것도 걸지 않는다', () => {
  const entered = onEnter(base, 'a', kst(12, 0)).state
  const { state, actions } = onExit(entered, 'a', kst(12, 2))
  assert.deepEqual(actions, [])
  assert.equal(state.pending, null)
})

test('위치 확인이 끊긴 머무름으로는 알리지 않는다 — 앱을 열 때 남은 머무름으로 알리던 것(11-10)', () => {
  const entered = onEnter(base, 'a', kst(12, 0)).state
  // 12:00 뒤로 위치가 오지 않다가 12:30 에 다른 신호(설정 바꿈 등)로 판단 → 보내지 않는다.
  const late = onPrefs(entered, {}, kst(12, 30))
  assert.deepEqual(late.actions, [])
  assert.equal(late.state.lastReason, '위치 확인 안 됨')
  // 마지막 확인이 1분 안이면 보낸다.
  const fresh = onSeen(entered, ['a'], kst(12, 5) - STAY_CONFIRM_MS + SEC)
  const sent = onPrefs(fresh.state, {}, kst(12, 5))
  assert.equal(sent.state.pending?.fireAt, kst(12, 5))
})

test('GPS 흔들림: 3분 안에 다시 들어오면 처음 들어온 때부터 센다', () => {
  let s = onEnter(base, 'a', kst(12, 0)).state
  s = onExit(s, 'a', kst(12, 2)).state
  s = onEnter(s, 'a', kst(12, 4)).state
  const { actions } = onSeen(s, ['a'], kst(12, 5))
  assert.deepEqual(actions, [{ kind: 'schedule', alert: { partnerId: 'a', fireAt: kst(12, 5), othersCount: 0 } }])
})

test('같은 업체 진입이 두 번 오면(등록 직후 중복) 새로 세지 않는다', () => {
  const first = onEnter(base, 'a', kst(12, 0)).state
  const { state, actions } = onEnter(first, 'a', kst(12, 1))
  assert.deepEqual(actions, [])
  assert.equal(state.stays.a.enteredAt, kst(12, 0))
  assert.equal(state.stays.a.seenAt, kst(12, 1))
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
  s = onEnter(s, 'b', kst(12, 1)).state
  const both = onSeen(s, ['a', 'b'], kst(12, 5))
  assert.deepEqual(both.actions, [{ kind: 'schedule', alert: { partnerId: 'a', fireAt: kst(12, 5), othersCount: 1 } }])
  // 먼저 들어온 a 에서 12:03 에 나가면 b 가 이어받는다(b 는 12:01 부터 머묾 → 12:06).
  s = onExit(s, 'a', kst(12, 3)).state
  const after = stayUntil(s, ['b'], kst(12, 4), kst(12, 6))
  assert.deepEqual(after.actions, [{ kind: 'schedule', alert: { partnerId: 'b', fireAt: kst(12, 6), othersCount: 0 } }])
})

test('알림이 뜬 뒤에는 보낸 것으로 기록하고, 옆 가게 알림은 30분 안에 다시 오지 않는다', () => {
  let s = onEnter(base, 'a', kst(12, 0)).state
  s = onEnter(s, 'b', kst(12, 1)).state
  s = onSeen(s, ['a', 'b'], kst(12, 5)).state
  // 12:05 에 알림이 떴다. 12:10 에 c 에 들어와 머묾.
  s = onEnter(s, 'c', kst(12, 10)).state
  const { state, actions } = stayUntil(s, ['c'], kst(12, 11), kst(12, 20))
  assert.deepEqual(state.sent, [{ partnerId: 'a', at: kst(12, 5) }])
  assert.equal(state.pending, null)
  assert.deepEqual(actions, [])
  assert.equal(state.lastReason, '알림 사이 30분 안')
})

test('위치를 알면 묶음에서 가장 가까운 업체 이름으로, 시각은 처음 들어온 때 기준', () => {
  const spread: NearbyState = {
    ...base,
    targets: [
      { id: 'a', name: '업체a', lat: 37.55, lng: 126.92, benefit: '10%' },
      { id: 'b', name: '업체b', lat: 37.5508, lng: 126.92, benefit: '10%' },
    ],
  }
  const nearB = { lat: 37.5508, lng: 126.92 }
  let s = onEnter(spread, 'a', kst(12, 0)).state
  s = onEnter(s, 'b', kst(12, 1), nearB).state
  // b 쪽(북쪽 90m)에 있다는 위치 → b 이름, 알림은 a 에 들어온 12:00 + 5분
  const { actions, state } = onSeen(s, ['a', 'b'], kst(12, 5) - 10 * SEC, nearB)
  assert.deepEqual(actions, [{ kind: 'schedule', alert: { partnerId: 'b', fireAt: kst(12, 5), othersCount: 1 } }])
  // 위치 없는 신호(이탈 등)는 이미 고른 업체를 바꾸지 않는다
  assert.equal(onExit(state, 'zzz', kst(12, 5) - 5 * SEC).state.pending?.partnerId, 'b')
})

test('밤 21~8시: 기본은 보내지 않고, 야간 수신 동의(quietNight false)면 보낸다(11-01)', () => {
  const night = stayUntil(onEnter(base, 'a', kst(20, 57)).state, ['a'], kst(20, 58), kst(21, 5))
  assert.deepEqual(night.actions, [])
  assert.equal(night.state.lastReason, '밤(21~8시)')
  const agreed = stayUntil(onEnter({ ...base, quietNight: false }, 'a', kst(20, 57)).state, ['a'], kst(20, 58), kst(21, 2))
  assert.deepEqual(agreed.actions, [{ kind: 'schedule', alert: { partnerId: 'a', fireAt: kst(21, 2), othersCount: 0 } }])
})

test('등록: 이미 안에 있는 업체는 지금 들어온 것으로, 감시에서 빠진 업체는 나간 것으로', () => {
  const s = onEnter(base, 'a', kst(12, 0)).state
  const { state, actions } = onRegister(s, ['b', 'c'], ['b'], kst(12, 2))
  assert.equal(state.stays.a.exitedAt, kst(12, 2))
  assert.deepEqual(state.stays.b, { enteredAt: kst(12, 2), exitedAt: null, seenAt: kst(12, 2) })
  assert.deepEqual(actions, [])
  assert.deepEqual(onSeen(state, ['b'], kst(12, 7)).actions, [
    { kind: 'schedule', alert: { partnerId: 'b', fireAt: kst(12, 7), othersCount: 0 } },
  ])
})

test('끄면 예약을 취소하고 머무름을 지우되 보낸 기록은 남긴다', () => {
  let s = onEnter(base, 'a', kst(12, 0)).state
  s = onSeen(s, ['a'], kst(12, 5)).state
  s = settle(s, kst(12, 6))
  s = onEnter(s, 'b', kst(14, 30)).state
  s = onSeen(s, ['b'], kst(14, 35) - 10 * SEC).state
  const { state, actions } = onDisable(s, kst(14, 35) - 5 * SEC)
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

test('저장한 대상은 마지막 날(until)이 지나면 빠지고, 그 가게에 들어가도 알리지 않는다(11-09)', () => {
  const dated: NearbyState = { ...base, targets: base.targets.map((t) => (t.id === 'a' ? { ...t, until: '2026-10-27' } : t)) }
  assert.deepEqual(settle(dated, kst(12, 0)).targets.map((t) => t.id), ['b', 'c'])
  assert.deepEqual(onEnter(dated, 'a', kst(12, 0)).state.stays, {})
  const today: NearbyState = { ...base, targets: base.targets.map((t) => (t.id === 'a' ? { ...t, until: '2026-10-28' } : t)) }
  assert.equal(settle(today, kst(12, 0)).targets.length, 3)
})

test('끈 가게는 머물러도 알리지 않고, 걸어 둔 가게를 끄면 취소한다', () => {
  const muted: NearbyState = { ...base, muted: ['a'] }
  assert.deepEqual(stayUntil(onEnter(muted, 'a', kst(12, 0)).state, ['a'], kst(12, 1), kst(12, 6)).actions, [])

  const due = onSeen(onEnter(base, 'a', kst(12, 0)).state, ['a'], kst(12, 4) + 50 * SEC).state
  assert.equal(due.pending?.partnerId, 'a')
  const off = onPrefs(due, { muted: ['a'] }, kst(12, 4) + 55 * SEC)
  assert.deepEqual(off.actions, [{ kind: 'cancel' }])
  assert.equal(off.state.pending, null)
  // 함께 있던 다른 가게는 그대로 알린다.
  const both = onEnter(onEnter(base, 'a', kst(12, 0)).state, 'b', kst(12, 1)).state
  const onlyB = onSeen(onPrefs(both, { muted: ['a'] }, kst(12, 2)).state, ['b'], kst(12, 6))
  assert.equal(onlyB.state.pending?.partnerId, 'b')
  assert.equal(onlyB.state.pending?.othersCount, 0)
})

/** 머물면서 처음 걸리는 알림 시각(없으면 null). */
function firstFire(state: NearbyState, id: string, from: number): number | null {
  const s = onEnter(state, id, from).state
  for (let t = from + 30 * SEC; t <= from + 12 * MIN; t += 30 * SEC) {
    const step = onSeen(s.pending ? s : s, [id], t)
    if (step.state.pending) return step.state.pending.fireAt
  }
  return null
}

test('카페는 2분 머물면 알린다', () => {
  const cafe: NearbyState = { ...base, targets: base.targets.map((t) => (t.id === 'a' ? { ...t, category: '카페' } : t)) }
  assert.equal(firstFire(cafe, 'a', kst(12, 0)), kst(12, 2))
  assert.equal(firstFire(cafe, 'b', kst(12, 0)), kst(12, 5))
})

test('머무는 시간을 바꾸면 그 시간으로 알린다', () => {
  const cafe: NearbyState = { ...base, targets: base.targets.map((t) => (t.id === 'a' ? { ...t, category: '카페' } : t)) }
  const custom: NearbyState = { ...cafe, dwellMinutes: { cafe: 1, other: 8 } }
  assert.equal(firstFire(custom, 'a', kst(12, 0)), kst(12, 1))
  assert.equal(firstFire(custom, 'b', kst(12, 0)), kst(12, 8))
  // 머무는 중에 바꾸면 새 시각으로 기다린다
  const entered = onEnter(cafe, 'b', kst(12, 0)).state
  const changed = onPrefs(entered, { dwellMinutes: { cafe: 2, other: 3 } }, kst(12, 1))
  assert.match(changed.state.lastReason ?? '', /12:03:00/)
  // 범위 밖 값은 1~10분으로
  assert.equal(firstFire({ ...cafe, dwellMinutes: { cafe: 0, other: 30 } }, 'b', kst(12, 0)), kst(12, 10))
})

test('알림 직전(15초 안)에 위치가 바뀌면 대표 가게를 가장 가까운 곳으로 다시 고른다(11-03)', () => {
  const spread: NearbyState = {
    ...base,
    targets: [
      { id: 'a', name: '업체a', lat: 37.55, lng: 126.92, benefit: '10%' },
      { id: 'c', name: '업체c', lat: 37.5502, lng: 126.92, benefit: '10%' },
    ],
  }
  const nearC = { lat: 37.5502, lng: 126.92 }
  let s = onEnter(spread, 'c', kst(12, 0), nearC).state
  s = onEnter(s, 'a', kst(12, 1), nearC).state
  s = onSeen(s, ['a', 'c'], kst(12, 5) - 10 * SEC, nearC).state
  assert.equal(s.pending?.partnerId, 'c')
  // a 앞으로 걸어감(진입·이탈 없음) → a 이름으로 다시, 시각은 그대로
  const moved = onSeen(s, ['a', 'c'], kst(12, 5) - 5 * SEC, A)
  assert.deepEqual(moved.actions, [
    { kind: 'cancel' },
    { kind: 'schedule', alert: { partnerId: 'a', fireAt: kst(12, 5), othersCount: 1 } },
  ])
  // 같은 자리에서 또 위치가 오면 할 일 없음
  assert.deepEqual(onSeen(moved.state, ['a', 'c'], kst(12, 5) - 2 * SEC, A).actions, [])
})

test('현장 테스트: 같은 가게에 머무는 동안 5분마다 다시, 나가면 멈춤(11-04)', () => {
  const field: NearbyState = { ...base, perVisit: true }
  let s = onEnter(field, 'a', kst(12, 0)).state
  s = onSeen(s, ['a'], kst(12, 5), A).state
  assert.equal(s.pending?.fireAt, kst(12, 5))
  // 12:05 에 떴다 → 12:06 위치 갱신에서 보냄으로 기록, 12:10 에 다시
  const again = stayUntil(s, ['a'], kst(12, 6), kst(12, 10), A)
  assert.deepEqual(again.state.sent, [{ partnerId: 'a', at: kst(12, 5) }])
  assert.deepEqual(again.actions, [{ kind: 'schedule', alert: { partnerId: 'a', fireAt: kst(12, 10), othersCount: 0 } }])
  // 나가면 더 오지 않는다
  const left = onExit(settle(again.state, kst(12, 11)), 'a', kst(12, 11))
  assert.equal(left.state.pending, null)
  // 운영(perVisit 아님)은 같은 가게에 머물러도 다시 보내지 않는다
  const prod = stayUntil(onEnter(base, 'a', kst(12, 0)).state, ['a'], kst(12, 1), kst(12, 20), A)
  assert.equal(prod.actions.length, 1)
})

test('운영: 같은 가게는 머무는 동안 한 번, 나갔다 다시 와도 지난 알림에서 3시간이 지나야 다시(11-09)', () => {
  // 12:00 들어옴 → 12:05 알림. 16:00 까지 계속 앉아 있어도 다시 보내지 않는다(가게 옆에 오래 있는 경우).
  let s = stayUntil(onEnter(base, 'a', kst(12, 0)).state, ['a'], kst(12, 1), kst(12, 6)).state
  const sitting = onSeen(s, ['a'], kst(16, 0), A)
  assert.deepEqual(sitting.state.sent, [{ partnerId: 'a', at: kst(12, 5) }])
  assert.deepEqual(sitting.actions, [])
  // 12:30 나감 → 14:00 다시 옴(알림에서 1시간 55분) → 안 보냄.
  s = onExit(s, 'a', kst(12, 30)).state
  const soon = stayUntil(onEnter(s, 'a', kst(14, 0)).state, ['a'], kst(14, 1), kst(14, 9))
  assert.deepEqual(soon.actions, [])
  // 14:10 나감 → 18:00 저녁에 다시 옴 → 머문 뒤 18:05 에 보냄.
  s = onExit(soon.state, 'a', kst(14, 10)).state
  const dinner = stayUntil(onEnter(s, 'a', kst(18, 0)).state, ['a'], kst(18, 1), kst(18, 5))
  assert.deepEqual(dinner.actions, [{ kind: 'schedule', alert: { partnerId: 'a', fireAt: kst(18, 0) + DWELL_MS, othersCount: 0 } }])
})
