import type { LoginProvider } from '../../contexts/AuthContext'
import type { MyProfile } from '../../apis/users'

/**
 * 지금 토큰의 회원과 다른 회원의 프로필(이전 계정 값)은 절대 보여 주지 않는다 — 새 응답이 올 때까지 '불러오는 중'.
 * 예전엔 계정이 바뀐 뒤 새 응답 전까지 이전 계정 닉네임이 잠깐 보였다(10-08 제보).
 */
export function visibleProfile(raw: MyProfile | null | undefined, memberId: number | null): MyProfile | undefined {
  return raw && (memberId == null || raw.id === memberId) ? raw : undefined
}

interface MemberNumberInput {
  /** 토큰 sub(= userId). 토큰이 이상하면 null. */
  memberId: number | null
  /** 회원 번호 API 응답과 그 응답이 어느 회원 것인지. 아직 없으면 undefined. */
  codeData: { ownerId: number | null; code: string | null } | undefined
  /** 프로필 응답에 실린 회원 번호. */
  profileMemberCode: string | null | undefined
  /** 서버에 회원 번호 API 가 없는지(배포 전). */
  codeApiMissing: boolean
}

/**
 * 설정에 보일 회원 번호. 서버가 주는 공개 번호(K7Q2M9XA4D)를 먼저 쓰고,
 * 서버에 회원 번호가 없을 때(배포 전·빈 값)만 예전 #id 표시로 돌아간다. 불러오는 중·일시 오류에는 id 를 내보이지 않는다(null).
 * 받은 번호가 다른 회원 것이면(계정이 바뀐 직후) 쓰지 않는다(10-08).
 */
export function resolveMemberNumber({ memberId, codeData, profileMemberCode, codeApiMissing }: MemberNumberInput): string | null {
  const ownMemberCode = codeData && codeData.ownerId === memberId ? codeData.code : null
  const memberCode = ownMemberCode ?? profileMemberCode ?? null
  const fallback = !memberCode && (codeApiMissing || (codeData?.ownerId === memberId && codeData.code === null))
  return memberCode ?? (fallback && memberId !== null ? `#${memberId}` : null)
}

/** 승인 대기 배지 문구. 없으면 undefined, 100건부터는 99+. */
export function pendingBadge(pending: number): string | undefined {
  return pending > 0 ? `승인 대기 ${pending > 99 ? '99+' : pending}` : undefined
}

/** 계정 묶음 머리 줄의 로그인 방식 이름. */
export function loginProviderName(provider: LoginProvider | null): string {
  return provider === 'apple' ? 'Apple' : provider === 'demo' ? '심사용' : '카카오'
}

/** 계정 묶음 첫 줄 '○○ 계정으로 로그인됨'. */
export function loginProviderLabel(provider: LoginProvider | null): string {
  return provider === 'apple'
    ? 'Apple 계정으로 로그인됨'
    : provider === 'demo'
      ? '심사용 데모 계정으로 로그인됨'
      : '카카오 계정으로 로그인됨'
}
