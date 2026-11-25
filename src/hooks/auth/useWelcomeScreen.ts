import { useState, useCallback, useEffect, useRef } from 'react'
import { Alert, Platform } from 'react-native'
import { useAuth } from '../../contexts/AuthContext'
import { isKakaoLoginCanceled } from '../../utils/auth/authContext'
import { getAppleButton, isAppleSignInAvailable, isAppleSignInCanceled } from '../../lib/appleAuth'
import { isWebAppleSignInEnabled } from '../../lib/appleWebAuth'
import { hasCurrentTermsConsent, saveTermsConsent } from '../../lib/termsConsent'
import { type PendingAction, type LoginAction } from '../../utils/auth/welcomeScreen'

/** WelcomeScreen 의 상태·효과·핸들러. 화면 파일은 이 훅을 불러 그리기만 한다. */
export function useWelcomeScreen() {
  const { loginWithKakao, loginWithApple, loginWithDemo, continueAsGuest, loginError } = useAuth()
  const [pending, setPending] = useState<PendingAction>(null)
  const [appleAvailable, setAppleAvailable] = useState(false)
  // 웹에선 Alert.alert 가 아무것도 띄우지 않아(react-native-web) 버튼 위에 문구로 보여준다.
  const [inlineError, setInlineError] = useState<string | null>(null)
  const [legalModal, setLegalModal] = useState<'terms' | 'privacy' | null>(null)
  // 앱 심사용 데모 로그인: 로고를 2초 안에 5번 누르면 연다(심사 메모에 적는다, 10-09).
  const [demoOpen, setDemoOpen] = useState(false)
  const logoTapsRef = useRef<number[]>([])
  const handleLogoTap = () => {
    const now = Date.now()
    logoTapsRef.current = [...logoTapsRef.current.filter((t) => now - t < 2000), now]
    if (logoTapsRef.current.length >= 5) {
      logoTapsRef.current = []
      setDemoOpen(true)
    }
  }
  const errorText = inlineError ?? loginError
  /** 동의 시트를 띄우게 한 로그인. 시트에서 동의하면 이 로그인을 이어서 연다. */
  const [consentFor, setConsentFor] = useState<LoginAction | null>(null)
  /** 시트 문구용. 닫히는 동안에도 문구가 바뀌지 않게 마지막 값을 남겨 둔다. */
  const [sheetProvider, setSheetProvider] = useState<LoginAction | null>(null)
  /** 동의 후 시트가 다 내려가면(iOS onDismiss) 시작할 로그인. 시트가 내려가는 중에 시스템 로그인 화면을 띄우면 안 뜰 수 있다. */
  const afterConsentRef = useRef<LoginAction | null>(null)

  useEffect(() => {
    let active = true
    isAppleSignInAvailable().then((available) => {
      if (active) setAppleAvailable(available)
    })
    return () => {
      active = false
    }
  }, [])

  const handleAppleLogin = useCallback(async () => {
    setPending('apple')
    setInlineError(null)
    try {
      await loginWithApple()
    } catch (error: unknown) {
      // 사용자가 Apple 시트를 닫은 건 오류가 아니다 — 아무것도 띄우지 않는다.
      if (isAppleSignInCanceled(error)) return
      const message = error instanceof Error ? error.message : '로그인에 실패했어요.'
      if (Platform.OS === 'web') {
        setInlineError(message)
      } else {
        Alert.alert('Apple 로그인 실패', message)
      }
    } finally {
      setPending(null)
    }
  }, [loginWithApple])

  const handleKakaoLogin = useCallback(async () => {
    setPending('kakao')
    setInlineError(null)
    try {
      await loginWithKakao()
    } catch (error: unknown) {
      // 로그인 창을 닫은 건 오류가 아니다 — Apple 과 같이 아무것도 띄우지 않는다.
      if (isKakaoLoginCanceled(error)) return
      const message = error instanceof Error ? error.message : '로그인에 실패했어요.'
      if (Platform.OS === 'web') {
        setInlineError(message)
      } else {
        Alert.alert('카카오 로그인 실패', message)
      }
    } finally {
      setPending(null)
    }
  }, [loginWithKakao])

  const startLogin = useCallback(
    (action: LoginAction) => {
      if (action === 'apple') void handleAppleLogin()
      else void handleKakaoLogin()
    },
    [handleAppleLogin, handleKakaoLogin],
  )

  /** 동의 뒤 미뤄 둔 로그인을 한 번만 시작한다(iOS onDismiss 또는 대비용 타이머 중 먼저 부른 쪽). */
  const runAfterConsent = useCallback(() => {
    const action = afterConsentRef.current
    afterConsentRef.current = null
    if (action) startLogin(action)
  }, [startLogin])

  /** 로그인 버튼: 이 기기에서 지금 판 약관에 동의했으면 바로, 아니면 동의 시트부터. */
  const requestLogin = useCallback(
    async (action: LoginAction) => {
      setInlineError(null)
      if (await hasCurrentTermsConsent()) startLogin(action)
      else {
        setSheetProvider(action)
        setConsentFor(action)
      }
    },
    [startLogin],
  )

  const handleConsentAgree = useCallback(async () => {
    const action = consentFor
    if (!action) return
    await saveTermsConsent()
    setConsentFor(null)
    // iOS 는 시트가 완전히 내려간 뒤(onDismiss) 로그인 화면을 띄운다 — 내려가는 중에 Apple·카카오 시트를
    // 띄우면 뜨지 않을 수 있다. onDismiss 가 오지 않는 경우를 대비해 잠시 뒤에도 한 번 시도한다(먼저 온 쪽만 실행).
    // 다른 플랫폼은 바로 연다.
    if (Platform.OS === 'ios') {
      afterConsentRef.current = action
      setTimeout(runAfterConsent, 800)
    } else {
      startLogin(action)
    }
  }, [consentFor, startLogin, runAfterConsent])

  const handleGuest = useCallback(async () => {
    setPending('guest')
    try {
      await continueAsGuest()
    } finally {
      setPending(null)
    }
  }, [continueAsGuest])

  const isBusy = pending !== null
  const appleButton = appleAvailable ? getAppleButton() : null
  const webAppleEnabled = isWebAppleSignInEnabled()
  return {
    loginWithDemo,
    pending,
    legalModal,
    setLegalModal,
    demoOpen,
    setDemoOpen,
    handleLogoTap,
    errorText,
    consentFor,
    setConsentFor,
    sheetProvider,
    runAfterConsent,
    requestLogin,
    handleConsentAgree,
    handleGuest,
    isBusy,
    appleButton,
    webAppleEnabled,
  }
}
