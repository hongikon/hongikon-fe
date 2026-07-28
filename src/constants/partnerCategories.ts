import type { ComponentProps } from 'react'
import type { Ionicons } from '@expo/vector-icons'
import type { PartnerCategory, PartnerMapIcon } from '../types'

type IoniconName = ComponentProps<typeof Ionicons>['name']

export interface PartnerCategoryMeta {
  key: PartnerCategory
  /** 칩에 쓰는 Ionicons 이름 */
  icon: IoniconName
  /**
   * 지도 마커 배지와 칩 선택 상태에 함께 쓰는 색. 7종이 서로 구분되도록
   * 색상환에서 충분히 떨어뜨렸다.
   *
   * 마커 배지 안의 아이콘은 이 Ionicons 이름이 아니라, WebView 에서 쓸 수 있도록
   * mapHtml.ts 의 PARTNER_ICONS 에 인라인 SVG 로 따로 그린다.
   */
  color: string
}

/** 배열 순서가 곧 칩이 놓이는 순서다. */
export const PARTNER_CATEGORIES: readonly PartnerCategoryMeta[] = [
  { key: '카페', icon: 'cafe', color: '#B45309' },
  { key: '주점', icon: 'wine', color: '#7C3AED' },
  { key: '음식', icon: 'restaurant', color: '#DC2626' },
  { key: '의료/미용', icon: 'medkit', color: '#DB2777' },
  { key: '문화', icon: 'color-palette', color: '#0891B2' },
  { key: '기타', icon: 'pricetag', color: '#64748B' },
  { key: '교육', icon: 'school', color: '#2563EB' },
]

const META_BY_KEY = new Map(PARTNER_CATEGORIES.map((meta) => [meta.key, meta]))

export function partnerCategoryMeta(key: PartnerCategory): PartnerCategoryMeta {
  const meta = META_BY_KEY.get(key)
  if (!meta) {
    throw new Error(`알 수 없는 제휴 카테고리: ${key}`)
  }
  return meta
}

/**
 * mapIcon 으로 아이콘을 덮어쓴 마커의 배지 색. 카테고리 색 대신 쓴다.
 * 병원은 초록+십자(녹십자)라는 보편 기호를 따르므로 카테고리(의료/미용)
 * 핑크가 아니라 별도 초록을 쓴다.
 */
export const PARTNER_MAP_ICON_COLOR: Record<PartnerMapIcon, string> = {
  '병원': '#16A34A',
}
