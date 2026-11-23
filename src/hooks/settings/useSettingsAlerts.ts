import { useState } from 'react'
import { Linking } from 'react-native'
import type { useAuth } from '../../contexts/AuthContext'
import type { useSettings } from '../../contexts/SettingsContext'
import type { useToast } from '../../components/common/Toast'
import { requestNotificationPermission, useNotificationPermission } from '../../lib/notificationPermission'
import { useIsAdmin } from '../../admin/AdminAccess'
import { useAdminAlertSetting } from './useAdminAlertSetting'
import { useReportKeywordAlerts } from './useReportKeywordAlerts'
import { isReportKeywordsMock } from '../../apis/reportKeywords'
import * as haptics from '../../lib/haptics'
import { notify } from '../../utils/common/dialog'
import { promptLogin } from '../../utils/map/report/reports'
import { isSystemNotificationBlocked, permissionSummary, subscriptionNewsTargets } from '../../utils/settings/alerts'

interface Options {
  status: ReturnType<typeof useAuth>['status']
  accessToken: string | null
  logout: () => void
  settings: ReturnType<typeof useSettings>['settings']
  toggleSubscriptionAlert: () => void
  isDeptAlertOn: (id: string) => boolean
  toggleDeptAlert: (id: string) => void
  toast: ReturnType<typeof useToast>
  /** 구독한 게시판이 없을 때 '구독 알림'을 누르면 구독 관리를 연다. */
  openSubscriptions: () => void
}

/**
 * 설정 > 알림 묶음: 휴대폰 알림 권한, 전체 알림·구독 알림 스위치, 게스트 안내, 관리자 알림, 제보 키워드.
 */
