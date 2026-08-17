/**
 * 공백을 지우고 소문자로 맞춘다.
 * '컴퓨터 공학'을 '컴퓨터공학'으로 쳐도 걸리게 하려는 것이다.
 * 학과 검색(useTreeSearch)·제휴업체 검색(partnerSearch)·소식 검색(useNewsSearch)이 공유한다.
 */
export function normalize(value: string): string {
  return value.replace(/\s+/g, '').toLowerCase()
}
