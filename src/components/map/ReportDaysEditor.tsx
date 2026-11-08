import { useCallback, useState } from 'react'
import { Text, TouchableOpacity, StyleSheet, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { COLORS } from '../../constants/colors'
import { FONTS } from '../../constants/typography'
import { RADIUS } from '../../constants/spacing'
import {
  REPORT_TIME_STEP_MINUTES,
  canRunDaily,
  defaultReportDays,
  formatClock,
  formatDay,
  kstMidnight,
  toReportDayHours,
  type ReportDayHours,
  type ReportDaySpan,
} from '../../utils/reportSchedule'
import ReportTimeSheet from './ReportTimeSheet'

const DAY_MS = 24 * 60 * 60 * 1000
const STEP_MS = REPORT_TIME_STEP_MINUTES * 60 * 1000

/** 고칠 수 있는 하루. off 면 그날은 쉰다(첫날·마지막 날은 쉴 수 없다 — 기간을 줄이면 된다). */
export interface EditableDay extends ReportDaySpan {
  off?: boolean
}

/**
 * 고른 시작·종료와 고친 날들로 지금 보일 날짜 목록. 날마다 처음엔 시작 시각~끝 시각이고, 고친 날·쉬는 날은 남긴다.
 * 첫날 시작·마지막 날 끝은 언제나 위에서 고른 시작·종료 시각이다.
 */
export function effectiveDays(startMs: number, endMs: number, edited: readonly EditableDay[]): EditableDay[] {
  const off = new Set(edited.filter((day) => day.off).map((day) => day.date))
  const days = defaultReportDays(startMs, endMs, edited)
  return days.map((day, index) => ({ ...day, off: index > 0 && index < days.length - 1 && off.has(day.date) }))
}

/** 서버로 보낼 날짜별 운영 시간. 켜지 않았거나 쓸 수 없으면 null(한 번짜리). */
export function reportDaysFor(
  enabled: boolean,
  startMs: number,
  endMs: number,
  edited: readonly EditableDay[],
): ReportDayHours[] | null {
  if (!enabled || !canRunDaily(startMs, endMs)) return null
  const open = effectiveDays(startMs, endMs, edited).filter((day) => !day.off)
  return open.length >= 2 ? toReportDayHours(open) : null
}

interface ReportDaysEditorProps {
  /** 고른 시작(첫날 시작)·종료(마지막 날 끝). */
  startMs: number
  endMs: number
  enabled: boolean
  onToggle: (next: boolean) => void
  /** 고친 날·쉬는 날. `effectiveDays` 로 날짜 목록이 된다. */
  edited: readonly EditableDay[]
  onChangeEdited: (next: EditableDay[]) => void
  /** 첫날 시작·마지막 날 끝을 고치면 위의 시작·종료 시각도 같이 바뀐다. */
  onChangeStart: (ms: number) => void
  onChangeEnd: (ms: number) => void
  /** 첫날 시작을 고를 수 있는 가장 이른 시각(지금 이후). */
  earliestStart: number
  /** 첫날 시작을 바꿀 수 없으면(이미 시작한 제보의 시간 수정) true. */
  startLocked?: boolean
  disabled?: boolean
}

/**
 * '매일 정해진 시간에만 운영' 체크와 날짜별 운영 시간(11-08). 여러 날 행사 중 정해진 시간에만 여는 부스·간식행사용.
 * 켜면 날마다 한 줄씩(처음엔 모두 같은 시간) 보이고, 시각을 눌러 그날만 바꾸거나 가운데 날은 '쉬는 날'로 뺀다.
 * 지도에는 기간 내내 핀이 있고, 핀·시트가 '오늘 14:00 시작'·'운영 중'·'곧 종료'를 보여 준다.
 * 부모가 `canRunDaily(startMs, endMs)` 일 때만 그린다.
 */
export default function ReportDaysEditor({
  startMs,
  endMs,
  enabled,
  onToggle,
  edited,
  onChangeEdited,
  onChangeStart,
  onChangeEnd,
  earliestStart,
  startLocked = false,
  disabled,
}: ReportDaysEditorProps) {
  const days = effectiveDays(startMs, endMs, edited)
  const [picker, setPicker] = useState<{ index: number; side: 'start' | 'end' } | null>(null)

  const replaceDay = (index: number, next: EditableDay) => {
    const others = days.filter((_, i) => i !== index)
    onChangeEdited([...others, next])
  }

  const pickedDay = picker ? days[picker.index] : null
  const pickedMidnight = pickedDay ? kstMidnight(pickedDay.startMs) : 0
  const isValid = useCallback(
    (ms: number) => {
      if (!pickedDay || !picker) return false
      if (ms < pickedMidnight || ms >= pickedMidnight + DAY_MS) return false
      if (picker.side === 'start') return ms < pickedDay.endMs && (picker.index > 0 || ms >= earliestStart)
      return ms > pickedDay.startMs
    },
    [pickedDay, picker, pickedMidnight, earliestStart],
  )

  const confirm = (ms: number) => {
    if (!picker || !pickedDay) return
    const { index, side } = picker
    setPicker(null)
    const last = days.length - 1
    if (side === 'start' && index === 0) return onChangeStart(ms)
    if (side === 'end' && index === last) return onChangeEnd(ms)
    replaceDay(index, side === 'start' ? { ...pickedDay, startMs: ms } : { ...pickedDay, endMs: ms })
  }

  const firstRange = `${formatClock(startMs)}~${formatClock(endMs)}`
  return (
    <View>
      <TouchableOpacity
        style={[styles.toggle, enabled && styles.toggleOn, disabled && styles.disabled]}
        onPress={() => onToggle(!enabled)}
        disabled={disabled}
        activeOpacity={0.75}
        accessibilityRole="checkbox"
        accessibilityState={{ checked: enabled, disabled: !!disabled }}
        accessibilityLabel="매일 정해진 시간에만 운영"
      >
        <Ionicons name={enabled ? 'checkbox' : 'square-outline'} size={20} color={COLORS.primary} />
        <View style={styles.toggleText}>
          <Text style={styles.toggleLabel}>매일 정해진 시간에만 운영</Text>
          <Text style={styles.toggleNote}>
            {enabled
              ? '시각을 누르면 그날만 바꿀 수 있어요. 기간 내내 지도에 있고 운영 시간이 함께 보여요.'
              : `여러 날 ${firstRange}처럼 정해진 시간에만 여는 부스·행사라면 켜 주세요.`}
          </Text>
        </View>
      </TouchableOpacity>

      {enabled ? (
        <View style={styles.list}>
          {days.map((day, index) => {
            const edge = index === 0 || index === days.length - 1
            const startFixed = index === 0 && startLocked
            return (
              <View key={day.date} style={styles.row}>
                <Text style={[styles.date, day.off && styles.offText]}>{formatDay(day.startMs)}</Text>
                {day.off ? (
                  <Text style={styles.offLabel}>쉬는 날</Text>
                ) : (
                  <View style={styles.times}>
                    <TimeButton
                      label={formatClock(day.startMs)}
                      disabled={disabled || startFixed}
                      onPress={() => setPicker({ index, side: 'start' })}
                      accessibilityLabel={`${formatDay(day.startMs)} 시작 ${formatClock(day.startMs)}${startFixed ? ', 이미 시작해 바꿀 수 없어요' : ', 바꾸기'}`}
                    />
                    <Text style={styles.dash}>~</Text>
                    <TimeButton
                      label={formatClock(day.endMs)}
                      disabled={disabled}
                      onPress={() => setPicker({ index, side: 'end' })}
                      accessibilityLabel={`${formatDay(day.startMs)} 끝 ${formatClock(day.endMs)}, 바꾸기`}
                    />
                  </View>
                )}
                {edge ? (
                  <View style={styles.offButtonSpacer} />
                ) : (
                  <TouchableOpacity
                    style={styles.offButton}
                    onPress={() => replaceDay(index, { ...day, off: !day.off })}
                    disabled={disabled}
                    accessibilityRole="button"
                    accessibilityLabel={day.off ? `${formatDay(day.startMs)} 운영하기` : `${formatDay(day.startMs)} 쉬는 날로`}
                  >
                    <Text style={styles.offButtonText}>{day.off ? '운영' : '쉬는 날'}</Text>
                  </TouchableOpacity>
                )}
              </View>
            )
          })}
        </View>
      ) : null}

      <ReportTimeSheet
        visible={picker !== null}
        title={pickedDay && picker ? `${formatDay(pickedDay.startMs)} ${picker.side === 'start' ? '시작' : '끝'} 시각` : ''}
        baseMidnight={pickedMidnight}
        dayCount={1}
        dayLabel={() => (pickedDay ? formatDay(pickedDay.startMs) : '')}
        isValid={isValid}
        initialMs={
          pickedDay && picker
            ? picker.side === 'start'
              ? pickedDay.startMs
              : Math.max(pickedDay.endMs, pickedDay.startMs + STEP_MS)
            : 0
        }
        onCancel={() => setPicker(null)}
        onConfirm={confirm}
      />
    </View>
  )
}

function TimeButton({
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
      style={[styles.time, disabled && styles.disabled]}
      onPress={onPress}
      disabled={disabled}
      activeOpacity={0.7}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
    >
      <Text style={styles.timeText}>{label}</Text>
    </TouchableOpacity>
  )
}

const styles = StyleSheet.create({
  toggle: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    marginTop: 10,
    paddingHorizontal: 12,
    paddingVertical: 11,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.chipBorder,
    backgroundColor: COLORS.white,
  },
  toggleOn: { borderColor: COLORS.primary, backgroundColor: COLORS.primarySoft },
  disabled: { opacity: 0.5 },
  toggleText: { flex: 1, gap: 2 },
  toggleLabel: { fontFamily: FONTS.semibold, fontSize: 14, color: COLORS.primary },
  toggleNote: { fontFamily: FONTS.regular, fontSize: 12, color: COLORS.textSecondary },
  list: { marginTop: 8, gap: 6 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 40 },
  date: { width: 72, fontFamily: FONTS.semibold, fontSize: 13.5, color: COLORS.textPrimary },
  offText: { color: COLORS.textTertiary },
  times: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6 },
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
  dash: { fontFamily: FONTS.regular, fontSize: 13, color: COLORS.textSecondary },
  offLabel: { flex: 1, fontFamily: FONTS.regular, fontSize: 13, color: COLORS.textTertiary },
  offButton: { minHeight: 36, paddingHorizontal: 8, justifyContent: 'center' },
  offButtonText: { fontFamily: FONTS.regular, fontSize: 12.5, color: COLORS.textSecondary, textDecorationLine: 'underline' },
  offButtonSpacer: { width: 52 },
})
