import { useState, useCallback } from 'react'
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  Alert,
  ActivityIndicator,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { COLORS } from '../constants/colors'
import { FONTS } from '../constants/typography'
import { useAuth } from '../contexts/AuthContext'

type PendingAction = 'kakao' | 'guest' | null

/**
 * 최초 진입 화면. 카카오 로그인 / 애플 로그인(백엔드 미구현으로 준비 중) / 게스트 중 하나를 고른다.
 * AuthContext.status 가 'signedOut' 일 때만 RootNavigator 가 이 화면을 보여준다.
 */
export default function WelcomeScreen() {
  const { loginWithKakao, continueAsGuest } = useAuth()
  const [pending, setPending] = useState<PendingAction>(null)

  const handleKakaoLogin = useCallback(async () => {
    setPending('kakao')
    try {
      await loginWithKakao()
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : '로그인에 실패했습니다.'
      Alert.alert('카카오 로그인 실패', message)
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

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <View style={styles.content}>
        <Image
          source={require('../../assets/splash-icon.png')}
          style={styles.logo}
          resizeMode="contain"
        />
        <Text style={styles.title}>홍익대알리미</Text>
        <Text style={styles.subtitle}>캠퍼스 지도와 학과 소식을 한 곳에서</Text>
      </View>

      <View style={styles.buttons}>
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
          style={[styles.button, styles.appleButton]}
          disabled
          accessibilityRole="button"
          accessibilityLabel="Apple로 시작하기, 준비 중"
          accessibilityState={{ disabled: true }}
        >
          <Ionicons name="logo-apple" size={18} color={COLORS.white} />
          <Text style={styles.appleButtonText}>Apple로 시작하기 · 준비 중</Text>
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
  logo: { width: 96, height: 96, borderRadius: 24 },
  title: { fontSize: 22, fontFamily: FONTS.bold, color: COLORS.textPrimary, marginTop: 8 },
  subtitle: { fontSize: 13, fontFamily: FONTS.regular, color: COLORS.textSecondary },
  buttons: { paddingHorizontal: 24, paddingBottom: 20, gap: 10 },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 50,
    borderRadius: 14,
  },
  kakaoButton: { backgroundColor: '#FEE500' },
  kakaoButtonText: { fontSize: 15, fontFamily: FONTS.semibold, color: '#3C1E1E' },
  // 준비 중 버튼은 브랜드색 대신 회색으로 눌러 비활성 상태임을 드러낸다.
  appleButton: { backgroundColor: '#B9B9B9' },
  appleButtonText: { fontSize: 15, fontFamily: FONTS.semibold, color: COLORS.white },
  guestButton: { alignItems: 'center', paddingVertical: 12 },
  guestButtonText: { fontSize: 14, fontFamily: FONTS.medium, color: COLORS.textSecondary },
})
