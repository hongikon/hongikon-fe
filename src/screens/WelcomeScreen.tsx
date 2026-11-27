import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Platform, Pressable } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { COLORS } from '../constants/colors'
import { layoutStyles } from '../constants/layout'
import { FONTS } from '../constants/typography'
import LogotypeVertical from '../../assets/brand/logotype-vertical.svg'
import { UNOFFICIAL_NOTICE } from '../constants/disclaimer'
import Button from '../components/common/Button'
import TermsModal from '../components/settings/TermsModal'
import DemoLoginModal from '../components/auth/DemoLoginModal'
import PrivacyModal from '../components/settings/PrivacyModal'
import SignupConsentSheet from '../components/auth/SignupConsentSheet'
import { useWelcomeScreen } from '../hooks/auth/useWelcomeScreen'

/**
 * 로그인 버튼 글자·아이콘 크기(11-28 사용자: 카카오·Apple 글자 크기를 같게). iOS Apple 버튼은 시스템 버튼이라 글자 크기를 못 바꾸고,
 * 높이 48 에서 약 20pt(시뮬레이터 캡처로 잼)다. 한글 18pt 가 그 영문 대문자 높이와 거의 같아 카카오·웹 Apple 버튼을 18 로 맞춘다(예전 15).
 */
const LOGIN_BUTTON_FONT_SIZE = 18
const LOGIN_ICON_SIZE = 20
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
  const { loginWithDemo, pending, legalModal, setLegalModal, demoOpen, setDemoOpen, handleLogoTap, errorText, consentFor, setConsentFor, sheetProvider, runAfterConsent, requestLogin, handleConsentAgree, handleGuest, isBusy, appleButton, webAppleEnabled } = useWelcomeScreen()

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <View style={styles.content}>
        <Pressable style={styles.logo} onPress={handleLogoTap} accessibilityRole="image" accessibilityLabel="HONGIK ON">
          <LogotypeVertical width={180} height={109} />
        </Pressable>
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
              <Ionicons name="chatbubble" size={LOGIN_ICON_SIZE} color="#3C1E1E" />
              <Text style={styles.kakaoButtonText}>카카오로 시작하기</Text>
            </>
          )}
        </TouchableOpacity>

        {/* 웹 Apple 로그인(`appleWebAuth.ts`). Services ID 가 설정된 운영 주소에서만 켜지고, 아니면 예전 '준비 중' 버튼을
            보여 준다(10-05 요청). 아이폰 앱은 위의 진짜 시스템 버튼이 떠 여기로 오지 않는다 — 미완성 버튼이 iOS 심사(2.1)에 안 보인다.
            Apple 브랜드 규정대로 검은 바탕·흰 로고·'Apple로 시작하기'를 쓰고 카카오 버튼과 같은 크기로 둔다. */}
        {!appleButton && Platform.OS === 'web' && (webAppleEnabled ? (
          <TouchableOpacity
            style={[styles.button, styles.appleWebButton]}
            onPress={() => void requestLogin('apple')}
            disabled={isBusy}
            accessibilityRole="button"
            accessibilityLabel="Apple로 시작하기"
          >
            {pending === 'apple' ? (
              <ActivityIndicator color={COLORS.white} />
            ) : (
              <>
                <Ionicons name="logo-apple" size={LOGIN_ICON_SIZE} color={COLORS.white} />
                <Text style={styles.applePlaceholderText}>Apple로 시작하기</Text>
              </>
            )}
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={[styles.button, styles.applePlaceholder]}
            disabled
            accessibilityRole="button"
            accessibilityLabel="Apple로 시작하기, 준비 중"
            accessibilityState={{ disabled: true }}
          >
            <Ionicons name="logo-apple" size={LOGIN_ICON_SIZE} color={COLORS.white} />
            <Text style={styles.applePlaceholderText}>Apple로 시작하기 · 준비 중</Text>
          </TouchableOpacity>
        ))}

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

      <DemoLoginModal
        visible={demoOpen}
        onClose={() => setDemoOpen(false)}
        onSubmit={async (username, password) => {
          await loginWithDemo(username, password)
          setDemoOpen(false)
        }}
      />
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
  applePlaceholder: { backgroundColor: '#B9B9B9' },
  appleWebButton: { backgroundColor: '#000000' },
  applePlaceholderText: { fontSize: LOGIN_BUTTON_FONT_SIZE, fontFamily: FONTS.semibold, color: COLORS.white },
  kakaoButtonText: { fontSize: LOGIN_BUTTON_FONT_SIZE, fontFamily: FONTS.semibold, color: '#3C1E1E' },
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
