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

const DEFAULT_USAGE_NOTE = '실물 학생증 제시 또는 모바일 학생증 제시'

/**
 * 소속 전체에 공통으로 적용되는 혜택 이용 방법 안내. 업체마다 다른
 * `Partner.benefit`과 달리, 소속 하나에 안내 문구 하나만 대응한다.
 * 기숙사만 카드키/기숙사 홈페이지로 확인하는 별도 방식이라 예외로 둔다.
 */
export const PARTNER_AFFILIATION_USAGE_NOTES: Record<PartnerAffiliation, string> = {
  총학생회: DEFAULT_USAGE_NOTE,
  기숙사:
    '기숙사 카드키를 보여주기 / 기숙사 홈페이지 로그인 후 왼쪽 메뉴 선택창에서 거주 여부 보여주기',
  미술대학: DEFAULT_USAGE_NOTE,
  공과대학: DEFAULT_USAGE_NOTE,
  문과대학: DEFAULT_USAGE_NOTE,
  경영대학: DEFAULT_USAGE_NOTE,
  건축도시대학: DEFAULT_USAGE_NOTE,
  법과대학: DEFAULT_USAGE_NOTE,
  사범대학: DEFAULT_USAGE_NOTE,
  경제학부: DEFAULT_USAGE_NOTE,
  '캠퍼스자율전공(서울)': DEFAULT_USAGE_NOTE,
  공연예술학부: DEFAULT_USAGE_NOTE,
  '디자인·예술경영학부': DEFAULT_USAGE_NOTE,
}
