import type { CategoryKey } from '../constants/colors'

export type BuildingCategory = '강의' | '식당' | '편의' | '주차'

export interface ExternalLink {
  label: string
  url: string
}

export interface Building {
  name: string
  lat: number
  lng: number
  color: string
  category: BuildingCategory
  type: string
  /** 지상 층수. 확인된 값만 채운다. 없으면 층 선택 다이얼을 건너뛴다. */
  floors?: number
  /** 지하 층수. 지하가 없으면 생략한다. */
  basementFloors?: number
  /** 확인된 값만 채운다. 미확인 건물은 비워두고 배너에서 숨긴다. */
  hours?: string
  description?: string
  facilities?: string[]
  contact?: string
  link?: ExternalLink
  boundary?: [number, number][]
}

/**
 * 제휴를 맺은 주체. 필터 1단(위쪽 칩 줄)에 해당한다.
 * 유니온에 적은 순서가 곧 칩 순서다.
 */
export type PartnerAffiliation =
  | '총학생회'
  | '미술대학'
  | '공과대학'
  | '문과대학'
  | '경영대학'
  | '건축도시대학'
  | '법과대학'
  | '사범대학'
  | '경제학부'
  | '캠퍼스자율전공(서울)'
  | '공연예술학부'
  | '디자인·예술경영학부'

/** 제휴 업체 업종. 필터 2단(아래쪽 칩 줄)에 해당한다. */
export type PartnerCategory =
  | '카페'
  | '주점'
  | '음식'
  | '의료/미용'
  | '문화'
  | '기타'
  | '교육'

/**
 * 제휴 업체 한 지점. 지점이 여러 곳인 브랜드(옵틱라이프·로얄짐 등)는
 * 지점마다 별도 항목으로 둔다. 지도에 찍히는 단위가 지점이기 때문이다.
 */
export interface Partner {
  id: string
  name: string
  category: PartnerCategory
  /**
   * 이 업체와 제휴를 맺은 주체들. 한 가게가 총학생회와 단과대 양쪽과
   * 계약한 경우가 있어 배열로 둔다.
   * 아직 확인되지 않은 업체는 비워두고, 1단 필터에서 걸러지지 않게 한다.
   */
  affiliations?: PartnerAffiliation[]
  /** 좌표는 사용자가 확인해 제공한 값만 넣는다. 추정하지 않는다. */
  lat: number
  lng: number
  /** 제휴 혜택. 아직 확정되지 않은 업체는 비워두고 시트에서 줄을 숨긴다. */
  benefit?: string
  address?: string
  hours?: string
  contact?: string
  link?: ExternalLink
}

export interface TreeNode {
  name: string
  children: TreeChild[]
}

export interface TreeChild {
  id: string
  name: string
}

export interface NewsItem {
  id: string
  category: CategoryKey
  title: string
  preview: string
  source: string
  sourceId: string
  date: string
}

export type FilterChip = '전체' | BuildingCategory
