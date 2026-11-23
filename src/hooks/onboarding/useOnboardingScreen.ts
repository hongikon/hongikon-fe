import { useCallback, useEffect, useRef, useState } from 'react'
import { Animated, BackHandler, Platform } from 'react-native'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { useAuth } from '../../contexts/AuthContext'
import { completeOnboarding } from '../../lib/onboarding'
import type { RootStackParamList } from '../../navigation/RootNavigator'
import { type Step } from '../../utils/onboarding/onboardingScreen'

/** OnboardingScreen 의 상태·효과·핸들러. 화면 파일은 이 훅을 불러 그리기만 한다. */
export function useOnboardingScreen() {
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

  // 웹은 접근권한이 없어 소개가 끝나면 바로 웰컴으로.
  const goAfterIntro = useCallback(() => {
    if (Platform.OS === 'web') finish()
    else setStep('permissions')
  }, [finish])

  const goAfterPermissions = useCallback(() => {
    finish()
  }, [finish])

  const goBack = useCallback((): boolean => {
    if (step === 'permissions') {
      setStep('intro')
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
  return { step, appear, goAfterIntro, goAfterPermissions, goBack, translateY }
}
