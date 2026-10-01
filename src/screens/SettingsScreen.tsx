import { useMemo, useState } from 'react'
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import Constants from 'expo-constants'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { COLORS, CATEGORY_COLORS } from '../constants/colors'
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
import { APP_NOTICES, type AppNotice } from '../constants/appNotices'
import { PARTNER_SOURCES } from '../constants/partnerSources'
import { SUBSCRIBABLE_ITEMS, groupSubscribableItems } from '../constants/news'
import { FONTS } from '../constants/typography'
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
  | null

export default function SettingsScreen() {
  const {
    settings,
    toggleSubscriptionAlert,
    toggleAlertCategory,
    toggleSubscribedDept,
    toggleDeptAlert,
    isDeptAlertOn,
    resetSettings,
  } = useSettings()

  const { status, logout, deleteAccount } = useAuth()
  const navigation = useNavigation<NavProp>()

  const [activeModal, setActiveModal] = useState<ModalType>(null)
  const [subManagerVisible, setSubManagerVisible] = useState(false)
  const [selectedNotice, setSelectedNotice] = useState<AppNotice | null>(null)

  const handleLogout = () => {
    Alert.alert('로그아웃', '로그아웃하시겠습니까?', [
      { text: '취소', style: 'cancel' },
      { text: '로그아웃', style: 'destructive', onPress: () => logout() },
    ])
  }

  // 게스트는 로그인된 게 없으니 확인 없이 바로 웰컴 화면으로 보낸다.
  // logout() 이 토큰·게스트 플래그를 함께 지워 signedOut 상태로 돌려놓는다.
  const handleGoToLogin = () => {
    logout()
  }

  const handleDeleteAccount = () => {
    Alert.alert(
      '회원 탈퇴',
      '탈퇴하면 계정 정보가 삭제되며 되돌릴 수 없습니다. 계속하시겠습니까?',
      [
        { text: '취소', style: 'cancel' },
        {
          text: '탈퇴',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteAccount()
            } catch (error) {
              const message = error instanceof Error ? error.message : '탈퇴 처리 중 오류가 발생했습니다.'
              Alert.alert('탈퇴 실패', message)
            }
          },
        },
      ]
    )
  }

  const handleReset = () => {
    Alert.alert(
      '설정 초기화',
      '모든 설정이 기본값으로 되돌아갑니다. 계속하시겠습니까?',
      [
        { text: '취소', style: 'cancel' },
        { text: '초기화', style: 'destructive', onPress: () => resetSettings() },
      ]
    )
  }

  const openNoticeDetail = (notice: AppNotice) => {
    setSelectedNotice(notice)
    setActiveModal('noticeDetail')
  }

  const { subscriptionAlert, alertCategories, subscribedDepts } = settings
  const isGuest = status !== 'authenticated'
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
      <ScrollView style={styles.scroll}>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>계정</Text>
          {status === 'authenticated' ? (
            <>
              <LinkRow icon="person-circle-outline" label="카카오 계정으로 로그인됨" />
              <LinkRow icon="log-out-outline" label="로그아웃" danger onPress={handleLogout} />
              <LinkRow icon="trash-outline" label="회원 탈퇴" danger onPress={handleDeleteAccount} />
            </>
          ) : (
            <LinkRow
              icon="log-in-outline"
              label="로그인하기"
              value="게스트로 이용 중"
              onPress={handleGoToLogin}
            />
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>알림</Text>
          {isGuest && (
            <View style={styles.guestNotice}>
              <Ionicons name="lock-closed-outline" size={15} color={COLORS.primary} />
              <View style={styles.guestNoticeBody}>
                <Text style={styles.guestNoticeTitle}>알림은 로그인 후 받을 수 있어요</Text>
                <Text style={styles.guestNoticeText}>
                  지금 고른 게시판·분야 설정은 로그인하면 그대로 적용돼요.
                </Text>
              </View>
              <TouchableOpacity
                style={styles.guestNoticeBtn}
                onPress={handleGoToLogin}
                accessibilityRole="button"
                accessibilityLabel="로그인하기"
              >
                <Text style={styles.guestNoticeBtnText}>로그인</Text>
              </TouchableOpacity>
            </View>
          )}
          <View style={[styles.row, styles.rowLast]}>
            <View style={styles.rowLabel}>
              <Ionicons name="notifications-outline" size={17} color={COLORS.textSecondary} />
              <View style={styles.rowLabelStack}>
                <Text style={styles.rowLabelText}>구독 소식 알림</Text>
                <Text style={styles.rowSubText}>
                  {subscriptionAlert
                    ? '켜 둔 게시판의 새 소식을 알려드려요'
                    : '꺼져 있어 아래 설정과 관계없이 알림이 오지 않아요'}
                </Text>
              </View>
            </View>
            <ToggleSwitch
              value={subscriptionAlert}
              onToggle={toggleSubscriptionAlert}
              accessibilityLabel="구독 소식 알림"
            />
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>구독 게시판</Text>
          <LinkRow
            icon="bookmarks-outline"
            label="구독 관리"
            value={subscribedDepts.length > 0 ? `${subscribedDepts.length}개` : '기관·학과 추가'}
            onPress={() => setSubManagerVisible(true)}
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
                          size={14}
                          color={on ? COLORS.primary : COLORS.textTertiary}
                        />
                        <Text
                          style={[styles.boardName, !on && styles.boardNameOff]}
                          numberOfLines={1}
                        >
                          {item.name}
                        </Text>
                        <ToggleSwitch
                          size="small"
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
          <View style={styles.sectionHead}>
            <Text style={[styles.sectionTitle, styles.sectionTitleInline]}>알림 받을 분야</Text>
            <Text style={styles.sectionCount}>
              {alertCategories.length}/{ALL_CATEGORIES.length}
            </Text>
          </View>
          <Text style={styles.sectionDesc}>구독한 게시판의 새 소식 중 선택한 분야만 알려드려요</Text>
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
                    size={13}
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
              <Ionicons name="alert-circle-outline" size={13} color={COLORS.danger} />
              <Text style={styles.warnText}>선택한 분야가 없어 새 소식 알림이 오지 않아요</Text>
            </View>
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>일반</Text>
          <LinkRow
            icon="megaphone-outline"
            label="공지사항"
            onPress={() => setActiveModal('notices')}
          />
          <LinkRow
            icon="information-circle-outline"
            label="앱 버전"
            value={Constants.expoConfig?.version ?? '-'}
          />
          <LinkRow
            icon="logo-instagram"
            label="제휴 출처"
            value={`${PARTNER_SOURCES.length}개 소속`}
            onPress={() => setActiveModal('sources')}
          />
          <LinkRow
            icon="storefront-outline"
            label="제휴 제보하기"
            onPress={() => setActiveModal('partnerSuggest')}
          />
          <LinkRow icon="document-text-outline" label="이용약관" onPress={() => setActiveModal('terms')} />
          <LinkRow icon="school-outline" label="학교" value="홍익대학교" />
          <LinkRow
            icon="pulse-outline"
            label="앱 상태 확인"
            onPress={() => navigation.navigate('AppStatus')}
          />
          <LinkRow icon="shield-checkmark-outline" label="개인정보 처리방침" onPress={() => setActiveModal('privacy')} />
          <LinkRow icon="chatbubble-ellipses-outline" label="문의하기" onPress={() => setActiveModal('feedback')} />
          <LinkRow icon="refresh-outline" label="설정 초기화" danger onPress={handleReset} />
        </View>

        <View style={styles.brandFooter} accessibilityLabel="HONGIK ON">
          <LogotypeHorizontal width={112} height={20} />
        </View>

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

      <PartnerSuggestModal
        visible={activeModal === 'partnerSuggest'}
        onClose={() => setActiveModal(null)}
      />

      <FeedbackModal visible={activeModal === 'feedback'} onClose={() => setActiveModal(null)} />

      <SubscriptionManagerModal
        visible={subManagerVisible}
        onClose={() => setSubManagerVisible(false)}
        subscribedDepts={subscribedDepts}
        onToggleDept={toggleSubscribedDept}
      />
    </SafeAreaView>
  )
}

