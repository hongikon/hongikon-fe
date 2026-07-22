import {
  CAMPUS_CENTER,
  PARTNER_BOUNDS_PADDING_DEGREES,
  PARTNER_FOCUS_RADIUS_METERS,
} from '../constants/map'
import { PARTNERS } from '../constants/partners'
import { haversineMeters } from './geo'
import type { Partner, PartnerAffiliation, PartnerCategory } from '../types'

export interface PartnerBounds {
  swLat: number
  swLng: number
  neLat: number
  neLng: number
}

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

export function filterPartners({
  affiliation,
  category,
}: PartnerFilter): Partner[] {
  return PARTNERS.filter(
    (partner) =>
      matchesAffiliation(partner, affiliation) &&
      (category === null || partner.category === category),
  )
}

/**
 * 칩에 붙는 개수 배지용.
 * 한쪽 단계를 고정한 채 세므로, 소속을 고르면 업종 칩의 숫자도 함께 좁혀진다.
 */
export function partnerCount(filter: PartnerFilter): number {
  return filterPartners(filter).length
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

/**
 * 마커를 화면에 맞출 범위. 캠퍼스에서 먼 지점(구로·강남·성수·방화·은평)은
 * 계산에서 빼고, 그런 지점만 있는 경우에만 전체를 쓴다. 빼지 않으면 칩 하나에
 * 지도가 서울 전체로 줌아웃된다.
 *
 * 캠퍼스 중심을 항상 포함시켜, 업체와 학교 사이 거리감을 잡을 수 있게 한다.
 */
export function partnerFocusBounds(
  partners: readonly Partner[],
): PartnerBounds | null {
  if (partners.length === 0) return null

  const nearby = partners.filter(isNearCampus)
  const focused = nearby.length > 0 ? nearby : partners

  const lats = [CAMPUS_CENTER.lat, ...focused.map((partner) => partner.lat)]
  const lngs = [CAMPUS_CENTER.lng, ...focused.map((partner) => partner.lng)]
  const pad = PARTNER_BOUNDS_PADDING_DEGREES

  return {
    swLat: Math.min(...lats) - pad,
    swLng: Math.min(...lngs) - pad,
    neLat: Math.max(...lats) + pad,
    neLng: Math.max(...lngs) + pad,
  }
}

/** 화면 맞춤 범위 밖으로 밀려나 눈에 잘 띄지 않는 지점들. 안내 문구에 쓴다. */
export function partnersOutsideFocus(partners: readonly Partner[]): Partner[] {
  const nearby = partners.filter(isNearCampus)
  if (nearby.length === 0) return []
  return partners.filter((partner) => !isNearCampus(partner))
}
