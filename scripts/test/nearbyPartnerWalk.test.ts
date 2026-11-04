import { test } from 'node:test'
import assert from 'node:assert/strict'

import {
  INITIAL_NEARBY_STATE,
  preciseUpdate,
  settle,
  type NearbyState,
  type PreciseRadii,
} from '../../src/lib/nearbyPartners/engine.ts'
import { ALERT_RADIUS_METERS, PARTNER_REGION_RADIUS_METERS, type PreciseMode } from '../../src/lib/nearbyPartners/rules.ts'

/**
 * 걷는 경로를 5초마다 위치 하나씩 넣어 `preciseUpdate`(백그라운드 위치 갱신 판단 전부)를 그대로 돌린다(11-04 현장 제보:
 * "원 안에 있는데 알림이 안 온다", "연속된 가게 반경을 지날 때"). 위치 갱신 단계(Wi-Fi·기지국 → GPS)도 결과 그대로 이어 간다.
 * 운영체제 지오펜스(깨우는 원)는 이미 들어와 위치 갱신이 켜진 뒤라고 본다.
 */

const SEC = 1000
const MIN = 60 * SEC
/** 한국 시간 2026-11-04 14:00 (밤 시간 아님). */
const T0 = Date.UTC(2026, 10, 4, 5, 0)
const ORIGIN = { lat: 37.5535, lng: 126.9235 }
const RADII: PreciseRadii = { alert: ALERT_RADIUS_METERS, wake: PARTNER_REGION_RADIUS_METERS, stopMargin: 50 }

/** 기준점에서 동쪽 x m, 북쪽 y m. */
function at(x: number, y = 0) {
  return { lat: ORIGIN.lat + y / 111_195, lng: ORIGIN.lng + x / (111_195 * Math.cos((ORIGIN.lat * Math.PI) / 180)) }
}

/** 같은 시드면 같은 잡음(테스트가 매번 같게). */
function noise(seed: number) {
  let s = seed
  return () => {
    s = (s * 1_103_515_245 + 12_345) % 2_147_483_648
    return s / 2_147_483_648 - 0.5
  }
}

/** 길을 따라 40m 간격으로 붙은 가게 셋(반경 20m 가 서로 맞닿는다)과 멀리 하나. */
const SHOPS = [
  { id: 'A', name: '가게A', ...at(0), benefit: '10% 할인' },
  { id: 'B', name: '가게B', ...at(40), benefit: '음료 1잔' },
  { id: 'C', name: '가게C', ...at(80), benefit: '5% 할인' },
  { id: 'Z', name: '먼가게', ...at(600), benefit: '사이드' },
]

function start(perVisit = false): NearbyState {
  return { ...INITIAL_NEARBY_STATE, enabled: true, targets: SHOPS, perVisit }
}

interface Leg {
  /** 이 구간 끝 위치(동쪽 m). 제자리에 있으면 앞 구간과 같게. */
  toX: number
  /** 걸리는 시간(ms). */
  ms: number
  /** 위치 잡음 크기(m, 실내 흔들림). */
  jitter?: number
  /** 운영체제가 알려 주는 오차(m). */
  accuracy?: number
  /** Wi-Fi·기지국 위치일 때 길과 직각으로 쏠리는 거리(m). */
  coarseBias?: number
}

interface Run {
  state: NearbyState
  /** 위치마다 쓴 단계. */
  modes: PreciseMode[]
  stoppedAt: number | null
}

function walk(legs: Leg[], { perVisit = false, startX = -60, seed = 7 } = {}): Run {
  const rand = noise(seed)
  let state = start(perVisit)
  let mode: PreciseMode = 'coarse'
  let now = T0
  let x = startX
  const modes: PreciseMode[] = []
  let stoppedAt: number | null = null
  for (const leg of legs) {
    const steps = Math.max(1, Math.round(leg.ms / (5 * SEC)))
    const dx = (leg.toX - x) / steps
    for (let i = 0; i < steps; i += 1) {
      now += 5 * SEC
      x += dx
      const jitter = leg.jitter ?? 5
      const bias = mode === 'coarse' ? (leg.coarseBias ?? 0) : 0
      const accuracy = mode === 'coarse' ? (leg.accuracy ?? 65) : (leg.accuracy ?? 10)
      // Wi-Fi·기지국 쏠림은 길과 직각(북쪽)으로 — 길 방향으로 쏠리면 옆 가게에 가까워져 우연히 맞는다.
      const outcome = preciseUpdate(state, now, { at: at(x + rand() * 2 * jitter, rand() * 2 * jitter + bias), accuracy, mode }, RADII)
      state = outcome.state
      modes.push(mode)
      mode = outcome.nextMode
      if (outcome.stop && stoppedAt === null) stoppedAt = now
    }
  }
  return { state: settle(state, now + 1), modes, stoppedAt }
}

const sentIds = (run: Run) => run.state.sent.map((s) => s.partnerId)

test('A·B·C 앞을 쉬지 않고 걸어 지나가면 알림이 없다', () => {
  const run = walk([{ toX: 140, ms: 2 * MIN }])
  assert.deepEqual(sentIds(run), [])
})

