import type { ComponentProps } from 'react'
import type { Ionicons } from '@expo/vector-icons'
import type { PartnerCategory } from '../types'

type IoniconName = ComponentProps<typeof Ionicons>['name']

export interface PartnerCategoryMeta {
  key: PartnerCategory
  /** 칩에 쓰는 Ionicons 이름 */
  icon: IoniconName
  /**
   * 지도 마커와 칩 선택 상태에 함께 쓰는 색.
   * 마커에는 아이콘을 넣지 않으므로, 카테고리를 구분하는 유일한 시각 단서다.
   * 7종이 서로 구분되도록 색상환에서 충분히 떨어뜨렸다.
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
