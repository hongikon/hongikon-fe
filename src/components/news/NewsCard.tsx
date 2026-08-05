import { memo, useCallback } from 'react'
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { COLORS, CATEGORY_COLORS } from '../../constants/colors'
import type { CategoryKey } from '../../constants/colors'
import { FONTS } from '../../constants/typography'
import type { NewsItem } from '../../types'

interface NewsCardProps {
  item: NewsItem
  bookmarked: boolean
  /**
   * 콜백은 항목마다가 아니라 화면 단위로 하나만 만들어 넘긴다.
   * 카드마다 화살표 함수를 새로 만들면 props 가 매번 달라져 memo 가 소용없어진다.
   */
  onPress: (item: NewsItem) => void
  onToggleBookmark: (id: string) => void
}

function NewsCardComponent({ item, bookmarked, onPress, onToggleBookmark }: NewsCardProps) {
  const catColor = CATEGORY_COLORS[item.category as CategoryKey]

  const handlePress = useCallback(() => onPress(item), [onPress, item])
  const handleToggleBookmark = useCallback(
    () => onToggleBookmark(item.id),
    [onToggleBookmark, item.id],
  )

  return (
    <TouchableOpacity style={styles.card} activeOpacity={0.7} onPress={handlePress}>
      <View style={styles.cardTop}>
        <View style={[styles.badge, { backgroundColor: catColor?.bg }]}>
          <Text style={[styles.badgeText, { color: catColor?.text }]}>{item.category}</Text>
        </View>
        <View style={styles.cardTopRight}>
          <Text style={styles.cardDate}>{item.date}</Text>
          <TouchableOpacity
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            onPress={handleToggleBookmark}
            accessibilityRole="button"
            accessibilityLabel={bookmarked ? '북마크 해제' : '북마크'}
          >
            <Ionicons
              name={bookmarked ? 'bookmark' : 'bookmark-outline'}
              size={16}
              color={bookmarked ? COLORS.primary : '#ccc'}
            />
          </TouchableOpacity>
        </View>
      </View>
      <Text style={styles.cardTitle} numberOfLines={2}>{item.title}</Text>
      <Text style={styles.cardPreview} numberOfLines={1}>{item.preview}</Text>
      <View style={styles.cardSource}>
        <Ionicons name="business-outline" size={12} color="#ccc" />
        <Text style={styles.cardSourceName}>{item.source}</Text>
      </View>
    </TouchableOpacity>
  )
}

/**
 * 북마크를 하나 누르면 그 카드의 bookmarked 만 바뀐다.
 * memo 가 없으면 목록 전체가 다시 그려진다.
 */
export default memo(NewsCardComponent)

const styles = StyleSheet.create({
  card: { backgroundColor: COLORS.white, borderRadius: 14, padding: 14 },
  cardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  badgeText: { fontSize: 10, fontFamily: FONTS.semibold },
  cardTopRight: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  cardDate: { fontFamily: FONTS.regular, fontSize: 11, color: '#ccc' },
  cardTitle: {
    fontSize: 14,
    fontFamily: FONTS.semibold,
    color: COLORS.textPrimary,
    lineHeight: 20,
    marginBottom: 4,
  },
  cardPreview: {
    fontFamily: FONTS.regular,
    fontSize: 12,
    color: COLORS.textSecondary,
    lineHeight: 17,
    marginBottom: 10,
  },
  cardSource: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingTop: 10,
    borderTopWidth: 0.5,
    borderTopColor: '#f2f2f2',
  },
  cardSourceName: { fontSize: 11, color: '#aaa', fontFamily: FONTS.medium },
})
