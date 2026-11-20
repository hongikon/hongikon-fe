import { StyleSheet, Text, TouchableOpacity } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { COLORS } from '../../../../constants/colors'
import { RADIUS } from '../../../../constants/spacing'
import { FONTS } from '../../../../constants/typography'
import type { EditableDay } from '../../../../utils/map/reportDays'
import { formatDay } from '../../../../utils/reportSchedule'

/** 날짜별 운영 시간 편집기의 작은 버튼들: 마지막 날 ± · 쉬는 날 토글 · 시각. */
export function StepButton({
  icon,
  disabled,
  onPress,
  accessibilityLabel,
}: {
  icon: 'add' | 'remove'
  disabled?: boolean
  onPress: () => void
  accessibilityLabel: string
}) {
  return (
    <TouchableOpacity
      style={[buttonStyles.stepButton, disabled && buttonStyles.disabled]}
      onPress={onPress}
      disabled={disabled}
      hitSlop={6}
      accessibilityRole="button"
      accessibilityState={{ disabled: !!disabled }}
      accessibilityLabel={accessibilityLabel}
    >
      <Ionicons name={icon} size={18} color={COLORS.primary} />
    </TouchableOpacity>
  )
}

export function OffButton({ day, disabled, onPress }: { day: EditableDay; disabled?: boolean; onPress: () => void }) {
  return (
    <TouchableOpacity
      style={buttonStyles.offButton}
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={day.off ? `${formatDay(day.startMs)} 운영하기` : `${formatDay(day.startMs)} 쉬는 날로`}
    >
      <Text style={buttonStyles.offButtonText}>{day.off ? '운영' : '쉬는 날'}</Text>
    </TouchableOpacity>
  )
}

export function TimeButton({
  label,
  disabled,
  onPress,
  accessibilityLabel,
}: {
  label: string
  disabled?: boolean
  onPress: () => void
  accessibilityLabel: string
}) {
  return (
    <TouchableOpacity
      style={[buttonStyles.time, disabled && buttonStyles.disabled]}
      onPress={onPress}
      disabled={disabled}
      activeOpacity={0.7}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
    >
      <Text style={buttonStyles.timeText}>{label}</Text>
    </TouchableOpacity>
  )
}

export const buttonStyles = StyleSheet.create({
  disabled: { opacity: 0.5 },
  stepButton: {
    width: 36,
    height: 36,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  time: {
    minWidth: 64,
    minHeight: 36,
    paddingHorizontal: 10,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  timeText: { fontFamily: FONTS.semibold, fontSize: 14, color: COLORS.primary, fontVariant: ['tabular-nums'] },
  offButton: { minHeight: 36, paddingHorizontal: 8, justifyContent: 'center' },
  offButtonText: { fontFamily: FONTS.regular, fontSize: 12.5, color: COLORS.textSecondary, textDecorationLine: 'underline' },
})
