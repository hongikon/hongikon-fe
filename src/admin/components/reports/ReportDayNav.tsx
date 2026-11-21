import { Pressable, StyleSheet, Text, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { COLORS } from '../../../constants/colors'
import { FONTS } from '../../../constants/typography'
import { formatDayLabel } from '../../utils/reportReview'

interface Props {
  /** 'yyyy-MM-dd' (한국 날짜) */
  day: string
  /** 오늘이면 '다음 날'을 막는다. */
  isLatestDay: boolean
  onPrev: () => void
  onNext: () => void
}

/** '날짜 지정' 기간에서 하루씩 ‹ › 로 넘겨 보는 줄(오늘 이후로는 못 간다). */
export function ReportDayNav({ day, isLatestDay, onPrev, onNext }: Props) {
  return (
    <View style={styles.dayRow}>
      <Pressable onPress={onPrev} hitSlop={8} accessibilityRole="button" accessibilityLabel="전날" style={styles.dayArrow}>
        <Ionicons name="chevron-back" size={18} color={COLORS.primary} />
      </Pressable>
      <Text style={styles.dayLabel}>{formatDayLabel(day)} 등록</Text>
      <Pressable
        onPress={onNext}
        disabled={isLatestDay}
        hitSlop={8}
        accessibilityRole="button"
        accessibilityLabel="다음 날"
        style={[styles.dayArrow, isLatestDay && styles.dayArrowDisabled]}
      >
        <Ionicons name="chevron-forward" size={18} color={COLORS.primary} />
      </Pressable>
    </View>
  )
}

const styles = StyleSheet.create({
  dayRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 14, marginBottom: 12 },
  dayArrow: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.primarySoft },
  dayArrowDisabled: { opacity: 0.35 },
  dayLabel: { fontFamily: FONTS.semibold, fontSize: 14, color: COLORS.textPrimary, minWidth: 150, textAlign: 'center' },
})
