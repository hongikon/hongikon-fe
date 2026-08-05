// 게시판이 카테고리를 주지 않으므로 제목 키워드로 추정한다.
// 결과 값 집합은 앱의 CategoryKey(src/types/index.ts)와 맞춘다.

const CATEGORY_RULES = [
  ['장학', /장학|등록금|학자금/],
  ['취업', /취업|채용|인턴|기업|박람회|공고|연구원|모집/],
  ['수강', /수강|성적|졸업|학점|교과|전공|시험|수업|계절학기|등록|휴학|복학/],
  ['행사', /축제|행사|전시|공연|대회|특강|세미나|워크숍|해커톤|공모전/],
  ['상담', /상담|심리|건강|보건/],
]

const DEFAULT_CATEGORY = '공지'

/** 제목에서 카테고리를 추정한다. 맞는 규칙이 없으면 '공지'. */
export function classify(title) {
  const matched = CATEGORY_RULES.find(([, pattern]) => pattern.test(title))
  return matched ? matched[0] : DEFAULT_CATEGORY
}
