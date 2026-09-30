import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useMemo,
  type ReactNode,
} from 'react'
import { Platform } from 'react-native'
import * as WebBrowser from 'expo-web-browser'
import {
  AUTH_REDIRECT_URI,
  KAKAO_LOGIN_URL,
  WEB_AUTH_CALLBACK_PATH,
  buildWebKakaoLoginUrl,
  deleteAccount as deleteAccountRequest,
  exchangeAuthCode,
  logoutRequest,
  type TokenResponse,
} from '../apis/auth'
import { ApiError, isNetworkError } from '../apis/client'
import { getItem, setItem, deleteItem } from '../lib/tokenStorage'
import AppLoadingScreen from '../screens/AppLoadingScreen'

// 앱이 카카오 로그인 팝업 자신으로 다시 열렸을 때(웹 타깃) 인증 세션을 마저 끝내준다.
// Expo 공식 가이드가 권장하는 모듈 스코프 호출.
WebBrowser.maybeCompleteAuthSession()

const ACCESS_TOKEN_KEY = 'hongikon_access_token'
const REFRESH_TOKEN_KEY = 'hongikon_refresh_token'
const GUEST_FLAG_KEY = 'hongikon_guest_mode'

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

interface AuthContextValue {
  status: AuthStatus
  accessToken: string | null
  /** 웹에서 카카오 로그인 후 돌아와 토큰 교환에 실패했을 때의 안내 문구. 웰컴 화면이 보여준다. */
  loginError: string | null
  loginWithKakao: () => Promise<void>
  continueAsGuest: () => Promise<void>
  logout: () => Promise<void>
  deleteAccount: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

async function saveTokens(tokens: TokenResponse): Promise<void> {
  await setItem(ACCESS_TOKEN_KEY, tokens.accessToken)
  await setItem(REFRESH_TOKEN_KEY, tokens.refreshToken)
}

async function clearTokens(): Promise<void> {
  await deleteItem(ACCESS_TOKEN_KEY)
  await deleteItem(REFRESH_TOKEN_KEY)
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
    return '네트워크 연결이 불안정해 로그인을 마치지 못했습니다. 연결을 확인한 뒤 다시 로그인해주세요.'
  }
  if (error instanceof ApiError && error.status >= 400 && error.status < 500) {
    return '로그인 정보가 만료되었거나 올바르지 않습니다. 다시 로그인해주세요.'
  }
  return '로그인 처리 중 서버에 문제가 생겼습니다. 잠시 후 다시 로그인해주세요.'
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>('loading')
  const [accessToken, setAccessToken] = useState<string | null>(null)
  const [loginError, setLoginError] = useState<string | null>(null)

  useEffect(() => {
    async function restore() {
      // 웹: 카카오 로그인에서 막 돌아온 경우 저장된 상태보다 먼저 처리한다.
      const callbackCode = takeWebAuthCallbackCode()
      if (callbackCode !== undefined) {
        if (!callbackCode) {
          setLoginError('로그인이 취소되었습니다.')
          setStatus('signedOut')
          return
        }
        try {
          const tokens = await exchangeAuthCode(callbackCode)
          await saveTokens(tokens)
          await deleteItem(GUEST_FLAG_KEY)
          setAccessToken(tokens.accessToken)
          setStatus('authenticated')
        } catch (error: unknown) {
          setLoginError(authExchangeErrorMessage(error))
          setStatus('signedOut')
        }
        return
      }

      try {
        const token = await getItem(ACCESS_TOKEN_KEY)
        if (token) {
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
  }, [])

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
      if (!url) throw new Error('로그인 서버 주소가 설정되지 않았습니다.')
      window.location.assign(url)
      return new Promise<void>(() => {})
    }

    const result = await WebBrowser.openAuthSessionAsync(KAKAO_LOGIN_URL, AUTH_REDIRECT_URI)

    if (result.type !== 'success') {
      throw new Error('로그인이 취소되었습니다.')
    }

    const code = extractAuthCode(result.url)
    if (!code) {
      throw new Error('로그인 응답에서 인가 코드를 찾지 못했습니다.')
    }

    // 인가 코드는 1회용이라 client 도 자동 재시도하지 않고(POST), 여기서도 다시 보내지 않는다.
    // 첫 요청이 서버에 닿아 코드가 이미 소모됐을 수 있어, 다시 보내면 실패하거나 재사용 시도로 남는다.
    // 실패하면 로그인 창부터 다시 열도록 안내한다.
    let tokens: TokenResponse
    try {
      tokens = await exchangeAuthCode(code)
    } catch (error) {
      throw new Error(authExchangeErrorMessage(error))
    }

    await saveTokens(tokens)
    await deleteItem(GUEST_FLAG_KEY)
    setAccessToken(tokens.accessToken)
    setStatus('authenticated')
  }, [])

  const logout = useCallback(async () => {
    // 서버에 refresh 토큰 폐기를 먼저 시도한다 — 실패해도(오프라인 등) 로컬 로그아웃은 그대로
    // 진행한다. 그렇지 않으면 네트워크가 안 되는 순간 로그아웃 버튼 자체가 안 먹는 꼴이 된다.
    const refreshToken = await getItem(REFRESH_TOKEN_KEY)
    if (refreshToken) {
      try {
        await logoutRequest(refreshToken)
      } catch (error: unknown) {
        if (__DEV__) console.warn('서버 로그아웃 요청 실패(로컬 로그아웃은 계속 진행):', error)
      }
    }

    await clearTokens()
    await deleteItem(GUEST_FLAG_KEY)
    setAccessToken(null)
    setStatus('signedOut')
  }, [])

  const deleteAccount = useCallback(async () => {
    if (!accessToken) throw new Error('로그인 후 이용해주세요.')

    await deleteAccountRequest(accessToken)
    await clearTokens()
    await deleteItem(GUEST_FLAG_KEY)
    setAccessToken(null)
    setStatus('signedOut')
  }, [accessToken])

  const value = useMemo(
    () => ({ status, accessToken, loginError, loginWithKakao, continueAsGuest, logout, deleteAccount }),
    [status, accessToken, loginError, loginWithKakao, continueAsGuest, logout, deleteAccount],
  )

  if (status === 'loading') return <AppLoadingScreen />

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
