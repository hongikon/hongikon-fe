import { Pressable, StyleSheet, Text, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { COLORS } from '../../../../constants/colors'
import { FONTS } from '../../../../constants/typography'
import { daySpansSummary } from '../../../../utils/map/report/reportSheet'
import { formatDaySpan, isSameKstDay, type ReportDaySpan } from '../../../../utils/map/report/reportSchedule'

interface ReportDaysBoxProps {
  daySpans: readonly ReportDaySpan[]
  /** 화면의 '지금'(1분마다 갱신). */
  clock: number
  open: boolean
  onToggle: () => void
}

/** 날짜별 운영 시간: 오늘(또는 가장 가까운 날) 한 줄, 누르면 날짜별로 펼친다. 오늘은 진하게, 지난 날은 옅게. */
export default function ReportDaysBox({ daySpans, clock, open, onToggle }: ReportDaysBoxProps) {
  const summary = daySpansSummary(daySpans, clock)
  return (
    <View style={styles.daysBox}>
      <Pressable
        onPress={onToggle}
        style={({ pressed }) => [styles.daysHeader, pressed && { opacity: 0.6 }]}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        accessibilityLabel={`${summary}. 날짜별 운영 시간 ${open ? '접기' : '펼치기'}`}
      >
        <Ionicons name="time-outline" size={14} color={COLORS.primary} />
        <Text style={styles.daysSummary} numberOfLines={1}>
          {summary}
        </Text>
        <Text style={styles.daysToggle}>날짜별 시간</Text>
        <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={14} color={COLORS.textSecondary} />
      </Pressable>
      {open ? (
        <View style={styles.dayList} accessibilityLabel="날짜별 운영 시간">
          {daySpans.map((span) => {
            const today = isSameKstDay(span.startMs, clock)
            const past = span.endMs <= clock
            return (
              <Text key={span.date} style={[styles.dayRow, past && styles.dayRowPast, today && styles.dayRowToday]}>
                {formatDaySpan(span)}
                {today ? ' · 오늘' : ''}
              </Text>
            )
          })}
        </View>
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  daysBox: { marginTop: 12, borderRadius: 10, backgroundColor: COLORS.primarySoft, paddingHorizontal: 12, paddingVertical: 10 },
  daysHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 24 },
  daysSummary: { flex: 1, fontFamily: FONTS.semibold, fontSize: 13, color: COLORS.primary, fontVariant: ['tabular-nums'] },
  daysToggle: { fontFamily: FONTS.regular, fontSize: 12.5, color: COLORS.textSecondary },
  dayList: { marginTop: 8, gap: 3 },
  dayRow: { fontFamily: FONTS.regular, fontSize: 12.5, color: COLORS.textSecondary, fontVariant: ['tabular-nums'] },
  dayRowToday: { fontFamily: FONTS.semibold, color: COLORS.textPrimary },
  dayRowPast: { color: COLORS.textTertiary },
})
