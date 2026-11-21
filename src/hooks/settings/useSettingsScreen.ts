import { useCallback, useRef, useState } from 'react'
import { ScrollView } from 'react-native'
import { useNavigation, useScrollToTop } from '@react-navigation/native'
import { useSettings } from '../../contexts/SettingsContext'
import { useAuth } from '../../contexts/AuthContext'
import { useHiddenAuthors } from '../../lib/hiddenAuthors'
import { useToast } from '../../components/common/Toast'
import { useFeedbackToggles } from './useFeedbackToggles'
import { useAppNotices } from '../../lib/appNotices'
import { useTabBarInset } from '../common/useTabBarInset'
import type { SettingsModalType } from './types'
import { useSettingsGroups } from './useSettingsGroups'
import { useAccountActions } from './useAccountActions'
import { useSettingsAlerts } from './useSettingsAlerts'
import { useSettingsAccount } from './useSettingsAccount'
import { useNearbySettingHighlight } from './useNearbySettingHighlight'
import { useSettingsIntents } from './useSettingsIntents'
import { type NavProp } from '../../utils/settings/settingsScreen'

/** SettingsScreen 의 상태·효과·핸들러. 화면 파일은 이 훅을 불러 그리기만 한다. */
export function useSettingsScreen() {
  const tabInset = useTabBarInset()
  const appNotices = useAppNotices()
  // 이미 설정 탭에 있을 때 하단 '설정' 탭을 다시 누르면 맨 위로 올린다(10-08 요청).
  const scrollRef = useRef<ScrollView>(null)
  useScrollToTop(scrollRef)
  const {
    settings,
    toggleSubscriptionAlert,
    isDeptAlertOn,
    toggleDeptAlert,
    resetSettings,
  } = useSettings()
  // 구독·게시판 알림·분야·제보 알림 토글은 진동과 토스트("○○ 알림을 껐어요")를 함께 준다.
  const {
    toggleAlertCategory,
    toggleSubscribedDept,
    toggleReportStatusAlert,
    toggleNewReportAlert,
  } = useFeedbackToggles()
  const toast = useToast()
  const hiddenAuthors = useHiddenAuthors()

  const { status, loginProvider, logout, deleteAccount, accessToken } = useAuth()
  const navigation = useNavigation<NavProp>()

  const [activeModal, setActiveModal] = useState<SettingsModalType>(null)
  const { expanded, toggleGroup, expandGroup } = useSettingsGroups(navigation, scrollRef)
  const [subManagerVisible, setSubManagerVisible] = useState(false)
  const [boardAlertsVisible, setBoardAlertsVisible] = useState(false)
  const closeModal = useCallback(() => setActiveModal(null), [])
  const openSubscriptions = useCallback(() => setSubManagerVisible(true), [])

  const actions = useAccountActions({ logout, deleteAccount, resetSettings, closeModal })

  const isGuest = status !== 'authenticated'
  const alerts = useSettingsAlerts({
    status,
    accessToken,
    logout,
    settings,
    toggleSubscriptionAlert,
    isDeptAlertOn,
    toggleDeptAlert,
    toast,
    openSubscriptions,
  })
  const account = useSettingsAccount({ isGuest, accessToken })
  const { profile } = account

  /** 반려 알림으로 들어왔을 때 내역에서 강조할 제보 */
  const [highlightReportId, setHighlightReportId] = useState<number | null>(null)
  const openMyReports = useCallback((reportId: number | null) => {
    setHighlightReportId(reportId)
    setActiveModal('myReports')
  }, [])
  const nearby = useNearbySettingHighlight(scrollRef)
  useSettingsIntents({ isGuest, expandGroup, openSubscriptions, showNearbySetting: nearby.show, openMyReports })

  // 설정은 하단 탭 안의 화면이라 탭 이름(Map)으로 이동하면 부모 탭 내비게이터가 처리한다.
  const navigateToMap = () => (navigation as unknown as { navigate: (name: string) => void }).navigate('Map')

  const { subscribedDepts } = settings
  return {
    tabInset,
    appNotices,
    scrollRef,
    toggleAlertCategory,
    toggleSubscribedDept,
    toggleReportStatusAlert,
    toggleNewReportAlert,
    hiddenAuthors,
    status,
    loginProvider,
    navigation,
    activeModal,
    setActiveModal,
    expanded,
    toggleGroup,
    subManagerVisible,
    setSubManagerVisible,
    boardAlertsVisible,
    setBoardAlertsVisible,
    actions,
    isGuest,
    alerts,
    account,
    profile,
    highlightReportId,
    openMyReports,
    nearby,
    navigateToMap,
    subscribedDepts,
  }
}
