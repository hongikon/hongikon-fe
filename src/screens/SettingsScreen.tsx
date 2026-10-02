import { useEffect, useMemo, useRef, useState } from 'react'
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Linking,
  Platform,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import Constants from 'expo-constants'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { COLORS, CATEGORY_COLORS } from '../constants/colors'
import { layoutStyles } from '../constants/layout'
import { useSettings, ALL_CATEGORIES } from '../contexts/SettingsContext'
import { useAuth } from '../contexts/AuthContext'
import SubscriptionManagerModal from '../components/settings/SubscriptionManagerModal'
import ToggleSwitch from '../components/settings/ToggleSwitch'
import NoticeDetailModal from '../components/settings/NoticeDetailModal'
import NoticeListModal from '../components/settings/NoticeListModal'
import PartnerSourcesModal from '../components/settings/PartnerSourcesModal'
import TermsModal from '../components/settings/TermsModal'
import PrivacyModal from '../components/settings/PrivacyModal'
import FeedbackModal from '../components/settings/FeedbackModal'
import PartnerSuggestModal from '../components/settings/PartnerSuggestModal'
import AppPermissionsModal from '../components/settings/AppPermissionsModal'
import KeywordAlertsModal from '../components/settings/KeywordAlertsModal'
import NicknameModal from '../components/settings/NicknameModal'
import HiddenUsersModal from '../components/settings/HiddenUsersModal'
import { useHiddenAuthors } from '../lib/hiddenAuthors'
import { useIsAdmin } from '../admin/AdminAccess'
import { useAdminAlertSetting } from '../hooks/useAdminAlertSetting'
import { getUserIdFromToken } from '../lib/jwt'
import { openSitePage } from '../utils/openSitePage'
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
import { useToast } from '../components/common/Toast'
import { useFeedbackToggles } from '../hooks/useFeedbackToggles'
import * as haptics from '../lib/haptics'
import { requestMapIntent } from '../lib/mapIntents'
import { SHOW_DEVELOPER_TOOLS } from '../lib/appVariant'
import { confirmAction, notify } from '../utils/dialog'
import { requestNotificationPermission, useNotificationPermission } from '../lib/notificationPermission'
import { APP_NOTICES, type AppNotice } from '../constants/appNotices'
import { UNOFFICIAL_NOTICE } from '../constants/disclaimer'
import { PARTNER_SOURCES } from '../constants/partnerSources'
import { SUBSCRIBABLE_ITEMS, groupSubscribableItems } from '../constants/news'
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
  | 'privacy'
  | 'feedback'
  | 'partnerSuggest'
  | 'permissions'
  | 'keywords'
  | 'nickname'
  | 'hiddenUsers'
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
    toggleDeptAlert,
    toggleReportStatusAlert,
    toggleNewReportAlert,
  } = useFeedbackToggles()
  const toast = useToast()
  const hiddenAuthors = useHiddenAuthors()

  const { status, loginProvider, logout, deleteAccount, accessToken } = useAuth()
  const navigation = useNavigation<NavProp>()

  const [activeModal, setActiveModal] = useState<ModalType>(null)
  const [subManagerVisible, setSubManagerVisible] = useState(false)
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

  const handleDeleteAccount = () => {
    confirmAction({
      title: '회원 탈퇴',
      message: '탈퇴하면 계정 정보와 구독·알림 설정이 삭제되고 되돌릴 수 없어요. 계속할까요?',
      confirmLabel: '탈퇴',
      destructive: true,
      onConfirm: async () => {
        try {
          await deleteAccount()
        } catch (error) {
          const message = error instanceof Error ? error.message : '탈퇴 처리 중 오류가 생겼어요.'
          notify('탈퇴 실패', message)
        }
      },
    })
  }

  // 회원 번호. 서버가 주는 공개 번호(K7Q2M9XA4D)를 보여 주고, 서버 배포 전에는 예전처럼 토큰 sub(= userId)를 #123 으로 보여 준다.
  // 관리자 지정·문의 때 알려 달라고 보여 준다. 토큰이 이상하면 줄을 숨긴다.
  const memberId = useMemo(() => getUserIdFromToken(accessToken), [accessToken])

  /**
   * 회원 번호 복사. 앱에는 클립보드 모듈(expo-clipboard)이 없어 — 넣으면 새 빌드가 필요하다 — 웹만 실제로 복사하고,
   * 앱은 토스트로 번호를 크게 보여 준다.
   */
  const handleCopyMemberNumber = async (text: string) => {
    haptics.tapLight()
    if (Platform.OS === 'web' && typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
      try {
        await navigator.clipboard.writeText(text.replace(/^#/, ''))
        toast.show({ message: `회원 번호를 복사했어요 · ${text}` })
        return
      } catch {
        // 권한이 막힌 브라우저 등은 아래처럼 번호만 보여 준다.
      }
    }
    toast.show({ message: `내 회원 번호 · ${text}`, tone: 'info' })
  }

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
    const turningOn = !settings.subscriptionAlert
    toggleSubscriptionAlert()
    haptics.tapLight()
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

  const { subscriptionAlert, alertCategories, subscribedDepts, reportStatusAlert, newReportAlert } = settings
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
  // 전체 알림이 꺼져 있으면 아래 세부 설정은 지금 효과가 없다. 미리 고를 수 있게 누를 수는 두고 흐리게만 보인다.
  const detailDimmed = !subscriptionAlert

  /** 구독한 게시판을 TREE_DATA 순서(단과대별)로 묶는다. 구독한 순서가 아니라 늘 같은 자리에 보이게 한다. */
  const subscribedGroups = useMemo(() => {
    const subscribed = new Set(subscribedDepts)
    return groupSubscribableItems(SUBSCRIBABLE_ITEMS.filter((item) => subscribed.has(item.id)))
  }, [subscribedDepts])
  const alertOnCount = subscribedDepts.filter(isDeptAlertOn).length

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <LargeTitleHeader title="설정" style={layoutStyles.readable} />
      <ScrollView style={styles.scroll} contentContainerStyle={layoutStyles.readable}>

        <View style={styles.section}>
          <SectionTitle title="계정" />
          {status === 'authenticated' ? (
            <>
              <ListRow
                icon="person-circle-outline"
                label={loginProvider === 'apple' ? 'Apple 계정으로 로그인됨' : '카카오 계정으로 로그인됨'}
              />
              {!nicknameApiMissing && (
                <ListRow
                  icon="happy-outline"
                  label="닉네임"
                  value={profile ? profile.displayName : profileResource.loading ? '불러오는 중' : '불러오지 못함'}
                  onPress={
                    profile
                      ? () => setActiveModal('nickname')
                      : profileResource.loading
                        ? undefined
                        : profileResource.retry
                  }
                />
              )}
              {memberId !== null && (
                <ListRow
                  icon="id-card-outline"
                  label="회원 번호"
                  value={
                    memberNumber ?? (memberCodeResource.loading ? '불러오는 중' : '불러오지 못함')
                  }
                  description="관리자 지정이나 문의할 때 이 번호를 알려 주세요."
                  onPress={
                    memberNumber
                      ? () => void handleCopyMemberNumber(memberNumber)
                      : memberCodeResource.loading
                        ? undefined
                        : memberCodeResource.retry
                  }
                  accessibilityLabel={
                    memberNumber
                      ? `회원 번호 ${memberNumber.replace(/^#/, '')}. ${Platform.OS === 'web' ? '눌러서 복사' : '눌러서 번호 보기'}`
                      : '회원 번호'
                  }
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
                  위 계정에서 로그인하면 지금 고른 게시판·분야·제보 알림 설정이 그대로 적용돼요.
                </Text>
              </View>
              {/* 로그인 버튼은 바로 위 계정 섹션의 "로그인하기" 하나만 둔다(같은 기능 중복 방지). */}
            </View>
          )}
          <ListRow
            icon="notifications-outline"
            label="구독 소식 알림"
            description={
              subscriptionAlert
                ? '켜 둔 게시판의 새 소식과 제보 알림을 보내드려요'
                : '꺼져 있어 아래 설정과 관계없이 알림이 오지 않아요'
            }
            last
            right={
              <ToggleSwitch
                value={subscriptionAlert}
                onToggle={handleToggleSubscriptionAlert}
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
              description="올린 제보가 지도에 올라가거나 반려되면 알려드려요"
              right={
                <ToggleSwitch
                  value={reportStatusAlert}
                  onToggle={toggleReportStatusAlert}
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
                  onToggle={toggleNewReportAlert}
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
          {subscribedGroups.length > 0 ? (
            <View style={[styles.boardList, detailDimmed && styles.dimmed]}>
              <View style={styles.boardListHead}>
                <Text style={styles.boardListTitle}>게시판별 알림</Text>
                <Text style={styles.boardListCount}>
                  {alertOnCount}/{subscribedDepts.length} 켜짐
                </Text>
              </View>
              {subscribedGroups.map((group) => (
                <View key={group.name} style={styles.boardGroup}>
                  <Text style={styles.boardGroupTitle}>{group.name}</Text>
                  {group.items.map((item) => {
                    const on = isDeptAlertOn(item.id)
                    return (
                      <View key={item.id} style={styles.boardRow}>
                        <Ionicons
                          name={on ? 'notifications' : 'notifications-off-outline'}
                          size={16}
                          color={on ? COLORS.primary : COLORS.iconMuted}
                        />
                        <Text
                          style={[styles.boardName, !on && styles.boardNameOff]}
                          numberOfLines={1}
                        >
                          {item.name}
                        </Text>
                        <ToggleSwitch
                          value={on}
                          onToggle={() => toggleDeptAlert(item.id)}
                          accessibilityLabel={`${item.name} 알림 ${on ? '켜짐' : '꺼짐'}`}
                        />
                      </View>
                    )
                  })}
                </View>
              ))}
            </View>
          ) : (
            <Text style={styles.emptyHint}>게시판을 구독하면 여기서 게시판마다 알림을 켜고 끌 수 있어요</Text>
          )}
        </View>

        <View style={styles.section}>
          <SectionTitle
            title="알림 받을 분야"
            meta={`${alertCategories.length}/${ALL_CATEGORIES.length}`}
            description="구독한 게시판의 새 소식 중 선택한 분야만 알려드려요"
            style={styles.sectionTitleWithDesc}
          />
          <View style={[styles.categoryGrid, detailDimmed && styles.dimmed]}>
            {ALL_CATEGORIES.map((cat) => {
              const isOn = alertCategories.includes(cat)
              const colors = CATEGORY_COLORS[cat]
              return (
                <TouchableOpacity
                  key={cat}
                  style={[
                    styles.categoryChip,
                    isOn
                      ? { backgroundColor: colors.bg, borderColor: colors.text }
                      : styles.categoryChipOff,
                  ]}
                  onPress={() => toggleAlertCategory(cat)}
                  activeOpacity={0.7}
                  accessibilityRole="switch"
                  accessibilityLabel={`${cat} 분야 알림 ${isOn ? '켜짐' : '꺼짐'}`}
                  accessibilityState={{ checked: isOn }}
                >
                  <Ionicons
                    name={isOn ? 'checkmark-circle' : 'ellipse-outline'}
                    size={14}
                    color={isOn ? colors.text : COLORS.textTertiary}
                  />
                  <Text style={[styles.categoryChipText, { color: isOn ? colors.text : COLORS.textTertiary }]}>
                    {cat}
                  </Text>
                </TouchableOpacity>
              )
            })}
          </View>
          {alertCategories.length === 0 && (
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
          <ListRow
            icon="information-circle-outline"
            label="앱 버전"
            value={Constants.expoConfig?.version ?? '-'}
          />
          <ListRow
            icon="logo-instagram"
            label="제휴 출처"
            value={`${PARTNER_SOURCES.length}개 소속`}
            onPress={() => setActiveModal('sources')}
          />
          <ListRow
            icon="storefront-outline"
            label="제휴 제보하기"
            onPress={() => setActiveModal('partnerSuggest')}
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
          <ListRow icon="chatbubble-ellipses-outline" label="문의하기" onPress={() => setActiveModal('feedback')} />
          <ListRow icon="help-buoy-outline" label="고객 지원" value="hongikon.com" onPress={() => openSitePage('/support/')} />
          <ListRow icon="code-slash-outline" label="오픈소스 라이선스" onPress={() => openSitePage('/licenses/')} />
          <ListRow icon="refresh-outline" label="설정 초기화" danger last onPress={handleReset} />
        </View>

        <View style={styles.brandFooter} accessibilityLabel="HONGIK ON">
          <LogotypeHorizontal width={112} height={20} />
        </View>
        <Text style={styles.unofficialNotice}>{UNOFFICIAL_NOTICE}</Text>

        {/* 회원 탈퇴는 실수로 누르지 않게 맨 아래 작은 글씨로 둔다. */}
        {status === 'authenticated' && (
          <TouchableOpacity
            style={styles.withdrawLink}
            onPress={handleDeleteAccount}
            accessibilityRole="button"
            accessibilityLabel="회원 탈퇴"
          >
            <Text style={styles.withdrawText}>회원 탈퇴</Text>
          </TouchableOpacity>
        )}

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

      <PrivacyModal visible={activeModal === 'privacy'} onClose={() => setActiveModal(null)} />

      <HiddenUsersModal visible={activeModal === 'hiddenUsers'} onClose={() => setActiveModal(null)} />

      <PartnerSuggestModal
        visible={activeModal === 'partnerSuggest'}
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
  boardList: {
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.md,
    paddingBottom: SPACING.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: COLORS.border,
  },
  boardListHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: SPACING.xs,
  },
  boardListTitle: { ...TYPE.callout, fontFamily: FONTS.semibold, color: COLORS.textPrimary },
  boardListCount: { ...TYPE.caption, color: COLORS.textTertiary },
  boardGroup: { marginTop: SPACING.sm },
  boardGroupTitle: {
    ...TYPE.caption,
    fontFamily: FONTS.semibold,
    color: COLORS.textTertiary,
    marginBottom: SPACING.xxs,
  },
  boardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    paddingVertical: SPACING.sm,
  },
  boardName: { ...TYPE.body, flex: 1, color: COLORS.textPrimary },
  boardNameOff: { color: COLORS.textSecondary },
  emptyHint: {
    ...TYPE.caption,
    color: COLORS.textTertiary,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
  },
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
  withdrawLink: { alignSelf: 'center', paddingVertical: SPACING.md, paddingHorizontal: SPACING.lg, marginTop: SPACING.sm },
  withdrawText: {
    ...TYPE.caption,
    color: COLORS.textSecondary,
    textDecorationLine: 'underline',
  },
  bottomSpacer: { height: SPACING.lg },
})
