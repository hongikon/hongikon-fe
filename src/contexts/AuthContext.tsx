import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useMemo,
  useRef,
  type ReactNode,
} from 'react'
import { Platform } from 'react-native'
import * as WebBrowser from 'expo-web-browser'
import {
  AUTH_REDIRECT_URI,
  buildKakaoLoginUrl,
  WEB_AUTH_CALLBACK_PATH,
  buildWebKakaoLoginUrl,
  deleteAccount as deleteAccountRequest,
  exchangeAuthCode,
  loginWithAppleRequest,
  logoutRequest,
  reissueTokens,
  type TokenResponse,
} from '../apis/auth'
import { ApiError, isNetworkError, setTokenRefresher } from '../apis/client'
import { getItem, setItem, deleteItem } from '../lib/tokenStorage'
import { isAppleSignInCanceled, requestAppleSignIn } from '../lib/appleAuth'
import { isWebAppleSignInEnabled, startWebAppleSignIn, takeWebAppleCallback } from '../lib/appleWebAuth'
import { createPkcePair } from '../lib/pkce'
import { deactivateStoredPushDevice, forgetStoredPushDevice, pushRegistrationMark } from '../lib/pushDevice'
import { clearAccountLinkedDeviceData, deleteWithdrawnAccountData } from '../lib/accountData'
import { setHiddenAuthorsOwner } from '../lib/hiddenAuthors'
import { getUserIdFromToken } from '../lib/jwt'
import AppLoadingScreen from '../screens/AppLoadingScreen'

// 앱이 카카오 로그인 팝업 자신으로 다시 열렸을 때(웹 타깃) 인증 세션을 마저 끝내준다.
// Expo 공식 가이드가 권장하는 모듈 스코프 호출.
WebBrowser.maybeCompleteAuthSession()

const ACCESS_TOKEN_KEY = 'hongikon_access_token'
const REFRESH_TOKEN_KEY = 'hongikon_refresh_token'
const GUEST_FLAG_KEY = 'hongikon_guest_mode'
/** 어떤 계정으로 로그인했는지(설정 화면 "○○ 계정으로 로그인됨" 표시용). 서버에 묻지 않고 로그인할 때 기기에 적어 둔다. */
const LOGIN_PROVIDER_KEY = 'hongikon_login_provider'

const isWeb = Platform.OS === 'web'

/**
 * 웹에서 카카오 로그인을 마치고 `/auth/callback?code=...` 로 돌아왔으면 코드를 꺼내고 주소창을 `/` 로 정리한다
 * (새로고침으로 1회용 코드를 다시 쓰지 않게, 방문 기록에도 남지 않게). 콜백이 아니면 undefined,
 * 콜백인데 코드가 없으면(취소 등) null.
 */
