/**
 * 길찾기 내 위치 점을 다듬는다(11-03). 휴대폰 GPS 는 캠퍼스 건물 사이에서 수십 m 씩 튀어, 받은 값을 그대로 찍으면
 * 점이 건물 안·길 밖으로 뛰었다. 좌표는 이 계산과 지도 점에만 쓰고 저장하거나 보내지 않는다.
 *
 * 1. 오차가 큰 값(50m 넘음)은 버린다. 아직 위치가 없을 때는 받아 둔다.
 * 2. 간단한 칼만 필터로 부드럽게 잇는다 — 새 값이 정확할수록 더 많이 따라가고, 시간이 지나면 움직였을 수 있으니 덜 믿는다.
 * 3. 고른 경로에서 20m 안이면 경로선 위 가장 가까운 곳에 붙인다(길 맞추기).
 */
import type { RoutePoint } from './floors'

export interface Fix {
  lat: number
  lng: number
  /** 오차 반경(m). 모르면 null. */
  accuracy: number | null
  /** 받은 시각(ms). */
  at: number
}

export interface FilterState {
  lat: number
  lng: number
  /** 지금 추정의 오차(분산, m²). */
  variance: number
  at: number
}

/** 이보다 오차가 크면 버린다(이미 추정이 있을 때). */
export const MAX_ACCEPT_ACCURACY_M = 50
/** 걷는 사람이 1초에 움직일 수 있는 정도(m/s). 시간이 지날수록 추정을 덜 믿게 한다. */
const WALK_SPEED_MPS = 1.5
/** 오차를 모를 때 가정하는 값. */
const UNKNOWN_ACCURACY_M = 30
/** 오차 아래 한계(너무 작게 나오는 값을 지나치게 믿지 않게). */
const MIN_ACCURACY_M = 3
/** 경로에서 이만큼 안이면 경로 위에 붙인다. */
export const SNAP_METERS = 20

const M_PER_DEG_LAT = 111_320

function metersPerDegLng(lat: number): number {
  return M_PER_DEG_LAT * Math.cos((lat * Math.PI) / 180)
}

/** 새 위치를 받아 다듬은 추정을 돌려준다. 버린 값이면 이전 추정을 그대로 돌려준다(없으면 null). */
export function filterFix(prev: FilterState | null, fix: Fix): FilterState | null {
  const accuracy = Math.max(fix.accuracy ?? UNKNOWN_ACCURACY_M, MIN_ACCURACY_M)
  if (!prev) return { lat: fix.lat, lng: fix.lng, variance: accuracy * accuracy, at: fix.at }
  if (accuracy > MAX_ACCEPT_ACCURACY_M) return prev

  const seconds = Math.max(0, (fix.at - prev.at) / 1000)
  const predicted = prev.variance + (WALK_SPEED_MPS * seconds) ** 2
  const measured = accuracy * accuracy
  const gain = predicted / (predicted + measured)
  return {
    lat: prev.lat + gain * (fix.lat - prev.lat),
    lng: prev.lng + gain * (fix.lng - prev.lng),
    variance: (1 - gain) * predicted,
    at: fix.at,
  }
}

/** 추정의 오차 반경(m) — 지도 정확도 원 크기. */
export function filterAccuracy(state: FilterState): number {
  return Math.sqrt(state.variance)
}

/**
 * 점 p 를 경로(꺾은선) 위 가장 가까운 곳으로 옮긴다. 경로에서 SNAP_METERS 넘게 떨어졌으면 null(붙이지 않음).
 * 캠퍼스 크기에서는 위경도를 미터 평면으로 펴서 계산해도 충분하다.
 */
export function snapToRoute(p: RoutePoint, route: readonly RoutePoint[], maxMeters = SNAP_METERS): RoutePoint | null {
  if (route.length < 2) return null
  const kx = metersPerDegLng(p.lat)
  let best: { point: RoutePoint; meters: number } | null = null
  for (let i = 0; i < route.length - 1; i++) {
    const a = route[i]
    const b = route[i + 1]
    const ax = (a.lng - p.lng) * kx
    const ay = (a.lat - p.lat) * M_PER_DEG_LAT
    const bx = (b.lng - p.lng) * kx
    const by = (b.lat - p.lat) * M_PER_DEG_LAT
    const dx = bx - ax
    const dy = by - ay
    const lengthSq = dx * dx + dy * dy
    const t = lengthSq === 0 ? 0 : Math.min(1, Math.max(0, -(ax * dx + ay * dy) / lengthSq))
    const x = ax + t * dx
    const y = ay + t * dy
    const meters = Math.hypot(x, y)
    if (!best || meters < best.meters) {
      best = { point: { lat: a.lat + t * (b.lat - a.lat), lng: a.lng + t * (b.lng - a.lng) }, meters }
    }
  }
  return best && best.meters <= maxMeters ? best.point : null
}
