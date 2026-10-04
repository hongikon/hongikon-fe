import { useState, useCallback, useEffect, useRef } from 'react'
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Platform,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { COLORS } from '../constants/colors'
import { layoutStyles } from '../constants/layout'
import { FONTS } from '../constants/typography'
import { isKakaoLoginCanceled, useAuth } from '../contexts/AuthContext'
import { getAppleButton, isAppleSignInAvailable, isAppleSignInCanceled } from '../lib/appleAuth'
import LogotypeVertical from '../../assets/brand/logotype-vertical.svg'
import { UNOFFICIAL_NOTICE } from '../constants/disclaimer'
import Button from '../components/common/Button'
import TermsModal from '../components/settings/TermsModal'
import PrivacyModal from '../components/settings/PrivacyModal'
import SignupConsentSheet from '../components/auth/SignupConsentSheet'
import { hasCurrentTermsConsent, saveTermsConsent } from '../lib/termsConsent'

type PendingAction = 'apple' | 'kakao' | 'guest' | null
type LoginAction = 'apple' | 'kakao'

/** 카카오 버튼과 같은 크기·모서리(앱 공용 Button lg 와 같은 48·12). Apple 버튼은 다른 로그인 버튼보다 작거나 아래에 있으면 안 된다(HIG·심사 4.8). */
const LOGIN_BUTTON_HEIGHT = 48
const LOGIN_BUTTON_RADIUS = 12

/**
 * 최초 진입 화면. Apple 로그인(iOS) / 카카오 로그인 / 게스트 중 하나를 고른다.
 * AuthContext.status 가 'signedOut' 일 때만 RootNavigator 가 이 화면을 보여준다.
 *
 * Apple 버튼은 iOS 이면서 이 바이너리에 ExpoAppleAuthentication 네이티브 모듈이 있고 기기가 지원할 때만 보인다
 * (src/lib/appleAuth.ts). 웹·안드로이드·모듈 없는 구버전 바이너리(OTA 로 이 JS 를 받은 1.0.0)에서는 숨는다.
 * Apple 이 승인한 시스템 버튼(AppleAuthenticationButton, 검은색)을 그대로 쓰고 카카오 버튼 위에 둔다.
 *
 * 로그인 버튼을 누르면, 이 기기에서 지금 판(TERMS_VERSION)의 약관에 동의한 적이 없을 때 먼저 동의 시트
 * (SignupConsentSheet)를 띄우고, 동의하면 그 로그인을 이어서 연다. 설정의 "로그인하기"도 이 화면으로 와서 같은 길을 탄다.
 */
