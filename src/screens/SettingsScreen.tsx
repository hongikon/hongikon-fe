import { useCallback, useRef, useState } from 'react'
import { View, Text, StyleSheet, ScrollView } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useNavigation, useScrollToTop } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { COLORS } from '../constants/colors'
import { layoutStyles } from '../constants/layout'
import { useSettings } from '../contexts/SettingsContext'
import { useAuth } from '../contexts/AuthContext'
import { useHiddenAuthors } from '../lib/hiddenAuthors'
import TabHeaderCard from '../components/common/TabHeaderCard'
import { useToast } from '../components/common/Toast'
import { useFeedbackToggles } from '../hooks/useFeedbackToggles'
import { useAppNotices } from '../lib/appNotices'
import { UNOFFICIAL_NOTICE } from '../constants/disclaimer'
import { TYPE } from '../constants/typography'
import { SPACING } from '../constants/spacing'
import type { RootStackParamList } from '../navigation/RootNavigator'
import LogotypeHorizontal from '../../assets/brand/logotype-horizontal.svg'
import { useTabBarInset } from '../hooks/common/useTabBarInset'
import type { SettingsModalType } from '../hooks/settings/types'
import { useSettingsGroups } from '../hooks/settings/useSettingsGroups'
import { useAccountActions } from '../hooks/settings/useAccountActions'
import { useSettingsAlerts } from '../hooks/settings/useSettingsAlerts'
import { useSettingsAccount } from '../hooks/settings/useSettingsAccount'
import { useNearbySettingHighlight } from '../hooks/settings/useNearbySettingHighlight'
import { useSettingsIntents } from '../hooks/settings/useSettingsIntents'
import GroupHeader from '../components/settings/screen/GroupHeader'
import ProfileCard from '../components/settings/screen/ProfileCard'
import SuspendedNotice from '../components/settings/screen/SuspendedNotice'
import AccountGroup from '../components/settings/screen/AccountGroup'
import AlertsGroup from '../components/settings/screen/AlertsGroup'
import GeneralGroup from '../components/settings/screen/GeneralGroup'
import SupportGroup from '../components/settings/screen/SupportGroup'
import PoliciesGroup from '../components/settings/screen/PoliciesGroup'
import SettingsModals from '../components/settings/screen/SettingsModals'
import { settingsStyles } from '../components/settings/screen/styles'

type NavProp = NativeStackNavigationProp<RootStackParamList>

/**
 * 설정 탭. 묶음(계정·알림·구독 게시판·일반·고객 지원·약관)을 누르면 그 자리에서 펼친다.
 * 상태와 동작은 hooks/settings/*, 묶음별 화면은 components/settings/screen/* 에 있다.
 */
