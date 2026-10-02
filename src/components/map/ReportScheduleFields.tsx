import { useCallback, useEffect, useRef, useState } from 'react'
import { Animated, View, Text, TouchableOpacity, StyleSheet } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { COLORS } from '../../constants/colors'
import { FONTS } from '../../constants/typography'
import { REPORT_DURATION_OPTIONS_HOURS } from '../../constants/report'
import {
  REPORT_MAX_DURATION_DAYS,
  REPORT_START_MAX_DAYS,
  REPORT_TIME_STEP_MINUTES,
  dayChipLabel,
  formatClock,
  formatDay,
  formatDurationMinutes,
  formatScheduleRange,
  kstMidnight,
  nextStepAfter,
} from '../../utils/reportSchedule'
import { chipStyles } from './chipStyles'
import { useAttentionFlash } from '../../hooks/useAttentionFlash'
import ReportTimeSheet from './ReportTimeSheet'

const MINUTE_MS = 60 * 1000
const HOUR_MS = 60 * MINUTE_MS
const DAY_MS = 24 * HOUR_MS
const STEP_MS = REPORT_TIME_STEP_MINUTES * MINUTE_MS
const MAX_DURATION_MS = REPORT_MAX_DURATION_DAYS * DAY_MS

/**
 * 제보 시각. 시작은 '지금' 또는 고른 시각(오늘부터 14일 안, 10분 단위), 끝은 진행 시간 프리셋 또는 직접 고른 날짜·시각
 * (시작부터 최대 7일 — 여러 날 행사).
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

/** 시작 이후, 최대 7일 안의 가장 가까운 10분 단위 종료로 맞춘다. */
function clampEnd(endMs: number, startMs: number): number {
  const earliest = Math.ceil((startMs + 1) / STEP_MS) * STEP_MS
  const latest = Math.floor((startMs + MAX_DURATION_MS) / STEP_MS) * STEP_MS
  return Math.min(Math.max(endMs, earliest), latest)
}

interface ReportScheduleFieldsProps {
  value: ReportSchedule
  onChange: (next: ReportSchedule) => void
  /** 지금 시각(부모가 30초마다 갱신). 지난 시각을 막고 '지금 ~' 요약을 맞춘다. */
  now: number
  disabled?: boolean
  /** 시간이 맞지 않는 채 제출했을 때 요약 카드 테두리를 잠깐 빨갛게 깜빡인다(값이 바뀔 때마다). */
  flashKey?: number
  /** 지금 시간 설정이 올릴 수 없는 상태인지. 맞춰지면 깜빡임을 바로 멈춘다. */
  invalid?: boolean
}

/**
 * 제보 작성창의 '언제' 영역. 빠른 칩(지금 · 1/2/3/6시간)과, 요약 줄을 누르면 뜨는 다이얼 시트(시작 시각 · 종료 시각).
 * 다이얼은 순수 JS(WheelPicker)라 앱을 다시 빌드하지 않고 OTA·웹에서 그대로 돈다.
 */
