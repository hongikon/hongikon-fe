import { PARTNERS } from '../constants/partners'
import type { Partner } from '../types'

/**
 * 공백을 지우고 소문자로 맞춘다.
 * '어리 홍대'를 '어리홍대'로 쳐도 걸리게 하려는 것이다.
 */
function normalize(value: string): string {
  return value.replace(/\s+/g, '').toLowerCase()
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
