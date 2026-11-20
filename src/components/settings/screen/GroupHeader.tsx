import { Pressable, StyleSheet, Text, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { COLORS } from '../../../constants/colors'
import { FONTS, TYPE } from '../../../constants/typography'
import { RADIUS, SPACING } from '../../../constants/spacing'

interface Props {
  icon: keyof typeof Ionicons.glyphMap
  label: string
  value?: string
  badge?: string
  expanded?: boolean
  onPress: () => void
}

/** 묶음 머리 줄: 아이콘(배경 없이) · 이름 · 값 · 펼침 표시. expanded 가 없으면(구독 게시판) 창을 여는 줄이라 > 를 둔다. */
export default function GroupHeader({ icon, label, value, badge, expanded, onPress }: Props) {
  const collapsible = expanded !== undefined
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.groupHeader, pressed && styles.groupHeaderPressed]}
      accessibilityRole="button"
      accessibilityState={collapsible ? { expanded } : undefined}
      accessibilityLabel={[label, badge, value].filter(Boolean).join(', ')}
    >
      <Ionicons name={icon} size={24} color={COLORS.primary} />
      <Text style={styles.groupLabel}>{label}</Text>
      {badge !== undefined && (
        <View style={styles.groupBadge}>
          <Text style={styles.groupBadgeText}>{badge}</Text>
        </View>
      )}
      {value !== undefined && (
        <Text style={styles.groupValue} numberOfLines={1}>
          {value}
        </Text>
      )}
      <Ionicons
        name={collapsible ? (expanded ? 'chevron-up' : 'chevron-down') : 'chevron-forward'}
        size={18}
        color={COLORS.chevron}
      />
    </Pressable>
  )
}

const styles = StyleSheet.create({
  groupHeader: {
    minHeight: 58,
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    backgroundColor: COLORS.white,
  },
  groupHeaderPressed: { backgroundColor: COLORS.fill },
  groupLabel: { flex: 1, fontFamily: FONTS.semibold, fontSize: 17, lineHeight: 23, color: COLORS.textPrimary },
  groupValue: { fontFamily: FONTS.regular, fontSize: 15, color: COLORS.textTertiary, maxWidth: '45%' },
  groupBadge: { paddingHorizontal: SPACING.sm, paddingVertical: 2, borderRadius: RADIUS.pill, backgroundColor: COLORS.warningSoft },
  groupBadgeText: { ...TYPE.label, fontSize: 13, color: COLORS.warning },
})