export default function SettingsScreen() {
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

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView ref={scrollRef} style={styles.scroll} keyboardShouldPersistTaps="handled" contentContainerStyle={[layoutStyles.readable, tabInset > 0 && { paddingBottom: tabInset }]}>
        {/* 설정은 목록이 길어 머리 카드를 위에 고정하지 않고 같이 스크롤한다(10-07 요청). */}
        <TabHeaderCard title="설정">
          <ProfileCard
            authenticated={status === 'authenticated'}
            displayName={profile?.displayName}
            onPress={
              status !== 'authenticated'
                ? actions.handleGoToLogin
                : profile && !account.nicknameApiMissing
                  ? () => setActiveModal('nickname')
                  : undefined
            }
          />
        </TabHeaderCard>

        {status === 'authenticated' && profile?.status === 'SUSPENDED' && <SuspendedNotice reason={profile.suspendedReason} />}

        {/* 묶음(10-31·11-01): 묶음마다 따로 둥근 카드(소식 > 전체의 단과대 카드처럼). 누르면 그 자리에서 아래로 펼친다. */}
        {/* 게스트는 맨 위 프로필 줄이 '로그인하기' 를 맡아 계정 묶음을 그리지 않는다. */}
        {status === 'authenticated' && (
          <AccountGroup
            loginProvider={loginProvider}
            expanded={expanded.has('account')}
            onToggle={() => toggleGroup('account')}
            memberId={account.memberId}
            memberNumber={account.memberNumber}
            memberCodeLoading={account.memberCodeLoading}
            showMyReports={account.accountLoaded && !account.myReportsApiMissing}
            myReportPending={account.myReportPending}
            onOpenMyReports={() => openMyReports(null)}
            onLogout={actions.handleLogout}
            onDeleteAccount={actions.handleDeleteAccount}
          />
        )}
        <AlertsGroup
          alerts={alerts}
          nearby={nearby}
          expanded={expanded.has('alerts')}
          onToggle={() => toggleGroup('alerts')}
          subscribedCount={subscribedDepts.length}
          onToggleCategory={toggleAlertCategory}
          onToggleReportStatus={toggleReportStatusAlert}
          onToggleNewReport={toggleNewReportAlert}
          onOpenBoardAlerts={() => setBoardAlertsVisible(true)}
          onOpenKeywords={() => setActiveModal('keywords')}
        />
        <View style={settingsStyles.section}>
          <GroupHeader
            icon="bookmarks-outline"
            label="구독 게시판"
            value={subscribedDepts.length > 0 ? `${subscribedDepts.length}개` : '기관·학과 추가'}
            onPress={() => setSubManagerVisible(true)}
          />
        </View>

        <GeneralGroup
          expanded={expanded.has('general')}
          onToggle={() => toggleGroup('general')}
          permissionSummary={alerts.permissionSummary}
          hiddenCount={hiddenAuthors.length}
          openModal={setActiveModal}
          onOpenAppStatus={() => navigation.navigate('AppStatus')}
          onReset={actions.handleReset}
        />
        <SupportGroup expanded={expanded.has('support')} onToggle={() => toggleGroup('support')} openModal={setActiveModal} />
        <PoliciesGroup expanded={expanded.has('policies')} onToggle={() => toggleGroup('policies')} openModal={setActiveModal} />

        <View style={styles.brandFooter} accessibilityLabel="HONGIK ON">
          <LogotypeHorizontal width={112} height={20} />
        </View>
        <Text style={styles.unofficialNotice}>{UNOFFICIAL_NOTICE}</Text>

        <View style={styles.bottomSpacer} />
      </ScrollView>

      <SettingsModals
        activeModal={activeModal}
        setActiveModal={setActiveModal}
        appNotices={appNotices}
        isGuest={isGuest}
        highlightReportId={highlightReportId}
        onMyReportsChanged={account.refreshMyReportCount}
        navigateToMap={navigateToMap}
        memberNumber={account.memberNumber}
        profile={profile}
        onProfileSaved={account.setSavedProfile}
        withdrawVisible={actions.withdrawVisible}
        setWithdrawVisible={actions.setWithdrawVisible}
        onWithdraw={actions.withdraw}
        boardAlertsVisible={boardAlertsVisible}
        setBoardAlertsVisible={setBoardAlertsVisible}
        subManagerVisible={subManagerVisible}
        setSubManagerVisible={setSubManagerVisible}
        subscribedDepts={subscribedDepts}
        onToggleDept={toggleSubscribedDept}
      />
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  // SafeAreaView 상단 인셋·큰 제목 줄은 흰색, 그룹 리스트의 회색 배경은 scroll 이 직접 칠한다.
  container: { flex: 1, backgroundColor: COLORS.background },
  scroll: { flex: 1, backgroundColor: COLORS.background },
  brandFooter: { alignItems: 'center', paddingTop: SPACING.lg, opacity: 0.35 },
  unofficialNotice: {
    ...TYPE.caption,
    color: COLORS.textSecondary,
    textAlign: 'center',
    paddingHorizontal: SPACING.xxxl,
    marginTop: SPACING.sm,
  },
  bottomSpacer: { height: SPACING.lg },
})
