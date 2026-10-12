import { memo, useCallback, useState } from 'react'
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { COLORS } from '../../constants/colors'
import { FONTS } from '../../constants/typography'
import { RADIUS, SPACING } from '../../constants/spacing'
import type { NewsItem } from '../../types'

interface PinnedNoticeSectionProps {
  /** 상단 고정 글. 비어 있으면 아무것도 그리지 않는다. */
  items: readonly NewsItem[]
  /** 화면 단위로 하나만 만들어 넘긴다(NewsCard 와 같은 이유 — memo 가 소용없어지지 않게). */
  onPressItem: (item: NewsItem) => void
}

/** 고정 글 한 줄. 제목만 한 줄로 줄여 보여준다 — 날짜·요약까지 넣으면 아래 목록을 너무 밀어낸다. */
const PinnedRow = memo(function PinnedRow({
  item,
  onPress,
}: {
  item: NewsItem
  onPress: (item: NewsItem) => void
}) {
  const handlePress = useCallback(() => onPress(item), [onPress, item])
  return (
    <TouchableOpacity
      style={styles.row}
      activeOpacity={0.6}
      onPress={handlePress}
      accessibilityRole="button"
      accessibilityLabel={`고정 공지: ${item.title}`}
    >
      <Text style={styles.bullet}>·</Text>
      <Text style={styles.rowTitle} numberOfLines={1}>
        {item.title}
      </Text>
    </TouchableOpacity>
  )
})

/**
 * 게시판 목록 위에 붙는 "고정 공지" 묶음(국제교류실처럼 원 게시판에 상단 고정 글이 있는 곳).
 * 고정 글은 오래돼도 계속 맨 위에 있어 최신순 목록에 섞으면 순서가 어긋나므로, 목록에선 빼고(`pinned: false`)
 * 여기서 제목만 따로 보여준다. 접힘 상태는 화면에 있는 동안만 기억한다.
 */
function PinnedNoticeSectionComponent({ items, onPressItem }: PinnedNoticeSectionProps) {
  const [expanded, setExpanded] = useState(true)
  const toggle = useCallback(() => setExpanded((v) => !v), [])

  if (items.length === 0) return null

  return (
    <View style={styles.card}>
      <TouchableOpacity
        style={styles.head}
        activeOpacity={0.6}
        onPress={toggle}
        accessibilityRole="button"
        accessibilityLabel={`고정 공지 ${items.length}개`}
        accessibilityHint={expanded ? '목록을 접어요' : '목록을 펼쳐요'}
        accessibilityState={{ expanded }}
      >
        <Ionicons name="pin" size={14} color={COLORS.primary} />
        <Text style={styles.headLabel}>고정 공지</Text>
        <Text style={styles.headCount}>{items.length}</Text>
        <View style={styles.headSpacer} />
        <Ionicons name={expanded ? 'chevron-up' : 'chevron-down'} size={16} color={COLORS.iconInactive} />
      </TouchableOpacity>

      {expanded && (
        <View style={styles.rows}>
          {items.map((item) => (
            <PinnedRow key={item.id} item={item} onPress={onPressItem} />
          ))}
        </View>
      )}
    </View>
  )
}

export default memo(PinnedNoticeSectionComponent)

const styles = StyleSheet.create({
  // 구독 탭 "내 구독" 묶음(NewsScreen hub)과 같은 카드 — 아래 소식 카드와 곡률·안쪽 여백을 맞춘다.
  card: { backgroundColor: COLORS.white, borderRadius: RADIUS.lg, paddingHorizontal: SPACING.lg, paddingVertical: SPACING.md },
  head: { flexDirection: 'row', alignItems: 'center', gap: SPACING.xs, paddingVertical: SPACING.xs },
  headLabel: { fontSize: 13, fontFamily: FONTS.semibold, color: COLORS.textSecondary },
  headCount: { fontSize: 13, fontFamily: FONTS.semibold, color: COLORS.primary },
  headSpacer: { flex: 1 },
  rows: {
    marginTop: SPACING.sm,
    paddingTop: SPACING.xs,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: COLORS.divider,
  },
  // 한 줄이 짧아도 손가락으로 누르기 쉽게 위아래 여백을 넉넉히 둔다.
  row: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, paddingVertical: SPACING.sm },
  bullet: { fontSize: 14, fontFamily: FONTS.bold, color: COLORS.textTertiary },
  rowTitle: { flex: 1, fontSize: 14, fontFamily: FONTS.medium, color: COLORS.textPrimary },
})
