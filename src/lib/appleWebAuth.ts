import { Platform } from 'react-native'
import { createAppleNonce, type AppleLoginRequestBody } from './appleNonce'

/**
 * 웹(hongikon.com) Apple 로그인. 아이폰 앱은 시스템 시트(`appleAuth.ts`)를 쓰고, 웹은 Apple 인증 페이지로 넘어갔다가
 * `/auth/apple/callback#code=…&id_token=…&state=…` 으로 돌아온다(카카오 웹 로그인과 같은 전체 페이지 이동).
 *
 * - 팝업 방식(Apple JS)은 쓰지 않는다 — 사이트가 Cross-Origin-Opener-Policy: same-origin 이라 팝업 창이 우리 창에 결과를 못 넘긴다.
 * - 이름·이메일을 요청하지 않는다(scope 없음) — 그래야 결과를 주소 #조각(fragment)으로 받을 수 있다(scope 가 있으면 Apple 이
 *   서버로 POST 만 한다). 이름은 앱 닉네임으로 따로 정한다(최소 수집).
 * - nonce: 원본은 이 탭의 sessionStorage 에 두고 Apple 에는 sha256 을 넘긴다. 서버가 원본을 sha256 해 토큰 값과 맞춘다(앱과 같다).
 * - state: 다른 사이트가 만든 콜백 주소로 로그인시키는 것(CSRF)을 막으려고 보낸 값과 돌아온 값을 맞춘다.
 *
 * Apple Developer 의 Services ID(EXPO_PUBLIC_APPLE_WEB_CLIENT_ID)와 Return URL(아래 주소)이 등록돼 있어야 한다.
 * 값이 없으면 웹 Apple 로그인은 꺼진 채(웰컴의 '준비 중' 버튼)로 남는다. Apple 은 localhost 를 Return URL 로 받지 않아
 * 운영 주소(hongikon.com)에서만 동작한다.
 */
export const WEB_APPLE_CALLBACK_PATH = '/auth/apple/callback'
const WEB_APPLE_REDIRECT_URI = `https://hongikon.com${WEB_APPLE_CALLBACK_PATH}`
const APPLE_WEB_CLIENT_ID = process.env.EXPO_PUBLIC_APPLE_WEB_CLIENT_ID ?? ''
const STORAGE_KEY = 'hongikon_apple_web_login'
/** Apple 페이지에서 오래 머물다 돌아온 값은 쓰지 않는다. */
const MAX_AGE_MS = 10 * 60 * 1000

interface PendingAppleLogin {
  nonce: string
  state: string
  at: number
}

/** 이 화면에서 웹 Apple 로그인을 켤지(웹 + Services ID 설정 + 운영 주소). */
export function isWebAppleSignInEnabled(): boolean {
  return (
    Platform.OS === 'web' &&
    APPLE_WEB_CLIENT_ID.length > 0 &&
    typeof window !== 'undefined' &&
    window.location.hostname === 'hongikon.com'
  )
}

/** Apple 인증 페이지로 넘어간다. 돌아오면 앱이 새로 로드되며 `takeWebAppleCallback` 이 마무리한다. */
export function startWebAppleSignIn(): void {
  const nonce = createAppleNonce()
  const state = createAppleNonce().raw
  const pending: PendingAppleLogin = { nonce: nonce.raw, state, at: Date.now() }
  window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(pending))
  const params = new URLSearchParams({
    client_id: APPLE_WEB_CLIENT_ID,
    redirect_uri: WEB_APPLE_REDIRECT_URI,
    response_type: 'code id_token',
    response_mode: 'fragment',
    state,
    nonce: nonce.hashed,
  })
  window.location.assign(`https://appleid.apple.com/auth/authorize?${params.toString()}`)
}

export type WebAppleCallback =
  | { kind: 'ok'; body: AppleLoginRequestBody }
  | { kind: 'canceled' }
  | { kind: 'error'; message: string }

/**
 * Apple 에서 막 돌아왔으면(콜백 주소) 결과를 꺼내고 주소창을 `/` 로 정리한다(1회용 값이 방문 기록·새로고침에 남지 않게).
 * 콜백이 아니면 undefined.
 */
export function takeWebAppleCallback(): WebAppleCallback | undefined {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return undefined
  if (window.location.pathname.replace(/\/+$/, '') !== WEB_APPLE_CALLBACK_PATH) return undefined
  const params = new URLSearchParams(window.location.hash.replace(/^#/, ''))
  window.history.replaceState(null, '', '/')

  let pending: PendingAppleLogin | null = null
  try {
    pending = JSON.parse(window.sessionStorage.getItem(STORAGE_KEY) ?? 'null') as PendingAppleLogin | null
  } catch {
    pending = null
  }
  window.sessionStorage.removeItem(STORAGE_KEY)

  const error = params.get('error')
  if (error === 'user_cancelled_authorize') return { kind: 'canceled' }
  if (error) return { kind: 'error', message: 'Apple 로그인을 마치지 못했어요. 잠시 뒤 다시 시도해 주세요.' }

  const identityToken = params.get('id_token')
  const authorizationCode = params.get('code')
  if (!pending || Date.now() - pending.at > MAX_AGE_MS || params.get('state') !== pending.state || !identityToken) {
    return { kind: 'error', message: 'Apple 로그인 정보가 맞지 않아요. 처음부터 다시 시도해 주세요.' }
  }
  return {
    kind: 'ok',
    body: { identityToken, authorizationCode: authorizationCode ?? undefined, nonce: pending.nonce },
  }
}
