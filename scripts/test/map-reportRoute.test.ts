import { test } from 'node:test'
import assert from 'node:assert/strict'

import { reportRouteBuilding, reportRouteFloor } from '../../src/utils/map/routePinBuilding'

const b = (id: number | undefined, name: string, lat: number, lng: number) => ({ id, name, lat, lng }) as never

test('제보 길찾기: 제보 건물 → 150m 안 가장 가까운 건물 → 없음', () => {
  const list = [b(1, 'A', 37.55, 126.92), b(2, 'B', 37.5504, 126.92), b(undefined, 'id 없음', 37.5501, 126.92)]
  assert.equal((reportRouteBuilding({ lat: 0, lng: 0, buildingId: 1 }, list) as { name: string }).name, 'A')
  assert.equal((reportRouteBuilding({ lat: 37.5503, lng: 126.92, buildingId: null }, list) as { name: string }).name, 'B')
  // 서버 건물 id 가 지도 데이터에 없으면 가까운 건물로
  assert.equal((reportRouteBuilding({ lat: 37.55, lng: 126.92, buildingId: 99 }, list) as { name: string }).name, 'A')
  assert.equal(reportRouteBuilding({ lat: 37.56, lng: 126.93 }, list), null)
})

test('제보 길찾기 층: 제보 건물의 목록에 있는 층만 바로 쓴다', () => {
  const options = [-1, 1, 2, 3]
  assert.equal(reportRouteFloor({ buildingId: 7, floor: 3 }, { id: 7 }, options), 3, '강당 S동 3층 → 3층')
  assert.equal(reportRouteFloor({ buildingId: 7, floor: -1 }, { id: 7 }, options), -1, '지하도 그대로')
  assert.equal(reportRouteFloor({ buildingId: 7, floor: 9 }, { id: 7 }, options), null, '목록에 없는 층은 다이얼로')
  assert.equal(reportRouteFloor({ buildingId: 7, floor: null }, { id: 7 }, options), null, '층 없음은 다이얼로')
  assert.equal(reportRouteFloor({ buildingId: null, floor: 3 }, { id: 7 }, options), null, '건물 밖 제보(가까운 건물 대신)는 다이얼로')
  assert.equal(reportRouteFloor({ buildingId: 8, floor: 3 }, { id: 7 }, options), null, '다른 건물이면 쓰지 않는다')
})
