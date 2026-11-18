import type { Building, Partner } from '../../types'
import { formatFloor } from '../floors'

/** 길찾기 표시의 건물 이름. 층을 골랐으면 '홍문관 R동 3F' 처럼 붙인다. */
export function buildingLabel(building: Building, floor: number | null): string {
  return floor === null ? building.name : `${building.name} ${formatFloor(floor)}`
}

/** 업체 이름 두 곳까지 보여 주고 나머지는 "외 N곳" 으로 줄인다. */
export function offscreenSummary(partners: readonly Partner[]): string {
  const names = partners.slice(0, 2).map((partner) => partner.name)
  const rest = partners.length - names.length
  return rest > 0 ? `${names.join(', ')} 외 ${rest}곳` : names.join(', ')
}
