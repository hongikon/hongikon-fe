import { useState, useCallback, useEffect } from 'react'
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
import { useAuth } from '../contexts/AuthContext'
import { getAppleButton, isAppleSignInAvailable, isAppleSignInCanceled } from '../lib/appleAuth'
import LogotypeVertical from '../../assets/brand/logotype-vertical.svg'

type PendingAction = 'apple' | 'kakao' | 'guest' | null

/** 카카오 버튼과 같은 크기·모서리. Apple 버튼은 다른 로그인 버튼보다 작거나 아래에 있으면 안 된다(HIG·심사 4.8). */
const LOGIN_BUTTON_HEIGHT = 50
const LOGIN_BUTTON_RADIUS = 14

/**
 * 최초 진입 화면. Apple 로그인(iOS) / 카카오 로그인 / 게스트 중 하나를 고른다.
 * AuthContext.status 가 'signedOut' 일 때만 RootNavigator 가 이 화면을 보여준다.
 *
 * Apple 버튼은 iOS 이면서 이 바이너리에 ExpoAppleAuthentication 네이티브 모듈이 있고 기기가 지원할 때만 보인다
 * (src/lib/appleAuth.ts). 웹·안드로이드·모듈 없는 구버전 바이너리(OTA 로 이 JS 를 받은 1.0.0)에서는 숨는다.
 * Apple 이 승인한 시스템 버튼(AppleAuthenticationButton, 검은색)을 그대로 쓰고 카카오 버튼 위에 둔다.
 */
export default function WelcomeScreen() {
  const { loginWithKakao, loginWithApple, continueAsGuest, loginError } = useAuth()
  const [pending, setPending] = useState<PendingAction>(null)
  const [appleAvailable, setAppleAvailable] = useState(false)
  // 웹에선 Alert.alert 가 아무것도 띄우지 않아(react-native-web) 버튼 위에 문구로 보여준다.
  const [inlineError, setInlineError] = useState<string | null>(null)
  const errorText = inlineError ?? loginError

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
      const message = error instanceof Error ? error.message : '로그인에 실패했습니다.'
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
      const message = error instanceof Error ? error.message : '로그인에 실패했습니다.'
      if (Platform.OS === 'web') {
        setInlineError(message)
      } else {
        Alert.alert('카카오 로그인 실패', message)
      }
    } finally {
      setPending(null)
    }
  }, [loginWithKakao])

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
              onPress={handleAppleLogin}
              style={styles.appleButton}
            />
          </View>
        )}

        <TouchableOpacity
          style={[styles.button, styles.kakaoButton]}
          onPress={handleKakaoLogin}
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

        <TouchableOpacity
          style={styles.guestButton}
          onPress={handleGuest}
          disabled={isBusy}
          accessibilityRole="button"
          accessibilityLabel="둘러보기"
        >
          <Text style={styles.guestButtonText}>
            {pending === 'guest' ? '이동 중…' : '둘러보기'}
          </Text>
        </TouchableOpacity>
      </View>
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
  guestButton: { alignItems: 'center', paddingVertical: 12 },
  guestButtonText: { fontSize: 14, fontFamily: FONTS.medium, color: COLORS.textSecondary },
})
