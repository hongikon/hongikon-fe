import { useMemo, useState } from 'react'
import { Modal, View, Text, StyleSheet, TouchableWithoutFeedback } from 'react-native'
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context'
import { COLORS } from '../../constants/colors'
import { FONTS, TYPE } from '../../constants/typography'
import { SHEET_MAX_WIDTH } from '../../constants/layout'
import Button from '../common/Button'
import WheelPicker, { type WheelItem } from '../common/WheelPicker'
import { REPORT_TIME_STEP_MINUTES, formatClock, formatDay } from '../../utils/reportSchedule'

const MINUTE_MS = 60 * 1000
const HOUR_MS = 60 * MINUTE_MS
const DAY_MS = 24 * HOUR_MS
const STEP_MS = REPORT_TIME_STEP_MINUTES * MINUTE_MS
const SLOTS_PER_DAY = DAY_MS / STEP_MS
const HOURS = Array.from({ length: 24 }, (_, hour) => hour)
const MINUTES = Array.from({ length: 60 / REPORT_TIME_STEP_MINUTES }, (_, i) => i * REPORT_TIME_STEP_MINUTES)

interface ReportTimeSheetProps {
  /** null 이면 닫힘. 열 때마다 initialMs 로 새로 시작한다. */
  visible: boolean
  title: string
  /** 날짜 열 첫날의 한국 시간 자정(epoch ms). */
  baseMidnight: number
  dayCount: number
  /** 날짜 열 이름(오늘·내일·모레·10/6(화)…). */
  dayLabel: (dayIndex: number) => string
  /** 고를 수 있는 시각인지(10분 칸 단위로 묻는다). */
  isValid: (ms: number) => boolean
  initialMs: number
  onCancel: () => void
  onConfirm: (ms: number) => void
}

/**
 * 시작·종료 시각을 다이얼(날짜 · 시 · 분)로 고르는 아래 시트. 시는 24시간제(요약 '11:00 ~ 15:00'과 같은 표기).
 * 지난 칸·범위 밖 칸은 흐리게 막고, 고른 조합이 안 되면 가장 가까운 되는 시각으로 맞춘다.
 */
export default function ReportTimeSheet(props: ReportTimeSheetProps) {
  return (
    <Modal transparent visible={props.visible} animationType="fade" onRequestClose={props.onCancel}>
      {/* 바깥 작성창 Modal 위에 따로 뜨므로 inset 을 새로 잡는다. */}
      <SafeAreaProvider>{props.visible ? <SheetBody {...props} /> : null}</SafeAreaProvider>
    </Modal>
  )
}

function SheetBody({ title, baseMidnight, dayCount, dayLabel, isValid, initialMs, onCancel, onConfirm }: ReportTimeSheetProps) {
  const at = (day: number, hour: number, minute: number) =>
    baseMidnight + day * DAY_MS + hour * HOUR_MS + minute * MINUTE_MS

  /** 가장 가까운 고를 수 있는 10분 칸. 없으면 null. */
  const nearestValid = (target: number): number | null => {
    let best: number | null = null
    for (let slot = 0; slot < dayCount * SLOTS_PER_DAY; slot += 1) {
      const ms = baseMidnight + slot * STEP_MS
      if (isValid(ms) && (best === null || Math.abs(ms - target) < Math.abs(best - target))) best = ms
    }
    return best
  }

  const [draft, setDraft] = useState(() => (isValid(initialMs) ? initialMs : nearestValid(initialMs) ?? initialMs))
  const day = Math.floor((draft - baseMidnight) / DAY_MS)
  const hour = Math.floor((draft - baseMidnight - day * DAY_MS) / HOUR_MS)
  const minute = Math.round((draft % HOUR_MS) / MINUTE_MS)

  const pick = (nextDay: number, nextHour: number, nextMinute: number) => {
    const target = at(nextDay, nextHour, nextMinute)
    setDraft(isValid(target) ? target : nearestValid(target) ?? draft)
  }

  const dayItems = useMemo<WheelItem<number>[]>(
    () =>
      Array.from({ length: dayCount }, (_, index) => ({
        value: index,
        label: dayLabel(index),
        disabled: !HOURS.some((h) => MINUTES.some((m) => isValid(at(index, h, m)))),
      })),
    [baseMidnight, dayCount, dayLabel, isValid],
  )
  const hourItems: WheelItem<number>[] = HOURS.map((h) => ({
    value: h,
    label: `${h}시`,
    disabled: !MINUTES.some((m) => isValid(at(day, h, m))),
  }))
  const minuteItems: WheelItem<number>[] = MINUTES.map((m) => ({
    value: m,
    label: `${m < 10 ? '0' : ''}${m}분`,
    disabled: !isValid(at(day, hour, m)),
  }))

  return (
    <TouchableWithoutFeedback onPress={onCancel}>
      <View style={styles.backdrop}>
        <TouchableWithoutFeedback onPress={() => {}}>
          <SafeAreaView style={styles.sheet} edges={['bottom']}>
            <View style={styles.handle} />
            <Text style={styles.title} accessibilityRole="header">
              {title}
            </Text>
            <Text style={styles.preview}>
              {formatDay(draft)} {formatClock(draft)}
            </Text>

            <View style={styles.columns}>
              <View style={styles.dayColumn}>
                <Text style={styles.columnLabel}>날짜</Text>
                <WheelPicker
                  items={dayItems}
                  value={day}
                  onChange={(next) => pick(next, hour, minute)}
                  accessibilityLabel={`${title} 날짜`}
                />
              </View>
              <View style={styles.column}>
                <Text style={styles.columnLabel}>시</Text>
                <WheelPicker
                  items={hourItems}
                  value={hour}
                  onChange={(next) => pick(day, next, minute)}
                  accessibilityLabel={`${title} 시`}
                />
              </View>
              <View style={styles.column}>
                <Text style={styles.columnLabel}>분</Text>
                <WheelPicker
                  items={minuteItems}
                  value={minute}
                  onChange={(next) => pick(day, hour, next)}
                  accessibilityLabel={`${title} 분`}
                />
              </View>
            </View>

            <View style={styles.actions}>
              <Button label="취소" variant="secondary" onPress={onCancel} style={styles.action} />
              <Button label="확인" onPress={() => onConfirm(draft)} disabled={!isValid(draft)} style={styles.action} />
            </View>
          </SafeAreaView>
        </TouchableWithoutFeedback>
      </View>
    </TouchableWithoutFeedback>
  )
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.4)' },
  sheet: {
    width: '100%',
    maxWidth: SHEET_MAX_WIDTH,
    alignSelf: 'center',
    backgroundColor: COLORS.white,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  handle: {
    alignSelf: 'center',
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: COLORS.border,
    marginTop: 10,
    marginBottom: 10,
  },
  title: { ...TYPE.headline, color: COLORS.textPrimary, textAlign: 'center' },
  preview: {
    fontFamily: FONTS.semibold,
    fontSize: 14,
    color: COLORS.primary,
    textAlign: 'center',
    marginTop: 4,
    marginBottom: 8,
  },
  columns: { flexDirection: 'row', gap: 6 },
  dayColumn: { flex: 1.5 },
  column: { flex: 1 },
  columnLabel: {
    fontFamily: FONTS.regular,
    fontSize: 12,
    color: COLORS.textTertiary,
    textAlign: 'center',
    marginBottom: 4,
  },
  actions: { flexDirection: 'row', gap: 8, marginTop: 14 },
  action: { flex: 1 },
})
