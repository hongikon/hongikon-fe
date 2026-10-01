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
