import { useState } from 'react'
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
import NoticeDetailModal from '../components/settings/NoticeDetailModal'
import NoticeListModal from '../components/settings/NoticeListModal'
import PartnerSourcesModal from '../components/settings/PartnerSourcesModal'
import TermsModal from '../components/settings/TermsModal'
import PrivacyModal from '../components/settings/PrivacyModal'
import FeedbackModal from '../components/settings/FeedbackModal'
import OpenSourceLicensesModal from '../components/settings/OpenSourceLicensesModal'
import { APP_NOTICES, type AppNotice } from '../constants/appNotices'
import { PARTNER_SOURCES } from '../constants/partnerSources'
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
  | 'licenses'
  | null

export default function SettingsScreen() {
  const {
    settings,
    toggleSubscriptionAlert,
    toggleSubscribedCategory,
    toggleSubscribedDept,
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

  const { subscriptionAlert, subscribedCategories, subscribedDepts } = settings

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
          <View style={styles.row}>
            <View style={styles.rowLabel}>
              <Ionicons name="notifications-outline" size={17} color={COLORS.textSecondary} />
              <Text style={styles.rowLabelText}>구독 소식 알림</Text>
            </View>
            <TouchableOpacity
              style={[styles.toggle, subscriptionAlert && styles.toggleOn]}
              onPress={toggleSubscriptionAlert}
              activeOpacity={0.8}
              accessibilityRole="switch"
              accessibilityLabel="구독 소식 알림"
              accessibilityState={{ checked: subscriptionAlert }}
            >
              <View style={[styles.toggleThumb, subscriptionAlert && styles.toggleThumbOn]} />
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>구독</Text>
          <LinkRow
            icon="bookmarks-outline"
            label="구독 관리"
            value={subscribedDepts.length > 0 ? `${subscribedDepts.length}개` : '기관·학과 추가'}
            onPress={() => setSubManagerVisible(true)}
          />
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>카테고리 필터</Text>
          <Text style={styles.sectionDesc}>구독 피드에 표시할 소식 카테고리를 선택하세요</Text>
          <View style={styles.categoryGrid}>
            {ALL_CATEGORIES.map((cat) => {
              const isOn = subscribedCategories.includes(cat)
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
                  onPress={() => toggleSubscribedCategory(cat)}
                  activeOpacity={0.7}
                >
                  {isOn && <Ionicons name="checkmark-circle" size={13} color={colors.text} />}
                  <Text style={[styles.categoryChipText, { color: isOn ? colors.text : COLORS.textTertiary }]}>
                    {cat}
                  </Text>
                </TouchableOpacity>
              )
            })}
          </View>
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
          <LinkRow icon="document-text-outline" label="이용약관" onPress={() => setActiveModal('terms')} />
          <LinkRow icon="school-outline" label="학교" value="홍익대학교 (곧 추가 예정)" />
          <LinkRow
            icon="pulse-outline"
            label="앱 상태 확인"
            onPress={() => navigation.navigate('AppStatus')}
          />
          <LinkRow icon="shield-checkmark-outline" label="개인정보 처리방침" onPress={() => setActiveModal('privacy')} />
          <LinkRow icon="code-slash-outline" label="오픈소스 라이선스" onPress={() => setActiveModal('licenses')} />
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

      <OpenSourceLicensesModal
        visible={activeModal === 'licenses'}
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
  toggle: {
    width: 44,
    height: 26,
    backgroundColor: COLORS.toggleOff,
    borderRadius: 13,
    justifyContent: 'center',
    paddingHorizontal: 2,
  },
  toggleOn: { backgroundColor: COLORS.primary },
  toggleThumb: {
    width: 22,
    height: 22,
    backgroundColor: '#fff',
    borderRadius: 11,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 2,
  },
  toggleThumbOn: { alignSelf: 'flex-end' },
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
  brandFooter: { alignItems: 'center', paddingTop: 16, opacity: 0.35 },
  bottomSpacer: { height: 16 },
})
