import type { Building, Exhibition, Facility, FacilityKind, Partner } from '../../types'
import { withExhibitionHints } from '../exhibitions'
import { facilityMarkers } from '../facilities'
import { toMarker } from '../partnerMarker'
import { filterPartners, hasActiveFilter, type PartnerFilter } from '../partners'

interface OverlayInput {
  partners: readonly Partner[]
  buildings: readonly Building[]
  facilities: readonly Facility[]
  exhibitions: readonly Exhibition[]
  activeFilter: PartnerFilter
  facilityKind: FacilityKind | null
}

/**
 * 지도 페이지에 다시 올릴 칩 마커 메시지. 켜 둔 것만 채운다(없으면 null). 카메라는 옮기지 않는다(bounds 없음).
 * filteredPartners 는 올린 제휴 목록 — 부르는 쪽이 고른 업체 강조를 다시 건다.
 */
export function overlayMarkerMessages({ partners, buildings, facilities, exhibitions, activeFilter, facilityKind }: OverlayInput) {
  let filteredPartners: Partner[] | null = null
  let partnersMessage: object | null = null
  if (hasActiveFilter(activeFilter)) {
    filteredPartners = filterPartners(partners, activeFilter)
    partnersMessage = { type: 'setPartners', partners: filteredPartners.map(toMarker), bounds: null }
  }
  const facilitiesMessage =
    facilityKind === null
      ? null
      : {
          type: 'setFacilities',
          markers: withExhibitionHints(facilityMarkers(facilities, buildings, facilityKind), facilities, exhibitions),
        }
  return { filteredPartners, partnersMessage, facilitiesMessage }
}
