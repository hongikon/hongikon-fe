import { Ionicons } from '@expo/vector-icons'
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs'
import type { NavigatorScreenParams } from '@react-navigation/native'
import { COLORS } from '../constants/colors'
import { FONTS } from '../constants/typography'
import MapScreen from '../screens/MapScreen'
import NewsStackNavigator, { type NewsStackParamList } from './NewsStackNavigator'
import SettingsScreen from '../screens/SettingsScreen'

/** 하단 탭. 알림 탭처럼 바깥에서 특정 탭으로 보낼 때 `navigate('Main', { screen: 'Map' })` 로 쓴다. */
export type MainTabParamList = {
  Map: undefined
  News: NavigatorScreenParams<NewsStackParamList> | undefined
  Settings: undefined
}

const Tab = createBottomTabNavigator<MainTabParamList>()

const TAB_BAR_BASE_STYLE = {
  height: 82,
  paddingTop: 8,
  backgroundColor: COLORS.white,
  borderTopWidth: 0.5,
  borderTopColor: COLORS.border,
}

export default function TabNavigator() {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: COLORS.primary,
        tabBarInactiveTintColor: COLORS.iconInactive,
        tabBarStyle: TAB_BAR_BASE_STYLE,
        tabBarLabelStyle: {
          fontSize: 10,
          fontFamily: FONTS.medium,
        },
      }}
    >
      <Tab.Screen
        name="Map"
        component={MapScreen}
        options={{
          tabBarLabel: '지도',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="map-outline" size={size} color={color} />
          ),
          // 지도 화면만 탭바를 지도 위에 띄운다(position:absolute) — 그래야 지도가
          // 화면 맨 아래까지 깔려서, 드래그 중 탭바가 사라져도 빈 회색이 아니라
          // 지도가 그대로 보인다. 소식·설정은 원래 방식(탭바가 자기 자리를 차지)을 쓴다.
          tabBarStyle: { ...TAB_BAR_BASE_STYLE, position: 'absolute', left: 0, right: 0, bottom: 0 },
        }}
      />
      <Tab.Screen
        name="News"
        component={NewsStackNavigator}
        options={{
          tabBarLabel: '소식',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="newspaper-outline" size={size} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="Settings"
        component={SettingsScreen}
        options={{
          tabBarLabel: '설정',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="settings-outline" size={size} color={color} />
          ),
        }}
      />
    </Tab.Navigator>
  )
}
