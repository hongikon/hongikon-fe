import { test } from 'node:test'
import assert from 'node:assert/strict'

import { reportRouteBuilding } from '../../src/utils/map/routePinBuilding'

const b = (id: number | undefined, name: string, lat: number, lng: number) => ({ id, name, lat, lng }) as never

test('제보 길찾기: 제보 건물 → 150m 안 가장 가까운 건물 → 없음', () => {
  const list = [b(1, 'A', 37.55, 126.92), b(2, 'B', 37.5504, 126.92), b(undefined, 'id 없음', 37.5501, 126.92)]
  assert.equal((reportRouteBuilding({ lat: 0, lng: 0, buildingId: 1 }, list) as { name: string }).name, 'A')
  assert.equal((reportRouteBuilding({ lat: 37.5503, lng: 126.92, buildingId: null }, list) as { name: string }).name, 'B')
  // 서버 건물 id 가 지도 데이터에 없으면 가까운 건물로
  assert.equal((reportRouteBuilding({ lat: 37.55, lng: 126.92, buildingId: 99 }, list) as { name: string }).name, 'A')
  assert.equal(reportRouteBuilding({ lat: 37.56, lng: 126.93 }, list), null)
})
