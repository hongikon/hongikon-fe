import { View, Text, StyleSheet, ScrollView } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { COLORS } from '../constants/colors'
import { layoutStyles } from '../constants/layout'
import TabHeaderCard from '../components/common/TabHeaderCard'
import { UNOFFICIAL_NOTICE } from '../constants/disclaimer'
import { TYPE } from '../constants/typography'
import { SPACING } from '../constants/spacing'
import LogotypeHorizontal from '../../assets/brand/logotype-horizontal.svg'
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
import { useSettingsScreen } from '../hooks/settings/useSettingsScreen'

/**
 * 설정 탭. 묶음(계정·알림·구독 게시판·일반·고객 지원·약관)을 누르면 그 자리에서 펼친다.
 * 상태와 동작은 hooks/settings/*, 묶음별 화면은 components/settings/screen/* 에 있다.
 */
export default function SettingsScreen() {
  const { tabInset, appNotices, scrollRef, toggleAlertCategory, toggleSubscribedDept, toggleReportStatusAlert, toggleNewReportAlert, hiddenAuthors, status, loginProvider, navigation, activeModal, setActiveModal, expanded, toggleGroup, subManagerVisible, setSubManagerVisible, boardAlertsVisible, setBoardAlertsVisible, actions, isGuest, alerts, account, profile, highlightReportId, openMyReports, nearby, navigateToMap, subscribedDepts } = useSettingsScreen()

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
