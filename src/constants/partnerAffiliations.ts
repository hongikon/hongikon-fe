import type { PartnerAffiliation } from '../types'

/**
 * 1단 필터(소속) 칩 목록. 배열 순서가 곧 칩이 놓이는 순서다.
 * 총학생회를 맨 앞에 두고 단과대·학부가 뒤따른다.
 *
 * 2단(업종)과 달리 색을 따로 두지 않는다. 지도 마커 색은 업종이 정하므로
 * 소속에 색을 주면 같은 화면에 뜻이 다른 색이 두 벌 생긴다.
 */
export const PARTNER_AFFILIATIONS: readonly PartnerAffiliation[] = [
  '총학생회',
  '기숙사',
  '미술대학',
  '공과대학',
  '문과대학',
  '경영대학',
  '건축도시대학',
  '법과대학',
  '사범대학',
  '경제학부',
  '캠퍼스자율전공(서울)',
  '공연예술학부',
  '디자인·예술경영학부',
]

/**
 * 소속 전체에 공통으로 적용되는 혜택 이용 방법 안내. 업체마다 다른
 * `Partner.benefit`과 달리, 소속 하나에 안내 문구 하나만 대응한다.
 * 값이 없는 소속은 안내를 표시하지 않는다.
 */
export const PARTNER_AFFILIATION_USAGE_NOTES: Partial<
  Record<PartnerAffiliation, string>
> = {
  기숙사:
    '기숙사 카드키를 보여주기 / 기숙사 홈페이지 로그인 후 왼쪽 메뉴 선택창에서 거주 여부 보여주기',
}
