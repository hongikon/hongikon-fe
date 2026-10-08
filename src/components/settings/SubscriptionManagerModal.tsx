import { useMemo, useState } from 'react'
import {
  Animated,
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
import { TYPE } from '../../constants/typography'
import { useAuth } from '../../contexts/AuthContext'
import { useSettings } from '../../contexts/SettingsContext'
import { useFeedbackToggles } from '../../hooks/useFeedbackToggles'
import { ToastViewport } from '../common/Toast'
import ContentColumn from '../common/ContentColumn'
import EmptyState from '../common/EmptyState'
import SearchBar from '../news/SearchBar'
import ModalHeader, { ModalPanel } from './ModalHeader'
import { useDragToClose } from '../../hooks/useDragToClose'
import SubscribeBell from '../common/SubscribeBell'

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
  const drag = useDragToClose(onClose)
  // 알림 설정(전체 스위치)이 꺼져 있으면 안내 문구를 바꾼다.
  const { settings } = useSettings()
  const masterOff = !settings.subscriptionAlert
  // 게스트도 소식 탭에 보여 줄 게시판은 고를 수 있다. 알림은 로그인해야 받아 게스트에겐 로그인 안내를 보여 준다.
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
        {/* 아래에서 올라온 창이라 머리 카드를 끌어내리면(iOS 는 목록 맨 위에서 더 끌어도) 닫힌다(10-08). */}
        <Animated.View style={[styles.sheet, { transform: [{ translateY: drag.dragY }] }]}>
        <ContentColumn>
        {/* 구독은 누르는 즉시 저장된다. 다른 설정 창처럼 ← 하나로 닫는다(예전 '완료'도 닫기만 했다, 10-08). */}
        <View {...drag.headerPanHandlers}>
          <ModalHeader title="구독 관리" onClose={onClose} />
        </View>

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
                ? '알림 설정이 꺼져 있어 구독한 게시판 알림이 오지 않아요.'
                : '종을 누르면 구독해요. 게시판마다 알림은 설정 › 게시판별 알림에서 켜고 꺼요.'}
            </Text>
          </View>
        )}

        <ScrollView style={styles.list} contentContainerStyle={styles.listContent} onScrollEndDrag={drag.onScrollEndDrag}>
          {groups.length === 0 ? (
            <EmptyState icon="search-outline" message={query.trim() ? `'${query.trim()}' 검색 결과가 없어요` : '검색 결과가 없어요'} />
          ) : (
            groups.map((group) => (
              <View key={group.name} style={styles.group}>
                <Text style={styles.groupTitle}>{group.name}</Text>
                {group.items.map((item) => {
                  const isOn = subscribedDepts.includes(item.id)
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
                      {/* 구독은 앱 전체에서 종 버튼 하나로(10-08). 게시판마다 알림 켜기는 설정 › 게시판별 알림에서 한다. */}
                      <SubscribeBell name={item.name} subscribed={isOn} onToggle={() => onToggleDept(item.id)} />
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
        </Animated.View>
      </SafeAreaView>
      </SafeAreaProvider>
    </Modal>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  sheet: { flex: 1 },
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
  hint: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginHorizontal: 16,
    marginTop: -2,
    marginBottom: 12,
  },
  hintText: { ...TYPE.caption, flex: 1, color: COLORS.textSecondary },
  bottomSpacer: { height: 24 },
})
