import { PARTNERS } from '../constants/partners'
import { PARTNER_CATEGORIES } from '../constants/partnerCategories'
import { normalize } from './normalize'
import type { Partner, PartnerCategory } from '../types'

export interface PartnerSection {
  category: PartnerCategory
  data: Partner[]
}

/** 상호명뿐 아니라 혜택·주소로도 찾게 한다. '10%할인', '상수동' 같은 검색을 위해서다. */
function searchableFields(partner: Partner): string[] {
  return [
    partner.name,
    partner.category,
    partner.benefit ?? '',
    partner.address ?? '',
  ]
}

function matchesName(partner: Partner, normalizedQuery: string): boolean {
  return normalize(partner.name).includes(normalizedQuery)
}

/**
 * 제휴 업체 검색. 앱 안 상수만 훑으므로 네트워크를 타지 않는다.
 * 빈 검색어는 빈 배열을 돌려준다. 전체 목록을 쏟아내지 않기 위해서다.
 */
export function searchPartners(query: string): Partner[] {
  const normalizedQuery = normalize(query)
  if (!normalizedQuery) return []

  const matched = PARTNERS.filter((partner) =>
    searchableFields(partner).some((field) =>
      normalize(field).includes(normalizedQuery),
    ),
  )

  // 상호명이 걸린 업체를 앞에 둔다. 혜택·주소로만 걸린 건 뒤로 민다.
  return [...matched].sort(
    (a, b) =>
      Number(matchesName(b, normalizedQuery)) -
      Number(matchesName(a, normalizedQuery)),
  )
}

/**
 * 검색어 없이 검색 화면을 열었을 때 훑어볼 전체 목록.
 * `PARTNER_CATEGORIES` 순서로 묶고, 묶음 안은 이름 가나다순. 업체가 없는
 * 카테고리는 빈 구획을 만들지 않도록 건너뛴다.
 */
export function browsePartnersByCategory(): PartnerSection[] {
  return PARTNER_CATEGORIES.map(({ key }) => ({
    category: key,
    data: PARTNERS.filter((partner) => partner.category === key).sort((a, b) =>
      a.name.localeCompare(b.name, 'ko'),
    ),
  })).filter((section) => section.data.length > 0)
}
