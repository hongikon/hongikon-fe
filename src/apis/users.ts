import { ApiError, apiRequest } from './client'
import { APP_NICKNAME_DAILY_LIMIT } from '../utils/nickname'

/** `GET /users/me`. 로그인 닉네임 원문은 내려오지 않는다. */
export interface MyProfile {
  id: number
  socialType: 'KAKAO' | 'APPLE' | string
  /** 직접 정한 앱 닉네임. 없으면 null. */
  appNickname: string | null
  /** 제보 등에서 다른 사람에게 보이는 이름. */
  displayName: string
  /** 앱 닉네임을 지웠을 때 보일 이름(로그인 닉네임 첫 글자만 남기고 가린 값). */
  maskedDefaultName: string
  /** 공개 회원 번호(영문 대문자·숫자 10자리, 예: K7Q2M9XA4D). 지금 서버의 `/users/me` 에는 없고 `getMyMemberCode` 로 따로 받는다 — 나중에 실리면 그대로 쓴다. */
  memberCode?: string | null
  /** 이용 상태. 정지면 설정 화면에 사유·이의 제기 안내를 띄운다. 이 필드 전 서버는 없음(= 정상으로 본다). */
  status?: 'ACTIVE' | 'SUSPENDED' | string
  suspendedReason?: string | null
  /** 서버 시각(UTC, 존 없음) */
  suspendedAt?: string | null
  /** 운영진이 붙인 공식 이름(학생회 등). 있으면 displayName 도 이 값이고 공식 배지가 붙는다. 이 기능 전 서버는 없음. */
  officialName?: string | null
}

/**
 * 서버에 닉네임 API 가 아직 없는지(백엔드 배포 전). 없는 경로는 404/405 이고,
 * 지금 운영 서버는 없는 경로를 401 로 돌려주기도 해서(`isSubscriptionApiMissing` 참고)
 * "토큰을 막 재발급받았는데도 401" 도 없는 것으로 본다.
 */
export function isNicknameApiMissing(error: unknown): boolean {
  if (!(error instanceof ApiError)) return false
  return error.status === 404 || error.status === 405 || (error.status === 401 && error.afterTokenRefresh === true)
}

/**
 * 닉네임 저장 실패를 화면 문구로. client 는 서버 본문을 보여 주지 않으므로(상태 코드별 공통 문구)
 * 서버 `AppNicknameService` 의 문구를 상태 코드에 맞춰 여기서 고른다. 400 은 대개 앱 검사에서 먼저 걸러진다.
 */
export function nicknameErrorMessage(error: unknown): string | null {
  if (!(error instanceof ApiError)) return null
  if (error.status === 400) return '쓸 수 없는 닉네임이에요. 다른 닉네임을 입력해 주세요.'
  if (error.status === 409) return '이미 다른 사람이 쓰고 있는 닉네임이에요.'
  if (error.status === 429) {
    return `닉네임은 하루에 ${APP_NICKNAME_DAILY_LIMIT}번까지 바꿀 수 있어요. 내일 다시 시도해 주세요.`
  }
  return null
}

/**
 * 한 번 "API 없음"으로 판정되면 앱을 다시 켤 때까지 부르지 않는다. 지금 운영 서버는 없는 경로에 401 을 줘서
 * 부를 때마다 토큰 재발급이 한 번씩 일어나기 때문이다(`isSubscriptionApiMissing` 과 같은 사정).
 */
let apiMissing = false

export function isNicknameApiKnownMissing(): boolean {
  return apiMissing
}

export async function getMyProfile(accessToken: string, signal?: AbortSignal): Promise<MyProfile> {
  try {
    return await apiRequest<MyProfile>('/users/me', { accessToken, signal })
  } catch (error) {
    if (isNicknameApiMissing(error)) apiMissing = true
    throw error
  }
}

/**
 * 앱 닉네임 설정. 빈 문자열이면 지운다.
 * 429(하루 한도)는 다시 보내도 같은 결과라 자동 재시도하지 않는다.
 */
export function updateAppNickname(nickname: string, accessToken: string): Promise<MyProfile> {
  return apiRequest<MyProfile>('/users/me/nickname', {
    method: 'PUT',
    body: { nickname },
    accessToken,
    retries: 0,
  })
}

/** 앱 닉네임을 지우고 가린 로그인 닉네임으로 돌아간다. */
export function clearAppNickname(accessToken: string): Promise<MyProfile> {
  return apiRequest<MyProfile>('/users/me/nickname', { method: 'DELETE', accessToken, retries: 0 })
}

/** `GET /users/me/member-code` (hongikon-be `MemberCodeController`). */
interface MemberCodeResponse {
  memberCode: string | null
}

/** 공개 회원 번호 형식: 영문 대문자·숫자 10자리. 다른 값이 오면 쓰지 않고 예전 표시(#id)로 돌아간다. */
const MEMBER_CODE_PATTERN = /^[A-Z0-9]{10}$/

/** 닉네임 API 와 같은 이유로, 회원 번호 API 가 없다고 판정되면 앱을 다시 켤 때까지 부르지 않는다. */
let memberCodeApiMissing = false

export function isMemberCodeApiKnownMissing(): boolean {
  return memberCodeApiMissing
}

/**
 * 내 공개 회원 번호(예: `K7Q2M9XA4D`). 순번인 회원 id 대신 설정 화면에 보여 준다.
 * 서버 배포 전(404/405/재발급 뒤 401)이면 `isMemberCodeApiKnownMissing()` 가 true 가 되고, 화면은 예전처럼 `#id` 를 보여 준다.
 */
export async function getMyMemberCode(accessToken: string, signal?: AbortSignal): Promise<string | null> {
  try {
    const response = await apiRequest<MemberCodeResponse>('/users/me/member-code', { accessToken, signal })
    const code = typeof response?.memberCode === 'string' ? response.memberCode.trim().toUpperCase() : ''
    return MEMBER_CODE_PATTERN.test(code) ? code : null
  } catch (error) {
    if (isNicknameApiMissing(error)) memberCodeApiMissing = true
    throw error
  }
}
