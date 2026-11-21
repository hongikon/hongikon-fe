import { View } from 'react-native'
import { nearbyAlertsAvailable } from '../../../lib/nearbyPartners/background'
import type { SettingsAlerts } from '../../../hooks/settings/useSettingsAlerts'
import type { useNearbySettingHighlight } from '../../../hooks/settings/useNearbySettingHighlight'
import type { ALL_CATEGORIES } from '../../../contexts/SettingsContext'
import GroupHeader from './GroupHeader'
import MasterAlertBlock from './alerts/MasterAlertBlock'
import NoticeAlertsBlock from './alerts/NoticeAlertsBlock'
import NearbyAlertBlock from './alerts/NearbyAlertBlock'
import ReportAlertsBlock from './alerts/ReportAlertsBlock'
import AdminAlertBlock from './alerts/AdminAlertBlock'
import { settingsStyles as s } from './styles'

interface Props {
  alerts: SettingsAlerts
  nearby: ReturnType<typeof useNearbySettingHighlight>
  expanded: boolean
  onToggle: () => void
  subscribedCount: number
  onToggleCategory: (cat: (typeof ALL_CATEGORIES)[number]) => void
  onToggleReportStatus: () => void
  onToggleNewReport: () => void
  onOpenBoardAlerts: () => void
  onOpenKeywords: () => void
}

/** 설정 > 알림 묶음: 전체 알림 · 공지 · 근처 제휴 · 제보 · 관리자 칸. */
export default function AlertsGroup({
  alerts,
  nearby,
  expanded,
  onToggle,
  subscribedCount,
  onToggleCategory,
  onToggleReportStatus,
  onToggleNewReport,
  onOpenBoardAlerts,
  onOpenKeywords,
}: Props) {
  const { isGuest, subscriptionAlert, systemBlocked, detailDimmed, guarded, adminAlert } = alerts
  return (
    <View style={s.section} onLayout={nearby.onSectionLayout}>
      <GroupHeader
        icon="notifications-outline"
        label="알림"
        value={isGuest ? '로그인 후 사용' : subscriptionAlert ? '켜짐' : '꺼짐'}
        badge={subscriptionAlert && systemBlocked ? '권한 필요' : undefined}
        expanded={expanded}
        onPress={onToggle}
      />
      {expanded && (
        <View style={s.groupBody} onLayout={nearby.onBodyLayout}>
          <MasterAlertBlock
            isGuest={isGuest}
            subscriptionAlert={subscriptionAlert}
            systemBlocked={systemBlocked}
            permission={alerts.permission}
            onToggle={alerts.handleToggleSubscriptionAlert}
            onFixPermission={alerts.handleFixSystemPermission}
          />

          {/* 공지(구독 게시판) 알림. 전체 스위치가 꺼져 있으면 흐리게. */}
          <NoticeAlertsBlock
            isGuest={isGuest}
            loggedIn={alerts.loggedIn}
            dimmed={detailDimmed}
            subscribedCount={subscribedCount}
            alertOnCount={alerts.alertOnCount}
            subscriptionNewsOn={alerts.subscriptionNewsOn}
            alertCategories={alerts.alertCategories}
            guarded={guarded}
            promptAlertLogin={alerts.promptAlertLogin}
            onToggleSubscriptionNews={alerts.handleToggleSubscriptionNews}
            onToggleCategory={onToggleCategory}
            onOpenBoardAlerts={onOpenBoardAlerts}
            onOpenKeywords={onOpenKeywords}
          />

          {/* 근처 알림 빌드 + 로그인일 때만(컴포넌트가 스스로 숨는다). 공지와 제보 사이(11-01). */}
          {nearbyAlertsAvailable() && !isGuest && (
            <NearbyAlertBlock
              highlight={nearby.highlight}
              onLayout={nearby.onBlockLayout}
              openSignal={nearby.openSignal}
              onModalClose={nearby.handleModalClose}
            />
          )}

          <ReportAlertsBlock
            isGuest={isGuest}
            dimmed={detailDimmed}
            reportStatusAlert={alerts.reportStatusAlert}
            newReportAlert={alerts.newReportAlert}
            keywordScopeOn={alerts.keywordScopeOn}
            showReportKeywords={alerts.showReportKeywords}
            reportKeywords={alerts.reportKeywords}
            guarded={guarded}
            onToggleReportStatus={onToggleReportStatus}
            onToggleNewReport={onToggleNewReport}
          />

          {alerts.isAdmin && adminAlert.state.status !== 'unsupported' && (
            <AdminAlertBlock dimmed={detailDimmed} state={adminAlert.state} toggle={adminAlert.toggle} retry={adminAlert.retry} />
          )}
        </View>
      )}
    </View>
  )
}

