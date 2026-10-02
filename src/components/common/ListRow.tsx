import type { ReactNode } from 'react'
import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { COLORS } from '../../constants/colors'
import { TYPE } from '../../constants/typography'
import { SPACING } from '../../constants/spacing'

interface ListRowProps {
  label: string
  icon?: keyof typeof Ionicons.glyphMap
  /** 이름 아래 한 줄 설명 */
  description?: string
  /** 오른쪽 회색 값(앱 버전·개수 등) */
  value?: string
  /** 값 자리 앞의 작은 강조 배지(승인 대기 개수 등). */
  badge?: string
  /** 빨간 글자. 로그아웃·초기화처럼 되돌리기 어려운 행동. */
  danger?: boolean
  onPress?: () => void
  /** 오른쪽에 둘 컨트롤(스위치 등). 주면 줄 전체는 눌리지 않는다. */
  right?: ReactNode
  /** 섹션의 마지막 줄이면 아래 구분선을 지운다. */
  last?: boolean
  style?: StyleProp<ViewStyle>
  accessibilityLabel?: string
}

/**
 * 설정·목록의 한 줄. 아이콘 · 이름(+설명) · 값 · > 순서이고, 높이·구분선·> 크기를 앱 전체에서 같게 맞춘다.
 * 누를 수 없는 줄(앱 버전 등)은 버튼으로 읽히지 않는다.
 */
export default function ListRow({
  label,
  icon,
  description,
  value,
  badge,
  danger = false,
  onPress,
  right,
  last = false,
  style,
  accessibilityLabel,
}: ListRowProps) {
  const pressable = onPress !== undefined && right === undefined
  const content = (
    <>
      {icon && (
        <Ionicons name={icon} size={20} color={danger ? COLORS.danger : COLORS.textSecondary} />
      )}
      <View style={styles.body}>
        <Text style={[styles.label, danger && styles.danger]}>{label}</Text>
        {description !== undefined && <Text style={styles.description}>{description}</Text>}
      </View>
      {badge !== undefined && (
        <View style={styles.badge}>
          <Text style={styles.badgeText} numberOfLines={1}>
            {badge}
          </Text>
        </View>
      )}
      {value !== undefined && (
        <Text style={styles.value} numberOfLines={1}>
          {value}
        </Text>
      )}
      {right}
      {pressable && !danger && <Ionicons name="chevron-forward" size={16} color={COLORS.chevron} />}
    </>
  )

  if (!pressable) {
    return (
      <View style={[styles.row, !last && styles.divider, style]} accessibilityLabel={accessibilityLabel}>
        {content}
      </View>
    )
  }
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.row, !last && styles.divider, pressed && styles.pressed, style]}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
    >
      {content}
    </Pressable>
  )
}

const styles = StyleSheet.create({
  row: {
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    backgroundColor: COLORS.white,
  },
  divider: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: COLORS.border },
  pressed: { backgroundColor: COLORS.fill },
  body: { flex: 1, gap: SPACING.xxs },
  label: { ...TYPE.body, color: COLORS.textPrimary },
  danger: { color: COLORS.danger },
  description: { ...TYPE.caption, color: COLORS.textSecondary },
  value: { ...TYPE.callout, color: COLORS.textTertiary, maxWidth: '45%' },
  badge: {
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xxs,
    borderRadius: 999,
    backgroundColor: COLORS.warningSoft,
  },
  badgeText: { ...TYPE.label, color: COLORS.warning },
})
