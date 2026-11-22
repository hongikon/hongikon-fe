import { apiRequest } from './client'

/**
 * 관리자 '길 관리'에서 막은 곳 중 오늘 유효한 것(11-22, `GET /map/walk-restrictions`). 길찾기 결과는 서버가 이미 이곳을 피한다 —
 * 앱은 길찾기 지도에 금지 표시만 찍는다. points 는 [lat, lng]: EDGE 는 두 점(그 사이 구간), 나머지는 한 점.
 */
export interface WalkRestrictionSpot {
  kind: 'ENTRANCE' | 'EDGE' | 'BUILDING_PASS'
  /** 임시 통제 이유. 상시 규칙은 서버가 보내지 않는다. */
  cause?: 'CONSTRUCTION' | 'EVENT' | 'OTHER' | null
  label: string
  reason?: string | null
  /** KST 'yyyy-MM-ddTHH:mm'. */
  endsAt?: string | null
  points: [number, number][]
}

function isSpot(value: unknown): value is WalkRestrictionSpot {
  const s = value as WalkRestrictionSpot
  return (
    !!s &&
    typeof s.label === 'string' &&
    Array.isArray(s.points) &&
    s.points.length > 0 &&
    s.points.every((p) => Array.isArray(p) && p.length === 2 && p.every((n) => typeof n === 'number' && Number.isFinite(n)))
  )
}

/** 서버가 아직 이 기능이 없거나 실패하면 빈 목록(금지 표시만 빠지고 길찾기는 그대로). */
export async function fetchWalkRestrictionSpots(signal?: AbortSignal): Promise<WalkRestrictionSpot[]> {
  try {
    const body = await apiRequest<{ restrictions?: unknown }>('/map/walk-restrictions', { signal, skipTokenRefresh: true })
    return Array.isArray(body?.restrictions) ? body.restrictions.filter(isSpot) : []
  } catch {
    return []
  }
}