test('B 안(실내, 흔들림 25m)에 6분 머물면 B 이름으로 한 번 알린다 — 옆 A·C 가 아니라', () => {
  const run = walk([
    { toX: 40, ms: 75 * SEC },
    { toX: 40, ms: 6 * MIN, jitter: 25, accuracy: 30 },
    { toX: 140, ms: 75 * SEC },
  ])
  assert.deepEqual(sentIds(run), ['B'])
})

test('들어갈 때 Wi-Fi·기지국 위치가 90m 쏠려(오차 65m) 찍혀도 GPS 로 올라가 알린다(11-04 원 안인데 알림 안 옴)', () => {
  const run = walk([
    { toX: 40, ms: 75 * SEC, coarseBias: 90 },
    { toX: 40, ms: 6 * MIN, jitter: 10, coarseBias: 90 },
  ])
  assert.ok(run.modes.includes('fine'), 'GPS 단계로 올라가야 한다')
  assert.deepEqual(sentIds(run), ['B'])
})

test('A 에 2분, B 에 2분, C 에 2분 — 붙은 가게를 차례로 지나며 머물면 이름은 지금 서 있는 곳', () => {
  const run = walk([
    { toX: 0, ms: 45 * SEC },
    { toX: 0, ms: 2 * MIN },
    { toX: 40, ms: 30 * SEC },
    { toX: 40, ms: 2 * MIN },
    { toX: 80, ms: 30 * SEC },
    { toX: 80, ms: 2 * MIN },
  ])
  assert.ok(sentIds(run).every((id) => id === 'C'), `보낸 알림: ${sentIds(run).join(',')}`)
})

test('현장 테스트: 같은 가게에 16분 머물면 5분마다(5·10·15분) 세 번 알린다(보낸 가게도 GPS 로 계속 잰다)', () => {
  const run = walk(
    [
      { toX: 40, ms: 75 * SEC },
      { toX: 40, ms: 16 * MIN, jitter: 15, coarseBias: 60 },
    ],
    { perVisit: true },
  )
  assert.deepEqual(sentIds(run), ['B', 'B', 'B'])
})

test('600m 떨어진 가게만 남으면 위치 갱신을 끈다(평소에는 GPS 를 쓰지 않음)', () => {
  const run = walk([{ toX: 400, ms: 6 * MIN }], { startX: 0 })
  assert.notEqual(run.stoppedAt, null)
})

test('GPS 로 바뀐 뒤 가게에서 70m 넘게 멀어지면 다시 Wi-Fi·기지국으로 내린다', () => {
  const run = walk([
    { toX: 40, ms: 75 * SEC },
    { toX: 40, ms: 1 * MIN },
    { toX: 230, ms: 2 * MIN },
  ])
  assert.equal(run.modes.at(-1), 'coarse')
})

test('알림 반경 20m: B 에서 12m 에 머물면 알린다', () => {
  const rand = noise(3)
  let state = start()
  let mode: PreciseMode = 'fine'
  let now = T0
  for (let i = 0; i < 6 * 12 + 2; i += 1) {
    now += 5 * SEC
    const outcome = preciseUpdate(state, now, { at: at(40 + rand() * 6, 12 + rand() * 6), accuracy: 5, mode }, RADII)
    state = outcome.state
    mode = outcome.nextMode
  }
  assert.deepEqual(settle(state, now + 1).sent.map((s) => s.partnerId), ['B'])
})

test('알림 반경 20m: 오차가 작을 때(5m) B 에서 40m 떨어져 머물면 알리지 않는다', () => {
  const rand = noise(5)
  let state = start()
  let mode: PreciseMode = 'fine'
  let now = T0
  for (let i = 0; i < 7 * 12; i += 1) {
    now += 5 * SEC
    const outcome = preciseUpdate(state, now, { at: at(40 + rand() * 6, 40 + rand() * 6), accuracy: 5, mode }, RADII)
    state = outcome.state
    mode = outcome.nextMode
  }
  assert.deepEqual(settle(state, now + 1).sent, [])
})

test('알림 반경 20m 의 실제 경계: GPS 오차는 15m 까지 반경에 더해 준다(오차 15m 면 35m 까지 안)', () => {
  const rand = noise(9)
  const runAt = (y: number, accuracy: number) => {
    let state = start()
    let mode: PreciseMode = 'fine'
    let now = T0
    for (let i = 0; i < 7 * 12; i += 1) {
      now += 5 * SEC
      const outcome = preciseUpdate(state, now, { at: at(40 + rand() * 2, y + rand() * 2), accuracy, mode }, RADII)
      state = outcome.state
      mode = outcome.nextMode
    }
    return settle(state, now + 1).sent.map((s) => s.partnerId)
  }
  assert.deepEqual(runAt(30, 15), ['B'])
  assert.deepEqual(runAt(30, 5), [])
  // 오차가 아무리 커도(50m) 15m 까지만 더한다.
  assert.deepEqual(runAt(40, 50), [])
})

test('두 가게 사이(A·B 에서 20m씩)에 머물면 한 번만 알린다(두 번 아님)', () => {
  const rand = noise(11)
  let state = start()
  let mode: PreciseMode = 'fine'
  let now = T0
  for (let i = 0; i < 7 * 12; i += 1) {
    now += 5 * SEC
    const outcome = preciseUpdate(state, now, { at: at(20 + rand() * 4, rand() * 4), accuracy: 5, mode }, RADII)
    state = outcome.state
    mode = outcome.nextMode
  }
  assert.equal(settle(state, now + 1).sent.length, 1)
})