export function useSettingsAlerts({
  status,
  accessToken,
  logout,
  settings,
  toggleSubscriptionAlert,
  isDeptAlertOn,
  toggleDeptAlert,
  toast,
  openSubscriptions,
}: Options) {
  const permission = useNotificationPermission()
  // 휴대폰 설정에서 알림이 막혀 있으면 앱 안 스위치가 켜져 있어도 알림이 오지 않는다.
  const systemBlocked = isSystemNotificationBlocked(permission)

  /** 앱 알림을 켤 때 휴대폰 권한을 아직 묻지 않았으면 그때 시스템 창을 띄운다. */
  const handleToggleSubscriptionAlert = () => {
    if (status !== 'authenticated') {
      promptLogin('알림은 로그인 후 받을 수 있어요.', logout)
      return
    }
    const turningOn = !settings.subscriptionAlert
    toggleSubscriptionAlert() // 진동은 ToggleSwitch 가 켤 때만 낸다(두 번 울리지 않게).
    toast.show(
      turningOn
        ? { message: '알림을 켰어요' }
        : { message: '알림을 껐어요', tone: 'info' },
    )
    if (turningOn && permission.status === 'undetermined' && permission.canAskAgain && status === 'authenticated') {
      void requestNotificationPermission()
    }
  }

  /** 거절된 뒤에는 앱이 다시 물을 수 없어(iOS) 휴대폰 설정 화면으로 보낸다. 아직 물을 수 있으면 바로 묻는다. */
  const handleFixSystemPermission = () => {
    if ((permission.status === 'undetermined' || permission.status === 'denied') && permission.canAskAgain) {
      void requestNotificationPermission()
      return
    }
    Linking.openSettings().catch(() => notify('설정을 열지 못했어요', '휴대폰 설정 > 홍익온 > 알림에서 허용해 주세요.'))
  }

  const { subscribedDepts } = settings
  // 게스트에게는 알림 값을 모두 꺼짐으로 보여 준다(아래 promptAlertLogin 주석). 저장값은 건드리지 않는다.
  const loggedIn = status === 'authenticated'
  const subscriptionAlert = loggedIn && settings.subscriptionAlert
  const reportStatusAlert = loggedIn && settings.reportStatusAlert
  const newReportAlert = loggedIn && settings.newReportAlert
  const alertCategories = loggedIn ? settings.alertCategories : []
  const isGuest = status !== 'authenticated'
  /**
   * 알림은 로그인해야 받는다(푸시 기기 등록·알림 설정 모두 계정에 저장). 게스트에게는 알림 스위치를 모두 꺼짐으로
   * 흐리게 보여 주고, 누르면 로그인을 권한다. 기기에 남은 값(게스트 기본값)은 보여 주지 않는다 — 로그인하면
   * 계정에 저장된 알림 설정을 불러온다.
   */
  const promptAlertLogin = () => promptLogin('알림은 로그인 후 받을 수 있어요.', logout)
  const guarded = (action: () => void) => (isGuest ? promptAlertLogin : action)
  // 관리자 알림 스위치 — 관리자 계정에만, 서버가 이 설정을 알 때만(모르면 숨김) 보인다.
  const isAdmin = useIsAdmin()
  const adminAlert = useAdminAlertSetting(isAdmin)
  // 새 제보 알림 범위·제보 키워드. 로그인 + 스위치 켜짐일 때만 불러와 보여 준다.
  // 개발 웹 `?mock=1` 에선 로그인 없이도 목업으로 보여 준다(운영 빌드는 늘 false).
  const [reportKeywordMock] = useState(isReportKeywordsMock)
  const showReportKeywords = newReportAlert || reportKeywordMock
  const reportKeywords = useReportKeywordAlerts(
    showReportKeywords,
    reportKeywordMock && !accessToken ? 'mock' : accessToken,
  )
  const keywordScopeOn = showReportKeywords && reportKeywords.status === 'ready' && reportKeywords.scope === 'KEYWORDS'

  // 전체 알림이 꺼져 있으면 아래 세부 설정은 지금 효과가 없다. 미리 고를 수 있게 누를 수는 두고 흐리게만 보인다.
  // 게스트는 subscriptionAlert 가 늘 false 라 함께 흐려진다.
  const detailDimmed = !subscriptionAlert

  const alertOnCount = loggedIn ? subscribedDepts.filter(isDeptAlertOn).length : 0
  // '구독 알림'(알림 설정 아래 첫 줄): 구독한 게시판 알림을 한 번에 켜고 끈다 — 게시판별 알림 창의 "모두 켜기/끄기"와 같다.
  // 하나라도 켜져 있으면 켜짐으로 본다. 구독한 게시판이 없으면 구독 관리를 연다.
  const subscriptionNewsOn = alertOnCount > 0
  const handleToggleSubscriptionNews = () => {
    if (subscribedDepts.length === 0) {
      openSubscriptions()
      return
    }
    // guarded 로만 불려 늘 로그인 상태다 — 이때 켜진 게시판이 하나라도 있으면(= subscriptionNewsOn) 모두 끈다.
    const { next, targets } = subscriptionNewsTargets(subscribedDepts, isDeptAlertOn)
    for (const id of targets) toggleDeptAlert(id)
    haptics.tapLight()
    toast.show(next ? { message: '구독 알림을 켰어요' } : { message: '구독 알림을 껐어요', tone: 'info' })
  }

  return {
    permission,
    systemBlocked,
    permissionSummary: permissionSummary(permission),
    handleToggleSubscriptionAlert,
    handleFixSystemPermission,
    loggedIn,
    isGuest,
    subscriptionAlert,
    reportStatusAlert,
    newReportAlert,
    alertCategories,
    promptAlertLogin,
    guarded,
    isAdmin,
    adminAlert,
    showReportKeywords,
    reportKeywords,
    keywordScopeOn,
    detailDimmed,
    alertOnCount,
    subscriptionNewsOn,
    handleToggleSubscriptionNews,
  }
}

export type SettingsAlerts = ReturnType<typeof useSettingsAlerts>