export default function WelcomeScreen() {
  const { loginWithKakao, loginWithApple, continueAsGuest, loginError } = useAuth()
  const [pending, setPending] = useState<PendingAction>(null)
  const [appleAvailable, setAppleAvailable] = useState(false)
  // 웹에선 Alert.alert 가 아무것도 띄우지 않아(react-native-web) 버튼 위에 문구로 보여준다.
  const [inlineError, setInlineError] = useState<string | null>(null)
  const [legalModal, setLegalModal] = useState<'terms' | 'privacy' | null>(null)
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

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <View style={styles.content}>
        <View style={styles.logo} accessibilityRole="image" accessibilityLabel="HONGIK ON">
          <LogotypeVertical width={180} height={109} />
        </View>
        <Text style={styles.subtitle}>캠퍼스 지도와 학과 소식을 한 곳에서</Text>
      </View>

      <View style={[styles.buttons, layoutStyles.readable]}>
        {errorText && (
          <Text style={styles.errorText} accessibilityRole="alert">
            {errorText}
          </Text>
        )}
        {appleButton && (
          // 시스템 버튼이라 disabled 가 없어, 처리 중에는 감싼 View 로 터치만 막는다(모양은 Apple 규정대로 그대로 둔다).
          <View pointerEvents={isBusy ? 'none' : 'auto'} style={pending === 'apple' && styles.applePending}>
            <appleButton.AppleAuthenticationButton
              buttonType={appleButton.AppleAuthenticationButtonType.CONTINUE}
              buttonStyle={appleButton.AppleAuthenticationButtonStyle.BLACK}
              cornerRadius={LOGIN_BUTTON_RADIUS}
              onPress={() => void requestLogin('apple')}
              style={styles.appleButton}
            />
          </View>
        )}

        <TouchableOpacity
          style={[styles.button, styles.kakaoButton]}
          onPress={() => void requestLogin('kakao')}
          disabled={isBusy}
          accessibilityRole="button"
          accessibilityLabel="카카오로 시작하기"
        >
          {pending === 'kakao' ? (
            <ActivityIndicator color="#3C1E1E" />
          ) : (
            <>
              <Ionicons name="chatbubble" size={18} color="#3C1E1E" />
              <Text style={styles.kakaoButtonText}>카카오로 시작하기</Text>
            </>
          )}
        </TouchableOpacity>

        {/* 약관 동의는 로그인 버튼을 누르면 뜨는 동의 시트에서 받는다. 여기서는 언제든 읽을 수 있게 링크만 둔다(처리방침은 굵게). */}
        <Text style={styles.legalLinks}>
          <Text
            style={styles.legalLink}
            onPress={() => setLegalModal('terms')}
            accessibilityRole="link"
            suppressHighlighting
          >
            이용약관
          </Text>
          {'  ·  '}
          <Text
            style={[styles.legalLink, styles.legalLinkStrong]}
            onPress={() => setLegalModal('privacy')}
            accessibilityRole="link"
            suppressHighlighting
          >
            개인정보 처리방침
          </Text>
        </Text>

        <Button
          variant="ghost"
          size="md"
          label={pending === 'guest' ? '이동 중…' : '둘러보기'}
          onPress={handleGuest}
          disabled={isBusy}
          accessibilityLabel="둘러보기"
        />
        <Text style={styles.unofficialNotice}>{UNOFFICIAL_NOTICE}</Text>
      </View>

      <TermsModal visible={legalModal === 'terms'} onClose={() => setLegalModal(null)} />
      <PrivacyModal visible={legalModal === 'privacy'} onClose={() => setLegalModal(null)} />
      <SignupConsentSheet
        visible={consentFor !== null}
        provider={sheetProvider}
        onAgree={() => void handleConsentAgree()}
        onClose={() => setConsentFor(null)}
        onDismiss={runAfterConsent}
      />
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.white, justifyContent: 'space-between' },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingHorizontal: 32,
  },
  logo: { marginBottom: 12 },
  subtitle: { fontSize: 13, fontFamily: FONTS.regular, color: COLORS.textSecondary },
  buttons: { paddingHorizontal: 24, paddingBottom: 20, gap: 10 },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: LOGIN_BUTTON_HEIGHT,
    borderRadius: LOGIN_BUTTON_RADIUS,
  },
  kakaoButton: { backgroundColor: '#FEE500' },
  kakaoButtonText: { fontSize: 15, fontFamily: FONTS.semibold, color: '#3C1E1E' },
  // 시스템 버튼에는 높이·너비만 준다(배경색·모서리는 buttonStyle·cornerRadius 로만 — Apple 규정).
  appleButton: { width: '100%', height: LOGIN_BUTTON_HEIGHT },
  applePending: { opacity: 0.6 },
  errorText: {
    fontSize: 13,
    fontFamily: FONTS.medium,
    color: COLORS.danger,
    textAlign: 'center',
    marginBottom: 4,
  },
  legalLinks: {
    fontSize: 12,
    lineHeight: 18,
    fontFamily: FONTS.regular,
    color: COLORS.textTertiary,
    textAlign: 'center',
  },
  legalLink: { color: COLORS.textSecondary, textDecorationLine: 'underline' },
  legalLinkStrong: { fontFamily: FONTS.semibold, color: COLORS.textPrimary },
  unofficialNotice: {
    fontSize: 11,
    lineHeight: 16,
    fontFamily: FONTS.regular,
    color: COLORS.textSecondary,
    textAlign: 'center',
  },
})
