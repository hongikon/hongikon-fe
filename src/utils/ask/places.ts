import type { Building, Facility, Partner } from '../../types'
import { formatFloor } from '../floors'

/** 지도 데이터 중 답 버튼이 찾아보는 것. */
export interface AskPlaceData {
  buildings: readonly Building[]
  facilities: readonly Facility[]
  partners: readonly Partner[]
}

/** 지도 대상 이름('building:K' · 'partner:…' · 'facility:…') — 앱 지도 데이터에 있는 곳만(없으면 null, 버튼을 그리지 않는다). */
export function placeName(target: string, data: AskPlaceData): string | null {
  const split = target.indexOf(':')
  const kind = target.slice(0, split)
  const id = target.slice(split + 1)
  if (kind === 'building') return data.buildings.find((b) => b.code === id)?.name ?? null
  if (kind === 'partner') return data.partners.find((p) => p.id === id)?.name ?? null
  if (kind === 'facility') {
    const facility = data.facilities.find((f) => f.id === id)
    return facility ? [facility.note, facility.buildingName].filter(Boolean).join(' · ') : null
  }
  return null
}

/** 찾아갈 부서 위치 한 줄(부서 메모 · 건물 층). 지도 데이터에 없으면 null. */
export function facilityPlaceLine(facilities: readonly Facility[], facilityId: string): string | null {
  const facility = facilities.find((item) => item.id === facilityId)
  if (!facility) return null
  const place = [facility.buildingName, facility.floor !== undefined ? formatFloor(facility.floor) : null].filter(Boolean).join(' ')
  return [facility.note, place].filter(Boolean).join(' · ')
}
