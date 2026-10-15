/**
 * '물어보기'에서 부서 안내보다 먼저 보여 줄, 운영진이 직접 확인한 답.
 * 학교 홈페이지 부서 안내에는 실제로 가야 할 곳·걸어야 할 번호가 빠진 경우가 있다(학생증은 학사지원팀 업무로 적혀 있지만
 * 재발급은 교내 신한은행에서 받는다). 확인한 것만 적고, 언제 확인했는지 남긴다 — 추측으로 채우지 않는다.
 */
export interface AskAnswer {
  id: string
  /**
   * 질문에 걸리는 조건. 바깥 배열의 묶음마다 하나 이상이 질문에 들어 있어야 한다(묶음끼리는 AND, 묶음 안은 OR).
   * 질문은 공백·문장부호를 지운 뒤 비교하므로 낱말도 붙여 적는다.
   */
  match: readonly (readonly string[])[]
  /** 답 한두 문장. */
  text: string
  phones?: readonly { label: string; phone: string }[]
  /** 지도에서 보여 줄 곳(지도 데이터 시설 id). 누르면 그 시설 시트를 연다. */
  facilityId?: string
  /** 운영진이 확인한 날(YYYY-MM-DD). */
  checkedAt: string
}

export const ASK_ANSWERS: readonly AskAnswer[] = [
  {
    id: 'student-card-reissue',
    match: [['학생증'], ['재발급', '분실', '잃어버', '다시발급', '새로발급']],
    text: '학생증 재발급은 홍문관(R동) 1층 신한은행 홍익대학교 지점에서 받아요.',
    phones: [{ label: '신한은행 홍익대학교 지점', phone: '02-6023-3950' }],
    facilityId: 'hi-r-1f-office-04',
    checkedAt: '2026-10-15',
  },
  {
    id: 'aircon-on-off',
    match: [['에어컨', '냉방', '난방', '냉난방', '히터', '온풍기', '추워', '더워', '춥다', '덥다']],
    text: '강의실·건물 에어컨(냉난방)을 켜고 끄는 건 아래 번호로 전화해 요청해요. 고장이나 설비 문제는 건설관리팀이 맡아요.',
    phones: [{ label: '냉난방 가동(켜기·끄기)', phone: '02-320-1541' }],
    checkedAt: '2026-10-15',
  },
]
