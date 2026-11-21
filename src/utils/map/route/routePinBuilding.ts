import type { Building } from '../../../types'
import { haversineMeters } from '../../common/geo'

/** 핀 아래 건물이 없을 때 이만큼 안의 가장 가까운 건물을 도착으로 쓴다(11-12). */
export const ROUTE_PIN_MAX_METERS = 150

/**
 * 길찾기 도착을 핀으로 고를 때 그 핀이 가리키는 건물(11-12). 길은 서버가 건물(id)끼리만 계산해, 핀 아래(지도가 알려 준 가까운
 * 건물) 건물을 쓰고, 없으면 핀에서 maxMeters 안의 가장 가까운 건물을 쓴다. 그것도 없으면 null.
 */
export function routePinBuilding(
  pin: { lat: number; lng: number; buildingName: string | null },
  buildings: readonly Building[],
  maxMeters = ROUTE_PIN_MAX_METERS,
): Building | null {
  const routable = buildings.filter((b) => b.id !== undefined)
  const named = pin.buildingName ? routable.find((b) => b.name === pin.buildingName) : undefined
  if (named) return named
  let best: Building | null = null
  let bestMeters = maxMeters
  for (const b of routable) {
    const meters = haversineMeters(pin.lat, pin.lng, b.lat, b.lng)
    if (meters <= bestMeters) {
      best = b
      bestMeters = meters
    }
  }
  return best
}

/**
 * 제보로 가는 길찾기의 건물. 제보에 서버 건물(buildingId)이 있고 지도 데이터에 그 건물이 있을 때만 그 건물(11-20 사용자 —
 * 캠퍼스 밖·건물 밖 제보는 길찾기 버튼을 보이지 않는다. 예전에는 가까운 건물로 대신 안내했다). 없으면 null(버튼을 그리지 않는다).
 */
export function reportRouteBuilding(
  report: { buildingId?: number | null },
  buildings: readonly Building[],
): Building | null {
  if (typeof report.buildingId !== 'number') return null
  return buildings.find((b) => b.id === report.buildingId) ?? null
}

/**
 * 제보 시트의 출발·도착에서 쓸 층(11-20 사용자). 제보가 그 건물 안에 적힌 것이고 그 층이 건물 층 목록에 있으면
 * 그 층을 돌려줘 층 다이얼 없이 바로 정한다. 가까운 건물로 대신 정한 경우(제보가 건물 밖)나 목록에 없는 층이면 null —
 * 그때는 지금처럼 층 다이얼로 묻는다.
 */
export function reportRouteFloor(
  report: { buildingId?: number | null; floor?: number | null },
  building: Pick<Building, 'id'>,
  floorOptions: readonly number[],
): number | null {
  if (report.buildingId !== building.id) return null
  if (typeof report.floor !== 'number') return null
  return floorOptions.includes(report.floor) ? report.floor : null
}
