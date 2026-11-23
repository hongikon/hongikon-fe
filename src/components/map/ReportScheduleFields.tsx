import { Animated, View, Text, StyleSheet } from 'react-native'
import { COLORS } from '../../constants/colors'
import { FONTS } from '../../constants/typography'
import { REPORT_DURATION_OPTIONS_HOURS } from '../../constants/report'
import { REPORT_MAX_DURATION_DAYS, REPORT_START_MAX_DAYS, canRunDaily, formatClock, formatDay } from '../../utils/map/report/reportSchedule'
import ReportTimeSheet from './report/ReportTimeSheet'
import ReportDaysEditor from './report/ReportDaysEditor'
import { pinDailyHours } from '../../utils/map/report/reportDays'
import { resolveSchedule, type ReportSchedule } from '../../utils/map/report/reportScheduleState'
import { Chip, SummaryRow } from './report/schedule/ScheduleParts'
import { RADIUS } from '../../constants/spacing'
import { useReportScheduleFields } from '../../hooks/map/useReportScheduleFields'

// 시각 계산은 utils/map/reportScheduleState 로 옮겼다. 바깥(TempChangesPreviewScreen 등)이 이 경로로 import 해서 다시 내보낸다.
export { initialReportSchedule, resolveSchedule, scheduleDaysFor } from '../../utils/map/report/reportScheduleState'
export type { ReportSchedule } from '../../utils/map/report/reportScheduleState'

export interface ReportScheduleFieldsProps {
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
  const { summaryFlash, startMs, endMs, scheduled, firstValidStart, todayMidnight, sheet, setSheet, endAutoFit, setEndAutoFit, endFor, changeStart, setStart, startValid, startDayLabel, endBase, endValid, endDayLabel, endInitial, startInitial, daily, summary } = useReportScheduleFields({ value, onChange, now, flashKey, invalid })

  return (
    <View>
      {/* 직접 고르는 칩을 앞에 둔다(시작 시각: 날짜·시간 선택 → 지금, 종료 시각: 날짜·시간 선택 → 1·2·3·6시간 뒤). 기본 선택은 그대로 '지금'·기본 시간. */}
      <Text style={styles.subLabel}>시작 시각</Text>
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
          // 직접 고른 종료는 시작을 옮길 때(setStart)처럼 그대로 두고, 지금 기준으로 쓸 수 없을 때만 자동으로 맞춘다.
          onPress={() => {
            if (scheduled && value.daily && canRunDaily(now, endMs)) {
              // 매일 운영 시간은 그대로 두고 첫날만 지금부터로(가운데 날이 지금 시각을 따라 바뀌지 않게).
              const editedDays = pinDailyHours(startMs, endMs, value.editedDays, now, endMs)
              const end = endFor(now)
              setEndAutoFit(value.endMode === 'custom' && end.customEndMs !== value.customEndMs)
              onChange({ ...value, startMode: 'now', ...end, editedDays })
              return
            }
            changeStart({ startMode: 'now', scheduledStartMs: value.scheduledStartMs }, now)
          }}
          accessibilityLabel="지금 시작"
        />
      </View>

      <Text style={styles.subLabel}>종료 시각</Text>
      <View style={styles.chipWrap}>
        <Chip
          label="날짜·시간 선택"
          icon="time-outline"
          active={value.endMode === 'custom'}
          disabled={disabled}
          onPress={() => setSheet('end')}
          accessibilityLabel="끝나는 날짜와 시각 직접 고르기"
        />
        {REPORT_DURATION_OPTIONS_HOURS.map((hours) => (
          <Chip
            key={hours}
            label={`${hours}시간 뒤`}
            active={value.endMode === 'duration' && value.durationHours === hours}
            disabled={disabled}
            onPress={() => {
              setEndAutoFit(false)
              onChange({ ...value, endMode: 'duration', durationHours: hours })
            }}
            accessibilityLabel={`시작하고 ${hours}시간 뒤에 종료`}
          />
        ))}
      </View>

      {/* 요약 줄. 시작·종료 줄을 누르면 다이얼 시트가 뜬다. */}
      <Animated.View style={[styles.summary, summaryFlash]}>
        <SummaryRow
          label="시작 시각"
          value={scheduled ? `${formatDay(startMs)} ${formatClock(startMs)}` : '지금'}
          onPress={() => setSheet('start')}
          disabled={disabled}
          accessibilityLabel={`시작 시각 ${scheduled ? `${formatDay(startMs)} ${formatClock(startMs)}` : '지금'}, 바꾸기`}
        />
        <View style={styles.summaryDivider} />
        <SummaryRow
          label="종료 시각"
          value={`${formatDay(endMs)} ${formatClock(endMs)}`}
          onPress={() => setSheet('end')}
          disabled={disabled}
          accessibilityLabel={`종료 시각 ${formatDay(endMs)} ${formatClock(endMs)}, 바꾸기`}
        />
        <Text style={styles.summaryText} accessibilityLabel={`제보 시간 ${summary}`}>
          {summary}
        </Text>
      </Animated.View>
      {endMs > startMs ? (
        <ReportDaysEditor
          startMs={startMs}
          endMs={endMs}
          enabled={value.daily}
          edited={value.editedDays}
          onChange={(patch) => {
            if (patch.endMs !== undefined) setEndAutoFit(false)
            onChange({
              ...value,
              ...(patch.daily !== undefined ? { daily: patch.daily } : {}),
              ...(patch.edited ? { editedDays: patch.edited } : {}),
              ...(patch.startMs !== undefined ? { startMode: 'scheduled' as const, scheduledStartMs: patch.startMs } : {}),
              ...(patch.endMs !== undefined ? { endMode: 'custom' as const, customEndMs: patch.endMs } : {}),
            })
          }}
          earliestStart={firstValidStart}
          startIsNow={!scheduled}
          disabled={disabled}
        />
      ) : null}
      {endAutoFit && value.endMode === 'custom' ? (
        <Text style={styles.autoFit} accessibilityLiveRegion="polite">
          시작 시각이 바뀌어 종료 시각을 원래 진행 시간에 맞춰 옮겼어요. 다르면 다시 골라 주세요.
        </Text>
      ) : null}
      <Text style={styles.hint}>
        {daily
          ? '운영진이 확인한 뒤, 첫날 시작부터 마지막 날 끝까지 지도에 있어요. 핀에 오늘 운영 시간이 함께 보여요.'
          : scheduled
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
          setEndAutoFit(false)
          onChange({ ...value, endMode: 'custom', customEndMs: ms })
        }}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  subLabel: { fontFamily: FONTS.regular, fontSize: 12, color: COLORS.textSecondary, marginBottom: 6, marginTop: 4 },
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 7, marginBottom: 8 },
  // 테두리(평소엔 바탕색과 같아 안 보임)는 시간이 맞지 않을 때 빨갛게 깜빡이는 자리. 그 1px 만큼 안쪽 여백을 줄였다.
  summary: {
    paddingHorizontal: 11,
    paddingTop: 3,
    paddingBottom: 9,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.primarySoft,
    backgroundColor: COLORS.primarySoft,
    marginTop: 2,
  },
  summaryDivider: { height: StyleSheet.hairlineWidth, backgroundColor: COLORS.chipBorder },
  summaryText: { fontFamily: FONTS.regular, fontSize: 12.5, color: COLORS.textSecondary, marginTop: 6 },
  autoFit: { fontFamily: FONTS.regular, fontSize: 12, color: COLORS.primary, marginTop: 8 },
  hint: { fontFamily: FONTS.regular, fontSize: 12, color: COLORS.textSecondary, marginTop: 8 },
})