interface LinkRowProps {
  icon: keyof typeof Ionicons.glyphMap
  label: string
  value?: string
  danger?: boolean
  onPress?: () => void
}

function LinkRow({ icon, label, value, danger = false, onPress }: LinkRowProps) {
  return (
    <TouchableOpacity style={styles.row} onPress={onPress} disabled={!onPress}>
      <View style={styles.rowLabel}>
        <Ionicons name={icon} size={17} color={danger ? COLORS.danger : COLORS.textSecondary} />
        <Text style={[styles.rowLabelText, danger && styles.dangerText]}>{label}</Text>
      </View>
      <View style={styles.rowValue}>
        {value && <Text style={styles.rowValueText}>{value}</Text>}
        {!danger && onPress && <Ionicons name="chevron-forward" size={13} color="#ddd" />}
      </View>
    </TouchableOpacity>
  )
}

const styles = StyleSheet.create({
  // SafeAreaView 상단 인셋은 첫 section의 흰 배경과 맞춰 흰색으로 둔다.
  // 그룹 리스트의 회색 배경은 scroll 이 직접 칠한다.
  container: { flex: 1, backgroundColor: COLORS.white },
  scroll: { flex: 1, backgroundColor: COLORS.sectionBg },
  section: { backgroundColor: COLORS.white, marginBottom: 8 },
  sectionTitle: { fontFamily: FONTS.regular,
    fontSize: 10,
    color: COLORS.textTertiary,
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 4,
    letterSpacing: 0.6,
  },
  sectionDesc: { fontFamily: FONTS.regular,
    fontSize: 12,
    color: COLORS.textSecondary,
    paddingHorizontal: 16,
    paddingBottom: 10,
    lineHeight: 17,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 13,
    borderBottomWidth: 0.5,
    borderBottomColor: '#f4f4f4',
  },
  rowLabel: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 },
  rowLabelText: { fontFamily: FONTS.regular, fontSize: 14, color: COLORS.textPrimary },
  dangerText: { color: COLORS.danger },
  rowValue: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  rowValueText: { fontFamily: FONTS.regular, fontSize: 13, color: COLORS.textTertiary },
  categoryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 12,
    paddingBottom: 14,
    gap: 8,
  },
  categoryChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1,
  },
  categoryChipOff: {
    backgroundColor: '#F5F5F5',
    borderColor: '#E0E0E0',
  },
  categoryChipText: { fontSize: 13, fontFamily: FONTS.medium },
  dimmed: { opacity: 0.45 },
  rowLast: { borderBottomWidth: 0 },
  rowLabelStack: { flex: 1, gap: 2 },
  rowSubText: { fontFamily: FONTS.regular, fontSize: 12, color: COLORS.textSecondary, lineHeight: 16 },
  sectionHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingRight: 16 },
  sectionTitleInline: { flex: 1 },
  sectionCount: { fontFamily: FONTS.medium, fontSize: 11, color: COLORS.textTertiary, paddingTop: 6 },
  guestNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginHorizontal: 12,
    marginTop: 4,
    marginBottom: 4,
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: '#F4F3FA',
  },
  guestNoticeBody: { flex: 1, gap: 2 },
  guestNoticeTitle: { fontFamily: FONTS.semibold, fontSize: 13, color: COLORS.textPrimary },
  guestNoticeText: { fontFamily: FONTS.regular, fontSize: 12, lineHeight: 16, color: COLORS.textSecondary },
  guestNoticeBtn: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 16,
    backgroundColor: COLORS.primary,
  },
  guestNoticeBtnText: { fontFamily: FONTS.semibold, fontSize: 12, color: COLORS.white },
  boardList: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 8 },
  boardListHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  boardListTitle: { fontFamily: FONTS.semibold, fontSize: 13, color: COLORS.textPrimary },
  boardListCount: { fontFamily: FONTS.medium, fontSize: 12, color: COLORS.textTertiary },
  boardGroup: { marginTop: 8 },
  boardGroupTitle: {
    fontFamily: FONTS.bold,
    fontSize: 11,
    color: COLORS.textTertiary,
    letterSpacing: 0.4,
    marginBottom: 2,
  },
  boardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 8,
  },
  boardName: { flex: 1, fontFamily: FONTS.regular, fontSize: 14, color: COLORS.textPrimary },
  boardNameOff: { color: COLORS.textSecondary },
  emptyHint: {
    fontFamily: FONTS.regular,
    fontSize: 12,
    lineHeight: 17,
    color: COLORS.textTertiary,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  warnRow: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 16, paddingBottom: 14, marginTop: -4 },
  warnText: { fontFamily: FONTS.regular, fontSize: 12, color: COLORS.danger },
  brandFooter: { alignItems: 'center', paddingTop: 16, opacity: 0.35 },
  bottomSpacer: { height: 16 },
})
