import { Platform } from 'react-native'
import { WEB_AUTH_CALLBACK_PATH, type TokenResponse } from '../../apis/auth'
import { ApiError, isNetworkError } from '../../apis/client'
import { setItem, deleteItem } from '../../lib/tokenStorage'

export const ACCESS_TOKEN_KEY = 'hongikon_access_token'

export const REFRESH_TOKEN_KEY = 'hongikon_refresh_token'

export const GUEST_FLAG_KEY = 'hongikon_guest_mode'

/** 어떤 계정으로 로그인했는지(설정 화면 "○○ 계정으로 로그인됨" 표시용). 서버에 묻지 않고 로그인할 때 기기에 적어 둔다. */
export const LOGIN_PROVIDER_KEY = 'hongikon_login_provider'

export const isWeb = Platform.OS === 'web'

/**
 * 웹에서 카카오 로그인을 마치고 `/auth/callback?code=...` 로 돌아왔으면 코드를 꺼내고 주소창을 `/` 로 정리한다
 * (새로고침으로 1회용 코드를 다시 쓰지 않게, 방문 기록에도 남지 않게). 콜백이 아니면 undefined,
 * 콜백인데 코드가 없으면(취소 등) null.
 */
export function takeWebAuthCallbackCode(): string | null | undefined {
  if (!isWeb || typeof window === 'undefined') return undefined
  if (window.location.pathname.replace(/\/+$/, '') !== WEB_AUTH_CALLBACK_PATH) return undefined
  const code = new URLSearchParams(window.location.search).get('code')
  window.history.replaceState(null, '', '/')
  return code
}

/**
 * loading: 저장된 로그인 상태를 아직 확인 중
 * signedOut: 로그인도 게스트 선택도 안 한 상태 — 웰컴 화면을 보여준다
 * guest: '둘러보기'를 선택해 게스트로 계속 쓰기로 한 상태
 * authenticated: 로그인 완료, accessToken 보유
 */
export type AuthStatus = 'loading' | 'signedOut' | 'guest' | 'authenticated'

export type LoginProvider = 'kakao' | 'apple' | 'demo'

/** 저장 값이 없으면(Apple 로그인 추가 전에 로그인한 사용자) 카카오 — 그때는 카카오 로그인뿐이었다. */
export function toLoginProvider(value: string | null): LoginProvider {
  return value === 'apple' || value === 'demo' ? value : 'kakao'
}

export async function saveTokens(tokens: TokenResponse): Promise<void> {
  await setItem(ACCESS_TOKEN_KEY, tokens.accessToken)
  await setItem(REFRESH_TOKEN_KEY, tokens.refreshToken)
}

export async function clearTokens(): Promise<void> {
  await deleteItem(ACCESS_TOKEN_KEY)
  await deleteItem(REFRESH_TOKEN_KEY)
  await deleteItem(LOGIN_PROVIDER_KEY)
}

export function isKakaoLoginCanceled(error: unknown): boolean {
  return error instanceof KakaoLoginCanceledError
}

/** 백엔드가 되돌려준 리다이렉트 URL에서 1회용 인가 코드를 뽑아낸다. 못 찾으면 null. */
export function extractAuthCode(redirectedUrl: string): string | null {
  try {
    return new URL(redirectedUrl).searchParams.get('code')
  } catch {
    return null
  }
}

/**
 * 토큰 교환 실패 문구. 서버 원문은 보여주지 않고(client 가 이미 걸러낸다), 사용자가 할 수 있는
 * 다음 행동("다시 로그인")을 알려준다.
 */
export function authExchangeErrorMessage(error: unknown): string {
  if (isNetworkError(error)) {
    return '네트워크 연결이 불안정해 로그인을 마치지 못했어요. 연결을 확인한 뒤 다시 로그인해 주세요.'
  }
  if (error instanceof ApiError && error.status >= 400 && error.status < 500) {
    return '로그인 정보가 만료됐거나 올바르지 않아요. 다시 로그인해 주세요.'
  }
  return '로그인 처리 중 서버에 문제가 생겼어요. 잠시 뒤 다시 로그인해 주세요.'
}

/**
 * 사용자가 카카오 로그인 창을 닫았다(openAuthSessionAsync 가 cancel·dismiss). 오류가 아니라
 * 웰컴 화면은 {@link isKakaoLoginCanceled} 로 걸러 아무것도 띄우지 않는다(Apple 시트 닫기와 같다).
 */
export class KakaoLoginCanceledError extends Error {
  constructor() {
    super('로그인이 취소됐어요.')
    this.name = 'KakaoLoginCanceledError'
  }
}
