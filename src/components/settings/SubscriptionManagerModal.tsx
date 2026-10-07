import { useMemo, useState } from 'react'
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Modal,
} from 'react-native'
import { SafeAreaView, SafeAreaProvider } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { COLORS } from '../../constants/colors'
import { SUBSCRIBABLE_ITEMS, groupSubscribableItems } from '../../constants/news'
import { FONTS, TYPE } from '../../constants/typography'
import { useAuth } from '../../contexts/AuthContext'
import { useSettings } from '../../contexts/SettingsContext'
import { useFeedbackToggles } from '../../hooks/useFeedbackToggles'
import { ToastViewport } from '../common/Toast'
import ContentColumn from '../common/ContentColumn'
import EmptyState from '../common/EmptyState'
import SearchBar from '../news/SearchBar'
import ModalHeader, { ModalPanel } from './ModalHeader'

interface SubscriptionManagerModalProps {
  visible: boolean
  onClose: () => void
  subscribedDepts: string[]
  onToggleDept: (id: string) => void
}

export default function SubscriptionManagerModal({
  visible,
  onClose,
  subscribedDepts,
  onToggleDept,
}: SubscriptionManagerModalProps) {
  const [query, setQuery] = useState('')
  // 게시판별 알림은 구독과 늘 함께 다뤄 호출부마다 넘기지 않고 설정에서 바로 읽는다.
  const { settings, isDeptAlertOn } = useSettings()
  // 종(게시판 알림)은 진동·토스트가 붙은 버전을 쓴다. 구독 토글(onToggleDept)은 호출부가 넘긴다.
  const { toggleDeptAlert } = useFeedbackToggles()
  const masterOff = !settings.subscriptionAlert
  // 게스트도 소식 탭에 보여 줄 게시판은 고를 수 있다. 알림은 로그인해야 받아서 종(게시판 알림)은 숨긴다.
  const isGuest = useAuth().status !== 'authenticated'

  const groups = useMemo(() => {
    const keyword = query.trim().toLowerCase()
    const filtered = keyword
      ? SUBSCRIBABLE_ITEMS.filter(
          (item) =>
            item.name.toLowerCase().includes(keyword) ||
            item.group.toLowerCase().includes(keyword)
        )
      : SUBSCRIBABLE_ITEMS
    return groupSubscribableItems(filtered)
  }, [query])

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      {/* Modal 은 별도 화면으로 떠서 바깥 SafeAreaProvider 의 inset 이 맞지 않는다(노치·홈 인디케이터와 겹침). */}
      <SafeAreaProvider>
      <SafeAreaView style={styles.container} edges={['top']}>
        {/* 폴드를 펼친 화면·넓은 웹 창에선 내용을 가운데 읽기 폭으로 모은다. */}
        <ContentColumn>
        <ModalHeader
          title="구독 관리"
          onClose={onClose}
          right={
            <TouchableOpacity
              onPress={onClose}
              style={styles.doneBtn}
              hitSlop={8}
              accessibilityRole="button"
            >
              <Text style={styles.done}>완료</Text>
            </TouchableOpacity>
          }
        />

        <ModalPanel>
        <SearchBar
          value={query}
          onChangeText={setQuery}
          placeholder="기관·학과 검색"
          accessibilityLabel="기관·학과 검색"
          style={styles.searchBar}
        />

        {isGuest ? (
          <View style={styles.hint}>
            <Ionicons name="lock-closed-outline" size={13} color={COLORS.textSecondary} />
            <Text style={styles.hintText}>
              구독한 게시판의 소식은 소식 탭에서 볼 수 있어요. 알림은 로그인 후 받을 수 있어요.
            </Text>
          </View>
        ) : subscribedDepts.length > 0 && (
          <View style={styles.hint}>
            <Ionicons
              name={masterOff ? 'notifications-off-outline' : 'notifications-outline'}
              size={13}
              color={COLORS.textSecondary}
            />
            <Text style={styles.hintText}>
              {masterOff
                ? '구독 소식 알림이 꺼져 있어요. 켜면 종이 켜진 게시판만 알려드려요.'
                : '종 모양을 눌러 게시판마다 알림을 켜고 끌 수 있어요.'}
            </Text>
          </View>
        )}

        <ScrollView style={styles.list} contentContainerStyle={styles.listContent}>
          {groups.length === 0 ? (
            <EmptyState icon="search-outline" message="검색 결과가 없어요" />
          ) : (
            groups.map((group) => (
              <View key={group.name} style={styles.group}>
                <Text style={styles.groupTitle}>{group.name}</Text>
                {group.items.map((item) => {
                  const isOn = subscribedDepts.includes(item.id)
                  const alertOn = isOn && isDeptAlertOn(item.id)
                  return (
                    <View key={item.id} style={styles.row}>
                      <TouchableOpacity
                        style={styles.rowNameArea}
                        onPress={() => onToggleDept(item.id)}
                        activeOpacity={0.6}
                        accessibilityRole="button"
                        accessibilityLabel={`${item.name} ${isOn ? '구독 해제' : '구독'}`}
                      >
                        <Text style={styles.rowName}>{item.name}</Text>
                      </TouchableOpacity>
                      {isOn && !isGuest && (
                        <TouchableOpacity
                          style={[
                            styles.bellBtn,
                            alertOn ? styles.bellBtnOn : styles.bellBtnOff,
                            masterOff && styles.dimmed,
                          ]}
                          onPress={() => toggleDeptAlert(item.id)}
                          activeOpacity={0.6}
                          hitSlop={{ top: 6, bottom: 6, left: 4, right: 4 }}
                          accessibilityRole="switch"
                          accessibilityLabel={`${item.name} 알림 ${alertOn ? '켜짐' : '꺼짐'}`}
                          accessibilityState={{ checked: alertOn }}
                        >
                          <Ionicons
                            name={alertOn ? 'notifications' : 'notifications-off-outline'}
                            size={15}
                            color={alertOn ? COLORS.primary : COLORS.textTertiary}
                          />
                        </TouchableOpacity>
                      )}
                      <TouchableOpacity
                        style={[styles.subBtn, isOn && styles.subBtnOn]}
                        onPress={() => onToggleDept(item.id)}
                        activeOpacity={0.7}
                        accessibilityRole="button"
                        accessibilityLabel={`${item.name} ${isOn ? '구독 해제' : '구독'}`}
                      >
                        <Ionicons
                          name={isOn ? 'checkmark' : 'add'}
                          size={14}
                          color={isOn ? COLORS.white : COLORS.primary}
                        />
                        <Text style={[styles.subBtnText, isOn && styles.subBtnTextOn]}>
                          {isOn ? '구독중' : '구독'}
                        </Text>
                      </TouchableOpacity>
                    </View>
                  )
                })}
              </View>
            ))
          )}
          <View style={styles.bottomSpacer} />
        </ScrollView>
        </ModalPanel>
        {/* 루트 토스트는 네이티브 Modal 아래에 가려져 이 창 안에 따로 둔다. */}
        <ToastViewport />
        </ContentColumn>
      </SafeAreaView>
      </SafeAreaProvider>
    </Modal>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  doneBtn: { minWidth: 40, height: 40, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 8 },
  done: {
    fontSize: 15,
    fontFamily: FONTS.semibold,
    color: COLORS.primary,
  },
  searchBar: { marginHorizontal: 16, marginVertical: 12 },
  list: { flex: 1 },
  listContent: { paddingHorizontal: 16 },
  group: { marginBottom: 18 },
  groupTitle: {
    ...TYPE.section,
    color: COLORS.textSecondary,
    marginBottom: 4,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 52,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: COLORS.border,
  },
  rowNameArea: { flex: 1, marginRight: 12, paddingVertical: 2 },
  rowName: { ...TYPE.body, color: COLORS.textPrimary },
  bellBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  bellBtnOn: { backgroundColor: COLORS.primarySoft },
  bellBtnOff: { backgroundColor: COLORS.fill },
  dimmed: { opacity: 0.45 },
  hint: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginHorizontal: 16,
    marginTop: -2,
    marginBottom: 12,
  },
  hintText: { ...TYPE.caption, flex: 1, color: COLORS.textSecondary },
  subBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    height: 32,
    paddingHorizontal: 12,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.primary,
    backgroundColor: COLORS.white,
  },
  subBtnOn: { backgroundColor: COLORS.primary },
  subBtnText: { fontSize: 12, fontFamily: FONTS.semibold, color: COLORS.primary },
  subBtnTextOn: { color: COLORS.white },
  bottomSpacer: { height: 24 },
})
