import { useEffect, useRef } from 'react'
import { View, Text, TouchableOpacity, ScrollView, StyleSheet } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { COLORS } from '../../constants/colors'
import { FONTS } from '../../constants/typography'
import { REPORT_DURATION_OPTIONS_HOURS } from '../../constants/report'
import {
  REPORT_MAX_DURATION_HOURS,
  REPORT_START_MAX_DAYS,
  REPORT_TIME_STEP_MINUTES,
  dayChipLabel,
  formatClock,
  formatDurationMinutes,
  formatScheduleRange,
  kstDateTime,
  kstMidnight,
  nextStepAfter,
} from '../../utils/reportSchedule'
import { chipStyles } from './chipStyles'

const MINUTE_MS = 60 * 1000
const HOUR_MS = 60 * MINUTE_MS
const DAY_MS = 24 * HOUR_MS
const STEP_MS = REPORT_TIME_STEP_MINUTES * MINUTE_MS
const MAX_DURATION_MS = REPORT_MAX_DURATION_HOURS * HOUR_MS
const MINUTE_OPTIONS = Array.from({ length: 60 / REPORT_TIME_STEP_MINUTES }, (_, i) => i * REPORT_TIME_STEP_MINUTES)
const HOURS = Array.from({ length: 24 }, (_, i) => i)
const DAY_OFFSETS = Array.from({ length: REPORT_START_MAX_DAYS }, (_, i) => i)

/**
 * 제보 시각. 시작은 '지금' 또는 고른 시각(오늘부터 14일 안, 10분 단위), 끝은 진행 시간 프리셋 또는 직접 고른 시각.
 * 고른 시작·종료는 epoch ms(UTC)로 들고 있고 화면엔 한국 시간으로 보인다.
 */
export interface ReportSchedule {
  startMode: 'now' | 'scheduled'
  /** startMode 가 scheduled 일 때의 시작(10분 단위). */
  scheduledStartMs: number
  endMode: 'duration' | 'custom'
  durationHours: number
  /** endMode 가 custom 일 때의 종료(10분 단위). */
  customEndMs: number
}

export function initialReportSchedule(defaultDurationHours: number, now: number = Date.now()): ReportSchedule {
  const start = defaultScheduledStart(now)
  return {
    startMode: 'now',
    scheduledStartMs: start,
    endMode: 'duration',
    durationHours: defaultDurationHours,
    customEndMs: start + defaultDurationHours * HOUR_MS,
  }
}

/** '날짜·시간 선택'을 처음 눌렀을 때의 시작: 30분 뒤 이후의 첫 정각. */
function defaultScheduledStart(now: number): number {
  return Math.ceil((now + 30 * MINUTE_MS) / HOUR_MS) * HOUR_MS
}

/** 지금 보이는 시작·종료(ms). '지금'이면 now 가 시작이다. */
export function resolveSchedule(schedule: ReportSchedule, now: number = Date.now()): { startMs: number; endMs: number } {
  const startMs = schedule.startMode === 'now' ? now : schedule.scheduledStartMs
  const endMs = schedule.endMode === 'duration' ? startMs + schedule.durationHours * HOUR_MS : schedule.customEndMs
  return { startMs, endMs }
}

/** 시작 이후, 최대 12시간 안의 가장 가까운 10분 단위 종료로 맞춘다. */
function clampEnd(endMs: number, startMs: number): number {
  const earliest = Math.ceil((startMs + 1) / STEP_MS) * STEP_MS
  const latest = Math.floor((startMs + MAX_DURATION_MS) / STEP_MS) * STEP_MS
  return Math.min(Math.max(endMs, earliest), latest)
}

interface ReportScheduleFieldsProps {
  value: ReportSchedule
  onChange: (next: ReportSchedule) => void
  /** 지금 시각(부모가 30초마다 갱신). 지난 시각 칩을 막고 '지금 ~' 요약을 맞춘다. */
  now: number
  disabled?: boolean
}

