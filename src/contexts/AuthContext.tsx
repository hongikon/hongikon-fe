import { createContext, useContext, type ReactNode } from 'react'
import * as WebBrowser from 'expo-web-browser'
import AppLoadingScreen from '../screens/AppLoadingScreen'
import { useAuthProvider } from '../hooks/auth/useAuthProvider'
import { type AuthStatus, type LoginProvider } from '../utils/auth/authContext'

// 앱이 카카오 로그인 팝업 자신으로 다시 열렸을 때(웹 타깃) 인증 세션을 마저 끝내준다.
// Expo 공식 가이드가 권장하는 모듈 스코프 호출.
WebBrowser.maybeCompleteAuthSession()

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
  /** 앱 심사용 데모 계정(아이디·비밀번호). 실패하면 보여줄 문구를 담은 Error 를 던진다. */
  loginWithDemo: (username: string, password: string) => Promise<void>
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

export function AuthProvider({ children }: { children: ReactNode }) {
  const { status, value } = useAuthProvider()

  if (status === 'loading') return <AppLoadingScreen />

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
