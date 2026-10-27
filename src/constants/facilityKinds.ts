import type { ComponentProps } from 'react'
import type { Ionicons } from '@expo/vector-icons'
import type { FacilityKind } from '../types'

type IoniconName = ComponentProps<typeof Ionicons>['name']
/** 시설 아이콘 이름. 'sofa'(라운지)·'bank'(은행·ATM)는 Ionicons 에 없어 MaterialCommunityIcons 로 그린다(`ChipIcon.tsx` KindIcon). */
export type FacilityIconName = IoniconName | 'sofa' | 'bank' | 'smoking'

export interface FacilityKindMeta {
  key: FacilityKind
  /** 칩·시트에 쓰는 아이콘 이름 */
  icon: FacilityIconName
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
  /**
   * 화면에 보일 이름. 없으면 key 를 그대로 쓴다. key 는 서버 데이터·배포된 지도 페이지(map.html 아이콘)가 쓰는 값이라
   * 바꾸지 않고, 보이는 이름만 바꿀 때 쓴다(예: '학생처' → '행정·지원').
   */
  label?: string
}

/**
 * 배열 순서가 곧 칩이 놓이는 순서다.
 *
 * 자주 찾는 순서로 앞에 둔다(10-13 요청): 행정·지원과 학과사무실을 앞쪽으로 올리고, 열람실·식당은 뒤로 보냈다.
 * 색은 이 레이어 안에서만 구분되면 된다. 편의시설과 제휴 업체는 최상단 칩으로
 * 갈려 한 화면에 같이 뜨지 않기 때문이다.
 */
export const FACILITY_KINDS: readonly FacilityKindMeta[] = [
  { key: '프린터', icon: 'print', color: '#4F46E5' },
  { key: '증명서 발급', icon: 'ribbon', color: '#0F766E' },
  // 학생처뿐 아니라 입학·교무·총무 등 학생이 찾아가는 행정 부서를 모두 담는다.
  { key: '학생처', label: '행정·지원', icon: 'people', color: '#EA580C' },
  { key: '스터디룸', icon: 'people-circle', color: '#2563EB' },
  { key: '정수기', icon: 'water', color: '#0EA5E9' },
  // 사선 없는 담배(MaterialCommunityIcons 'smoking') — Ionicons 'logo-no-smoking' 은 금연 표시라 뜻이 반대였다(10-27). 칩은 카페 바로 왼쪽(10-27 요청). 지도 핀도 사선 없음.
  { key: '흡연구역', icon: 'smoking', color: '#57534E' },
  { key: '카페', icon: 'cafe', color: '#9333EA' },
  { key: '학과사무실', icon: 'business-outline', color: '#1E3A8A' },
  { key: '편의점', icon: 'storefront', color: '#D97706' },
  // 은행 창구·ATM. 편의점(밝은 호박색)과 갈리게 짙은 금색(10-14 추가).
  { key: '은행·ATM', icon: 'bank', color: '#854D0E' },
  { key: '라운지', icon: 'sofa', color: '#65A30D' },
  // 서버 값은 '수면실' 그대로, 화면에는 '휴게실'(10-14 요청 — 실제 데이터가 남·여학생 휴게실이다). 아이콘은 침대 그대로.
  { key: '수면실', label: '휴게실', icon: 'bed', color: '#0891B2' },
  { key: '열람실', icon: 'book', color: '#059669' },
  { key: '식당', icon: 'restaurant', color: '#DC2626' },
  { key: '행사·전시', icon: 'easel', color: '#DB2777' },
  { key: '엘리베이터', icon: 'swap-vertical', color: '#475569' },
]

const META_BY_KEY = new Map(FACILITY_KINDS.map((meta) => [meta.key, meta]))

export function facilityKindMeta(key: FacilityKind): FacilityKindMeta {
  const meta = META_BY_KEY.get(key)
  if (!meta) {
    throw new Error(`알 수 없는 편의시설 종류: ${key}`)
  }
  return meta
}

/** 편의시설 종류의 화면 이름(label 이 있으면 label). */
/** 이 앱이 아는 편의시설 종류인지. 서버에 새 종류가 먼저 생겨도 옛 앱이 그 항목에서 멈추지 않게 지도 데이터를 받을 때 거른다. */
export function isFacilityKind(key: string): key is FacilityKind {
  return META_BY_KEY.has(key as FacilityKind)
}

export function facilityKindLabel(key: FacilityKind): string {
  return META_BY_KEY.get(key)?.label ?? key
}
