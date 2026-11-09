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
  kstDateKey,
  kstMidnight,
  kstMinutesOfDay,
  toReportDayHours,
  type ReportDayHours,
  type ReportDaySpan,
} from '../../utils/reportSchedule'
import ReportTimeSheet from './ReportTimeSheet'

const DAY_MS = 24 * 60 * 60 * 1000
const MINUTE_MS = 60 * 1000
const STEP_MS = REPORT_TIME_STEP_MINUTES * MINUTE_MS

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

/**
 * 시작을 바꿀 때(예: '지금'으로) 날마다의 시각이 새 시작 시각을 따라가지 않게, 지금 보이는 '매일' 시작 시각으로
 * 아직 고치지 않은 날을 모두 채워 둔다. 고친 날·쉬는 날은 그대로.
 */
export function pinDailyHours(
  startMs: number,
  endMs: number,
  edited: readonly EditableDay[],
  nextStartMs: number,
  nextEndMs: number,
): EditableDay[] {
  const days = effectiveDays(startMs, endMs, edited)
  const open = kstMinutesOfDay(days[days.length - 1].startMs)
  const close = kstMinutesOfDay(endMs)
  const kept = new Map(edited.map((day) => [day.date, day]))
  const out: EditableDay[] = []
  for (let midnight = kstMidnight(nextStartMs); midnight <= kstMidnight(nextEndMs); midnight += DAY_MS) {
    const date = kstDateKey(midnight)
    out.push(kept.get(date) ?? { date, startMs: midnight + open * MINUTE_MS, endMs: midnight + close * MINUTE_MS })
  }
  return out
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

/** 편집기가 부모에게 한 번에 넘기는 바뀐 값. 여러 값이 같이 바뀌어도 한 번에 넘겨야 부모가 앞의 값을 덮어쓰지 않는다. */
export interface ReportDaysPatch {
  daily?: boolean
  edited?: EditableDay[]
  /** 첫날 시작(=제보 시작)을 이 시각으로. */
  startMs?: number
  /** 마지막 날 끝(=제보 종료)을 이 시각으로. */
  endMs?: number
}

type DaysMode = 'same' | 'each'

interface ReportDaysEditorProps {
  /** 고른 시작(첫날 시작)·종료(마지막 날 끝). */
  startMs: number
  endMs: number
  enabled: boolean
  /** 고친 날·쉬는 날. `effectiveDays` 로 날짜 목록이 된다. */
  edited: readonly EditableDay[]
  onChange: (patch: ReportDaysPatch) => void
  /** 첫날 시작을 고를 수 있는 가장 이른 시각(지금 이후). */
  earliestStart: number
  /** 시작이 '지금'이면 true — 첫날은 지금부터이고 '매일' 시작 시각은 둘째 날부터 맞춘다. */
  startIsNow?: boolean
  /** 첫날 시작을 바꿀 수 없으면(이미 시작한 제보의 시간 수정) true. */
  startLocked?: boolean
  disabled?: boolean
}

const LAST_SLOT_MINUTES = 24 * 60 - REPORT_TIME_STEP_MINUTES

/** 체크를 처음 켤 때의 매일 운영 시간: 고른 시작 시각(지금이면 지금 시각의 정각)~종료 시각. 끝이 시작보다 이르면 4시간짜리로. */
function initialHours(startMs: number, endMs: number, startIsNow: boolean): { open: number; close: number } {
  const startMinutes = kstMinutesOfDay(startMs)
  const open = startIsNow ? Math.floor(startMinutes / 60) * 60 : startMinutes
  const endMinutes = kstMinutesOfDay(endMs)
  const close = endMinutes > open ? endMinutes : Math.min(open + 4 * 60, LAST_SLOT_MINUTES)
  return { open: Math.min(open, close - REPORT_TIME_STEP_MINUTES), close }
}

/** 날마다 같은 시간인지(첫날이 '지금'이면 첫날 시작은 보지 않는다, 쉬는 날은 뺀다). */
function allSameHours(days: readonly EditableDay[], startIsNow: boolean): boolean {
  const open = days.filter((day) => !day.off)
  if (open.length < 2) return true
  const ref = open[open.length - 1]
  const refStart = kstMinutesOfDay(ref.startMs)
  const refEnd = kstMinutesOfDay(ref.endMs)
  return open.every(
    (day, index) =>
      (index === 0 && startIsNow ? true : kstMinutesOfDay(day.startMs) === refStart) && kstMinutesOfDay(day.endMs) === refEnd,
  )
}

/**
 * '매일 정해진 시간에만 운영' 체크와 날짜별 운영 시간(11-08, 11-09 흐름 정리). 여러 날 행사 중 정해진 시간에만 여는 부스·간식행사용.
 * 켜면 '매일 같은 시간'(시각 한 줄을 고치면 모든 날이 같이 바뀌고, 날짜 목록에서는 쉬는 날만 고른다)과
 * '날마다 다르게'(날마다 시각을 따로 고른다) 중에 고른다. 시작이 '지금'이어도 켤 수 있다 — 첫날은 지금부터다.
 * 지도에는 기간 내내 핀이 있고, 핀·시트가 '오늘 14:00 시작'·'운영 중'·'곧 종료'를 보여 준다.
 * 부모가 `canRunDaily(startMs, endMs)` 일 때만 그린다.
 */
export default function ReportDaysEditor({
  startMs,
  endMs,
  enabled,
  edited,
  onChange,
  earliestStart,
  startIsNow = false,
  startLocked = false,
  disabled,
}: ReportDaysEditorProps) {
  const days = effectiveDays(startMs, endMs, edited)
  const [mode, setMode] = useState<DaysMode>(() => (allSameHours(days, startIsNow) ? 'same' : 'each'))
  const [picker, setPicker] = useState<{ index: number; side: 'start' | 'end' } | null>(null)
  const [hoursPicker, setHoursPicker] = useState<'open' | 'close' | null>(null)
  const firstFixed = startIsNow || startLocked

  // '매일 같은 시간'의 시각: 마지막 날 시작(첫날이 지금일 수 있어서)~종료 시각.
  const last = days[days.length - 1]
  const open = kstMinutesOfDay(last.startMs)
  const close = kstMinutesOfDay(endMs)

  /** 모든 날을 open~close 로 맞춘다(쉬는 날은 그대로). 첫날 시작·마지막 날 끝은 제보 시작·종료도 같이 옮긴다. */
  const applySame = (nextOpen: number, nextClose: number, extra: ReportDaysPatch = {}) => {
    const firstMidnight = kstMidnight(startMs)
    const lastMidnight = kstMidnight(endMs)
    const wantStart = firstMidnight + nextOpen * MINUTE_MS
    const nextStart = !firstFixed && wantStart >= earliestStart ? wantStart : startMs
    const nextEnd = lastMidnight + nextClose * MINUTE_MS
    const nextEdited = days.map((day, index) => {
      const midnight = kstMidnight(day.startMs)
      return {
        date: day.date,
        startMs: index === 0 ? nextStart : midnight + nextOpen * MINUTE_MS,
        endMs: midnight + nextClose * MINUTE_MS,
        off: day.off,
      }
    })
    onChange({
      ...extra,
      edited: nextEdited,
      ...(nextStart !== startMs ? { startMs: nextStart } : {}),
      ...(nextEnd !== endMs ? { endMs: nextEnd } : {}),
    })
  }

  const toggle = () => {
    if (enabled) return onChange({ daily: false })
    const hours = initialHours(startMs, endMs, startIsNow)
    setMode('same')
    applySame(hours.open, hours.close, { daily: true })
  }

  const chooseMode = (next: DaysMode) => {
    if (next === mode) return
    setMode(next)
    // 날마다 다르게 고쳐 둔 것을 '매일 같은 시간'으로 돌리면 마지막 날 시간으로 모두 맞춘다.
    if (next === 'same' && !allSameHours(days, startIsNow)) applySame(open, close)
  }

  const replaceDay = (index: number, next: EditableDay) => {
    const others = days.filter((_, i) => i !== index)
    onChange({ edited: [...others, next] })
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
    if (side === 'start' && index === 0) return onChange({ startMs: ms })
    if (side === 'end' && index === days.length - 1) return onChange({ endMs: ms })
    replaceDay(index, side === 'start' ? { ...pickedDay, startMs: ms } : { ...pickedDay, endMs: ms })
  }

  // 매일 시각 다이얼은 마지막 날(언제나 고를 수 있는 날) 위에서 고른다.
  const hoursMidnight = kstMidnight(last.startMs)
  const hoursValid = useCallback(
    (ms: number) => {
      const minutes = Math.round((ms - hoursMidnight) / MINUTE_MS)
      if (minutes < 0 || minutes >= 24 * 60) return false
      return hoursPicker === 'open' ? minutes < close : minutes > open
    },
    [hoursMidnight, hoursPicker, open, close],
  )
  const confirmHours = (ms: number) => {
    const minutes = Math.round((ms - hoursMidnight) / MINUTE_MS)
    const side = hoursPicker
    setHoursPicker(null)
    if (side === 'open') applySame(minutes, close)
    else if (side === 'close') applySame(open, minutes)
  }

  const firstRange = `${formatClock(startMs)}~${formatClock(endMs)}`
  return (
    <View>
      <TouchableOpacity
        style={[styles.toggle, enabled && styles.toggleOn, disabled && styles.disabled]}
        onPress={toggle}
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
              ? '기간 내내 지도에 있고, 핀에 그날 운영 시간이 함께 보여요.'
              : startIsNow
                ? '여러 날 정해진 시간에만 여는 부스·행사라면 켜 주세요. 오늘은 지금부터예요.'
                : `여러 날 ${firstRange}처럼 정해진 시간에만 여는 부스·행사라면 켜 주세요.`}
          </Text>
        </View>
      </TouchableOpacity>

      {enabled ? (
        <View style={styles.body}>
          <View style={styles.segment} accessibilityRole="radiogroup">
            {(
              [
                ['same', '매일 같은 시간'],
                ['each', '날마다 다르게'],
              ] as const
            ).map(([key, label]) => (
              <TouchableOpacity
                key={key}
                style={[styles.segmentItem, mode === key && styles.segmentItemOn]}
                onPress={() => chooseMode(key)}
                disabled={disabled}
                activeOpacity={0.75}
                accessibilityRole="radio"
                accessibilityState={{ selected: mode === key, disabled: !!disabled }}
                accessibilityLabel={label}
              >
                <Text style={[styles.segmentText, mode === key && styles.segmentTextOn]}>{label}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {mode === 'same' ? (
            <>
              <View style={styles.hoursRow}>
                <Text style={styles.hoursLabel}>매일</Text>
                <View style={styles.times}>
                  <TimeButton
                    label={formatClock(hoursMidnight + open * MINUTE_MS)}
                    disabled={disabled}
                    onPress={() => setHoursPicker('open')}
                    accessibilityLabel={`매일 시작 ${formatClock(hoursMidnight + open * MINUTE_MS)}, 바꾸기`}
                  />
                  <Text style={styles.dash}>~</Text>
                  <TimeButton
                    label={formatClock(endMs)}
                    disabled={disabled}
                    onPress={() => setHoursPicker('close')}
                    accessibilityLabel={`매일 끝 ${formatClock(endMs)}, 바꾸기`}
                  />
                </View>
              </View>
              <Text style={styles.sectionNote}>
                {startIsNow ? '오늘은 지금부터 열어요. ' : ''}가운데 날 중 쉬는 날이 있으면 눌러서 빼 주세요.
              </Text>
              <View style={styles.list}>
                {days.map((day, index) => {
                  const edge = index === 0 || index === days.length - 1
                  return (
                    <View key={day.date} style={styles.compactRow}>
                      <Text style={[styles.date, day.off && styles.offText]}>{formatDay(day.startMs)}</Text>
                      <Text style={[styles.compactHours, day.off && styles.offText]}>
                        {day.off ? '쉬는 날' : `${index === 0 && startIsNow ? '지금' : formatClock(day.startMs)}~${formatClock(day.endMs)}`}
                      </Text>
                      {edge ? (
                        <View style={styles.offButtonSpacer} />
                      ) : (
                        <OffButton day={day} disabled={disabled} onPress={() => replaceDay(index, { ...day, off: !day.off })} />
                      )}
                    </View>
                  )
                })}
              </View>
            </>
          ) : (
            <>
              <Text style={styles.sectionNote}>시각을 누르면 그날만 바뀌어요. 가운데 날은 쉬는 날로 뺄 수 있어요.</Text>
              <View style={styles.list}>
                {days.map((day, index) => {
                  const edge = index === 0 || index === days.length - 1
                  const startFixed = index === 0 && firstFixed
                  return (
                    <View key={day.date} style={styles.row}>
                      <Text style={[styles.date, day.off && styles.offText]}>{formatDay(day.startMs)}</Text>
                      {day.off ? (
                        <Text style={styles.offLabel}>쉬는 날</Text>
                      ) : (
                        <View style={styles.times}>
                          <TimeButton
                            label={index === 0 && startIsNow ? '지금' : formatClock(day.startMs)}
                            disabled={disabled || startFixed}
                            onPress={() => setPicker({ index, side: 'start' })}
                            accessibilityLabel={`${formatDay(day.startMs)} 시작 ${index === 0 && startIsNow ? '지금' : formatClock(day.startMs)}${startFixed ? ', 바꿀 수 없어요' : ', 바꾸기'}`}
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
                        <OffButton day={day} disabled={disabled} onPress={() => replaceDay(index, { ...day, off: !day.off })} />
                      )}
                    </View>
                  )
                })}
              </View>
            </>
          )}
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
      <ReportTimeSheet
        visible={hoursPicker !== null}
        title={hoursPicker === 'open' ? '매일 시작 시각' : '매일 끝 시각'}
        baseMidnight={hoursMidnight}
        dayCount={1}
        dayLabel={() => '매일'}
        isValid={hoursValid}
        initialMs={hoursMidnight + (hoursPicker === 'open' ? open : close) * MINUTE_MS}
        onCancel={() => setHoursPicker(null)}
        onConfirm={confirmHours}
      />
    </View>
  )
}

function OffButton({ day, disabled, onPress }: { day: EditableDay; disabled?: boolean; onPress: () => void }) {
  return (
    <TouchableOpacity
      style={styles.offButton}
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={day.off ? `${formatDay(day.startMs)} 운영하기` : `${formatDay(day.startMs)} 쉬는 날로`}
    >
      <Text style={styles.offButtonText}>{day.off ? '운영' : '쉬는 날'}</Text>
    </TouchableOpacity>
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
  body: { marginTop: 10 },
  segment: {
    flexDirection: 'row',
    padding: 3,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.primarySoft,
  },
  segmentItem: { flex: 1, minHeight: 36, alignItems: 'center', justifyContent: 'center', borderRadius: RADIUS.md - 2 },
  segmentItemOn: { backgroundColor: COLORS.primary },
  segmentText: { fontFamily: FONTS.semibold, fontSize: 13.5, color: COLORS.primary },
  segmentTextOn: { color: COLORS.white },
  hoursRow: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 44, marginTop: 10 },
  hoursLabel: { width: 72, fontFamily: FONTS.semibold, fontSize: 14, color: COLORS.textPrimary },
  sectionNote: { fontFamily: FONTS.regular, fontSize: 12, color: COLORS.textSecondary, marginTop: 8 },
  compactRow: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 36 },
  compactHours: { flex: 1, fontFamily: FONTS.regular, fontSize: 13.5, color: COLORS.textPrimary, fontVariant: ['tabular-nums'] },
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
