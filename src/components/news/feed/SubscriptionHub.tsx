import { memo } from 'react'
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { COLORS } from '../../../constants/colors'
import { RADIUS, SPACING } from '../../../constants/spacing'
import { FONTS } from '../../../constants/typography'
import { deptDisplayName } from '../../../utils/news/feed'

interface Props {
  subscribedDepts: string[]
  /** '내 구독' 칩으로 고른 게시판(null = 전체). */
  selectedSource: string | null
  onSelectSource: (id: string | null) => void
  /** '관리'를 펼쳤는지. 펼치면 고르기 칩 대신 해제(X)·추가 칩을 보여 준다. */
  manageOpen: boolean
  onToggleManage: () => void
  onRemoveDept: (id: string) => void
  onAddSubscription: () => void
}

/**
 * [내 구독 카드] 소식 '구독' 탭 목록 머리. 구독 수와 '관리' 버튼, 그 아래 게시판 고르기 칩(전체·게시판) 또는
 * 관리 칩(구독 해제·구독 추가). 구독이 하나뿐이면 고르기 칩은 없다.
 */
function SubscriptionHub({
  subscribedDepts,
  selectedSource,
  onSelectSource,
  manageOpen,
  onToggleManage,
  onRemoveDept,
  onAddSubscription,
}: Props) {
  return (
    <View style={styles.hub}>
      <View style={styles.hubHead}>
        <Text style={styles.hubLabel}>
          내 구독 {subscribedDepts.length}
        </Text>
        <TouchableOpacity
          style={styles.hubManage}
          onPress={onToggleManage}
          accessibilityRole="button"
        >
          <Ionicons
            name={manageOpen ? 'chevron-up' : 'options-outline'}
            size={13}
            color={COLORS.primary}
          />
          <Text style={styles.hubManageText}>관리</Text>
        </TouchableOpacity>
      </View>

      {!manageOpen && subscribedDepts.length > 1 && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterRow}
          style={styles.filterScroll}
        >
          {[null, ...subscribedDepts].map((id) => {
            const selected = selectedSource === id
            const label = id === null ? '전체' : deptDisplayName(id)
            return (
              <TouchableOpacity
                key={id ?? '__all'}
                style={[styles.filterChip, selected && styles.filterChipOn]}
                onPress={() => onSelectSource(id)}
                accessibilityRole="button"
                accessibilityState={{ selected }}
                accessibilityLabel={id === null ? '구독 전체 보기' : `${label}만 보기`}
              >
                <Text style={[styles.filterChipText, selected && styles.filterChipTextOn]}>{label}</Text>
              </TouchableOpacity>
            )
          })}
        </ScrollView>
      )}

      {manageOpen && (
        <View style={styles.chips}>
          {subscribedDepts.map((id) => (
            <View key={id} style={styles.chip}>
              <Text style={styles.chipText}>{deptDisplayName(id)}</Text>
              <TouchableOpacity
                onPress={() => onRemoveDept(id)}
                hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                accessibilityLabel={`${deptDisplayName(id)} 구독 해제`}
              >
                <View style={styles.chipX}>
                  <Ionicons name="close" size={11} color={COLORS.white} />
                </View>
              </TouchableOpacity>
            </View>
          ))}
          <TouchableOpacity
            style={styles.chipAdd}
            onPress={onAddSubscription}
            accessibilityRole="button"
          >
            <Ionicons name="add" size={13} color={COLORS.primary} />
            <Text style={styles.chipAddText}>구독 추가</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  )
}

export default memo(SubscriptionHub)

const styles = StyleSheet.create({
  // 목록 카드와 같은 곡률·안쪽 여백(10-08) — 글자가 아래 카드 글자와 세로로 줄이 맞는다.
  hub: { backgroundColor: COLORS.white, borderRadius: RADIUS.lg, padding: SPACING.lg },
  hubHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  hubLabel: { fontSize: 13, fontFamily: FONTS.semibold, color: COLORS.textSecondary },
  hubManage: { flexDirection: 'row', alignItems: 'center', gap: 3, paddingVertical: 2, paddingLeft: 8 },
  hubManageText: { fontSize: 12, fontFamily: FONTS.semibold, color: COLORS.primary },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm, marginTop: 12 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: COLORS.primary,
    paddingLeft: 11,
    paddingRight: 7,
    paddingVertical: 6,
    borderRadius: RADIUS.pill,
  },
  chipText: { color: COLORS.white, fontSize: 12, fontFamily: FONTS.semibold },
  chipX: {
    width: 15,
    height: 15,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.25)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipAdd: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: RADIUS.pill,
    borderWidth: 1.2,
    borderColor: COLORS.chipBorder,
    borderStyle: 'dashed',
  },
  chipAddText: { color: COLORS.primary, fontSize: 12, fontFamily: FONTS.semibold },
  // 관리를 닫았을 때의 고르기 칩(전체·게시판). 카드 안쪽 여백(lg)을 넘어 끝까지 넘기게 좌우로 늘린다.
  filterScroll: { marginTop: 12, marginHorizontal: -SPACING.lg },
  filterRow: { gap: SPACING.sm, paddingHorizontal: SPACING.lg },
  filterChip: {
    paddingHorizontal: 13,
    paddingVertical: 7,
    borderRadius: RADIUS.pill,
    borderWidth: 1.2,
    borderColor: COLORS.chipBorder,
    backgroundColor: COLORS.white,
  },
  filterChipOn: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  filterChipText: { color: COLORS.textSecondary, fontSize: 12, fontFamily: FONTS.semibold },
  filterChipTextOn: { color: COLORS.white },
})
