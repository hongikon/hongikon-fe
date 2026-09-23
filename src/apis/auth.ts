import { apiRequest, API_BASE_URL } from './client'

/** 백엔드 OAuth2SuccessHandler 가 되돌아오는 주소. app.json 의 scheme(hongikon)과 정확히 일치해야 한다. */
export const AUTH_REDIRECT_URI = 'hongikon://auth/callback'

/** 카카오 로그인 진입 주소. WebBrowser.openAuthSessionAsync 로 연다. */
export const KAKAO_LOGIN_URL = `${API_BASE_URL}/oauth2/authorization/kakao`

export interface TokenResponse {
  accessToken: string
  refreshToken: string
}

/** 카카오 로그인 콜백에서 받은 1회용 인가 코드를 액세스/리프레시 토큰으로 교환한다. */
export function exchangeAuthCode(code: string): Promise<TokenResponse> {
  return apiRequest<TokenResponse>('/auth/token/exchange', {
    method: 'POST',
    body: { code },
    // 1회용 코드라 절대 다시 보내지 않는다. 기본값도 POST 는 0 이지만 실수로 바뀌지 않게 못 박는다.
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
