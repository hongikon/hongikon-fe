import { useState } from 'react'
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Modal,
  Alert,
  Linking,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import Constants from 'expo-constants'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { COLORS, CATEGORY_COLORS } from '../constants/colors'
import { BUILDINGS } from '../constants/buildings'
import { useSettings, ALL_CATEGORIES } from '../contexts/SettingsContext'
import { useAuth } from '../contexts/AuthContext'
import SubscriptionManagerModal from '../components/settings/SubscriptionManagerModal'
import { PARTNER_NOTICE_TEXT } from '../components/map/PartnerNoticeModal'
import { PARTNER_SOURCES } from '../constants/partnerSources'
import { FONTS } from '../constants/typography'
import type { RootStackParamList } from '../navigation/RootNavigator'

type NavProp = NativeStackNavigationProp<RootStackParamList>

interface AppNotice {
  id: string
  title: string
  date: string
  body: string
}

const APP_NOTICES: AppNotice[] = [
  {
    id: '4',
    title: '제휴 정보 안내',
    date: '2026.08.20',
    body: PARTNER_NOTICE_TEXT,
  },
  {
    id: '3',
    title: '홍익대알리미 v1.0.0 출시',
    date: '2024.08.01',
    body: '홍익대알리미가 정식 출시되었습니다. 캠퍼스 지도, 학과별 소식, 길찾기 기능을 이용해보세요.',
  },
  {
    id: '2',
    title: '소식 탭 업데이트 안내',
    date: '2024.08.05',
    body: '북마크, 구독, 전체 탭으로 소식을 더 편리하게 확인할 수 있습니다. 구독 소식 알림도 설정에서 켜보세요.',
  },
  {
    id: '1',
    title: '지도 기능 개선 예정',
    date: '2024.08.10',
    body: '실제 네이버/카카오 지도 연동 및 GPS 기반 현위치 표시 기능이 다음 업데이트에 추가될 예정입니다.',
  },
]

type ModalType = 'favorites' | 'notices' | 'noticeDetail' | 'sources' | 'terms' | 'privacy' | null

