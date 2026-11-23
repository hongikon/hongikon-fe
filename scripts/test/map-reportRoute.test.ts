import { test } from 'node:test'
import assert from 'node:assert/strict'

import { reportRouteBuilding, reportRouteFloor } from '../../src/utils/map/route/routePinBuilding'

const b = (id: number | undefined, name: string, lat: number, lng: number) => ({ id, name, lat, lng }) as never

test('제보 길찾기: 캠퍼스 건물 안 제보만, 캠퍼스 밖·건물 밖은 없음', () => {
  const list = [b(1, 'A', 37.55, 126.92), b(2, 'B', 37.5504, 126.92)]
  assert.equal((reportRouteBuilding({ buildingId: 1 }, list) as { name: string }).name, 'A')
  assert.equal(reportRouteBuilding({ buildingId: null }, list), null, '캠퍼스 밖 제보는 버튼 없음(가까운 건물로 대신하지 않는다)')
  assert.equal(reportRouteBuilding({}, list), null)
  assert.equal(reportRouteBuilding({ buildingId: 99 }, list), null, '지도 데이터에 없는 건물이면 없음')
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
