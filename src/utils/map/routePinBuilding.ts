import type { Building } from '../../types'
import { haversineMeters } from '../geo'

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
