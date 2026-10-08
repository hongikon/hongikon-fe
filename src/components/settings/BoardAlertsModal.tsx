import { useMemo, useState } from 'react'
import { View, Text, StyleSheet, ScrollView, Modal, TouchableOpacity } from 'react-native'
import { SafeAreaView, SafeAreaProvider } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { COLORS } from '../../constants/colors'
import { FONTS, TYPE } from '../../constants/typography'
import { SPACING } from '../../constants/spacing'
import { SUBSCRIBABLE_ITEMS, groupSubscribableItems } from '../../constants/news'
import { useSettings } from '../../contexts/SettingsContext'
import { useFeedbackToggles } from '../../hooks/useFeedbackToggles'
import * as haptics from '../../lib/haptics'
import ModalHeader, { ModalPanel } from './ModalHeader'
import ToggleSwitch from './ToggleSwitch'
import ContentColumn from '../common/ContentColumn'
import SectionTitle from '../common/SectionTitle'
import EmptyState from '../common/EmptyState'
import Button from '../common/Button'
import SearchBar from '../news/SearchBar'
import { ToastViewport, useToast } from '../common/Toast'

interface BoardAlertsModalProps {
  visible: boolean
  onClose: () => void
  /** 구독한 게시판이 없을 때 "구독 관리" 로 보낸다. */
  onOpenSubscriptions: () => void
}

/**
 * 설정 > 구독 게시판 > 게시판별 알림. 구독한 게시판마다 알림을 켜고 끈다.
 * 구독이 많으면 설정 화면 안 목록이 끝없이 길어져 따로 뺐다.
 *
 * 서버 동기화는 설정 화면에 있던 목록과 같다 — 게시판 하나를 바꿀 때마다 `SettingsContext.toggleDeptAlert`
 * (→ 게시판별 대기열 `boardSubscriptionSync`). "모두 켜기/끄기" 도 값이 다른 게시판에만 같은 함수를 부른다.
 * 게스트는 이 창을 열지 않는다(설정 화면이 로그인을 권한다).
 */
