import { lazy, Suspense } from 'react'
import { ActivityIndicator, StyleSheet, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs'
import type { NavigatorScreenParams } from '@react-navigation/native'
import { COLORS } from '../constants/colors'
import { FONTS } from '../constants/typography'
import MapScreen from '../screens/MapScreen'
import NewsStackNavigator, { type NewsStackParamList } from './NewsStackNavigator'
import SettingsScreen from '../screens/SettingsScreen'
import { useAdminOverview, useIsAdmin } from '../admin/AdminAccess'
import { MAP_TAB_BAR_STYLE, TAB_BAR_BASE_STYLE } from './tabBarStyles'
import FloatingTabBar from './FloatingTabBar'

/** 관리 탭 화면은 관리자만 쓰니 처음 열 때 불러온다(웹 번들에서 나머지 사용자에게 싣지 않는다). */
const AdminTabScreen = lazy(() => import('../admin/AdminTabScreen'))

function AdminTab() {
  return (
    <Suspense
      fallback={
        <View style={styles.loading}>
          <ActivityIndicator color={COLORS.primary} />
        </View>
      }
    >
      <AdminTabScreen />
    </Suspense>
  )
}

/** 하단 탭. 알림 탭처럼 바깥에서 특정 탭으로 보낼 때 `navigate('Main', { screen: 'Map' })` 로 쓴다. */
export type MainTabParamList = {
  Map: undefined
  News: NavigatorScreenParams<NewsStackParamList> | undefined
  Settings: undefined
  /** 관리자 계정에만 붙는다(`useIsAdmin`). */
  Admin: undefined
}

const Tab = createBottomTabNavigator<MainTabParamList>()


export default function TabNavigator() {
  const isAdmin = useIsAdmin()
  const pending = useAdminOverview().data?.reports.pending ?? 0
  return (
    <Tab.Navigator
      // 네이버 지도처럼 화면 아래에 떠 있는 둥근 캡슐(아이콘만) 탭 바. 지도 탭에선 지도 위에 뜬다.
      tabBar={(props) => <FloatingTabBar {...props} />}
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: COLORS.primary,
        tabBarInactiveTintColor: COLORS.iconInactive,
        tabBarStyle: TAB_BAR_BASE_STYLE,
        tabBarLabelStyle: {
          fontSize: 11,
          fontFamily: FONTS.medium,
        },
      }}
    >
      <Tab.Screen
        name="Map"
        component={MapScreen}
        options={{
          tabBarLabel: '지도',
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons name={focused ? 'map' : 'map-outline'} size={size} color={color} />
          ),
          // 지도 화면만 탭바를 지도 위에 띄운다(position:absolute) — 그래야 지도가
          // 화면 맨 아래까지 깔려서, 드래그 중 탭바가 사라져도 빈 회색이 아니라
          // 지도가 그대로 보인다. 소식·설정은 원래 방식(탭바가 자기 자리를 차지)을 쓴다.
          tabBarStyle: MAP_TAB_BAR_STYLE,
        }}
      />
      <Tab.Screen
        name="News"
        component={NewsStackNavigator}
        options={{
          tabBarLabel: '소식',
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons name={focused ? 'newspaper' : 'newspaper-outline'} size={size} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="Settings"
        component={SettingsScreen}
        options={{
          tabBarLabel: '설정',
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons name={focused ? 'settings' : 'settings-outline'} size={size} color={color} />
          ),
        }}
      />
      {isAdmin ? (
        <Tab.Screen
          name="Admin"
          component={AdminTab}
          options={{
            tabBarLabel: '관리',
            tabBarAccessibilityLabel: pending > 0 ? `관리, 승인 대기 제보 ${pending}건` : '관리',
            tabBarIcon: ({ color, size, focused }) => (
            <Ionicons name={focused ? 'shield-checkmark' : 'shield-checkmark-outline'} size={size} color={color} />
            ),
            tabBarBadge: pending > 0 ? (pending > 99 ? '99+' : pending) : undefined,
            tabBarBadgeStyle: { fontFamily: FONTS.semibold, fontSize: 10 },
          }}
        />
      ) : null}
    </Tab.Navigator>
  )
}

const styles = StyleSheet.create({
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.white },
})
