import { test } from 'node:test'
import assert from 'node:assert/strict'
import { routePinBuilding } from '../../src/utils/map/routePinBuilding'
import { buildingLabel, offscreenSummary } from '../../src/utils/map/labels'

const b = (id: number | undefined, name: string, lat: number, lng: number) => ({ id, name, lat, lng }) as never

test('핀 아래 건물 이름이 있으면 그 건물', () => {
  const list = [b(1, 'A', 37.55, 126.92), b(2, 'B', 37.5501, 126.9201)]
  assert.equal((routePinBuilding({ lat: 37.55, lng: 126.92, buildingName: 'B' }, list) as { name: string }).name, 'B')
})

test('이름이 없으면 150m 안 가장 가까운 건물, 없으면 null, id 없는 건물은 빼고', () => {
  const list = [b(undefined, '가까운데 id 없음', 37.55, 126.92), b(2, '50m', 37.55045, 126.92), b(3, '100m', 37.5509, 126.92)]
  assert.equal((routePinBuilding({ lat: 37.55, lng: 126.92, buildingName: null }, list) as { name: string }).name, '50m')
  assert.equal(routePinBuilding({ lat: 37.56, lng: 126.92, buildingName: null }, list), null)
})

test('건물 이름에 층, 업체 줄임', () => {
  assert.equal(buildingLabel(b(1, '홍문관 R동', 0, 0), null), '홍문관 R동')
  assert.equal(buildingLabel(b(1, '홍문관 R동', 0, 0), 3), '홍문관 R동 3F')
  assert.equal(offscreenSummary([{ name: 'a' }, { name: 'b' }, { name: 'c' }] as never), 'a, b 외 1곳')
  assert.equal(offscreenSummary([{ name: 'a' }] as never), 'a')
})
