import { createNativeStackNavigator } from '@react-navigation/native-stack'
import TabNavigator from './TabNavigator'
import NewsDetailScreen from '../screens/NewsDetailScreen'
import NewsSearchScreen from '../screens/NewsSearchScreen'
import DeptNewsScreen from '../screens/DeptNewsScreen'
import WelcomeScreen from '../screens/WelcomeScreen'
import AppStatusScreen from '../screens/AppStatusScreen'
import { useAuth } from '../contexts/AuthContext'
import type { NewsItem } from '../types'

export type RootStackParamList = {
  Welcome: undefined
  Main: undefined
  /**
   * 목록 카드에서 오면 `item`(요약)을 넘겨 바로 그리고, 알림처럼 id만 아는 경로는 `newsId`만 넘긴다 —
   * 어느 쪽이든 상세 화면이 `GET /news/{id}`로 본문을 받아 채운다.
   */
  NewsDetail: { item: NewsItem } | { newsId: string }
  NewsSearch: undefined
  DeptNews: { deptId: string; deptName: string }
  AppStatus: undefined
}

const Stack = createNativeStackNavigator<RootStackParamList>()

/**
 * 로그인 여부에 따라 완전히 다른 스택을 보여준다(React Navigation 의 표준 인증 플로우 패턴).
 * signedOut → 웰컴 화면만. guest/authenticated → 기존 탭 화면들.
 * AuthProvider 가 상태 복원 중에는 children 을 아예 렌더하지 않으므로 여기선 'loading' 을 신경 쓸 필요가 없다.
 */
export default function RootNavigator() {
  const { status } = useAuth()

  if (status === 'signedOut') {
    return (
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        <Stack.Screen name="Welcome" component={WelcomeScreen} />
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
        name="DeptNews"
        component={DeptNewsScreen}
        options={{ animation: 'slide_from_right' }}
      />
      <Stack.Screen
        name="AppStatus"
        component={AppStatusScreen}
        options={{ animation: 'slide_from_right' }}
      />
    </Stack.Navigator>
  )
}
