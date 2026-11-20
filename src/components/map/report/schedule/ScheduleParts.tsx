import { StyleSheet, Text, TouchableOpacity } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { COLORS } from '../../../../constants/colors'
import { FONTS } from '../../../../constants/typography'
import { chipStyles } from '../../chipStyles'

/** 요약 카드의 한 줄(시작 · 끝). 누르면 다이얼 시트를 연다. */
export function SummaryRow({
  label,
  value,
  onPress,
  disabled,
  accessibilityLabel,
}: {
  label: string
  value: string
  onPress: () => void
  disabled?: boolean
  accessibilityLabel: string
}) {
  return (
    <TouchableOpacity
      style={styles.summaryRow}
      onPress={onPress}
      disabled={disabled}
      activeOpacity={0.7}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
    >
      <Text style={styles.summaryLabel}>{label}</Text>
      <Text style={styles.summaryValue}>{value}</Text>
      <Ionicons name="chevron-forward" size={16} color={COLORS.primary} />
    </TouchableOpacity>
  )
}

/** '언제' 영역의 빠른 칩(지금 · 1/2/3/6시간 · 직접 고르기). */
export function Chip({
  label,
  active,
  disabled,
  onPress,
  icon,
  compact,
  accessibilityLabel,
}: {
  label: string
  active: boolean
  disabled?: boolean
  onPress: () => void
  icon?: keyof typeof Ionicons.glyphMap
  compact?: boolean
  accessibilityLabel?: string
}) {
  return (
    <TouchableOpacity
      activeOpacity={0.75}
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityState={{ selected: active, disabled: !!disabled }}
      accessibilityLabel={accessibilityLabel ?? label}
      style={[
        chipStyles.chip,
        compact && styles.compactChip,
        active && styles.chipActive,
        disabled && !active && styles.chipDisabled,
      ]}
    >
      {icon ? <Ionicons name={icon} size={13} color={active ? COLORS.white : COLORS.primary} /> : null}
      <Text style={[chipStyles.label, active && chipStyles.labelActive]}>{label}</Text>
    </TouchableOpacity>
  )
}

const styles = StyleSheet.create({
  compactChip: { paddingHorizontal: 9 },
  chipActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  chipDisabled: { opacity: 0.4 },
  summaryRow: { flexDirection: 'row', alignItems: 'center', minHeight: 44, gap: 8 },
  summaryLabel: { width: 32, fontFamily: FONTS.regular, fontSize: 13, color: COLORS.textSecondary },
  summaryValue: { flex: 1, fontFamily: FONTS.semibold, fontSize: 15, color: COLORS.primary },
})
