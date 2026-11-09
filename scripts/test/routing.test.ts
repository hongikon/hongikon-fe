import { test } from 'node:test'
import assert from 'node:assert/strict'

import { findRoutes, readableMemo } from '../../src/utils/routing'
import { describeRoutes, shortBuildingName } from '../../src/utils/routeLabels'
import type { Building } from '../../src/types'

/**
 * 건물은 서버 건물 code(hongik_r)로 경로망 조사 v3 정점과 이어진다. code 가 없으면 출입구 이름 앞부분(HI_R_ → 'R')으로.
 * 좌표는 경로망이 쓰므로 건물 좌표는 아무 값이어도 된다.
 */
function building(name: string, code: string, serverCode?: string, lat = 37.55, lng = 126.925): Building {
  return {
    name,
    code: serverCode,
    lat,
    lng,
    entrances: [{ label: `HI_${code}_1F_ENTER`, lat, lng, minFloor: 1, maxFloor: 1 }],
  } as Building
}

const R = building('홍문관 R동', 'R', 'hongik_r')
const C = building('인문사회관 C동', 'C', 'hongik_c')
const L = building('와우관 L동', 'L', 'hongik_l')
const T = building('제4공학관 T동', 'T', 'hongik_t')
// code 없이 출입구 이름(HI_Q_)으로만 찾는 건물.
const Q = building('Q동', 'Q')
// 경로망에 없는 건물(캠퍼스 안, 가짜 code).
const X = building('경로망 밖 건물', 'XX', 'hongik_none', 37.5512, 126.9246)
const buildings = [R, C, L, T, Q, X]

test('경로망에 있는 두 건물은 실측 경로', () => {
  const routes = findRoutes(buildings, { building: C, floor: null }, { building: L, floor: null })
  assert.ok(routes.length > 0)
  assert.equal(routes[0].isEstimate, false)
  assert.ok(routes[0].points.length >= 2)
  assert.ok(routes[0].distanceMeters > 50 && routes[0].distanceMeters < 1500)
})

test('층을 고르면 층 이동 시간이 더해진다', () => {
  const ground = findRoutes(buildings, { building: R, floor: 1 }, { building: L, floor: 1 })[0]
  const upstairs = findRoutes(buildings, { building: R, floor: 1 }, { building: L, floor: 10 })[0]
  assert.ok(upstairs.totalSeconds > ground.totalSeconds)
  assert.equal(upstairs.hasIndoorTransit, true)
})

test('경로망에 아직 없는 건물은 가까운 길까지 직선으로 이어 길을 따라간다', () => {
  const routes = findRoutes(buildings, { building: R, floor: null }, { building: X, floor: null })
  assert.ok(routes.length > 0)
  assert.equal(routes[0].isEstimate, false)
  assert.equal(routes[0].hasLinkSegment, true)
})

test('내 위치에서 출발: 경로망 가까이면 실측, 멀면 빈 배열', async () => {
  const { findRoutesFromPoint } = await import('../../src/utils/routing')
  const { SURVEY_V3_VERTICES } = await import('../../src/constants/surveyGraphV3')
  const near = SURVEY_V3_VERTICES.find((v) => v[3] === null)!
  const routes = findRoutesFromPoint(buildings, { lat: near[1] + 0.0001, lng: near[2] }, { building: L, floor: null })
  assert.ok(routes.length > 0)
  assert.equal(routes[0].isEstimate, false)
  // 캠퍼스에서 1km 넘게 떨어진 곳은 경로망에 잇지 않는다.
  assert.deepEqual(findRoutesFromPoint(buildings, { lat: 37.56, lng: 126.94 }, { building: L, floor: null }), [])
})

test('조사된 층(T동 엘리베이터 10층)으로 가면 실내 수직 이동이 들어간다', () => {
  const routes = findRoutes(buildings, { building: C, floor: null }, { building: T, floor: 10 })
  assert.ok(routes.length > 0)
  assert.equal(routes[0].isEstimate, false)
  assert.equal(routes[0].hasIndoorTransit, true)
  const ground = findRoutes(buildings, { building: C, floor: null }, { building: T, floor: 1 })[0]
  assert.ok(routes[0].totalSeconds > ground.totalSeconds)
})

test('code 가 없는 건물은 출입구 이름(HI_Q_)으로 경로망에 이어진다', () => {
  const routes = findRoutes(buildings, { building: Q, floor: null }, { building: R, floor: null })
  assert.ok(routes.length > 0)
  assert.equal(routes[0].hasLinkSegment, false)
})

test('경로 점에 같은 자리가 연달아 나오지 않는다(층 이동은 한 점)', () => {
  for (const route of findRoutes(buildings, { building: C, floor: 8 }, { building: T, floor: 10 })) {
    for (let i = 1; i < route.points.length; i++) {
      const [p, q] = [route.points[i - 1], route.points[i]]
      assert.ok(p.lat !== q.lat || p.lng !== q.lng)
    }
  }
})

test('길찾기 후보: 실제로 다른 길만 최대 3개, 가장 빠른 길이 맨 앞, 1.25배·+1분 넘는 우회는 빼기(11-09)', () => {
  const routes = findRoutes(buildings, { building: R, floor: null }, { building: T, floor: null })
  // 억지로 다른 길을 만들지 않는다(11-09) — 실제로 다른 길이 없으면 하나만.
  assert.ok(routes.length >= 1 && routes.length <= 3, `후보 ${routes.length}개`)
  const best = routes[0]
  for (const route of routes.slice(1)) {
    assert.ok(route.totalSeconds >= best.totalSeconds)
    assert.ok(route.totalSeconds <= Math.max(best.totalSeconds * 1.25, best.totalSeconds + 60))
  }
  const keys = new Set(routes.map((route) => route.points.map((p) => `${p.lat},${p.lng}`).join('>')))
  assert.equal(keys.size, routes.length)
})

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

test('조사 메모를 길 안내 말로: 이름표는 읽는 말로, 조사 경로 이름·대수 줄은 뺀다(11-09)', () => {
  assert.equal(readableMemo('HI_T_3F_ENTER 앞 교차점'), 'T동 3층 출입구 앞 교차점')
  assert.equal(readableMemo('HI_C_3_ELEVATOR\n3F~8F\n2대\n주말 사용 불가'), 'C동 엘리베이터 · 3F~8F · 주말 사용 불가')
  assert.equal(readableMemo('상수역 -> 제4공학관 T동'), null)
  assert.equal(readableMemo('HI_R_2F_1_ENTER로 가는 계단 및 경사로'), 'R동 2층 출입구로 가는 계단 및 경사로')
  assert.equal(readableMemo('주말 폐문'), '주말 폐문')
})

test('길 흐름: 나가는 출입구 → 들어가는 출입구(+ 고른 층)', () => {
  const routes = findRoutes(buildings, { building: R, floor: null }, { building: T, floor: null })
  const steps = routes[0].steps ?? []
  assert.ok(steps.length >= 2, steps.join(' / '))
  assert.match(steps[0], /^R동 .*출구$/)
  assert.match(steps[steps.length - 1], /^T동 .*출입구$/)
})
