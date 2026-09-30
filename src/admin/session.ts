import type { TokenResponse } from '../apis/auth'

/**
 * 관리자 토큰 저장소.
 *
 * 앱(AuthContext)과 키를 따로 쓰고 sessionStorage 에 둔다 — 탭을 닫으면 사라져서,
 * 공용 PC 에서 관리자 로그인이 남는 일을 줄인다. 웹 전용이라 SecureStore 를 거치지 않는다.
 * 저장소 접근이 막힌 브라우저(시크릿 모드 설정 등)에서도 던지지 않고 "로그인 안 됨"으로 본다.
 */
const ACCESS_TOKEN_KEY = 'hongikon_admin_access_token'
const REFRESH_TOKEN_KEY = 'hongikon_admin_refresh_token'
const MOCK_MODE_KEY = 'hongikon_admin_mock'

function storage(): Storage | null {
  try {
    return typeof window !== 'undefined' ? window.sessionStorage : null
  } catch {
    return null
  }
}

export function getTokens(): TokenResponse | null {
  const store = storage()
  if (!store) return null
  try {
    const accessToken = store.getItem(ACCESS_TOKEN_KEY)
    const refreshToken = store.getItem(REFRESH_TOKEN_KEY)
    return accessToken && refreshToken ? { accessToken, refreshToken } : null
  } catch {
    return null
  }
}

export function saveTokens(tokens: TokenResponse): void {
  const store = storage()
  if (!store) return
  try {
    store.setItem(ACCESS_TOKEN_KEY, tokens.accessToken)
    store.setItem(REFRESH_TOKEN_KEY, tokens.refreshToken)
  } catch {
    // 저장 실패 시 이번 탭 메모리에서도 못 쓰니 다음 요청에서 로그인 화면으로 돌아간다.
  }
}

export function clearTokens(): void {
  const store = storage()
  if (!store) return
  try {
    store.removeItem(ACCESS_TOKEN_KEY)
    store.removeItem(REFRESH_TOKEN_KEY)
  } catch {
    // 지울 수 없으면 할 수 있는 게 없다.
  }
}

/**
 * 목업 모드. 백엔드 없이 화면을 돌려 보는 개발 전용 기능이다.
 * - `/admin?mock=1`   가짜 데이터로 관리자 화면 전체
 * - `/admin?mock=403` 관리자 아닌 계정(403) 화면
 * - `/admin?mock=0`   목업 끄기
 * 화면 이동(pushState)으로 쿼리가 빠져도 유지되게 sessionStorage 에 적어 둔다.
 * 운영 빌드(__DEV__ = false)에서는 쿼리를 무시하고 항상 null 이다.
 */
export type MockMode = 'on' | 'forbidden'

export function resolveMockMode(): MockMode | null {
  if (!__DEV__ || typeof window === 'undefined') return null
  const store = storage()
  const param = new URLSearchParams(window.location.search).get('mock')
  try {
    if (param === '0') store?.removeItem(MOCK_MODE_KEY)
    else if (param === '1') store?.setItem(MOCK_MODE_KEY, 'on')
    else if (param === '403') store?.setItem(MOCK_MODE_KEY, 'forbidden')
    const saved = store?.getItem(MOCK_MODE_KEY)
    return saved === 'on' || saved === 'forbidden' ? saved : null
  } catch {
    return param === '1' ? 'on' : param === '403' ? 'forbidden' : null
  }
}

export function clearMockMode(): void {
  try {
    storage()?.removeItem(MOCK_MODE_KEY)
  } catch {
    // 무시
  }
}
