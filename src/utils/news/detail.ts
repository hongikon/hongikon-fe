/**
 * 소식 상세 화면의 계산(그리지 않는 부분). 화면·훅이 함께 쓰고 `scripts/test/news-detail.test.ts` 가 확인한다.
 */

/** 학교 홈페이지 기본 주소. 소식에 원문 링크가 없을 때 연다. */
export const HONGIK_HOME_URL = 'https://www.hongik.ac.kr'

/**
 * 백엔드 소식 id(숫자 문자열)면 숫자로, 아니면 null. 로컬 목데이터("n1")나 웹 주소로 들어온 엉뚱한 id 는
 * 부를 상세 API 가 없다.
 */
export function backendNewsId(id: string): number | null {
  return /^\d+$/.test(id) ? Number(id) : null
}

/** 화면 아래 '원문 보기' 버튼 글자와 읽어 주는 이름. 링크가 없으면 학교 홈페이지로 간다는 걸 적는다. */
export function originalLinkLabels(link: string | null | undefined): { label: string; a11yLabel: string } {
  return link
    ? { label: '원문 보기', a11yLabel: '원문 보기' }
    : { label: '원문 보기 (홍익대 홈페이지)', a11yLabel: '원문 보기, 홍익대 홈페이지' }
}

/** 본문 미리보기가 비었을 때 안내. 크롤러가 목록만 긁었거나 본문이 이미지뿐인 경우다. */
export function emptyBodyMessage(imageCount: number | undefined): string {
  return imageCount
    ? '본문이 이미지로만 되어 있어요. 원문에서 확인해 주세요.'
    : '본문 미리보기가 없어요. 원문에서 확인해 주세요.'
}
