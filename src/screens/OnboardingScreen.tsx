import { useCallback, useEffect, useRef, useState } from 'react'
import {
  Animated,
  BackHandler,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  View,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { COLORS } from '../constants/colors'
import { useAuth } from '../contexts/AuthContext'
import { completeOnboarding } from '../lib/onboarding'
import ContentColumn from '../components/common/ContentColumn'
import IntroSlides from '../components/onboarding/IntroSlides'
import DeptPickStep from '../components/onboarding/DeptPickStep'
import PermissionNoticeStep from '../components/onboarding/PermissionNoticeStep'
import type { RootStackParamList } from '../navigation/RootNavigator'

type Step = 'intro' | 'depts' | 'permissions'

/**
 * 첫 실행 온보딩: 소개(2~3장) → 내 학과 고르기 → 앱 접근권한 안내(네이티브만) → 웰컴(로그인/둘러보기).
 * 알림 허용은 첫 실행에서 묻지 않는다 — 알림은 로그인한 계정 기준이라, 로그인한 뒤에 NotificationPrimer 가 한 번 묻는다(10-02 결정).
 * 접근권한 안내는 정보통신망법 제22조의2의 "앱 최초 실행 시" 고지라, 알림 허용 창을 띄울 수 없는 기기
 * (이미 허용·거절)에서도 보여 준다. 웹은 접근권한이 없어 건너뛴다.
 * RootNavigator 가 온보딩을 끝내지 않았을 때만 이 화면을 맨 앞에 둔다(`src/lib/onboarding.ts`).
 * 단계는 한 화면 안에서 바꾼다 — 단계마다 스택 화면을 쌓으면 웰컴으로 넘어갈 때 정리할 게 많아진다.
 */
export default function OnboardingScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>()
  const { status } = useAuth()
  const [step, setStep] = useState<Step>('intro')

  // 단계가 바뀔 때 살짝 떠오르며 나타난다(웹에서도 같게 보이도록 JS 드라이버).
  const appear = useRef(new Animated.Value(1)).current
  useEffect(() => {
    appear.setValue(0)
    Animated.timing(appear, { toValue: 1, duration: 260, useNativeDriver: false }).start()
  }, [step, appear])

  const finish = useCallback(() => {
    // 로그인 전이면 웰컴(카카오로 시작하기/둘러보기)으로, "온보딩 다시 보기"로 들어온 로그인 사용자는
    // 끝냄 처리만 하면 RootNavigator 가 메인 화면으로 돌려보낸다.
    if (status === 'signedOut') navigation.replace('Welcome')
    void completeOnboarding()
  }, [status, navigation])

  const goAfterDepts = useCallback(() => {
    if (Platform.OS === 'web') finish()
    else setStep('permissions')
  }, [finish])

  const goAfterPermissions = useCallback(() => {
    finish()
  }, [finish])

  const goBack = useCallback((): boolean => {
    if (step === 'depts') {
      setStep('intro')
      return true
    }
    if (step === 'permissions') {
      setStep('depts')
      return true
    }
    return false
  }, [step])

  // 안드로이드 뒤로 가기는 앱을 닫지 않고 이전 단계로.
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', goBack)
    return () => sub.remove()
  }, [goBack])

  const translateY = appear.interpolate({ inputRange: [0, 1], outputRange: [12, 0] })

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      {/* 폴드를 펼친 화면·넓은 웹 창에서도 그림·버튼이 가운데 한 폭에 모이게 한다. */}
      <ContentColumn>
      {step !== 'intro' && (
        <View style={styles.header}>
          <Pressable
            onPress={goBack}
            hitSlop={10}
            style={({ pressed }) => [styles.back, pressed && styles.pressed]}
            accessibilityRole="button"
            accessibilityLabel="이전 단계"
          >
            <Ionicons name="chevron-back" size={24} color={COLORS.textPrimary} />
          </Pressable>
        </View>
      )}
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <Animated.View style={[styles.flex, { opacity: appear, transform: [{ translateY }] }]}>
          {step === 'intro' && <IntroSlides onDone={() => setStep('depts')} />}
          {step === 'depts' && <DeptPickStep onNext={goAfterDepts} />}
          {step === 'permissions' && <PermissionNoticeStep onNext={goAfterPermissions} />}
        </Animated.View>
      </KeyboardAvoidingView>
      </ContentColumn>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.white },
  flex: { flex: 1 },
  header: { height: 52, paddingHorizontal: 12, justifyContent: 'center' },
  back: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  pressed: { opacity: 0.6 },
})
