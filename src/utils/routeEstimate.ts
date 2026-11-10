import type { RouteAlternative } from '../apis/routes'
import { WALKING_METERS_PER_MINUTE } from '../constants/route'
import type { Building } from '../types'
import { entranceTransitSeconds, resolveEntrancePoint } from './floors'
import type { RoutePoint } from './floors'
import { haversineMeters } from './geo'

/**
 * 서버 길찾기(GET /map/routes)를 못 받을 때(오프라인·오류) 보여 주는 직선 어림. 경로망 없이 출입구 사이 직선거리와 층 이동 시간으로만
 * 어림한다(isEstimate — 카드에 '직선 어림').
 */
export function straightLineFallback(
  fromBuilding: Building,
  fromFloor: number | null,
  toBuilding: Building,
  toFloor: number | null,
): RouteAlternative {
  const fromPoint = resolveEntrancePoint(fromBuilding, fromFloor)
  const toPoint = resolveEntrancePoint(toBuilding, toFloor)
  const meters = haversineMeters(fromPoint.lat, fromPoint.lng, toPoint.lat, toPoint.lng)
  const totalSeconds =
    (meters / WALKING_METERS_PER_MINUTE) * 60 + entranceTransitSeconds(fromBuilding, fromFloor) + entranceTransitSeconds(toBuilding, toFloor)
  return {
    points: [fromPoint, toPoint],
    distanceMeters: Math.round(meters),
    totalSeconds,
    minutes: Math.max(1, Math.round(totalSeconds / 60)),
    hasIndoorTransit: fromFloor !== null || toFloor !== null,
    hasStairs: false,
    hasLinkSegment: false,
    isEstimate: true,
  }
}

/** 내 위치에서 건물까지 직선 어림(경로망 길 점이 150m 안에 없거나 서버를 못 받을 때). */
export function straightLineFromPoint(from: RoutePoint, toBuilding: Building, toFloor: number | null): RouteAlternative {
  const toPoint = resolveEntrancePoint(toBuilding, toFloor)
  const meters = haversineMeters(from.lat, from.lng, toPoint.lat, toPoint.lng)
  const totalSeconds = (meters / WALKING_METERS_PER_MINUTE) * 60 + entranceTransitSeconds(toBuilding, toFloor)
  return {
    points: [from, toPoint],
    distanceMeters: Math.round(meters),
    totalSeconds,
    minutes: Math.max(1, Math.round(totalSeconds / 60)),
    hasIndoorTransit: toFloor !== null,
    hasStairs: false,
    hasLinkSegment: false,
    isEstimate: true,
  }
}