export default function SettingsScreen() {
  const {
    settings,
    toggleSubscriptionAlert,
    toggleFavoriteBuilding,
    toggleSubscribedCategory,
    toggleSubscribedDept,
    resetSettings,
  } = useSettings()

  const { status, logout } = useAuth()
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

  const { subscriptionAlert, favoriteBuildings, subscribedCategories, subscribedDepts } = settings

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView style={styles.scroll}>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>계정</Text>
          {status === 'authenticated' ? (
            <>
              <LinkRow icon="person-circle-outline" label="카카오 계정으로 로그인됨" />
              <LinkRow icon="log-out-outline" label="로그아웃" danger onPress={handleLogout} />
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
          <Text style={styles.sectionTitle}>북마크</Text>
          <LinkRow
            icon="star-outline"
            label="즐겨찾는 건물"
            value={favoriteBuildings.length > 0 ? `${favoriteBuildings.length}개` : undefined}
            onPress={() => setActiveModal('favorites')}
          />
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>앱 공지사항</Text>
          {APP_NOTICES.map((notice) => (
            <TouchableOpacity
              key={notice.id}
              style={styles.row}
              onPress={() => openNoticeDetail(notice)}
            >
              <View style={styles.noticeRow}>
                <Text style={styles.rowLabelText} numberOfLines={1}>{notice.title}</Text>
                <Text style={styles.noticeDate}>{notice.date}</Text>
              </View>
              <Ionicons name="chevron-forward" size={14} color="#ddd" />
            </TouchableOpacity>
          ))}
          <TouchableOpacity style={styles.row} onPress={() => setActiveModal('notices')}>
            <Text style={styles.moreText}>전체 보기</Text>
            <Ionicons name="chevron-forward" size={14} color={COLORS.primary} />
          </TouchableOpacity>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>일반</Text>
          <LinkRow icon="school-outline" label="학교" value="홍익대학교 (곧 추가 예정)" />
          <LinkRow
            icon="information-circle-outline"
            label="앱 버전"
            value={Constants.expoConfig?.version ?? '-'}
          />
          <LinkRow
            icon="pulse-outline"
            label="앱 상태 확인"
            onPress={() => navigation.navigate('AppStatus')}
          />
          <LinkRow
            icon="logo-instagram"
            label="제휴 출처"
            value={`${PARTNER_SOURCES.length}개 소속`}
            onPress={() => setActiveModal('sources')}
          />
          <LinkRow icon="document-text-outline" label="이용약관" onPress={() => setActiveModal('terms')} />
          <LinkRow icon="shield-checkmark-outline" label="개인정보 처리방침" onPress={() => setActiveModal('privacy')} />
          <LinkRow icon="refresh-outline" label="설정 초기화" danger onPress={handleReset} />
        </View>

        <View style={styles.bottomSpacer} />
      </ScrollView>

      <Modal visible={activeModal === 'noticeDetail'} animationType="slide">
        <SafeAreaView style={styles.modalContainer} edges={['top']}>
          <ModalHeader title="공지사항" onClose={() => setActiveModal(null)} />
          {selectedNotice && (
            <ScrollView style={styles.legalBody}>
              <Text style={styles.noticeDetailDate}>{selectedNotice.date}</Text>
              <Text style={styles.legalTitle}>{selectedNotice.title}</Text>
              <Text style={styles.legalText}>{selectedNotice.body}</Text>
            </ScrollView>
          )}
        </SafeAreaView>
      </Modal>

      <Modal visible={activeModal === 'notices'} animationType="slide">
        <SafeAreaView style={styles.modalContainer} edges={['top']}>
          <ModalHeader title="앱 공지사항" onClose={() => setActiveModal(null)} />
          <ScrollView style={styles.modalBody}>
            {APP_NOTICES.map((notice) => (
              <TouchableOpacity
                key={notice.id}
                style={styles.noticeItem}
                onPress={() => openNoticeDetail(notice)}
              >
                <Text style={styles.noticeItemTitle}>{notice.title}</Text>
                <Text style={styles.noticeItemDate}>{notice.date}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </SafeAreaView>
      </Modal>

      <Modal visible={activeModal === 'favorites'} animationType="slide">
        <SafeAreaView style={styles.modalContainer} edges={['top']}>
          <ModalHeader title="즐겨찾는 건물" onClose={() => setActiveModal(null)} />
          <ScrollView style={styles.modalBody}>
            {BUILDINGS.map((b) => {
              const isFav = favoriteBuildings.includes(b.name)
              return (
                <TouchableOpacity
                  key={b.name}
                  style={styles.selectRow}
                  onPress={() => toggleFavoriteBuilding(b.name)}
                >
                  <View style={styles.favRow}>
                    <View style={[styles.favDot, { backgroundColor: b.color }]} />
                    <View>
                      <Text style={styles.selectLabel}>{b.name}</Text>
                      <Text style={styles.favType}>{b.type}</Text>
                    </View>
                  </View>
                  <Ionicons
                    name={isFav ? 'star' : 'star-outline'}
                    size={20}
                    color={isFav ? '#F59E0B' : '#ddd'}
                  />
                </TouchableOpacity>
              )
            })}
          </ScrollView>
        </SafeAreaView>
      </Modal>

      <Modal visible={activeModal === 'sources'} animationType="slide">
        <SafeAreaView style={styles.modalContainer} edges={['top']}>
          <ModalHeader title="제휴 출처" onClose={() => setActiveModal(null)} />
          <ScrollView style={styles.modalBody}>
            <Text style={styles.sourceIntro}>{PARTNER_NOTICE_TEXT}</Text>
            {PARTNER_SOURCES.map((source) => (
              <View key={source.affiliation} style={styles.sourceCard}>
                <Text style={styles.sourceAffiliation}>{source.affiliation}</Text>
                {source.period && (
                  <Text style={styles.sourcePeriod}>제휴기간 {source.period}</Text>
                )}
                {source.links.map((link) => (
                  <TouchableOpacity
                    key={link.url}
                    style={styles.sourceLinkRow}
                    onPress={() => Linking.openURL(link.url)}
                  >
                    <Ionicons name="link-outline" size={14} color={COLORS.primary} />
                    <Text style={styles.sourceLinkText} numberOfLines={1}>
                      {link.label}
                    </Text>
                    <Ionicons name="open-outline" size={13} color="#ccc" />
                  </TouchableOpacity>
                ))}
              </View>
            ))}
          </ScrollView>
        </SafeAreaView>
      </Modal>

      <Modal visible={activeModal === 'terms'} animationType="slide">
        <SafeAreaView style={styles.modalContainer} edges={['top']}>
          <ModalHeader title="이용약관" onClose={() => setActiveModal(null)} />
          <ScrollView style={styles.legalBody}>
            <Text style={styles.legalTitle}>홍익대알리미 이용약관</Text>
            <Text style={styles.legalText}>
              {`제1조 (목적)\n본 약관은 홍익대알리미(이하 "앱")가 제공하는 서비스의 이용 조건 및 절차를 규정합니다.\n\n제2조 (서비스 내용)\n1. 캠퍼스 지도 및 건물 정보 제공\n2. 학교 공지사항 및 소식 전달\n3. 길찾기 서비스\n\n제3조 (이용자의 의무)\n이용자는 본 앱을 학업 및 캠퍼스 생활 목적으로만 사용해야 합니다.\n\n제4조 (면책)\n본 앱은 정보 제공 목적으로 운영되며, 정보의 정확성을 보장하지 않습니다.`}
            </Text>
          </ScrollView>
        </SafeAreaView>
      </Modal>

      <Modal visible={activeModal === 'privacy'} animationType="slide">
        <SafeAreaView style={styles.modalContainer} edges={['top']}>
          <ModalHeader title="개인정보 처리방침" onClose={() => setActiveModal(null)} />
          <ScrollView style={styles.legalBody}>
            <Text style={styles.legalTitle}>개인정보 처리방침</Text>
            <Text style={styles.legalText}>
              {`1. 수집하는 개인정보\n- 알림 설정 정보\n- 북마크 건물 목록\n- 구독 카테고리 설정\n\n2. 개인정보의 이용 목적\n- 맞춤형 캠퍼스 정보 제공\n- 관심 분야별 공지사항 알림\n\n3. 개인정보의 보관\n- 모든 설정 정보는 기기 내부에만 저장됩니다\n- 서버로 전송되지 않습니다\n\n4. 개인정보의 파기\n- 앱 삭제 시 모든 데이터가 자동으로 파기됩니다\n- 설정 초기화 시 저장된 설정이 기본값으로 돌아갑니다`}
            </Text>
          </ScrollView>
        </SafeAreaView>
      </Modal>

      <SubscriptionManagerModal
        visible={subManagerVisible}
        onClose={() => setSubManagerVisible(false)}
        subscribedDepts={subscribedDepts}
        onToggleDept={toggleSubscribedDept}
      />
    </SafeAreaView>
  )
}

function ModalHeader({ title, onClose }: { title: string; onClose: () => void }) {
  return (
    <View style={styles.modalHeader}>
      <TouchableOpacity onPress={onClose}>
        <Ionicons name="arrow-back" size={22} color={COLORS.textPrimary} />
      </TouchableOpacity>
      <Text style={styles.modalTitle}>{title}</Text>
      <View style={{ width: 22 }} />
    </View>
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
  noticeRow: { flex: 1, marginRight: 8 },
  noticeDate: { fontFamily: FONTS.regular, fontSize: 11, color: '#ccc', marginTop: 2 },
  moreText: { fontSize: 13, color: COLORS.primary, fontFamily: FONTS.medium },
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
  bottomSpacer: { height: 16 },
  modalContainer: { flex: 1, backgroundColor: COLORS.white },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 0.5,
    borderBottomColor: '#eee',
  },
  modalTitle: { fontSize: 16, fontFamily: FONTS.semibold, color: COLORS.textPrimary },
  modalBody: { padding: 20 },
  noticeItem: {
    paddingVertical: 14,
    borderBottomWidth: 0.5,
    borderBottomColor: '#f4f4f4',
  },
  noticeItemTitle: { fontSize: 14, fontFamily: FONTS.medium, color: COLORS.textPrimary, marginBottom: 3 },
  noticeItemDate: { fontFamily: FONTS.regular, fontSize: 11, color: '#bbb' },
  noticeDetailDate: { fontFamily: FONTS.regular, fontSize: 12, color: '#bbb', marginBottom: 8 },
  selectRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    borderBottomWidth: 0.5,
    borderBottomColor: '#f4f4f4',
  },
  selectLabel: { fontFamily: FONTS.regular, fontSize: 14, color: COLORS.textPrimary },
  favRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  favDot: { width: 10, height: 10, borderRadius: 5 },
  favType: { fontFamily: FONTS.regular, fontSize: 11, color: COLORS.textSecondary, marginTop: 1 },
  sourceIntro: {
    fontFamily: FONTS.regular,
    fontSize: 12,
    lineHeight: 18,
    color: COLORS.textSecondary,
    marginBottom: 16,
  },
  sourceCard: {
    backgroundColor: COLORS.sectionBg,
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
  },
  sourceAffiliation: { fontSize: 14, fontFamily: FONTS.semibold, color: COLORS.textPrimary },
  sourcePeriod: {
    fontFamily: FONTS.regular,
    fontSize: 12,
    color: COLORS.textTertiary,
    marginTop: 2,
    marginBottom: 8,
  },
  sourceLinkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 6,
  },
  sourceLinkText: { flex: 1, fontFamily: FONTS.regular, fontSize: 13, color: COLORS.primary },
  legalBody: { flex: 1, padding: 20 },
  legalTitle: { fontSize: 16, fontFamily: FONTS.semibold, color: COLORS.textPrimary, marginBottom: 16 },
  legalText: { fontFamily: FONTS.regular, fontSize: 13, color: '#666', lineHeight: 22 },
})
