import { Animated, KeyboardAvoidingView, Platform, Pressable, StyleSheet, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { COLORS } from '../constants/colors'
import ContentColumn from '../components/common/ContentColumn'
import IntroSlides from '../components/onboarding/IntroSlides'
import PermissionNoticeStep from '../components/onboarding/PermissionNoticeStep'
import { useOnboardingScreen } from '../hooks/onboarding/useOnboardingScreen'

/**
 * 첫 실행 온보딩: 소개(2~3장) → 앱 접근권한 안내(네이티브만) → 웰컴(로그인/둘러보기).
 * "내 학과 고르기"는 여기서 하지 않는다 — 웰컴을 지난 뒤(로그인·둘러보기) `DeptPickScreen` 이 한 번 묻는다(10-04 변경).
 * 로그인한 사용자는 고른 구독이 바로 계정에 저장되고, 이미 구독이 있는 계정이면 건너뛸 수 있어서다.
 * 알림 허용은 첫 실행에서 묻지 않는다 — 알림은 로그인한 계정 기준이라, 로그인한 뒤에 NotificationPrimer 가 한 번 묻는다(10-02 결정).
 * 접근권한 안내는 정보통신망법 제22조의2의 "앱 최초 실행 시" 고지라, 알림 허용 창을 띄울 수 없는 기기
 * (이미 허용·거절)에서도 보여 준다. 웹은 접근권한이 없어 건너뛴다.
 * RootNavigator 가 온보딩을 끝내지 않았을 때만 이 화면을 맨 앞에 둔다(`src/lib/onboarding.ts`).
 * 단계는 한 화면 안에서 바꾼다 — 단계마다 스택 화면을 쌓으면 웰컴으로 넘어갈 때 정리할 게 많아진다.
 */
export default function OnboardingScreen() {
  const { step, appear, goAfterIntro, goAfterPermissions, goBack, translateY } = useOnboardingScreen()

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
          {step === 'intro' && <IntroSlides onDone={goAfterIntro} />}
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
