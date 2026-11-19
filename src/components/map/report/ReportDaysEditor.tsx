import { Text, TouchableOpacity, StyleSheet, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { COLORS } from '../../../constants/colors'
import { FONTS } from '../../../constants/typography'
import { RADIUS } from '../../../constants/spacing'
import { formatClock, formatDay } from '../../../utils/reportSchedule'
import { MINUTE_MS, STEP_MS, type EditableDay, type ReportDaysPatch } from '../../../utils/map/reportDays'
import { useReportDaysEditor } from '../../../hooks/map/report/useReportDaysEditor'
import ReportTimeSheet from './ReportTimeSheet'
import { OffButton, StepButton, TimeButton } from './days/DaysEditorButtons'

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

/**
 * '매일 정해진 시간에만 운영' 체크와 날짜별 운영 시간(11-08, 11-09 흐름 정리). 여러 날 행사 중 정해진 시간에만 여는 부스·간식행사용.
 * 켜면 '매일 같은 시간'(시각 한 줄을 고치면 모든 날이 같이 바뀌고, 날짜 목록에서는 쉬는 날만 고른다)과
 * '날마다 다르게'(날마다 시각을 따로 고른다) 중에 고른다. 시작이 '지금'이어도 켤 수 있다 — 첫날은 지금부터다.
 * 지도에는 기간 내내 핀이 있고, 핀·시트가 '오늘 14:00 시작'·'운영 중'·'곧 종료'를 보여 준다.
 * 하루 안에서 끝나는 시간을 골랐어도 체크는 보인다 — 켜면 마지막 날을 내일로 늘린다(11-09 요청). 켠 뒤에는 '마지막 날'을 하루씩 늘이거나 줄인다.
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
  const {
    multiDay,
    on,
    days,
    mode,
    picker,
    setPicker,
    hoursPicker,
    setHoursPicker,
    firstFixed,
    open,
    close,
    toggle,
    moveLastDay,
    canShorten,
    canExtend,
    chooseMode,
    replaceDay,
    pickedDay,
    pickedMidnight,
    isValid,
    confirm,
    hoursMidnight,
    hoursValid,
    confirmHours,
  } = useReportDaysEditor({ startMs, endMs, enabled, edited, onChange, earliestStart, startIsNow, startLocked })

  const firstRange = `${formatClock(startMs)}~${formatClock(endMs)}`
  return (
    <View>
      <TouchableOpacity
        style={[styles.toggle, on && styles.toggleOn, disabled && styles.disabled]}
        onPress={toggle}
        disabled={disabled}
        activeOpacity={0.75}
        accessibilityRole="checkbox"
        accessibilityState={{ checked: on, disabled: !!disabled }}
        accessibilityLabel="매일 정해진 시간에만 운영"
      >
        <Ionicons name={on ? 'checkbox' : 'square-outline'} size={20} color={COLORS.primary} />
        <View style={styles.toggleText}>
          <Text style={styles.toggleLabel}>매일 정해진 시간에만 운영</Text>
          <Text style={styles.toggleNote}>
            {on
              ? '기간 내내 지도에 있고, 핀에 그날 운영 시간이 함께 보여요.'
              : !multiDay
                ? '여러 날 같은 시간대에 여는 부스·행사라면 켜 주세요. 켜면 내일까지로 늘어나고, 마지막 날은 바꿀 수 있어요.'
              : startIsNow
                ? '여러 날 정해진 시간에만 여는 부스·행사라면 켜 주세요. 오늘은 지금부터예요.'
                : `여러 날 ${firstRange}처럼 정해진 시간에만 여는 부스·행사라면 켜 주세요.`}
          </Text>
        </View>
      </TouchableOpacity>

      {on ? (
        <View style={styles.body}>
          <View style={styles.lastDayRow}>
            <Text style={styles.hoursLabel}>마지막 날</Text>
            <View style={styles.times}>
              <StepButton
                icon="remove"
                disabled={disabled || !canShorten}
                onPress={() => moveLastDay(-1)}
                accessibilityLabel="마지막 날 하루 앞당기기"
              />
              <Text style={styles.lastDayText} accessibilityLiveRegion="polite">
                {formatDay(endMs)} · {days.length}일
              </Text>
              <StepButton
                icon="add"
                disabled={disabled || !canExtend}
                onPress={() => moveLastDay(1)}
                accessibilityLabel="마지막 날 하루 늘리기"
              />
            </View>
          </View>
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
  lastDayRow: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 44, marginBottom: 8 },
  lastDayText: {
    minWidth: 112,
    textAlign: 'center',
    fontFamily: FONTS.semibold,
    fontSize: 14,
    color: COLORS.textPrimary,
    fontVariant: ['tabular-nums'],
  },
  hoursLabel: { width: 72, fontFamily: FONTS.semibold, fontSize: 14, color: COLORS.textPrimary },
  sectionNote: { fontFamily: FONTS.regular, fontSize: 12, color: COLORS.textSecondary, marginTop: 8 },
  compactRow: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 36 },
  compactHours: { flex: 1, fontFamily: FONTS.regular, fontSize: 13.5, color: COLORS.textPrimary, fontVariant: ['tabular-nums'] },
  list: { marginTop: 8, gap: 6 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 40 },
  date: { width: 72, fontFamily: FONTS.semibold, fontSize: 13.5, color: COLORS.textPrimary },
  offText: { color: COLORS.textTertiary },
  times: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6 },
  dash: { fontFamily: FONTS.regular, fontSize: 13, color: COLORS.textSecondary },
  offLabel: { flex: 1, fontFamily: FONTS.regular, fontSize: 13, color: COLORS.textTertiary },
  offButtonSpacer: { width: 52 },
})