/** 제보 작성창의 '언제' 영역. 네이티브 시간 선택기 없이 칩으로 고른다(앱 다시 빌드 없이 OTA 가능). */
export default function ReportScheduleFields({ value, onChange, now, disabled }: ReportScheduleFieldsProps) {
  const { startMs, endMs } = resolveSchedule(value, now)
  const scheduled = value.startMode === 'scheduled'
  const todayMidnight = kstMidnight(now)
  const selectedDay = Math.floor((value.scheduledStartMs - todayMidnight) / DAY_MS)
  const selectedHour = Math.floor((value.scheduledStartMs - todayMidnight - selectedDay * DAY_MS) / HOUR_MS)
  const selectedMinute = Math.round((value.scheduledStartMs % HOUR_MS) / MINUTE_MS)
  const firstValidStart = nextStepAfter(now - 1)

  /** 시작을 바꾼다. 직접 고른 종료는 진행 시간을 유지한 채 같이 옮긴다. */
  const setStart = (nextStartMs: number) => {
    const delta = nextStartMs - startMs
    onChange({
      ...value,
      startMode: 'scheduled',
      scheduledStartMs: nextStartMs,
      customEndMs: value.endMode === 'custom' ? clampEnd(value.customEndMs + delta, nextStartMs) : value.customEndMs,
    })
  }

  // 고른 시작 시각이 (창을 열어 둔 사이) 지나가면 가장 가까운 다음 칸으로 민다.
  const onChangeRef = useRef(onChange)
  onChangeRef.current = onChange
  useEffect(() => {
    if (value.startMode === 'scheduled' && value.scheduledStartMs < now) {
      const next = nextStepAfter(now)
      onChangeRef.current({
        ...value,
        scheduledStartMs: next,
        customEndMs: value.endMode === 'custom' ? clampEnd(value.customEndMs, next) : value.customEndMs,
      })
    }
  }, [value, now])

  const pickDay = (day: number) => {
    let next = kstDateTime(day, selectedHour, selectedMinute, now)
    if (next < firstValidStart) next = firstValidStart
    setStart(next)
  }
  const pickHour = (hour: number) => {
    let next = kstDateTime(selectedDay, hour, selectedMinute, now)
    if (next < firstValidStart) next = firstValidStart
    setStart(next)
  }
  const pickMinute = (minute: number) => setStart(kstDateTime(selectedDay, selectedHour, minute, now))

  // 직접 고르는 종료: 시작이 든 시(정각)부터 12시간 뒤까지 시 칩, 그리고 10분 칩.
  const baseHourMs = Math.floor(startMs / HOUR_MS) * HOUR_MS
  const endHourIndex = Math.floor((value.customEndMs - baseHourMs) / HOUR_MS)
  const endMinute = Math.round((value.customEndMs % HOUR_MS) / MINUTE_MS)
  const endValid = (candidate: number) => candidate > startMs && candidate - startMs <= MAX_DURATION_MS
  const pickEndHour = (index: number) => {
    const candidate = baseHourMs + index * HOUR_MS + endMinute * MINUTE_MS
    onChange({ ...value, endMode: 'custom', customEndMs: clampEnd(candidate, startMs) })
  }
  const pickEndMinute = (minute: number) => {
    onChange({ ...value, endMode: 'custom', customEndMs: baseHourMs + endHourIndex * HOUR_MS + minute * MINUTE_MS })
  }
  const openCustomEnd = () => {
    // 지금 고른 진행 시간의 끝(10분 단위로 올림)에서 시작한다.
    const preset = Math.ceil((startMs + value.durationHours * HOUR_MS) / STEP_MS) * STEP_MS
    onChange({ ...value, endMode: 'custom', customEndMs: clampEnd(preset, startMs) })
  }

  const durationMinutes = Math.round((endMs - startMs) / MINUTE_MS)
  const summary = `${formatScheduleRange(startMs, endMs, scheduled ? undefined : '지금')} · ${formatDurationMinutes(Math.max(durationMinutes, 0))}`

  return (
    <View>
      <Text style={styles.subLabel}>시작</Text>
      <View style={styles.chipWrap}>
        <Chip
          label="지금"
          active={!scheduled}
          disabled={disabled}
          onPress={() => onChange({ ...value, startMode: 'now' })}
          accessibilityLabel="지금 시작"
        />
        <Chip
          label="날짜·시간 선택"
          icon="calendar-outline"
          active={scheduled}
          disabled={disabled}
          onPress={() => {
            if (scheduled) return
            const start = value.scheduledStartMs >= firstValidStart ? value.scheduledStartMs : defaultScheduledStart(now)
            setStart(start)
          }}
          accessibilityLabel="시작 날짜와 시간 고르기"
        />
      </View>

      {scheduled && (
        <View style={styles.pickerBox}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
            {DAY_OFFSETS.map((day) => {
              // 오늘인데 남은 칸이 없으면(23:50 이후) 오늘 칩은 막는다.
              const dayDisabled = kstDateTime(day, 23, 50, now) < firstValidStart
              return (
                <Chip
                  key={day}
                  label={dayChipLabel(day, now)}
                  active={day === selectedDay}
                  disabled={disabled || dayDisabled}
                  onPress={() => pickDay(day)}
                />
              )
            })}
          </ScrollView>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
            {HOURS.map((hour) => {
              const past = kstDateTime(selectedDay, hour, 60 - REPORT_TIME_STEP_MINUTES, now) < firstValidStart
              if (past) return null
              return (
                <Chip
                  key={hour}
                  label={`${hour}시`}
                  active={hour === selectedHour}
                  disabled={disabled}
                  onPress={() => pickHour(hour)}
                />
              )
            })}
          </ScrollView>
          <View style={styles.chipWrap}>
            {MINUTE_OPTIONS.map((minute) => {
              const past = kstDateTime(selectedDay, selectedHour, minute, now) < firstValidStart
              return (
                <Chip
                  key={minute}
                  label={`${minute < 10 ? '0' : ''}${minute}분`}
                  active={minute === selectedMinute}
                  disabled={disabled || past}
                  onPress={() => pickMinute(minute)}
                  compact
                />
              )
            })}
          </View>
        </View>
      )}

      <Text style={styles.subLabel}>진행 시간</Text>
      <View style={styles.chipWrap}>
        {REPORT_DURATION_OPTIONS_HOURS.map((hours) => (
          <Chip
            key={hours}
            label={`${hours}시간`}
            active={value.endMode === 'duration' && value.durationHours === hours}
            disabled={disabled}
            onPress={() => onChange({ ...value, endMode: 'duration', durationHours: hours })}
            accessibilityLabel={`${hours}시간 동안`}
          />
        ))}
        <Chip
          label="종료 시각 직접"
          icon="time-outline"
          active={value.endMode === 'custom'}
          disabled={disabled}
          onPress={value.endMode === 'custom' ? () => {} : openCustomEnd}
          accessibilityLabel="끝나는 시각 직접 고르기"
        />
      </View>

      {value.endMode === 'custom' && (
        <View style={styles.pickerBox}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
            {Array.from({ length: REPORT_MAX_DURATION_HOURS + 1 }, (_, index) => {
              const hourStart = baseHourMs + index * HOUR_MS
              // 이 시에 고를 수 있는 10분 칸이 하나도 없으면 뺀다.
              const any = MINUTE_OPTIONS.some((minute) => endValid(hourStart + minute * MINUTE_MS))
              if (!any) return null
              const nextDay = Math.floor((hourStart - kstMidnight(startMs)) / DAY_MS) > 0
              const clock = formatClock(hourStart).slice(0, 2)
              return (
                <Chip
                  key={index}
                  label={`${nextDay ? '다음날 ' : ''}${Number(clock)}시`}
                  active={index === endHourIndex}
                  disabled={disabled}
                  onPress={() => pickEndHour(index)}
                />
              )
            })}
          </ScrollView>
          <View style={styles.chipWrap}>
            {MINUTE_OPTIONS.map((minute) => {
              const candidate = baseHourMs + endHourIndex * HOUR_MS + minute * MINUTE_MS
              return (
                <Chip
                  key={minute}
                  label={`${minute < 10 ? '0' : ''}${minute}분`}
                  active={minute === endMinute}
                  disabled={disabled || !endValid(candidate)}
                  onPress={() => pickEndMinute(minute)}
                  compact
                />
              )
            })}
          </View>
        </View>
      )}

      <View style={styles.summary} accessibilityRole="summary" accessibilityLabel={`제보 시간 ${summary}`}>
        <Ionicons name="calendar-clear-outline" size={15} color={COLORS.primary} />
        <Text style={styles.summaryText}>{summary}</Text>
      </View>
      <Text style={styles.hint}>
        {scheduled
          ? '운영진이 확인한 뒤, 시작 시각이 되면 지도에 올라가요. 끝나는 시각에 자동으로 내려가요.'
          : '운영진이 확인한 뒤 지도에 올라가고, 끝나는 시각에 자동으로 내려가요.'}
      </Text>
    </View>
  )
}

function Chip({
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
  subLabel: { fontFamily: FONTS.regular, fontSize: 12, color: COLORS.textSecondary, marginBottom: 6, marginTop: 4 },
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 7, marginBottom: 8 },
  row: { flexDirection: 'row', gap: 7, paddingRight: 4 },
  pickerBox: {
    gap: 8,
    padding: 10,
    paddingBottom: 2,
    marginBottom: 10,
    borderRadius: 12,
    backgroundColor: COLORS.fill,
  },
  compactChip: { paddingHorizontal: 9 },
  chipActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  chipDisabled: { opacity: 0.4 },
  summary: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
    backgroundColor: COLORS.primarySoft,
    marginTop: 2,
  },
  summaryText: { flex: 1, fontFamily: FONTS.semibold, fontSize: 13.5, color: COLORS.primary },
  hint: { fontFamily: FONTS.regular, fontSize: 12, color: COLORS.textSecondary, marginTop: 8 },
})
