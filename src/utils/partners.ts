import {
  CAMPUS_CENTER,
  PARTNER_FOCUS_RADIUS_METERS,
} from '../constants/map'
import { haversineMeters } from './geo'
import type { Partner, PartnerAffiliation, PartnerCategory } from '../types'

/** 두 단계 필터. 고르지 않은 단계는 null 이고, 그 단계로는 걸러내지 않는다. */
export interface PartnerFilter {
  affiliation: PartnerAffiliation | null
  category: PartnerCategory | null
}

/** 소속이 아직 확인되지 않은 업체는 어떤 소속으로도 걸러지지 않는다. */
function matchesAffiliation(
  partner: Partner,
  affiliation: PartnerAffiliation | null,
): boolean {
  if (affiliation === null) return true
  return (partner.affiliations ?? []).includes(affiliation)
}

/** `partners` 는 지도 데이터(`useMapData().partners`)를 넘긴다. */
export function filterPartners(
  partners: readonly Partner[],
  { affiliation, category }: PartnerFilter,
): Partner[] {
  return partners.filter(
    (partner) =>
      matchesAffiliation(partner, affiliation) &&
      (category === null || partner.category === category),
  )
}

/**
 * 칩에 붙는 개수 배지용.
 * 한쪽 단계를 고정한 채 세므로, 소속을 고르면 업종 칩의 숫자도 함께 좁혀진다.
 */
export function partnerCount(partners: readonly Partner[], filter: PartnerFilter): number {
  return filterPartners(partners, filter).length
}

/** 두 단계 모두 고르지 않았으면 지도에 아무것도 그리지 않는다. */
export function hasActiveFilter({
  affiliation,
  category,
}: PartnerFilter): boolean {
  return affiliation !== null || category !== null
}

function isNearCampus(partner: Partner): boolean {
  const distance = haversineMeters(
    CAMPUS_CENTER.lat,
    CAMPUS_CENTER.lng,
    partner.lat,
    partner.lng,
  )
  return distance <= PARTNER_FOCUS_RADIUS_METERS
}

/** 화면 맞춤 범위 밖으로 밀려나 눈에 잘 띄지 않는 지점들. 안내 문구에 쓴다. */
export function partnersOutsideFocus(partners: readonly Partner[]): Partner[] {
  const nearby = partners.filter(isNearCampus)
  if (nearby.length === 0) return []
  return partners.filter((partner) => !isNearCampus(partner))
}
