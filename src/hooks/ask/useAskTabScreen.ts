import { useEffect } from 'react'
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useAuth } from '../../contexts/AuthContext'
import { useAskTabNavigation } from './useAskTabNavigation'
import { useAskConsent, useAskStatus } from './useAskTabStatus'
import { useKeyboardOpen } from './useKeyboardOpen'
import { TAB_BAR_BASE_STYLE } from '../../navigation/tabBarStyles'

/** AskTabScreen 의 상태·효과·핸들러. 화면 파일은 이 훅을 불러 그리기만 한다. */
export function useAskTabScreen() {
  const { status, accessToken, logout } = useAuth()
  const { navigation, showOnMap, routeTo, openSettings, searchNews } = useAskTabNavigation()
  const insets = useSafeAreaInsets()
  const tabBarHeight = useBottomTabBarHeight()
  const loggedIn = status === 'authenticated' && !!accessToken
  const { consented, accept } = useAskConsent()
  const { askStatus, refreshStatus } = useAskStatus(loggedIn, accessToken)
  // 키보드가 올라오면 탭 바를 숨긴다(떠 있는 캡슐이 입력줄을 가린다). 이 탭을 떠나면 원래대로.
  const keyboardShown = useKeyboardOpen()
  useEffect(() => {
    navigation.setOptions({ tabBarStyle: keyboardShown ? { display: 'none' } : TAB_BAR_BASE_STYLE })
  }, [navigation, keyboardShown])
  return {
    accessToken,
    logout,
    showOnMap,
    routeTo,
    openSettings,
    searchNews,
    insets,
    tabBarHeight,
    loggedIn,
    consented,
    accept,
    askStatus,
    refreshStatus,
    keyboardShown,
  }
}
