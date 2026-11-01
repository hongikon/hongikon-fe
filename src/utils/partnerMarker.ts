import { partnerCategoryMeta, PARTNER_MAP_ICON_COLOR } from '../constants/partnerCategories'
import type { Partner } from '../types'

/** WebView 지도 페이지(setPartners)로 넘길 마커 정보. 배지 색·아이콘을 여기서 정한다. */
export function toMarker(partner: Partner) {
  const meta = partnerCategoryMeta(partner.category)
  // mapIcon 으로 아이콘을 덮어쓴 마커(병원 등)는 전용 색을, 아니면 카테고리 색을 쓴다.
  const color = partner.mapIcon ? PARTNER_MAP_ICON_COLOR[partner.mapIcon] : meta.color
  return {
    id: partner.id,
    name: partner.name,
    lat: partner.lat,
    lng: partner.lng,
    color,
    iconKey: partner.mapIcon ?? partner.category,
  }
}
