import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Linking,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { useFocusEffect, useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { COLORS } from '../constants/colors'
import { layoutStyles } from '../constants/layout'
import { useSettings, ALL_CATEGORIES } from '../contexts/SettingsContext'
import { useAuth } from '../contexts/AuthContext'
import SubscriptionManagerModal from '../components/settings/SubscriptionManagerModal'
import BoardAlertsModal from '../components/settings/BoardAlertsModal'
import ToggleSwitch from '../components/settings/ToggleSwitch'
import NoticeDetailModal from '../components/settings/NoticeDetailModal'
import NoticeListModal from '../components/settings/NoticeListModal'
import PartnerSourcesModal from '../components/settings/PartnerSourcesModal'
import TermsModal from '../components/settings/TermsModal'
import LicensesModal from '../components/settings/LicensesModal'
import SupportModal from '../components/settings/SupportModal'
import WithdrawConfirmDialog from '../components/settings/WithdrawConfirmDialog'
import PrivacyModal from '../components/settings/PrivacyModal'
import FeedbackModal from '../components/settings/FeedbackModal'
import OfficialRequestModal from '../components/settings/OfficialRequestModal'
import InfoSuggestModal from '../components/settings/InfoSuggestModal'
import AppPermissionsModal from '../components/settings/AppPermissionsModal'
import KeywordAlertsModal from '../components/settings/KeywordAlertsModal'
import NicknameModal from '../components/settings/NicknameModal'
import HiddenUsersModal from '../components/settings/HiddenUsersModal'
import MyReportsModal from '../components/settings/MyReportsModal'
import { UpdateHistoryRow } from '../components/settings/UpdateHistoryModal'
import { useHiddenAuthors } from '../lib/hiddenAuthors'
import { useIsAdmin } from '../admin/AdminAccess'
import { useAdminAlertSetting } from '../hooks/useAdminAlertSetting'
import { getUserIdFromToken } from '../lib/jwt'
import ListRow from '../components/common/ListRow'
import SectionTitle from '../components/common/SectionTitle'
import { LargeTitleHeader } from '../components/common/ScreenHeader'
import {
  getMyMemberCode,
  getMyProfile,
  isMemberCodeApiKnownMissing,
  isNicknameApiKnownMissing,
  type MyProfile,
} from '../apis/users'
import { useApiResource } from '../hooks/useApiResource'
import { getMyReportCount, isMyReportsApiKnownMissing, type MyReportCount } from '../apis/myReports'
import { consumeSettingsIntent, subscribeSettingsIntent } from '../lib/settingsIntents'
import { useToast } from '../components/common/Toast'
import { useFeedbackToggles } from '../hooks/useFeedbackToggles'
import { requestMapIntent } from '../lib/mapIntents'
import { SHOW_DEVELOPER_TOOLS } from '../lib/appVariant'
import { confirmAction, notify } from '../utils/dialog'
import { promptLogin } from '../utils/reports'
import { requestNotificationPermission, useNotificationPermission } from '../lib/notificationPermission'
import { APP_NOTICES, type AppNotice } from '../constants/appNotices'
import { UNOFFICIAL_NOTICE } from '../constants/disclaimer'
import { PARTNER_SOURCES } from '../constants/partnerSources'
import { FONTS, TYPE } from '../constants/typography'
import { RADIUS, SPACING } from '../constants/spacing'
import type { RootStackParamList } from '../navigation/RootNavigator'
import LogotypeHorizontal from '../../assets/brand/logotype-horizontal.svg'

type NavProp = NativeStackNavigationProp<RootStackParamList>

type ModalType =
  | 'notices'
  | 'noticeDetail'
  | 'sources'
  | 'terms'
  | 'licenses'
  | 'support'
  | 'privacy'
  | 'feedback'
  | 'infoSuggest'
  | 'permissions'
  | 'keywords'
  | 'nickname'
  | 'hiddenUsers'
  | 'myReports'
  | 'official'
  | null

export default function SettingsScreen() {
  const {
    settings,
    toggleSubscriptionAlert,
    isDeptAlertOn,
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

  const [activeModal, setActiveModal] = useState<ModalType>(null)
  const [subManagerVisible, setSubManagerVisible] = useState(false)
  const [boardAlertsVisible, setBoardAlertsVisible] = useState(false)
  const [selectedNotice, setSelectedNotice] = useState<AppNotice | null>(null)

  const handleLogout = () => {
    confirmAction({
      title: '로그아웃',
      message: '로그아웃할까요?',
      confirmLabel: '로그아웃',
      destructive: true,
      onConfirm: () => {
        void logout()
      },
    })
  }

  // 게스트는 로그인된 게 없으니 확인 없이 바로 웰컴 화면으로 보낸다.
  // logout() 이 토큰·게스트 플래그를 함께 지워 signedOut 상태로 돌려놓는다.
  const handleGoToLogin = () => {
    logout()
  }

  // 탈퇴 확인은 WithdrawConfirmDialog(빨간 경고, '아니요'가 메인 컬러). 설정 맨 아래 링크와 고객 지원 › 계정 삭제 안내가 같이 쓴다.
  const [withdrawVisible, setWithdrawVisible] = useState(false)
  const handleDeleteAccount = () => setWithdrawVisible(true)

  const withdraw = async () => {
    try {
      await deleteAccount()
      setWithdrawVisible(false)
      setActiveModal(null)
    } catch (error) {
      const message = error instanceof Error ? error.message : '탈퇴 처리 중 오류가 생겼어요.'
      notify('탈퇴 실패', message)
    }
  }

  // 회원 번호. 서버가 주는 공개 번호(K7Q2M9XA4D)를 보여 주고, 서버 배포 전에는 예전처럼 토큰 sub(= userId)를 #123 으로 보여 준다.
  // 누르는 동작 없이 보여 주기만 한다. 토큰이 이상하면 줄을 숨긴다.
  const memberId = useMemo(() => getUserIdFromToken(accessToken), [accessToken])

  const handleReset = () => {
    confirmAction({
      title: '설정 초기화',
      message: '모든 설정이 기본값으로 되돌아가요. 계속할까요?',
      confirmLabel: '초기화',
      destructive: true,
      onConfirm: () => {
        void resetSettings()
      },
    })
  }

  const openNoticeDetail = (notice: AppNotice) => {
    setSelectedNotice(notice)
    setActiveModal('noticeDetail')
  }

  const permission = useNotificationPermission()
  // 휴대폰 설정에서 알림이 막혀 있으면 앱 안 스위치가 켜져 있어도 알림이 오지 않는다.
  const systemBlocked = permission.status === 'denied' || permission.status === 'undetermined'

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
        ? { message: '구독 소식 알림을 켰어요' }
        : { message: '구독 소식 알림을 껐어요', tone: 'info' },
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
  // 게스트에게는 알림 값을 모두 꺼짐으로 보여 준다(위 promptAlertLogin 주석). 저장값은 건드리지 않는다.
  const loggedIn = status === 'authenticated'
  const subscriptionAlert = loggedIn && settings.subscriptionAlert
  const reportStatusAlert = loggedIn && settings.reportStatusAlert
  const newReportAlert = loggedIn && settings.newReportAlert
  const alertCategories = loggedIn ? settings.alertCategories : []
  // 알림 권한이 꺼져 있으면 '앱 권한' 줄에 바로 보여 찾아 들어가게 한다.
  const permissionSummary =
    permission.status === 'granted'
      ? undefined
      : permission.status === 'denied'
        ? '알림 꺼짐'
        : permission.status === 'undetermined'
          ? '알림 확인 필요'
          : undefined
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

  // 앱 닉네임. 백엔드에 API 가 아직 없으면(배포 전) 줄을 숨긴다.
  // 토큰은 ref 로 읽는다. deps 에 넣으면 401 → 재발급으로 토큰이 바뀔 때마다 다시 불러, 배포 전 서버(없는 경로에 401)에서
  // 재발급이 꼬리를 문다. 재발급 뒤 재요청은 client 가 알아서 한다.
  const accessTokenRef = useRef(accessToken)
  accessTokenRef.current = accessToken
  const profileResource = useApiResource<MyProfile>(
    (signal) => getMyProfile(accessTokenRef.current as string, signal),
    [isGuest],
    { enabled: !isGuest && !!accessToken && !isNicknameApiKnownMissing(), refetchOnForeground: false },
  )
  // 저장 직후 응답을 바로 보여 주고, 다음 조회 결과가 오면 그걸 따른다.
  const [savedProfile, setSavedProfile] = useState<MyProfile | null>(null)
  useEffect(() => setSavedProfile(null), [profileResource.data])
  const profile = savedProfile ?? profileResource.data
  const nicknameApiMissing = !profile && isNicknameApiKnownMissing()
  // 계정 정보를 받아 왔을 때만(구서버라 닉네임 API 가 없으면 예전처럼) 닉네임·내 제보 내역을 보인다.
  // 토큰이 만료됐거나 서버에 닿지 않아 못 받아 오면 두 줄을 숨긴다('불러오지 못함' 줄을 남기지 않는다).
  const accountLoaded = profile != null || nicknameApiMissing

  // 공개 회원 번호. 닉네임과 같은 이유로 토큰은 ref 로 읽고, API 가 없으면(배포 전) 다시 부르지 않는다.
  const memberCodeResource = useApiResource<string | null>(
    (signal) => getMyMemberCode(accessTokenRef.current as string, signal),
    [isGuest],
    { enabled: !isGuest && !!accessToken && !isMemberCodeApiKnownMissing(), refetchOnForeground: false },
  )
  const memberCode = memberCodeResource.data ?? profile?.memberCode ?? null
  // 서버에 회원 번호가 없을 때(배포 전·빈 값)만 예전 #id 표시로 돌아간다. 불러오는 중·일시 오류에는 id 를 내보이지 않는다.
  const memberCodeFallback =
    !memberCode && (isMemberCodeApiKnownMissing() || memberCodeResource.data === null)
  const memberNumber = memberCode ?? (memberCodeFallback && memberId !== null ? `#${memberId}` : null)

  // 내 제보 내역. 개수(승인 대기 배지)를 먼저 받아, 서버에 API 가 없으면(배포 전 404/405/재발급 뒤 401) 줄을 숨긴다.
  const myReportCountResource = useApiResource<MyReportCount>(
    (signal) => getMyReportCount(accessTokenRef.current as string, signal),
    [isGuest],
    { enabled: !isGuest && !!accessToken && !isMyReportsApiKnownMissing() },
  )
  const myReportsApiMissing = isMyReportsApiKnownMissing()
  const myReportPending = myReportCountResource.data?.pending ?? 0
  /** 반려 알림으로 들어왔을 때 내역에서 강조할 제보 */
  const [highlightReportId, setHighlightReportId] = useState<number | null>(null)

  // 알림(반려) 탭 → 설정 탭으로 넘어와 내 제보 내역을 연다(`lib/settingsIntents.ts`). 게스트면 무시한다.
  const handleSettingsIntent = useCallback(() => {
    const intent = consumeSettingsIntent()
    if (intent?.type !== 'openMyReports' || isGuest) return
    setHighlightReportId(intent.reportId)
    setActiveModal('myReports')
  }, [isGuest])
  useFocusEffect(handleSettingsIntent)
  useEffect(() => subscribeSettingsIntent(handleSettingsIntent), [handleSettingsIntent])

  const goToMap = (afterClose: () => void) => {
    setActiveModal(null)
    afterClose()
    // 설정은 하단 탭 안의 화면이라 탭 이름(Map)으로 이동하면 부모 탭 내비게이터가 처리한다.
    ;(navigation as unknown as { navigate: (name: string) => void }).navigate('Map')
  }
  // 전체 알림이 꺼져 있으면 아래 세부 설정은 지금 효과가 없다. 미리 고를 수 있게 누를 수는 두고 흐리게만 보인다.
  // 게스트는 subscriptionAlert 가 늘 false 라 함께 흐려진다.
  const detailDimmed = !subscriptionAlert

  const alertOnCount = loggedIn ? subscribedDepts.filter(isDeptAlertOn).length : 0

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <LargeTitleHeader title="설정" style={layoutStyles.readable} />
      <ScrollView style={styles.scroll} contentContainerStyle={layoutStyles.readable}>

        {/* 이용 제한(약관 제10조): 사유와 이의 제기 방법을 맨 위에 알린다. 서버가 정지 알림 푸시도 보낸다. */}
        {status === 'authenticated' && profile?.status === 'SUSPENDED' && (
          <View style={styles.suspendedBox} accessibilityRole="alert">
            <Ionicons name="alert-circle" size={18} color={COLORS.danger} />
            <View style={styles.suspendedBody}>
              <Text style={styles.suspendedTitle}>이용이 제한된 계정이에요</Text>
              <Text style={styles.suspendedText}>
                {profile.suspendedReason ? `사유: ${profile.suspendedReason}\n` : ''}
                제보·신고·문의를 할 수 없어요. 이의가 있으면 제한 알림을 받은 날부터 14일 안에 hongikonsupport@gmail.com 으로 알려 주세요.
              </Text>
            </View>
          </View>
        )}

        <View style={styles.section}>
          <SectionTitle title="계정" />
          {status === 'authenticated' ? (
            <>
              <ListRow
                icon="person-circle-outline"
                label={loginProvider === 'apple' ? 'Apple 계정으로 로그인됨' : '카카오 계정으로 로그인됨'}
              />
              {!nicknameApiMissing && (profile || profileResource.loading) && (
                <ListRow
                  icon="happy-outline"
                  label="닉네임"
                  value={profile ? profile.displayName : '불러오는 중'}
                  onPress={profile ? () => setActiveModal('nickname') : undefined}
                />
              )}
              {memberId !== null && (
                <ListRow
                  icon="id-card-outline"
                  label="회원 번호"
                  value={
                    memberNumber ?? (memberCodeResource.loading ? '불러오는 중' : '불러오지 못함')
                  }
                  accessibilityLabel={memberNumber ? `회원 번호 ${memberNumber.replace(/^#/, '')}` : '회원 번호'}
                />
              )}
              {/* 공식 계정(학생회 등): 인증됐으면 공식 이름과 배지, 아니면 신청 창. 이 기능 전 서버는 키가 없어 신청 줄만 보인다. */}
              {profile && profile.officialName ? (
                <ListRow
                  icon="shield-checkmark-outline"
                  label="공식 계정"
                  value={profile.officialName}
                  accessibilityLabel={`공식 계정, ${profile.officialName}`}
                />
              ) : profile ? (
                <ListRow
                  icon="shield-checkmark-outline"
                  label="공식 계정 신청"
                  value="학생회·단체"
                  onPress={() => setActiveModal('official')}
                />
              ) : null}
              {accountLoaded && !myReportsApiMissing && (
                <ListRow
                  icon="megaphone-outline"
                  label="내 제보 내역"
                  badge={myReportPending > 0 ? `승인 대기 ${myReportPending > 99 ? '99+' : myReportPending}` : undefined}
                  onPress={() => {
                    setHighlightReportId(null)
                    setActiveModal('myReports')
                  }}
                  accessibilityLabel={myReportPending > 0 ? `내 제보 내역, 승인 대기 ${myReportPending}건` : '내 제보 내역'}
                />
              )}
              <ListRow icon="log-out-outline" label="로그아웃" danger last onPress={handleLogout} />
            </>
          ) : (
            <ListRow
              icon="log-in-outline"
              label="로그인하기"
              value="게스트로 이용 중"
              last
              onPress={handleGoToLogin}
            />
          )}
        </View>

        <View style={styles.section}>
          <SectionTitle title="알림" />
          {isGuest && (
            <View style={styles.guestNotice}>
              <Ionicons name="lock-closed-outline" size={15} color={COLORS.primary} />
              <View style={styles.guestNoticeBody}>
                <Text style={styles.guestNoticeTitle}>알림은 로그인 후 받을 수 있어요</Text>
                <Text style={styles.guestNoticeText}>
                  로그인하면 계정에 저장된 알림 설정을 불러와요. 구독한 게시판은 로그인하지 않아도 소식 탭에서 볼 수 있어요.
                </Text>
              </View>
              {/* 로그인 버튼은 바로 위 계정 섹션의 "로그인하기" 하나만 둔다(같은 기능 중복 방지). */}
            </View>
          )}
          <ListRow
            icon="notifications-outline"
            label="구독 소식 알림"
            description={
              isGuest
                ? '로그인하면 켤 수 있어요'
                : subscriptionAlert
                  ? '켜 둔 게시판의 새 소식과 제보 알림을 보내드려요'
                  : '꺼져 있어 아래 설정과 관계없이 알림이 오지 않아요'
            }
            last
            right={
              <ToggleSwitch
                value={subscriptionAlert}
                dimmed={isGuest}
                onToggle={handleToggleSubscriptionAlert}
                locked={isGuest}
                accessibilityLabel="구독 소식 알림"
              />
            }
          />
          {subscriptionAlert && status === 'authenticated' && systemBlocked && (
            <View style={styles.permissionCard}>
              <Ionicons name="alert-circle-outline" size={18} color={COLORS.warningIcon} />
              <Text style={styles.permissionText}>
                {permission.status === 'denied'
                  ? '휴대폰 설정에서 홍익온 알림이 꺼져 있어 알림이 오지 않아요.'
                  : '알림을 받으려면 휴대폰 알림 권한을 허용해 주세요.'}
              </Text>
              <TouchableOpacity
                onPress={handleFixSystemPermission}
                accessibilityRole="button"
                accessibilityLabel={permission.status === 'denied' && !permission.canAskAgain ? '휴대폰 설정 열기' : '알림 허용하기'}
              >
                <Text style={styles.permissionAction}>
                  {permission.status === 'denied' && !permission.canAskAgain ? '설정 열기' : '허용하기'}
                </Text>
              </TouchableOpacity>
            </View>
          )}
          {/* 제보 알림. 기기 위치(GPS)를 쓰지 않아 "근처" 대신 캠퍼스 전체 단위로 받는다. */}
          <View style={[styles.subGroup, detailDimmed && styles.dimmed]}>
            <Text style={styles.subGroupTitle}>제보 알림</Text>
            <ListRow
              icon="checkmark-done-outline"
              label="내 제보 결과 알림"
              description="올린 제보가 지도에 올라가거나 반려되면, 내 제보에 댓글이나 내 댓글에 답글이 달리거나 공감이 모이면 알려드려요"
              right={
                <ToggleSwitch
                  value={reportStatusAlert}
                  onToggle={guarded(toggleReportStatusAlert)}
                  locked={isGuest}
                  accessibilityLabel={`내 제보 결과 알림 ${reportStatusAlert ? '켜짐' : '꺼짐'}`}
                />
              }
            />
            <ListRow
              icon="megaphone-outline"
              label="캠퍼스 새 제보 알림"
              description="운영진이 확인한 새 제보가 지도에 올라오면 알려드려요. 여러 건이 몰려도 알림은 30분에 한 번만 와요."
              last
              right={
                <ToggleSwitch
                  value={newReportAlert}
                  onToggle={guarded(toggleNewReportAlert)}
                  locked={isGuest}
                  accessibilityLabel={`캠퍼스 새 제보 알림 ${newReportAlert ? '켜짐' : '꺼짐'}`}
                />
              }
            />
          </View>
          {isAdmin && adminAlert.state.status !== 'unsupported' && (
            <View style={[styles.subGroup, detailDimmed && styles.dimmed]}>
              <Text style={styles.subGroupTitle}>관리자</Text>
              <ListRow
                icon="shield-checkmark-outline"
                label="관리자 알림"
                description="새 제보 승인 대기·새 문의·신고로 자동 숨김된 제보를 알려드려요. 몰리면 2분에 한 번 묶어서 와요."
                value={
                  adminAlert.state.status === 'loading'
                    ? '불러오는 중'
                    : adminAlert.state.status === 'error'
                      ? '다시 시도'
                      : undefined
                }
                onPress={adminAlert.state.status === 'error' ? adminAlert.retry : undefined}
                last
                right={
                  adminAlert.state.status === 'ready' ? (
                    <ToggleSwitch
                      value={adminAlert.state.enabled}
                      onToggle={adminAlert.toggle}
                      accessibilityLabel={`관리자 알림 ${adminAlert.state.enabled ? '켜짐' : '꺼짐'}`}
                    />
                  ) : undefined
                }
              />
            </View>
          )}
        </View>

        <View style={styles.section}>
          <SectionTitle title="구독 게시판" />
          <ListRow
            icon="bookmarks-outline"
            label="구독 관리"
            value={subscribedDepts.length > 0 ? `${subscribedDepts.length}개` : '기관·학과 추가'}
            onPress={() => setSubManagerVisible(true)}
          />
          {/* 키워드는 서버에만 저장해 게스트는 열지 않고 로그인 안내만 한다. */}
          <ListRow
            icon="pricetag-outline"
            label="키워드 알림"
            value={isGuest ? '로그인 후 사용' : undefined}
            onPress={() =>
              isGuest
                ? notify('키워드 알림', '키워드 알림은 로그인 후 쓸 수 있어요.')
                : setActiveModal('keywords')
            }
          />
          {/* 구독이 많으면 목록이 끝없이 길어져 게시판별 알림은 따로 연다(BoardAlertsModal). 게스트는 로그인을 권한다. */}
          <ListRow
            icon="notifications-circle-outline"
            label="게시판별 알림"
            value={
              isGuest
                ? '로그인 후 사용'
                : subscribedDepts.length > 0
                  ? `${alertOnCount}/${subscribedDepts.length} 켜짐`
                  : '구독한 게시판 없음'
            }
            last
            style={detailDimmed ? styles.dimmed : undefined}
            onPress={isGuest ? promptAlertLogin : () => setBoardAlertsVisible(true)}
          />
        </View>

        <View style={styles.section}>
          <SectionTitle
            title="알림 받을 분야"
            meta={isGuest ? '로그인 후 사용' : `${alertCategories.length}/${ALL_CATEGORIES.length}`}
            description="구독한 게시판의 새 소식 중 선택한 분야만 알려드려요"
            style={styles.sectionTitleWithDesc}
          />
          <View style={[styles.categoryGrid, detailDimmed && styles.dimmed]}>
            {ALL_CATEGORIES.map((cat) => {
              const isOn = alertCategories.includes(cat)
              // 켜진 분야는 분야별 색 대신 앱 기본색(남색)으로 통일한다.
              return (
                <TouchableOpacity
                  key={cat}
                  style={[
                    styles.categoryChip,
                    isOn ? styles.categoryChipOn : styles.categoryChipOff,
                  ]}
                  onPress={guarded(() => toggleAlertCategory(cat))}
                  activeOpacity={0.7}
                  accessibilityRole="switch"
                  accessibilityLabel={`${cat} 분야 알림 ${isOn ? '켜짐' : '꺼짐'}`}
                  accessibilityState={{ checked: isOn }}
                >
                  <Ionicons
                    name={isOn ? 'checkmark-circle' : 'ellipse-outline'}
                    size={14}
                    color={isOn ? COLORS.primary : COLORS.textTertiary}
                  />
                  <Text style={[styles.categoryChipText, { color: isOn ? COLORS.primary : COLORS.textTertiary }]}>
                    {cat}
                  </Text>
                </TouchableOpacity>
              )
            })}
          </View>
          {loggedIn && alertCategories.length === 0 && (
            <View style={styles.warnRow}>
              <Ionicons name="alert-circle-outline" size={14} color={COLORS.danger} />
              <Text style={styles.warnText}>선택한 분야가 없어 새 소식 알림이 오지 않아요</Text>
            </View>
          )}
        </View>

        <View style={styles.section}>
          <SectionTitle title="일반" />
          <ListRow
            icon="key-outline"
            label="앱 권한"
            value={permissionSummary}
            onPress={() => setActiveModal('permissions')}
          />
          <ListRow
            icon="megaphone-outline"
            label="공지사항"
            onPress={() => setActiveModal('notices')}
          />
          <UpdateHistoryRow />
          <ListRow
            icon="logo-instagram"
            label="제휴 출처"
            value={`${PARTNER_SOURCES.length}개 소속`}
            onPress={() => setActiveModal('sources')}
          />
          <ListRow
            icon="storefront-outline"
            label="정보 제보하기"
            onPress={() => setActiveModal('infoSuggest')}
          />
          <ListRow
            icon="eye-off-outline"
            label="숨긴 사용자"
            value={hiddenAuthors.length > 0 ? `${hiddenAuthors.length}명` : undefined}
            onPress={() => setActiveModal('hiddenUsers')}
          />
          <ListRow icon="document-text-outline" label="이용약관" onPress={() => setActiveModal('terms')} />
          <ListRow icon="school-outline" label="학교" value="홍익대학교" />
          {/* 개발자용 화면이라 운영 빌드에서는 숨긴다(개발 서버·개발/테스트 빌드에서만 보임). */}
          {SHOW_DEVELOPER_TOOLS && (
            <ListRow
              icon="pulse-outline"
              label="앱 상태 확인"
              onPress={() => navigation.navigate('AppStatus')}
            />
          )}
          <ListRow icon="shield-checkmark-outline" label="개인정보 처리방침" onPress={() => setActiveModal('privacy')} />
          <ListRow icon="help-buoy-outline" label="고객 지원" value="문의·자주 묻는 질문" onPress={() => setActiveModal('support')} />
          <ListRow icon="chatbubble-ellipses-outline" label="문의하기" onPress={() => setActiveModal('feedback')} />
          <ListRow icon="code-slash-outline" label="오픈소스 라이선스" onPress={() => setActiveModal('licenses')} />
          <ListRow icon="refresh-outline" label="설정 초기화" danger last={status !== 'authenticated'} onPress={handleReset} />
          {/* 회원 탈퇴는 설정 초기화 바로 아래. 누르면 WithdrawConfirmDialog(탈퇴를 말리는 쪽)가 뜬다. */}
          {status === 'authenticated' && (
            <ListRow icon="person-remove-outline" label="회원 탈퇴" danger last onPress={handleDeleteAccount} />
          )}
        </View>

        <View style={styles.brandFooter} accessibilityLabel="HONGIK ON">
          <LogotypeHorizontal width={112} height={20} />
        </View>
        <Text style={styles.unofficialNotice}>{UNOFFICIAL_NOTICE}</Text>

        <View style={styles.bottomSpacer} />
      </ScrollView>

      <NoticeDetailModal
        visible={activeModal === 'noticeDetail'}
        notice={selectedNotice}
        onClose={() => setActiveModal(null)}
      />

      <NoticeListModal
        visible={activeModal === 'notices'}
        notices={APP_NOTICES}
        onClose={() => setActiveModal(null)}
        onSelectNotice={openNoticeDetail}
      />

      <PartnerSourcesModal
        visible={activeModal === 'sources'}
        onClose={() => setActiveModal(null)}
      />

      <TermsModal visible={activeModal === 'terms'} onClose={() => setActiveModal(null)} />
      <LicensesModal visible={activeModal === 'licenses'} onClose={() => setActiveModal(null)} />

      <PrivacyModal visible={activeModal === 'privacy'} onClose={() => setActiveModal(null)} />

      <HiddenUsersModal visible={activeModal === 'hiddenUsers'} onClose={() => setActiveModal(null)} />

      {!isGuest && (
        <MyReportsModal
          visible={activeModal === 'myReports'}
          onClose={() => setActiveModal(null)}
          highlightReportId={highlightReportId}
          onChanged={myReportCountResource.retry}
          onShowOnMap={(reportId) => goToMap(() => requestMapIntent({ type: 'focusReport', reportId }))}
          onStartReport={() => goToMap(() => requestMapIntent({ type: 'startReport' }))}
        />
      )}

      <InfoSuggestModal
        visible={activeModal === 'infoSuggest'}
        onClose={() => setActiveModal(null)}
        onPickOnMap={() => {
          // 창을 닫고 지도 탭으로 옮겨 핀을 고르게 한다. 지도 화면이 요청을 받아 같은 제보 창을 다시 연다.
          setActiveModal(null)
          requestMapIntent({ type: 'pickPartnerLocation' })
          // 설정은 하단 탭 안의 화면이라 탭 이름(Map)으로 이동하면 부모 탭 내비게이터가 처리한다.
          ;(navigation as unknown as { navigate: (name: string) => void }).navigate('Map')
        }}
      />

      <FeedbackModal visible={activeModal === 'feedback'} onClose={() => setActiveModal(null)} />
      <OfficialRequestModal
        visible={activeModal === 'official'}
        onClose={() => setActiveModal(null)}
        memberNumber={memberNumber}
        currentName={profile?.displayName ?? null}
      />
      {/* 고객 지원 › 앱에서 문의 보내기는 이 창을 닫고 문의하기 창을 연다(공지 목록 › 상세와 같은 방식). */}
      <SupportModal
        visible={activeModal === 'support'}
        onClose={() => setActiveModal(null)}
        onOpenFeedback={() => setActiveModal('feedback')}
        isMember={status === 'authenticated'}
        onWithdraw={withdraw}
      />
      <WithdrawConfirmDialog
        visible={withdrawVisible && activeModal !== 'support'}
        onCancel={() => setWithdrawVisible(false)}
        onConfirm={withdraw}
      />

      <AppPermissionsModal visible={activeModal === 'permissions'} onClose={() => setActiveModal(null)} />

      <KeywordAlertsModal visible={activeModal === 'keywords'} onClose={() => setActiveModal(null)} />

      {profile && (
        <NicknameModal
          visible={activeModal === 'nickname'}
          profile={profile}
          onClose={() => setActiveModal(null)}
          onSaved={setSavedProfile}
        />
      )}

      <BoardAlertsModal
        visible={boardAlertsVisible}
        onClose={() => setBoardAlertsVisible(false)}
        onOpenSubscriptions={() => {
          // 네이티브 Modal 은 앞 창이 닫히는 중에 다음 창을 띄우면(iOS) 무시될 수 있어 닫힌 뒤에 연다.
          setBoardAlertsVisible(false)
          setTimeout(() => setSubManagerVisible(true), 400)
        }}
      />

      <SubscriptionManagerModal
        visible={subManagerVisible}
        onClose={() => setSubManagerVisible(false)}
        subscribedDepts={subscribedDepts}
        onToggleDept={toggleSubscribedDept}
      />
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  // SafeAreaView 상단 인셋·큰 제목 줄은 흰색, 그룹 리스트의 회색 배경은 scroll 이 직접 칠한다.
  container: { flex: 1, backgroundColor: COLORS.white },
  scroll: { flex: 1, backgroundColor: COLORS.background },
  section: { backgroundColor: COLORS.white, marginBottom: SPACING.sm },
  sectionTitleWithDesc: { paddingBottom: SPACING.md },
  categoryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: SPACING.lg,
    paddingBottom: SPACING.lg,
    gap: SPACING.sm,
  },
  categoryChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    height: 34,
    paddingHorizontal: SPACING.md,
    borderRadius: RADIUS.pill,
    borderWidth: 1,
  },
  categoryChipOn: {
    backgroundColor: COLORS.primarySoft,
    borderColor: COLORS.primary,
  },
  categoryChipOff: {
    backgroundColor: COLORS.fill,
    borderColor: COLORS.border,
  },
  categoryChipText: { ...TYPE.label, fontSize: 13 },
  dimmed: { opacity: 0.45 },
  subGroup: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: COLORS.border },
  subGroupTitle: {
    ...TYPE.caption,
    fontFamily: FONTS.semibold,
    color: COLORS.textTertiary,
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.md,
  },
  guestNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
    marginHorizontal: SPACING.lg,
    marginTop: SPACING.xs,
    marginBottom: SPACING.xs,
    padding: SPACING.md,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.primarySoft,
  },
  guestNoticeBody: { flex: 1, gap: SPACING.xxs },
  guestNoticeTitle: { ...TYPE.callout, fontFamily: FONTS.semibold, color: COLORS.textPrimary },
  guestNoticeText: { ...TYPE.caption, color: COLORS.textSecondary },
  suspendedBox: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'flex-start',
    backgroundColor: COLORS.dangerSoft,
    borderRadius: 12,
    padding: SPACING.md,
    marginHorizontal: SPACING.lg,
    marginBottom: SPACING.md,
  },
  suspendedBody: { flex: 1, gap: 4 },
  suspendedTitle: { ...TYPE.subhead, color: COLORS.danger },
  suspendedText: { ...TYPE.caption, color: COLORS.danger },
  warnRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    paddingHorizontal: SPACING.lg,
    paddingBottom: SPACING.lg,
    marginTop: -SPACING.xs,
  },
  warnText: { ...TYPE.caption, color: COLORS.danger },
  brandFooter: { alignItems: 'center', paddingTop: SPACING.lg, opacity: 0.35 },
  unofficialNotice: {
    ...TYPE.caption,
    color: COLORS.textSecondary,
    textAlign: 'center',
    paddingHorizontal: SPACING.xxxl,
    marginTop: SPACING.sm,
  },
  permissionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    marginHorizontal: SPACING.lg,
    marginBottom: SPACING.md,
    padding: SPACING.md,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.warningSoft,
  },
  permissionText: { ...TYPE.caption, flex: 1, color: COLORS.warning },
  permissionAction: { ...TYPE.callout, fontFamily: FONTS.semibold, color: COLORS.primary },
  bottomSpacer: { height: SPACING.lg },
})