export default function BoardAlertsModal({ visible, onClose, onOpenSubscriptions }: BoardAlertsModalProps) {
  const { settings, isDeptAlertOn, toggleDeptAlert } = useSettings()
  // 한 줄씩 바꿀 때는 진동·토스트가 붙은 버전(설정 화면 목록과 같은 피드백).
  const { toggleDeptAlert: toggleDeptAlertWithFeedback } = useFeedbackToggles()
  const toast = useToast()
  const [query, setQuery] = useState('')
  const { subscribedDepts } = settings
  const masterOff = !settings.subscriptionAlert

  const subscribedItems = useMemo(() => {
    const subscribed = new Set(subscribedDepts)
    return SUBSCRIBABLE_ITEMS.filter((item) => subscribed.has(item.id))
  }, [subscribedDepts])

  /** 구독한 게시판을 TREE_DATA 순서(단과대별)로 묶는다. 검색어가 있으면 게시판·그룹 이름으로 거른다. */
  const groups = useMemo(() => {
    const keyword = query.trim().toLowerCase()
    const filtered = keyword
      ? subscribedItems.filter(
          (item) => item.name.toLowerCase().includes(keyword) || item.group.toLowerCase().includes(keyword),
        )
      : subscribedItems
    return groupSubscribableItems(filtered)
  }, [subscribedItems, query])

  const onCount = subscribedItems.filter((item) => isDeptAlertOn(item.id)).length

  /** 값이 다른 게시판만 바꾼다. 토스트는 한 번만 띄운다. */
  const setAll = (ids: readonly string[], on: boolean, label: string) => {
    const targets = ids.filter((id) => isDeptAlertOn(id) !== on)
    if (targets.length === 0) return
    for (const id of targets) toggleDeptAlert(id)
    haptics.tapLight()
    toast.show(
      on
        ? { message: `${label} 알림을 모두 켰어요` }
        : { message: `${label} 알림을 모두 껐어요`, tone: 'info' },
    )
  }

  const visibleIds = groups.flatMap((group) => group.items.map((item) => item.id))
  const searching = query.trim().length > 0
  const scopeLabel = searching ? '검색된 게시판' : '구독한 게시판'

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      {/* Modal 은 별도 화면으로 떠서 바깥 SafeAreaProvider 의 inset 이 맞지 않는다(노치·홈 인디케이터와 겹침). */}
      <SafeAreaProvider>
      <SafeAreaView style={styles.container} edges={['top']}>
        <ContentColumn>
        <ModalHeader title="게시판별 알림" onClose={onClose} />

        <ModalPanel>
        {subscribedItems.length === 0 ? (
          <EmptyState
            icon="notifications-off-outline"
            message="구독한 게시판이 없어요"
            description="게시판을 구독하면 여기서 게시판마다 알림을 켜고 끌 수 있어요"
            action={
              <Button
                label="구독 관리 열기"
                size="md"
                variant="secondary"
                fullWidth={false}
                icon="bookmarks-outline"
                onPress={onOpenSubscriptions}
              />
            }
          />
        ) : (
          <>
            <SearchBar
              value={query}
              onChangeText={setQuery}
              placeholder="게시판 검색"
              accessibilityLabel="게시판 검색"
              style={styles.searchBar}
            />

            <View style={styles.summary}>
              <Text style={styles.summaryText}>
                {onCount}/{subscribedItems.length} 켜짐
              </Text>
              <View style={styles.summaryActions}>
                <Button
                  label="모두 켜기"
                  size="sm"
                  variant="secondary"
                  fullWidth={false}
                  disabled={visibleIds.length === 0}
                  onPress={() => setAll(visibleIds, true, scopeLabel)}
                  accessibilityLabel={`${scopeLabel} 알림 모두 켜기`}
                />
                <Button
                  label="모두 끄기"
                  size="sm"
                  variant="outline"
                  fullWidth={false}
                  disabled={visibleIds.length === 0}
                  onPress={() => setAll(visibleIds, false, scopeLabel)}
                  accessibilityLabel={`${scopeLabel} 알림 모두 끄기`}
                />
              </View>
            </View>

            {masterOff && (
              <View style={styles.hint}>
                <Ionicons name="notifications-off-outline" size={13} color={COLORS.textSecondary} />
                <Text style={styles.hintText}>
                  알림 설정이 꺼져 있어요. 켜면 여기서 켜 둔 게시판만 알려드려요.
                </Text>
              </View>
            )}

            <ScrollView style={styles.list} contentContainerStyle={styles.listContent} keyboardShouldPersistTaps="handled">
              {groups.length === 0 ? (
                <EmptyState icon="search-outline" message={query.trim() ? `'${query.trim()}' 검색 결과가 없어요` : '검색 결과가 없어요'} />
              ) : (
                groups.map((group) => {
                  const ids = group.items.map((item) => item.id)
                  const allOn = ids.every((id) => isDeptAlertOn(id))
                  const groupOn = ids.filter((id) => isDeptAlertOn(id)).length
                  return (
                    <View key={group.name} style={styles.group}>
                      <SectionTitle
                        title={group.name}
                        meta={`${groupOn}/${ids.length}`}
                        style={styles.groupTitle}
                        right={
                          <TouchableOpacity
                            onPress={() => setAll(ids, !allOn, group.name)}
                            hitSlop={8}
                            accessibilityRole="button"
                            accessibilityLabel={`${group.name} 알림 ${allOn ? '모두 끄기' : '모두 켜기'}`}
                          >
                            <Text style={styles.groupAction}>{allOn ? '모두 끄기' : '모두 켜기'}</Text>
                          </TouchableOpacity>
                        }
                      />
                      {group.items.map((item, index) => {
                        const on = isDeptAlertOn(item.id)
                        return (
                          <View
                            key={item.id}
                            style={[styles.row, index === group.items.length - 1 && styles.rowLast]}
                          >
                            <Ionicons
                              name={on ? 'notifications' : 'notifications-off-outline'}
                              size={16}
                              color={on ? COLORS.primary : COLORS.iconMuted}
                            />
                            <Text style={[styles.rowName, !on && styles.rowNameOff]} numberOfLines={1}>
                              {item.name}
                            </Text>
                            <ToggleSwitch
                              value={on}
                              dimmed={masterOff}
                              onToggle={() => toggleDeptAlertWithFeedback(item.id)}
                              accessibilityLabel={`${item.name} 알림 ${on ? '켜짐' : '꺼짐'}`}
                            />
                          </View>
                        )
                      })}
                    </View>
                  )
                })
              )}
              <View style={styles.bottomSpacer} />
            </ScrollView>
          </>
        )}
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
  searchBar: { marginHorizontal: SPACING.lg, marginTop: SPACING.md, marginBottom: SPACING.sm },
  summary: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: SPACING.sm,
    paddingHorizontal: SPACING.lg,
    paddingBottom: SPACING.sm,
  },
  summaryText: { ...TYPE.callout, fontFamily: FONTS.semibold, color: COLORS.textPrimary },
  summaryActions: { flexDirection: 'row', gap: SPACING.sm },
  hint: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginHorizontal: SPACING.lg,
    marginBottom: SPACING.sm,
  },
  hintText: { ...TYPE.caption, flex: 1, color: COLORS.textSecondary },
  list: { flex: 1, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: COLORS.border },
  listContent: { paddingBottom: SPACING.lg },
  group: { marginBottom: SPACING.xs },
  groupTitle: { paddingBottom: SPACING.xxs },
  groupAction: { ...TYPE.caption, fontFamily: FONTS.semibold, color: COLORS.primary },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    minHeight: 52,
    marginHorizontal: SPACING.lg,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: COLORS.border,
  },
  rowLast: { borderBottomWidth: 0 },
  rowName: { ...TYPE.body, flex: 1, color: COLORS.textPrimary },
  rowNameOff: { color: COLORS.textSecondary },
  bottomSpacer: { height: SPACING.xl },
})
