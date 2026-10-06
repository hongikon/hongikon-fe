import { COLORS } from './colors'
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
/**
 * 제보 색 — 카테고리마다 다른 색을 쓰지 않고 앱 메인 컬러 하나로 통일한다(지도 제보 핀·확성기와 같은 색, 10-06).
 * 카테고리는 아이콘과 이름으로만 가른다.
 */
const REPORT_COLOR = COLORS.primary

export const REPORT_CATEGORIES: readonly ReportCategoryMeta[] = [
  { key: 'EVENT', label: '행사', icon: 'sparkles', color: REPORT_COLOR },
  { key: 'PERFORMANCE', label: '공연', icon: 'musical-notes', color: REPORT_COLOR },
  { key: 'FOOD_TRUCK', label: '간식행사', icon: 'fast-food', color: REPORT_COLOR },
  { key: 'BOOTH', label: '부스', icon: 'storefront', color: REPORT_COLOR },
  { key: 'ETC', label: '기타', icon: 'ellipsis-horizontal', color: REPORT_COLOR },
]

const META_BY_KEY = new Map(REPORT_CATEGORIES.map((meta) => [meta.key, meta]))

export function reportCategoryMeta(key: ReportCategory): ReportCategoryMeta {
  const meta = META_BY_KEY.get(key)
  if (!meta) {
    // 서버에 새 카테고리가 생기면 OTA 로 아직 못 받은 앱이 지도·시트를 그리다 통째로 죽는다 — '기타'로 보여 준다.
    if (__DEV__) console.warn(`알 수 없는 제보 카테고리: ${key}`)
    return META_BY_KEY.get('ETC') as ReportCategoryMeta
  }
  return meta
}
