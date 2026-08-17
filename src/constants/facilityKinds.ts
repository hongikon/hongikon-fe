import type { ComponentProps } from 'react'
import type { Ionicons } from '@expo/vector-icons'
import type { FacilityKind } from '../types'

type IoniconName = ComponentProps<typeof Ionicons>['name']

export interface FacilityKindMeta {
  key: FacilityKind
  /** 칩에 쓰는 Ionicons 이름 */
  icon: IoniconName
  /**
   * 지도 핀과 칩 선택 상태에 함께 쓰는 색.
   *
   * 제휴 업종 색(`partnerCategories.ts`)과 겹치지 않게 골랐다. 두 갈래를 번갈아
   * 보다 보면 같은 색이 다른 뜻으로 쓰이는 것이 가장 헷갈리기 때문이다.
   * 특히 '카페'는 양쪽에 다 있어, 제휴 카페(#B45309 갈색)와 분명히 다른 색을 쓴다.
   *
   * 지도 핀 안의 아이콘은 이 Ionicons 이름이 아니라, WebView 에서 쓸 수 있도록
   * mapHtml.ts 의 FACILITY_ICONS 에 인라인 SVG 로 따로 그린다.
   */
  color: string
}

/**
 * 배열 순서가 곧 칩이 놓이는 순서다.
 *
 * 찾는 목적이 비슷한 것끼리 묶었다 — 학업(프린터·증명서 발급·열람실),
 * 먹고 마시는 것(정수기·카페·식당), 사람을 만나거나 둘러보는 곳(학생처·행사·전시).
 * 색은 이 레이어 안에서만 구분되면 된다. 편의시설과 제휴 업체는 최상단 칩으로
 * 갈려 한 화면에 같이 뜨지 않기 때문이다.
 */
export const FACILITY_KINDS: readonly FacilityKindMeta[] = [
  { key: '프린터', icon: 'print', color: '#4F46E5' },
  { key: '증명서 발급', icon: 'ribbon', color: '#0F766E' },
  { key: '열람실', icon: 'book', color: '#059669' },
  { key: '정수기', icon: 'water', color: '#0EA5E9' },
  { key: '카페', icon: 'cafe', color: '#9333EA' },
  { key: '식당', icon: 'restaurant', color: '#DC2626' },
  { key: '학생처', icon: 'people', color: '#EA580C' },
  { key: '행사·전시', icon: 'easel', color: '#DB2777' },
]

const META_BY_KEY = new Map(FACILITY_KINDS.map((meta) => [meta.key, meta]))

export function facilityKindMeta(key: FacilityKind): FacilityKindMeta {
  const meta = META_BY_KEY.get(key)
  if (!meta) {
    throw new Error(`알 수 없는 편의시설 종류: ${key}`)
  }
  return meta
}
