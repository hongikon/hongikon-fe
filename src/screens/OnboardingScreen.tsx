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
import { refreshNotificationPermission } from '../lib/notificationPermission'
import { markNotificationPermissionAsked } from '../components/common/NotificationPrimer'
import IntroSlides from '../components/onboarding/IntroSlides'
import DeptPickStep from '../components/onboarding/DeptPickStep'
import NotificationStep from '../components/onboarding/NotificationStep'
import type { RootStackParamList } from '../navigation/RootNavigator'

type Step = 'intro' | 'depts' | 'notifications'

/**
 * 시스템 허용 창을 지금 띄울 수 있는지. 웹(원격 푸시 없음)이거나 이미 허용·거절이 정해졌으면
 * 알림 단계를 통째로 건너뛴다 — 띄울 수도 없는 버튼을 보여주지 않는다.
 */
async function canAskNotificationPermission(): Promise<boolean> {
  if (Platform.OS === 'web') return false
  const permission = await refreshNotificationPermission()
  return permission.status === 'undetermined' && permission.canAskAgain
}

/**
 * 첫 실행 온보딩: 소개(2~3장) → 내 학과 고르기 → 알림 허용(네이티브만) → 웰컴(로그인/둘러보기).
 * RootNavigator 가 온보딩을 끝내지 않았을 때만 이 화면을 맨 앞에 둔다(`src/lib/onboarding.ts`).
 * 단계는 한 화면 안에서 바꾼다 — 단계마다 스택 화면을 쌓으면 웰컴으로 넘어갈 때 정리할 게 많아진다.
 */
export default function OnboardingScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>()
  const { status } = useAuth()
  const [step, setStep] = useState<Step>('intro')
  const askableRef = useRef<Promise<boolean> | null>(null)
  if (!askableRef.current) askableRef.current = canAskNotificationPermission().catch(() => false)

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

  const goAfterDepts = useCallback(async () => {
    if (await askableRef.current) {
      // 이 단계가 허용 창을 맡는다. 온보딩 뒤 NotificationPrimer 가 다시 묻지 않게 바로 기록한다.
      void markNotificationPermissionAsked()
      setStep('notifications')
    } else {
      finish()
    }
  }, [finish])

  const goBack = useCallback((): boolean => {
    if (step === 'depts') {
      setStep('intro')
      return true
    }
    if (step === 'notifications') {
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
          {step === 'notifications' && <NotificationStep onDone={finish} />}
        </Animated.View>
      </KeyboardAvoidingView>
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
