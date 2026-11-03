import { test } from 'node:test'
import assert from 'node:assert/strict'

import { findRoutes } from '../../src/utils/routing'
import type { Building } from '../../src/types'

/** 건물은 출입구 이름 앞부분(HI_R_ → 'R')으로 경로망 출입구와 이어진다. 좌표는 경로망이 쓰므로 건물 좌표는 아무 값이어도 된다. */
function building(name: string, code: string): Building {
  return {
    name,
    lat: 37.55,
    lng: 126.925,
    entrances: [{ label: `HI_${code}_1F_ENTER`, lat: 37.55, lng: 126.925, minFloor: 1, maxFloor: 1 }],
  } as Building
}

const R = building('홍문관 R동', 'R')
const C = building('인문사회관 C동', 'C')
const L = building('와우관 L동', 'L')
const H = building('중앙도서관 H동', 'H')
const buildings = [R, C, L, H]

test('경로망에 있는 두 건물은 실측 경로', () => {
  const routes = findRoutes(buildings, { building: C, floor: null }, { building: L, floor: null })
  assert.ok(routes.length > 0)
  assert.equal(routes[0].isEstimate, false)
  assert.ok(routes[0].points.length >= 2)
  assert.ok(routes[0].distanceMeters > 50 && routes[0].distanceMeters < 1500)
})

test('층을 고르면 층 이동 시간이 더해진다', () => {
  const ground = findRoutes(buildings, { building: R, floor: 1 }, { building: L, floor: 1 })[0]
  const upstairs = findRoutes(buildings, { building: R, floor: 1 }, { building: L, floor: 6 })[0]
  assert.ok(upstairs.totalSeconds > ground.totalSeconds)
  assert.equal(upstairs.hasIndoorTransit, true)
})

test('경로망에 아직 없는 건물은 빈 배열(호출부가 직선 어림으로 대신)', () => {
  assert.deepEqual(findRoutes(buildings, { building: R, floor: null }, { building: H, floor: null }), [])
})
