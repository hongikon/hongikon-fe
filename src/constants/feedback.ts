/**
 * 제휴 제보는 별도 API 없이 문의(`POST /feedback`)로 보내고 내용 맨 앞의 이 머리말로 구분한다.
 * 관리자 화면(문의 탭)이 이 값으로 "제휴 제보" 표시를 붙이므로, 바꾸면 이전 제보와 구분이 깨진다.
 */
export const PARTNER_SUGGESTION_PREFIX = '[제휴 제보]'