function takeWebAuthCallbackCode(): string | null | undefined {
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
type AuthStatus = 'loading' | 'signedOut' | 'guest' | 'authenticated'

export type LoginProvider = 'kakao' | 'apple'

/** 저장 값이 없으면(Apple 로그인 추가 전에 로그인한 사용자) 카카오 — 그때는 카카오 로그인뿐이었다. */
function toLoginProvider(value: string | null): LoginProvider {
  return value === 'apple' ? 'apple' : 'kakao'
}

interface AuthContextValue {
  status: AuthStatus
  accessToken: string | null
  /** 웹에서 카카오 로그인 후 돌아와 토큰 교환에 실패했을 때의 안내 문구. 웰컴 화면이 보여준다. */
  loginError: string | null
  /** 로그인한 계정 종류. 로그인 상태가 아니면 null. */
  loginProvider: LoginProvider | null
  /** 사용자가 로그인 창을 닫으면 {@link isKakaoLoginCanceled} 로 가릴 수 있는 오류를 던진다. 그 밖의 실패는 보여줄 문구를 담은 Error. */
  loginWithKakao: () => Promise<void>
  /**
   * Sign in with Apple(iOS). 사용자가 Apple 시트를 닫으면 ERR_REQUEST_CANCELED 오류를 그대로 던진다
   * (`isAppleSignInCanceled` 로 걸러 조용히 넘긴다). 그 밖의 실패는 보여줄 문구를 담은 Error.
   */
  loginWithApple: () => Promise<void>
  continueAsGuest: () => Promise<void>
  logout: () => Promise<void>
  deleteAccount: () => Promise<void>
  /**
   * 만료된 액세스 토큰으로 새 토큰을 받는다(동시 요청은 한 번만 재발급). refresh 토큰도 무효면 로그아웃까지 한다.
   * 보통은 `apiRequest` 가 알아서 쓰고, 관리 탭처럼 토큰을 직접 붙이는 곳만 부른다.
   */
  refreshAccessToken: (expiredAccessToken: string) => Promise<string | null>
}

const AuthContext = createContext<AuthContextValue | null>(null)

async function saveTokens(tokens: TokenResponse): Promise<void> {
  await setItem(ACCESS_TOKEN_KEY, tokens.accessToken)
  await setItem(REFRESH_TOKEN_KEY, tokens.refreshToken)
}

async function clearTokens(): Promise<void> {
  await deleteItem(ACCESS_TOKEN_KEY)
  await deleteItem(REFRESH_TOKEN_KEY)
  await deleteItem(LOGIN_PROVIDER_KEY)
}

/**
 * 사용자가 카카오 로그인 창을 닫았다(openAuthSessionAsync 가 cancel·dismiss). 오류가 아니라
 * 웰컴 화면은 {@link isKakaoLoginCanceled} 로 걸러 아무것도 띄우지 않는다(Apple 시트 닫기와 같다).
 */
class KakaoLoginCanceledError extends Error {
  constructor() {
    super('로그인이 취소됐어요.')
    this.name = 'KakaoLoginCanceledError'
  }
}

export function isKakaoLoginCanceled(error: unknown): boolean {
  return error instanceof KakaoLoginCanceledError
}

/** 백엔드가 되돌려준 리다이렉트 URL에서 1회용 인가 코드를 뽑아낸다. 못 찾으면 null. */
function extractAuthCode(redirectedUrl: string): string | null {
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
function authExchangeErrorMessage(error: unknown): string {
  if (isNetworkError(error)) {
    return '네트워크 연결이 불안정해 로그인을 마치지 못했어요. 연결을 확인한 뒤 다시 로그인해 주세요.'
  }
  if (error instanceof ApiError && error.status >= 400 && error.status < 500) {
    return '로그인 정보가 만료됐거나 올바르지 않아요. 다시 로그인해 주세요.'
  }
  return '로그인 처리 중 서버에 문제가 생겼어요. 잠시 후 다시 로그인해 주세요.'
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>('loading')
  const [accessToken, setAccessToken] = useState<string | null>(null)
  const [loginError, setLoginError] = useState<string | null>(null)
  const [storedProvider, setStoredProvider] = useState<LoginProvider>('kakao')
  /** 동시에 여러 요청이 401 을 받아도 재발급은 한 번만 한다(리프레시 토큰이 회전돼 두 번 쓰면 두 번째가 실패). */
  const refreshInFlightRef = useRef<Promise<string | null> | null>(null)
  /**
   * 로그인 세션 번호. 로그아웃·탈퇴 때 올린다. 재발급이 도는 사이 로그아웃하면 늦게 온 새 토큰을
   * 저장하지 않고 버려야 한다 — 안 그러면 로그아웃했는데 저장소에 새 토큰이 되살아난다.
   */
  const sessionGenRef = useRef(0)
  /** 로그아웃 뒤 늦게 도착해 버린 재발급의 액세스 토큰. 로그아웃 정리(기기 해제)가 한 번 쓰고 비운다. */
  const lateAccessTokenRef = useRef<string | null>(null)

  const refreshAccessToken = useCallback(async (expiredAccessToken: string): Promise<string | null> => {
    // 다른 요청이 이미 새 토큰을 받아 두었으면 그걸 쓴다.
    const stored = await getItem(ACCESS_TOKEN_KEY)
    if (stored && stored !== expiredAccessToken) return stored

    if (!refreshInFlightRef.current) {
      const generation = sessionGenRef.current
      const isStale = () => generation !== sessionGenRef.current
      /** 로그아웃 뒤 도착한 토큰: 저장하지 않고, 새로 발급된 refresh 토큰은 서버에서 폐기한다(실패해도 넘어간다). */
      const discard = (tokens: TokenResponse) => {
        lateAccessTokenRef.current = tokens.accessToken
        logoutRequest(tokens.refreshToken).catch(() => {})
      }
      refreshInFlightRef.current = (async () => {
        let refreshToken: string | null = null
        try {
          refreshToken = await getItem(REFRESH_TOKEN_KEY)
          if (isStale()) return null
          if (!refreshToken) {
            // 저장소에 refresh 토큰이 없다 — 웹에서 다른 탭이 로그아웃(같은 저장소를 지운다)했거나, 저장이 반쯤
            // 끝난 채 앱이 꺼졌다. 예전엔 null 만 돌려줘 이 탭은 'authenticated' 인 채 요청마다 401 → 재발급 실패를
            // 되풀이했다. 그사이 다른 탭이 새로 로그인해 새 토큰을 저장했으면 그걸 쓰고, 아니면 이 탭도 로그아웃
            // 상태로 돌린다. 서버 정리(기기 해제·토큰 폐기)는 로그아웃한 쪽이 이미 했거나 쓸 refresh 토큰이 없어 하지 않는다.
            const latestAccess = await getItem(ACCESS_TOKEN_KEY)
            if (isStale()) return null
            if (latestAccess && latestAccess !== expiredAccessToken) {
              setAccessToken(latestAccess)
              return latestAccess
            }
            await clearAccountLinkedDeviceData()
            await clearTokens()
            if (isStale()) return null
            setAccessToken(null)
            setStatus('signedOut')
            return null
          }
          const tokens = await reissueTokens(refreshToken)
          if (isStale()) {
            discard(tokens)
            return null
          }
          await saveTokens(tokens)
          // 저장하는 사이 로그아웃이 끼어들었으면 방금 쓴 값을 다시 지운다.
          if (isStale()) {
            await clearTokens()
            discard(tokens)
            return null
          }
          setAccessToken(tokens.accessToken)
          return tokens.accessToken
        } catch (error: unknown) {
          // 리프레시 토큰도 만료·무효(4xx)면 다시 로그인해야 한다. 네트워크 문제면 로그인 상태는 유지한다.
          // 408(요청 시간 초과)·429(요청 과다)는 4xx 지만 토큰 문제가 아니라 잠깐의 상태라 네트워크 문제처럼 넘긴다
          // (예전엔 이것도 만료로 보고 로그아웃시켰다).
          // 단, 그 사이 다른 탭(웹은 같은 저장소를 쓴다)이 먼저 재발급해 저장소의 토큰이 바뀌었으면 그 토큰을 쓴다 —
          // 여기서 저장소를 지우면 멀쩡한 다른 탭까지 로그아웃된다(서버는 세션별 토큰 + 60초 유예, BE #24).
          if (
            !isStale() &&
            error instanceof ApiError &&
            error.status >= 400 &&
            error.status < 500 &&
            error.status !== 408 &&
            error.status !== 429
          ) {
            const [latestRefresh, latestAccess] = await Promise.all([getItem(REFRESH_TOKEN_KEY), getItem(ACCESS_TOKEN_KEY)])
            if (latestRefresh && latestRefresh !== refreshToken && latestAccess && latestAccess !== expiredAccessToken) {
              setAccessToken(latestAccess)
              return latestAccess
            }
            // 기기에 남은 이전 계정의 구독·알림 설정·약관 동의 기록도 지운다(로그아웃과 같다). 토큰보다 먼저 지운다 — `clearAccountLinkedSettings` 주석.
            await clearAccountLinkedDeviceData()
            await clearTokens()
            setAccessToken(null)
            setLoginError('로그인이 만료됐어요. 다시 로그인해 주세요.')
            setStatus('signedOut')
            // 이 기기의 푸시 등록도 내려 보지만, 유효한 토큰이 없어 대개 401 로 실패한다(재발급할 refresh 토큰도
            // 무효). 그러면 서버의 기기 행은 활성으로 남고, 이 기기로 다시 로그인할 때 같은 푸시 토큰 재등록이
            // 새 계정으로 넘긴다. 그 사이 이전 계정 알림이 올 수 있다 — 서버 쪽 정리 없이는 막을 수 없다.
            // 저장된 id 지우기는 같은 작업 안에서 한다(forget) — 따로 줄을 세우면 곧바로 다시 로그인한 계정의
            // 등록이 사이에 끼어 새 id 를 지운다. before: 그 뒤 등록이 쓴 id 면 건드리지 않는다(logout 과 같다).
            void deactivateStoredPushDevice(expiredAccessToken, {
              quick: true,
              before: pushRegistrationMark(),
              forget: true,
            }).catch(() => {})
          }
          return null
        } finally {
          refreshInFlightRef.current = null
        }
      })()
    }
    return refreshInFlightRef.current
  }, [])

  /** 로그인 성공 공통 마무리: 토큰·로그인 종류 저장, 게스트 표시 해제, 화면 전환. */
  const completeLogin = useCallback(async (tokens: TokenResponse, provider: LoginProvider) => {
    await saveTokens(tokens)
    await setItem(LOGIN_PROVIDER_KEY, provider)
    await deleteItem(GUEST_FLAG_KEY)
    setStoredProvider(provider)
    setAccessToken(tokens.accessToken)
    setStatus('authenticated')
  }, [])

  // 숨긴 사용자 목록의 칸을 지금 로그인 상태에 맞춘다(`hiddenAuthors.ts`). 로그인이면 그 계정 칸, 아니면(둘러보기·로그아웃)
  // 게스트 칸. 토큰 재발급은 회원 번호가 같아 칸이 그대로고, 계정이 바뀌려면 반드시 로그아웃(게스트 칸)을 거친다.
  // 상태 복원 전(loading)에는 정하지 않는다 — 그동안 아무것도 불러오지 않아 다른 칸의 목록이 한 번 비치지 않는다.
  // 자식의 구독(useSyncExternalStore)이 먼저 붙고 이 효과가 뒤에 돌아도, 칸을 모르는 동안은 불러오지 않으니 같은 결과다.
  useEffect(() => {
    if (status === 'loading') return
    setHiddenAuthorsOwner(
      status === 'authenticated' ? { kind: 'account', userId: getUserIdFromToken(accessToken) } : { kind: 'guest' },
    )
  }, [status, accessToken])

  useEffect(() => {
    setTokenRefresher(refreshAccessToken)
    return () => setTokenRefresher(null)
  }, [refreshAccessToken])

  useEffect(() => {
    async function restore() {
      // 웹: Apple 로그인에서 막 돌아온 경우(`/auth/apple/callback#…`) 저장된 상태보다 먼저 처리한다.
      const appleCallback = takeWebAppleCallback()
      if (appleCallback !== undefined) {
        if (appleCallback.kind === 'canceled') {
          setStatus('signedOut')
          return
        }
        if (appleCallback.kind === 'error') {
          setLoginError(appleCallback.message)
          setStatus('signedOut')
          return
        }
        try {
          await completeLogin(await loginWithAppleRequest(appleCallback.body), 'apple')
        } catch (error: unknown) {
          setLoginError(authExchangeErrorMessage(error))
          setStatus('signedOut')
        }
        return
      }

      // 웹: 카카오 로그인에서 막 돌아온 경우 저장된 상태보다 먼저 처리한다.
      const callbackCode = takeWebAuthCallbackCode()
      if (callbackCode !== undefined) {
        if (!callbackCode) {
          setLoginError('로그인이 취소됐어요.')
          setStatus('signedOut')
          return
        }
        try {
          const tokens = await exchangeAuthCode(callbackCode)
          await completeLogin(tokens, 'kakao')
        } catch (error: unknown) {
          setLoginError(authExchangeErrorMessage(error))
          setStatus('signedOut')
        }
        return
      }

      try {
        const token = await getItem(ACCESS_TOKEN_KEY)
        if (token) {
          setStoredProvider(toLoginProvider(await getItem(LOGIN_PROVIDER_KEY)))
          setAccessToken(token)
          setStatus('authenticated')
          return
        }

        const isGuest = await getItem(GUEST_FLAG_KEY)
        setStatus(isGuest ? 'guest' : 'signedOut')
      } catch (error: unknown) {
        if (__DEV__) console.warn('로그인 상태를 불러오지 못해 웰컴 화면으로 시작합니다:', error)
        setStatus('signedOut')
      }
    }

    restore()
  }, [completeLogin])

  const continueAsGuest = useCallback(async () => {
    await setItem(GUEST_FLAG_KEY, '1')
    setStatus('guest')
  }, [])

  const loginWithKakao = useCallback(async () => {
    setLoginError(null)

    // 웹(PC·모바일 브라우저): 앱 스킴(hongikon://)으로는 돌아올 수 없으니 페이지 전체를 카카오로 보냈다가
    // /auth/callback 으로 돌아와 restore() 에서 마저 처리한다. 이동하는 동안 버튼은 로딩 상태로 둔다.
    if (isWeb) {
      const url = buildWebKakaoLoginUrl(WEB_AUTH_CALLBACK_PATH)
      if (!url) throw new Error('로그인 서버 주소가 설정되지 않았어요.')
      window.location.assign(url)
      return new Promise<void>(() => {})
    }

    // PKCE: 이 로그인 시도에서만 쓰는 verifier. 메모리에만 두고 저장하지 않는다.
    const pkce = createPkcePair()
    const result = await WebBrowser.openAuthSessionAsync(buildKakaoLoginUrl(pkce.challenge), AUTH_REDIRECT_URI)

    if (result.type !== 'success') {
      // 창을 닫은 것(cancel·dismiss)은 조용히 넘기게 따로 표시한다. 예전엔 '카카오 로그인 실패' 알림이 떴다.
      // locked(다른 인증 창이 이미 열려 있음) 등은 그대로 실패로 알린다.
      if (result.type === 'cancel' || result.type === 'dismiss') throw new KakaoLoginCanceledError()
      throw new Error('로그인을 시작하지 못했어요. 잠시 후 다시 시도해 주세요.')
    }

    const code = extractAuthCode(result.url)
    if (!code) {
      throw new Error('로그인 응답에서 인가 코드를 찾지 못했어요.')
    }

    // 인가 코드는 1회용이라 client 도 자동 재시도하지 않고(POST), 여기서도 다시 보내지 않는다.
    // 첫 요청이 서버에 닿아 코드가 이미 소모됐을 수 있어, 다시 보내면 실패하거나 재사용 시도로 남는다.
    // 실패하면 로그인 창부터 다시 열도록 안내한다.
    let tokens: TokenResponse
    try {
      tokens = await exchangeAuthCode(code, pkce.verifier)
    } catch (error) {
      throw new Error(authExchangeErrorMessage(error))
    }

    await completeLogin(tokens, 'kakao')
  }, [completeLogin])

  const loginWithApple = useCallback(async () => {
    setLoginError(null)

    // 웹: Apple 인증 페이지로 넘어갔다가 돌아오면 restore() 가 마무리한다(이 함수는 돌아오지 않는다).
    if (isWebAppleSignInEnabled()) {
      startWebAppleSignIn()
      return new Promise<void>(() => {})
    }

    let body
    try {
      body = await requestAppleSignIn()
    } catch (error: unknown) {
      if (isAppleSignInCanceled(error)) throw error
      if (__DEV__) console.warn('Apple 로그인 실패:', error)
      throw new Error('Apple 로그인을 마치지 못했어요. 잠시 후 다시 시도해 주세요.')
    }

    // authorizationCode 는 1회용이라 다시 보내지 않는다(카카오 코드 교환과 같은 이유). 실패하면 버튼부터 다시.
    let tokens: TokenResponse
    try {
      tokens = await loginWithAppleRequest(body)
    } catch (error) {
      throw new Error(authExchangeErrorMessage(error))
    }

    await completeLogin(tokens, 'apple')
  }, [completeLogin])

  const logout = useCallback(async () => {
    // 화면은 바로 로그아웃 상태로 돌리고, 서버 정리(기기 해제·refresh 토큰 폐기)는 뒤에서 한다.
    // 예전엔 두 요청을 기다린 뒤에 화면을 바꿔, 망이 느리면 로그아웃 버튼이 안 먹는 것처럼 보였다.
    // 세션 번호를 먼저 올려, 지금 돌고 있는 재발급이 끝나도 새 토큰을 저장하지 않게 한다.
    sessionGenRef.current += 1
    lateAccessTokenRef.current = null
    // 이 시점까지 부른 푸시 등록 번호. 아래 기기 해제는 재발급을 기다린 뒤에야 줄을 서서, 그 사이 곧바로 다시
    // 로그인한 계정의 등록이 먼저 돌 수 있다 — 그 등록이 쓴 id 는 이전 계정 토큰으로 내리거나 지우지 않는다.
    const pushMark = pushRegistrationMark()
    const storedAccessToken = await getItem(ACCESS_TOKEN_KEY)
    const storedRefreshToken = await getItem(REFRESH_TOKEN_KEY)

    // 같은 기기를 쓰는 다음 사람에게 이 계정의 구독·알림 설정이 보이지 않게 기기 저장값을 지우고, 약관 동의 기록도 지워
    // 다음에 로그인하는 사람에게 다시 묻는다(`clearAccountLinkedDeviceData`). 서버 값은 그대로라 다시 로그인하면 불러온다.
    // 토큰보다 먼저 지운다 — `clearAccountLinkedSettings` 주석. 숨긴 사용자 목록·알림 스위치는 계정 칸에 남고 화면만
    // 게스트 칸으로 바뀐다(아래 status 효과, `SettingsContext`).
    // 게스트가 "로그인하기"로 웰컴 화면에 갈 때도 이 함수를 쓰는데, 그때는 계정 설정이 아니라 게스트가 고른
    // 구독이라 지우지 않는다(로그인하면 계정 구독과 합쳐진다).
    if (storedAccessToken || storedRefreshToken) await clearAccountLinkedDeviceData()
    await clearTokens()
    await deleteItem(GUEST_FLAG_KEY)
    setAccessToken(null)
    setStatus('signedOut')
    const pendingRefresh = refreshInFlightRef.current

    void (async () => {
      // 재발급이 돌고 있었으면 끝나길 기다린다. 늦게 온 결과는 refreshAccessToken 이 버리고 새 refresh 토큰도
      // 폐기하지만, 새 액세스 토큰은 아직 유효해 아래 기기 해제에 쓴다.
      if (pendingRefresh) await pendingRefresh.catch(() => null)
      let accessToken = lateAccessTokenRef.current ?? storedAccessToken
      lateAccessTokenRef.current = null
      let refreshToken = storedRefreshToken

      // 이 기기의 푸시 등록을 내린다 — 안 그러면 로그아웃한 폰이 이전 계정의 알림을 계속 받는다.
      // 저장소의 토큰은 이미 지웠으므로 미리 꺼내 둔 토큰으로 보낸다. 액세스 토큰이 만료됐으면(401) 꺼내 둔
      // refresh 토큰으로 한 번만 재발급받아 다시 보낸다. refresh 토큰은 회전되므로 그 뒤엔 새 값을 폐기해야 한다.
      // 실패해도 이 기기로 다시 로그인하면 같은 푸시 토큰 재등록이 기존 행을 새 계정으로 넘긴다.
      let reissued = false
      const reissue = async (): Promise<string | null> => {
        if (reissued || !refreshToken) return null
        reissued = true
        try {
          const tokens = await reissueTokens(refreshToken)
          refreshToken = tokens.refreshToken
          accessToken = tokens.accessToken
          return tokens.accessToken
        } catch {
          return null
        }
      }
      // 실패해도 저장된 id 는 지운다(forget). 비활성화와 같은 작업 안에서 지워야 한다 — 예전엔 비활성화가 끝난 뒤
      // 따로 줄을 세워, 그 사이 곧바로 다시 로그인한 계정의 등록이 끼면 새 계정의 id 를 지웠다(그 계정은 알림
      // 끄기·로그아웃 때 기기를 못 내려 푸시가 계속 왔다).
      const done = await deactivateStoredPushDevice(accessToken, {
        quick: true,
        reissue,
        before: pushMark,
        forget: true,
      }).catch(() => false)
      if (!done && __DEV__) console.warn('로그아웃 후 기기 비활성화 실패')
      if (refreshToken) {
        try {
          await logoutRequest(refreshToken)
        } catch (error: unknown) {
          if (__DEV__) console.warn('서버 로그아웃 요청 실패(로컬 로그아웃은 이미 끝남):', error)
        }
      }
    })()
  }, [])

  const deleteAccount = useCallback(async () => {
    if (!accessToken) throw new Error('로그인 후 이용해 주세요.')

    await deleteAccountRequest(accessToken)
    sessionGenRef.current += 1
    // 탈퇴하면 서버가 기기 행까지 지운다(`UserService.withdraw`) — 저장해 둔 id 만 버린다.
    await forgetStoredPushDevice()
    await clearAccountLinkedDeviceData()
    await clearTokens()
    await deleteItem(GUEST_FLAG_KEY)
    setAccessToken(null)
    setStatus('signedOut')
  }, [accessToken])

  const loginProvider = status === 'authenticated' ? storedProvider : null

  const value = useMemo(
    () => ({
      status,
      accessToken,
      loginError,
      loginProvider,
      loginWithKakao,
      loginWithApple,
      continueAsGuest,
      logout,
      deleteAccount,
      refreshAccessToken,
    }),
    [
      status,
      accessToken,
      loginError,
      loginProvider,
      loginWithKakao,
      loginWithApple,
      continueAsGuest,
      logout,
      deleteAccount,
      refreshAccessToken,
    ],
  )

  if (status === 'loading') return <AppLoadingScreen />

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
