import type { AdminUser } from '../../types'

/**
 * 회원 카드(UserModerationPanel)의 표시 규칙(순수 함수). 로그인 닉네임 원문은 여기서 다루지 않는다 —
 * "로그인 닉네임 보기"(LoginNameReveal)로 누를 때만 받는다(개인정보 최소 처리).
 */

/** 확인 문구 등에 쓰는 회원 표시. 회원 번호가 있으면 그것, 없으면(서버 배포 전) 예전처럼 #id. */
export function memberLabel(user: Pick<AdminUser, 'id' | 'memberCode'>): string {
  return user.memberCode ? user.memberCode : `#${user.id}`
}

/**
 * 카드 제목에 쓸 이름: 앱 닉네임 → 표시 이름(앱 닉네임이 없으면 가린 이름 "홍**") 순. 로그인 닉네임 원문(nickname)은
 * 쓰지 않는다 — 예전 서버는 nickname 에 원문을 넣어 보냈기 때문(개인정보 최소 처리).
 */
export function memberName(user: Pick<AdminUser, 'appNickname' | 'displayName'>): string {
  return user.appNickname || user.displayName || '이름 없음'
}

/** appNickname 키가 null 로 왔을 때만 "앱 닉네임 없음" — 키가 아예 없으면(예전 서버) 유무를 알 수 없어 표시하지 않는다. */
export function hasNoAppNickname(user: AdminUser): boolean {
  return 'appNickname' in user && !user.appNickname
}

/**
 * '공식 계정 지정' 버튼을 보일지. 정지되지 않았고, 공식 계정 기능이 있는 서버(officialName 키가 옴)이며,
 * 신청 여부를 모르거나(예전 서버) 신청한 회원일 때. 이미 공식 이름이 있으면 '공식 해제'가 대신 보인다.
 */
export function canAssignOfficial(user: AdminUser): boolean {
  return user.status !== 'SUSPENDED' && 'officialName' in user && user.officialRequested !== false
}

/** 로그인 방식 표시 이름. */
export const SOCIAL_LABEL: Record<string, string> = { KAKAO: '카카오', APPLE: 'Apple', GOOGLE: 'Google' }
