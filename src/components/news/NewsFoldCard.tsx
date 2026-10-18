import { memo, useCallback } from 'react'
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { COLORS, CATEGORY_COLORS } from '../../constants/colors'
import { FONTS } from '../../constants/typography'
import { RADIUS } from '../../constants/spacing'
import type { NewsItem } from '../../types'

interface NewsFoldCardProps {
  foldKey: string
  date: string
  items: NewsItem[]
  expanded: boolean
  /** 화면 단위로 하나만 만들어 넘긴다(NewsCard 와 같은 까닭). */
  onToggle: (foldKey: string) => void
}

/** 앞 몇 건 제목만 미리 보여 준다. */
const PREVIEW_COUNT = 2

/**
 * 구독 피드에서 한 날짜의 채용정보 글을 접어 둔 카드(`foldNewsRows`). 누르면 그 글들이 바로 아래로 펼쳐진다.
 * 모양은 NewsCard 와 같은 흰 카드에 맞추고, 건수를 제목으로 둔다.
 */
function NewsFoldCardComponent({ foldKey, date, items, expanded, onToggle }: NewsFoldCardProps) {
  const catColor = CATEGORY_COLORS['취업']
  const sourceName = items[0]?.source ?? '채용정보'
  const handlePress = useCallback(() => onToggle(foldKey), [onToggle, foldKey])

  return (
    <TouchableOpacity
      style={[styles.card, expanded && styles.cardExpanded]}
      activeOpacity={0.7}
      onPress={handlePress}
      accessibilityRole="button"
      accessibilityState={{ expanded }}
      accessibilityLabel={`${sourceName} ${date} 채용 공고 ${items.length}건 ${expanded ? '접기' : '펼치기'}`}
    >
      <View style={styles.cardTop}>
        <View style={[styles.badge, { backgroundColor: catColor?.bg }]}>
          <Text style={[styles.badgeText, { color: catColor?.text }]}>취업</Text>
        </View>
        <Text style={styles.cardDate}>{date}</Text>
      </View>
      <Text style={styles.cardTitle}>채용 공고 {items.length}건</Text>
      {!expanded &&
        items.slice(0, PREVIEW_COUNT).map((item) => (
          <Text key={item.id} style={styles.previewLine} numberOfLines={1}>
            {item.title}
          </Text>
        ))}
      <View style={styles.cardFoot}>
        <View style={styles.source}>
          <Ionicons name="business-outline" size={12} color={COLORS.textTertiary} />
          <Text style={styles.sourceName}>{sourceName}</Text>
        </View>
        <View style={styles.toggle}>
          <Text style={styles.toggleText}>{expanded ? '접기' : `${items.length}건 모두 보기`}</Text>
          <Ionicons name={expanded ? 'chevron-up' : 'chevron-down'} size={14} color={COLORS.primary} />
        </View>
      </View>
    </TouchableOpacity>
  )
}

export default memo(NewsFoldCardComponent)

const styles = StyleSheet.create({
  card: { backgroundColor: COLORS.white, borderRadius: RADIUS.lg, padding: 16 },
  // 펼친 동안은 아래 글들의 머리라는 걸 테두리로 드러낸다.
  cardExpanded: { borderWidth: 1, borderColor: COLORS.primary },
  cardTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  badgeText: { fontSize: 11, fontFamily: FONTS.semibold },
  cardDate: { fontFamily: FONTS.regular, fontSize: 12, color: COLORS.textTertiary },
  cardTitle: { fontSize: 15, fontFamily: FONTS.semibold, color: COLORS.textPrimary, lineHeight: 21, marginBottom: 4 },
  previewLine: { fontFamily: FONTS.regular, fontSize: 13, color: COLORS.textSecondary, lineHeight: 19 },
  cardFoot: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: COLORS.divider,
  },
  source: { flexDirection: 'row', alignItems: 'center', gap: 4, flexShrink: 1 },
  sourceName: { fontSize: 12, color: COLORS.textTertiary, fontFamily: FONTS.medium },
  toggle: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  toggleText: { fontSize: 12, color: COLORS.primary, fontFamily: FONTS.semibold },
})
