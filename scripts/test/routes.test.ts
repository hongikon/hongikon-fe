import { test } from 'node:test'
import assert from 'node:assert/strict'

import { pickApproachRoutes, type WalkApproach } from '../../src/apis/routes'
import { straightLineFallback, straightLineFromPoint } from '../../src/utils/routeEstimate'
import { describeRoutes, shortBuildingName } from '../../src/utils/routeLabels'
import type { Building } from '../../src/types'

/** 길찾기 계산은 서버(hongikon-be walkroute)가 하고 그쪽에서 앱 예전 결과와 맞춰 본다. 앱에는 결과를 다루는 부분만 남았다. */

test('길찾기 후보 이름: 가장 빠른 길 기준으로 무엇이 다른지', () => {
  const base = { points: [], distanceMeters: 250, totalSeconds: 180, minutes: 3, hasIndoorTransit: false, hasLinkSegment: false, isEstimate: false }
  const texts = describeRoutes([
    { ...base, hasStairs: true },
    { ...base, totalSeconds: 290, minutes: 5, hasStairs: false },
    { ...base, totalSeconds: 200, hasStairs: true, viaBuildings: ['제4공학관 T동'] },
    { ...base, totalSeconds: 230, hasStairs: true, indoorMeters: 90 },
  ])
  assert.deepEqual(texts.map((t) => t.label), ['가장 빠른 길', '다른 길', 'T동 거쳐', '실내로 가는 길'])
  assert.deepEqual(texts.map((t) => t.delta), [null, '+2분', '비슷해요', '+1분'])
  assert.deepEqual(texts[0].tags, ['계단 있음'])
  assert.deepEqual(describeRoutes([{ ...base, hasStairs: false }, { ...base, hasStairs: false }, { ...base, hasStairs: false }]).map((t) => t.label), ['가장 빠른 길', '다른 길', '다른 길'])
  assert.equal(shortBuildingName('학생회관'), '학생회관')
})

// 위도 0.0001° ≈ 11.1m. 길 점 a(원점)·b(북쪽 약 44m)에서 도착(c)까지.
const summary = (totalSeconds: number, distanceMeters: number, steps: string[] = ['T동 1층 출입구']) => ({
  distanceMeters, totalSeconds, minutes: Math.round(totalSeconds / 60), hasIndoorTransit: false, hasStairs: false,
  hasLinkSegment: false, isEstimate: false, steps,
})
const approach: WalkApproach = {
  nodes: [
    { id: 'a', lat: 37.55, lng: 126.92 },
    { id: 'b', lat: 37.5504, lng: 126.92 },
    { id: 'c', lat: 37.5508, lng: 126.92 },
    { id: 'far', lat: 37.56, lng: 126.92 },
    { id: 'side', lat: 37.5506, lng: 126.9205 },
  ],
  starts: [
    { node: 0, routes: [{ path: [0, 1, 2], route: summary(200, 90) }] },
    {
      node: 1,
      routes: [
        { path: [1, 2], route: summary(100, 45) },
        { path: [1, 4, 2], route: summary(130, 70, ['계단 이용', 'T동 1층 출입구']) },
      ],
    },
    { node: 3, routes: [{ path: [3, 2], route: summary(10, 1000) }] },
  ],
}

test('내 위치 출발: 150m 안 가까운 길 점 중 가장 빠른 곳의 후보들(위치는 보내지 않음)', () => {
  const me = { lat: 37.5499, lng: 126.92 }
  const routes = pickApproachRoutes(approach, me)
  // a 까지 약 11m(8초)+200초, b 까지 약 55m(42초)+100초 → b 의 후보 2개.
  assert.equal(routes.length, 2)
  assert.deepEqual(routes[0].points, [me, { lat: 37.5504, lng: 126.92 }, { lat: 37.5508, lng: 126.92 }])
  assert.ok(routes[0].totalSeconds > 140 && routes[0].totalSeconds < 145, String(routes[0].totalSeconds))
  assert.equal(routes[0].minutes, 2)
  assert.equal(routes[0].isEstimate, false)
  assert.equal(routes[1].points.length, 4)
  assert.equal(Math.round(routes[1].totalSeconds - routes[0].totalSeconds), 30)
  assert.deepEqual(routes[1].steps, ['계단 이용', 'T동 1층 출입구'])
  // 150m 밖뿐이면 빈 배열(호출부가 직선 어림).
  assert.deepEqual(pickApproachRoutes(approach, { lat: 37.54, lng: 126.92 }), [])
  assert.deepEqual(pickApproachRoutes({ nodes: [], starts: [] }, me), [])
})

test('서버를 못 받을 때 직선 어림(층 이동 시간 더함)', () => {
  const a = { name: 'A', lat: 37.55, lng: 126.92, entrances: [{ label: 'HI_A_1F_ENTER', lat: 37.55, lng: 126.92, minFloor: 1, maxFloor: 1 }] } as Building
  const b = { name: 'B', lat: 37.551, lng: 126.92 } as Building
  const flat = straightLineFallback(a, null, b, null)
  const up = straightLineFallback(a, 4, b, null)
  assert.equal(flat.isEstimate, true)
  assert.ok(flat.distanceMeters > 100 && flat.distanceMeters < 120)
  assert.equal(up.totalSeconds - flat.totalSeconds, 60)
  assert.equal(straightLineFromPoint({ lat: 37.55, lng: 126.92 }, b, null).points.length, 2)
})
