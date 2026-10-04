import type { NavigatorScreenParams } from '@react-navigation/native'
import { createNativeStackNavigator } from '@react-navigation/native-stack'
import TabNavigator, { type MainTabParamList } from './TabNavigator'
import NewsDetailScreen from '../screens/NewsDetailScreen'
import NewsSearchScreen from '../screens/NewsSearchScreen'
import WelcomeScreen from '../screens/WelcomeScreen'
import OnboardingScreen from '../screens/OnboardingScreen'
import DeptPickScreen from '../screens/DeptPickScreen'
import AppStatusScreen from '../screens/AppStatusScreen'
import { useAuth } from '../contexts/AuthContext'
import { useDeptPickPending, useOnboardingDone } from '../lib/onboarding'
import type { NewsItem } from '../types'

export type RootStackParamList = {
  /** 첫 실행 온보딩(소개 → 앱 접근권한 안내). 끝나면 웰컴으로 넘어간다. */
  Onboarding: undefined
  Welcome: undefined
  /** 첫 실행의 "내 학과 고르기". 웰컴을 지나(로그인·둘러보기) 메인 대신 한 번 뜬다. */
  DeptPick: undefined
  Main: NavigatorScreenParams<MainTabParamList> | undefined
  /**
   * 목록 카드에서 오면 `item`(요약)을 넘겨 바로 그리고, 알림처럼 id만 아는 경로는 `newsId`만 넘긴다 —
   * 어느 쪽이든 상세 화면이 `GET /news/{id}`로 본문을 받아 채운다.
   */
  NewsDetail: { item: NewsItem } | { newsId: string }
  NewsSearch: undefined
  AppStatus: undefined
}

const Stack = createNativeStackNavigator<RootStackParamList>()

/**
 * 로그인 여부에 따라 완전히 다른 스택을 보여준다(React Navigation 의 표준 인증 플로우 패턴).
 * signedOut → 온보딩(처음 켠 사용자만) → 웰컴. guest/authenticated → 기존 탭 화면들.
 * AuthProvider 가 상태 복원 중에는 children 을 아예 렌더하지 않으므로 여기선 'loading' 을 신경 쓸 필요가 없다.
 * 온보딩 여부도 OnboardingGate 가 정한 뒤에야 여기까지 오므로 null(판단 전)인 경우는 없다.
 *
 * 스택이 바뀔 때(화면 이름 목록이 바뀔 때) React Navigation 은 남은 화면이 없으면 목록의 첫 화면으로 간다.
 * 그래서 화면 순서가 곧 "처음 보여줄 화면"이다.
 * - signedOut: 온보딩을 끝내지 않았으면 온보딩이 첫 화면. 끝내면 순서만 바뀌고(이름 목록은 그대로라 스택은 유지)
 *   온보딩 화면이 직접 웰컴으로 replace 한다.
 * - 로그인·게스트인데 온보딩을 다시 보기로 했으면(`resetOnboarding`) 온보딩만 띄웠다가, 끝내면 메인으로 돌아간다.
 *   이때도 알림 상세(NewsDetail) 화면이 없어 콜드 스타트 알림은 pushNotifications 가 들고 있다가 메인으로 바뀌면 처리한다.
 * - 로그인·게스트이고 온보딩도 끝냈지만 "내 학과 고르기"가 남았으면(처음 켠 기기만, `useDeptPickPending`) 그 화면만 띄운다.
 *   끝내면(`completeDeptPick`) 이름 목록이 메인 스택으로 바뀌어 메인으로 간다. 온보딩과 같은 방식이라 콜드 스타트 알림도 같다.
 *   웰컴 → 로그인/둘러보기로 status 가 바뀌는 순간 signedOut 스택이 통째로 이 스택으로 바뀐다.
 */
export default function RootNavigator() {
  const { status } = useAuth()
  const onboardingDone = useOnboardingDone() !== false
  const deptPickPending = useDeptPickPending()

  if (status === 'signedOut') {
    const onboarding = <Stack.Screen key="Onboarding" name="Onboarding" component={OnboardingScreen} />
    const welcome = <Stack.Screen key="Welcome" name="Welcome" component={WelcomeScreen} />
    return (
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {onboardingDone ? [welcome, onboarding] : [onboarding, welcome]}
      </Stack.Navigator>
    )
  }

  if (!onboardingDone) {
    return (
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        <Stack.Screen name="Onboarding" component={OnboardingScreen} />
      </Stack.Navigator>
    )
  }

  if (deptPickPending) {
    return (
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        <Stack.Screen name="DeptPick" component={DeptPickScreen} />
      </Stack.Navigator>
    )
  }

  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Main" component={TabNavigator} />
      <Stack.Screen
        name="NewsDetail"
        component={NewsDetailScreen}
        options={{ animation: 'slide_from_right' }}
      />
      <Stack.Screen
        name="NewsSearch"
        component={NewsSearchScreen}
        options={{ animation: 'slide_from_bottom' }}
      />
      <Stack.Screen
        name="AppStatus"
        component={AppStatusScreen}
        options={{ animation: 'slide_from_right' }}
      />
    </Stack.Navigator>
  )
}
