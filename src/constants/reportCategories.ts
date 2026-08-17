import type { ComponentProps } from 'react'
import type { Ionicons } from '@expo/vector-icons'
import type { ReportCategory } from '../types'

type IoniconName = ComponentProps<typeof Ionicons>['name']

export interface ReportCategoryMeta {
  key: ReportCategory
  /** 화면에 보이는 이름. 서버로는 `key` 를 보낸다. */
  label: string
  icon: IoniconName
  color: string
}

/**
 * 제보 카테고리. 배열 순서가 곧 선택지 순서다.
 *
 * `docs/report-api-spec.md` §3-3 "카테고리 목록"은 아직 서버와 확정되지 않았다.
 * 여기 `key` 는 `types/index.ts` 의 `ReportCategory` 가안을 그대로 따르며,
 * 확정되면 그 유니온·이 배열·스펙 문서를 함께 고친다.
 *
 * 앱의 소식 카테고리(`constants/colors.ts` 의 `CategoryKey` 7종)와는 별개 축이다.
 * 이름이 겹치는 '행사' 가 있어도 서로 다른 값이니 섞어 쓰지 않는다.
 */
export const REPORT_CATEGORIES: readonly ReportCategoryMeta[] = [
  { key: 'EVENT', label: '행사', icon: 'sparkles', color: '#DB2777' },
  { key: 'PERFORMANCE', label: '공연', icon: 'musical-notes', color: '#7C3AED' },
  { key: 'FOOD_TRUCK', label: '푸드트럭', icon: 'fast-food', color: '#EA580C' },
  { key: 'BOOTH', label: '부스', icon: 'storefront', color: '#0891B2' },
  { key: 'ETC', label: '기타', icon: 'ellipsis-horizontal', color: '#64748B' },
]

const META_BY_KEY = new Map(REPORT_CATEGORIES.map((meta) => [meta.key, meta]))

export function reportCategoryMeta(key: ReportCategory): ReportCategoryMeta {
  const meta = META_BY_KEY.get(key)
  if (!meta) {
    throw new Error(`알 수 없는 제보 카테고리: ${key}`)
  }
  return meta
}