export default function ReportScheduleFields({
  value,
  onChange,
  now,
  disabled,
  flashKey,
  invalid = false,
}: ReportScheduleFieldsProps) {
  const summaryFlash = useAttentionFlash(flashKey, invalid, COLORS.primarySoft)
  const { startMs, endMs } = resolveSchedule(value, now)
  const scheduled = value.startMode === 'scheduled'
  const firstValidStart = nextStepAfter(now - 1)
  const todayMidnight = kstMidnight(now)
  const [sheet, setSheet] = useState<'start' | 'end' | null>(null)

  /** 시작을 바꾼다. 직접 고른 종료는 진행 기간을 유지한 채 같이 옮긴다. */
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

  // 시작 다이얼: 오늘부터 14일, 지금 이후 10분 칸.
  const startValid = useCallback(
    (ms: number) => ms >= firstValidStart && ms < todayMidnight + REPORT_START_MAX_DAYS * DAY_MS,
    [firstValidStart, todayMidnight],
  )
  const startDayLabel = useCallback((index: number) => dayChipLabel(index, now), [now])

  // 종료 다이얼: 시작한 날부터 7일 뒤까지, 시작보다 뒤이고 7일 이내.
  const endBase = kstMidnight(startMs)
  const endValid = useCallback(
    (ms: number) => ms > startMs && ms - startMs <= MAX_DURATION_MS && ms > now,
    [startMs, now],
  )
  const endDayLabel = useCallback(
    (index: number) => dayChipLabel(Math.round((endBase + index * DAY_MS - todayMidnight) / DAY_MS), now),
    [endBase, todayMidnight, now],
  )
  const endInitial =
    value.endMode === 'custom' ? value.customEndMs : clampEnd(Math.ceil(endMs / STEP_MS) * STEP_MS, startMs)
  const startInitial = scheduled
    ? value.scheduledStartMs
    : value.scheduledStartMs >= firstValidStart
      ? value.scheduledStartMs
      : defaultScheduledStart(now)

  const durationMinutes = Math.max(Math.round((endMs - startMs) / MINUTE_MS), 0)
  const summary = `${formatScheduleRange(startMs, endMs, scheduled ? undefined : '지금')} · ${formatDurationMinutes(durationMinutes)}`

  return (
    <View>
      {/* 직접 고르는 칩을 앞에 둔다(시작: 날짜·시간 선택 → 지금, 진행 시간: 종료 직접 → 1·2·3·6시간). 기본 선택은 그대로 '지금'·기본 시간. */}
      <Text style={styles.subLabel}>시작</Text>
      <View style={styles.chipWrap}>
        <Chip
          label="날짜·시간 선택"
          icon="calendar-outline"
          active={scheduled}
          disabled={disabled}
          onPress={() => setSheet('start')}
          accessibilityLabel="시작 날짜와 시간 고르기"
        />
        <Chip
          label="지금"
          active={!scheduled}
          disabled={disabled}
          onPress={() =>
            // 직접 고른 종료도 시작을 옮길 때(setStart)처럼 진행 기간을 유지한 채 지금 기준으로 당긴다.
            // 안 그러면 며칠 뒤로 잡아 둔 종료가 그대로 남아 '지금 ~ 10/12' 처럼 늘어나거나 7일 상한에 걸린다.
            onChange({
              ...value,
              startMode: 'now',
              customEndMs:
                value.endMode === 'custom' && scheduled
                  ? clampEnd(Math.round((value.customEndMs + (now - startMs)) / STEP_MS) * STEP_MS, now)
                  : value.customEndMs,
            })
          }
          accessibilityLabel="지금 시작"
        />
      </View>

      <Text style={styles.subLabel}>진행 시간</Text>
      <View style={styles.chipWrap}>
        <Chip
          label="종료 날짜·시각 직접"
          icon="time-outline"
          active={value.endMode === 'custom'}
          disabled={disabled}
          onPress={() => setSheet('end')}
          accessibilityLabel="끝나는 날짜와 시각 직접 고르기"
        />
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
      </View>

      {/* 요약 줄. 시작·종료 줄을 누르면 다이얼 시트가 뜬다. */}
      <Animated.View style={[styles.summary, summaryFlash]}>
        <SummaryRow
          label="시작"
          value={scheduled ? `${formatDay(startMs)} ${formatClock(startMs)}` : '지금'}
          onPress={() => setSheet('start')}
          disabled={disabled}
          accessibilityLabel={`시작 ${scheduled ? `${formatDay(startMs)} ${formatClock(startMs)}` : '지금'}, 바꾸기`}
        />
        <View style={styles.summaryDivider} />
        <SummaryRow
          label="종료"
          value={`${formatDay(endMs)} ${formatClock(endMs)}`}
          onPress={() => setSheet('end')}
          disabled={disabled}
          accessibilityLabel={`종료 ${formatDay(endMs)} ${formatClock(endMs)}, 바꾸기`}
        />
        <Text style={styles.summaryText} accessibilityLabel={`제보 시간 ${summary}`}>
          {summary}
        </Text>
      </Animated.View>
      <Text style={styles.hint}>
        {scheduled
          ? '운영진이 확인한 뒤, 시작 시각이 되면 지도에 올라가요. 끝나는 시각에 자동으로 내려가요.'
          : '운영진이 확인한 뒤 지도에 올라가고, 끝나는 시각에 자동으로 내려가요.'}
      </Text>

      <ReportTimeSheet
        visible={sheet === 'start'}
        title="시작 시각"
        baseMidnight={todayMidnight}
        dayCount={REPORT_START_MAX_DAYS}
        dayLabel={startDayLabel}
        isValid={startValid}
        initialMs={startInitial}
        onCancel={() => setSheet(null)}
        onConfirm={(ms) => {
          setSheet(null)
          setStart(ms)
        }}
      />
      <ReportTimeSheet
        visible={sheet === 'end'}
        title="종료 시각"
        baseMidnight={endBase}
        dayCount={REPORT_MAX_DURATION_DAYS + 1}
        dayLabel={endDayLabel}
        isValid={endValid}
        initialMs={endInitial}
        onCancel={() => setSheet(null)}
        onConfirm={(ms) => {
          setSheet(null)
          onChange({ ...value, endMode: 'custom', customEndMs: ms })
        }}
      />
    </View>
  )
}

function SummaryRow({
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
  compactChip: { paddingHorizontal: 9 },
  chipActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  chipDisabled: { opacity: 0.4 },
  // 테두리(평소엔 바탕색과 같아 안 보임)는 시간이 맞지 않을 때 빨갛게 깜빡이는 자리. 그 1px 만큼 안쪽 여백을 줄였다.
  summary: {
    paddingHorizontal: 11,
    paddingTop: 3,
    paddingBottom: 9,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.primarySoft,
    backgroundColor: COLORS.primarySoft,
    marginTop: 2,
  },
  summaryRow: { flexDirection: 'row', alignItems: 'center', minHeight: 44, gap: 8 },
  summaryLabel: { width: 32, fontFamily: FONTS.regular, fontSize: 13, color: COLORS.textSecondary },
  summaryValue: { flex: 1, fontFamily: FONTS.semibold, fontSize: 15, color: COLORS.primary },
  summaryDivider: { height: StyleSheet.hairlineWidth, backgroundColor: COLORS.chipBorder },
  summaryText: { fontFamily: FONTS.regular, fontSize: 12.5, color: COLORS.textSecondary, marginTop: 6 },
  hint: { fontFamily: FONTS.regular, fontSize: 12, color: COLORS.textSecondary, marginTop: 8 },
})
