/**
 * 정보 제보(설정 > 정보 제보하기)는 별도 API 없이 문의(`POST /feedback`)로 보내고 내용 맨 앞의 머리말로 구분한다.
 * 관리자 화면(문의 탭)이 이 값들로 종류별 표시를 붙이므로, 바꾸면 이전 제보와 구분이 깨진다.
 */

/** 제휴·혜택 제보. 정보 제보로 넓히기 전부터 쓰던 머리말이라 그대로 둔다(이전 제보와 관리자 표시 호환). */
export const PARTNER_SUGGESTION_PREFIX = '[제휴 제보]'

export type InfoSuggestType = 'partner' | 'exhibition' | 'event' | 'facility' | 'other'

/** 종류별 머리말. 제휴만 예전 머리말을 쓰고 나머지는 `[정보 제보:종류]` 꼴이다. */
export const INFO_SUGGESTION_PREFIXES: Record<InfoSuggestType, string> = {
  partner: PARTNER_SUGGESTION_PREFIX,
  exhibition: '[정보 제보:전시]',
  event: '[정보 제보:행사]',
  facility: '[정보 제보:시설 정보]',
  other: '[정보 제보:기타]',
}

/** 관리자 문의 목록에 붙는 표시 이름 */
export const INFO_SUGGESTION_BADGES: Record<InfoSuggestType, string> = {
  partner: '제휴 제보',
  exhibition: '전시',
  event: '행사',
  facility: '시설 정보',
  other: '기타 제보',
}

/** 문의 내용이 정보 제보면 그 종류, 아니면 null */
export function infoSuggestTypeOf(content: string): InfoSuggestType | null {
  const types = Object.keys(INFO_SUGGESTION_PREFIXES) as InfoSuggestType[]
  return types.find((type) => content.startsWith(INFO_SUGGESTION_PREFIXES[type])) ?? null
}
