import { apiRequest, API_BASE_URL } from './client'
import type { AppleLoginRequestBody } from '../lib/appleNonce'

/** 백엔드 OAuth2SuccessHandler 가 되돌아오는 주소. app.json 의 scheme(hongikon)과 정확히 일치해야 한다. */
export const AUTH_REDIRECT_URI = 'hongikon://auth/callback'

/** 카카오 로그인 진입 주소(앱). WebBrowser.openAuthSessionAsync 로 연다. */
export const KAKAO_LOGIN_URL = `${API_BASE_URL}/oauth2/authorization/kakao`

/**
 * 웹판 카카오 로그인이 끝나고 돌아올 경로. 백엔드 허용 목록(app.oauth2.allowed-redirect-uris)에
 * `https://hongikon.com/auth/callback` 처럼 출처까지 정확히 등록돼 있어야 한다.
 */
export const WEB_AUTH_CALLBACK_PATH = '/auth/callback'

/**
 * 카카오 로그인 시작 주소의 호스트. 웹에서는 `/api` 프록시가 아니라 반드시 API 도메인이어야 한다 —
 * 프록시를 거치면 OAuth state 세션 쿠키가 hongikon.com 에 붙어 카카오 콜백(api.hongikon.com)에서
 * 검증이 깨진다. API_BASE_URL 이 절대 주소면 그대로, 상대 경로(`/api`)면 EXPO_PUBLIC_API_ORIGIN 을 쓴다.
 */
export function getApiOrigin(): string | null {
  const origin = /^https?:\/\//.test(API_BASE_URL) ? API_BASE_URL : process.env.EXPO_PUBLIC_API_ORIGIN ?? ''
  return origin ? origin.replace(/\/+$/, '') : null
}

/**
 * 웹(PC·모바일 브라우저)용 카카오 로그인 주소. 성공하면 서버가 `{현재 출처}{returnPath}?code=...` 로 돌려보낸다.
 * 팝업이 아니라 페이지 전체를 이동한다 — 모바일 브라우저는 팝업을 막는 경우가 많고, 카카오톡 앱 로그인도
 * 카카오 로그인 페이지가 알아서 앱을 열었다가 이 주소로 돌아온다.
 */
export function buildWebKakaoLoginUrl(returnPath: string): string | null {
  const origin = getApiOrigin()
  if (!origin || typeof window === 'undefined') return null
  const redirectUri = `${window.location.origin}${returnPath}`
  return `${origin}/oauth2/authorization/kakao?redirect_uri=${encodeURIComponent(redirectUri)}`
}

export interface TokenResponse {
  accessToken: string
  refreshToken: string
}

/**
 * 앱 카카오 로그인 진입 주소에 PKCE code_challenge 를 붙인다(src/lib/pkce.ts). 서버가 1회용 code 를 이 값에 묶어,
 * 딥링크를 가로챈 다른 앱은 verifier 없이 code 를 토큰으로 바꿀 수 없다. 구버전 서버는 이 쿼리를 무시한다.
 */
export function buildKakaoLoginUrl(codeChallenge: string): string {
  return `${KAKAO_LOGIN_URL}?code_challenge=${encodeURIComponent(codeChallenge)}`
}

/**
 * 카카오 로그인 콜백에서 받은 1회용 인가 코드를 액세스/리프레시 토큰으로 교환한다.
 * codeVerifier 는 로그인 진입 때 code_challenge 를 보냈다면 그 원본(PKCE). 구버전 서버는 모르는 필드라 무시한다.
 */
export function exchangeAuthCode(code: string, codeVerifier?: string): Promise<TokenResponse> {
  return apiRequest<TokenResponse>('/auth/token/exchange', {
    method: 'POST',
    body: codeVerifier ? { code, codeVerifier } : { code },
    // 1회용 코드라 절대 다시 보내지 않는다. 기본값도 POST 는 0 이지만 실수로 바뀌지 않게 못 박는다.
    retries: 0,
  })
}

/**
 * Sign in with Apple(iOS) 결과를 서버에 보내 액세스/리프레시 토큰을 받는다(카카오 교환과 같은 응답).
 * authorizationCode 는 1회용이라 자동 재시도하지 않는다 — 실패하면 Apple 버튼부터 다시 누르게 한다.
 */
export function loginWithAppleRequest(body: AppleLoginRequestBody): Promise<TokenResponse> {
  return apiRequest<TokenResponse>('/auth/apple', {
    method: 'POST',
    body,
    retries: 0,
  })
}

/**
 * 리프레시 토큰으로 새 액세스·리프레시 토큰을 받는다. 서버가 리프레시 토큰을 회전시키므로
 * (쓰면 옛 값은 무효) 응답의 refreshToken 으로 반드시 바꿔 저장해야 한다. 재시도하지 않는다.
 */
export function reissueTokens(refreshToken: string): Promise<TokenResponse> {
  return apiRequest<TokenResponse>('/auth/reissue', {
    method: 'POST',
    body: { refreshToken },
    retries: 0,
  })
}

/**
 * 로그아웃. 전달한 refresh 토큰을 서버에서 폐기(해당 유저의 저장된 refresh 토큰 레코드 삭제)한다.
 * 이미 만료/무효한 토큰이어도 서버가 204로 응답하므로(멱등) 호출부는 실패를 신경 쓰지 않아도 된다 —
 * 다만 네트워크 자체가 안 되는 경우엔 예외가 나므로, 로컬 로그아웃까지 막지 않으려면 호출부에서 감싸야 한다.
 */
export function logoutRequest(refreshToken: string): Promise<void> {
  return apiRequest<void>('/auth/logout', {
    method: 'POST',
    body: { refreshToken },
    retries: 0,
  })
}

/** 회원 탈퇴. 백엔드에 동일 경로의 DELETE 핸들러가 없다면 여기 경로를 맞춰 바꿔야 한다. */
export function deleteAccount(accessToken: string): Promise<void> {
  return apiRequest<void>('/auth/me', {
    method: 'DELETE',
    accessToken,
    // DELETE 라도 자동 재시도하지 않는다. 첫 시도가 응답만 못 받고 처리됐으면 재시도가
    // 404/401 로 돌아와 "탈퇴 실패"로 잘못 보이고, 경로 자체가 없을 때의 404 와도 구분이 안 된다.
    // 실패하면 사용자가 탈퇴 버튼을 다시 누르게 둔다.
    retries: 0,
  })
}
