import { Modal, Pressable, View, Text, StyleSheet } from 'react-native'
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context'
import { COLORS } from '../../../constants/colors'
import { FONTS, TYPE } from '../../../constants/typography'
import { SHEET_MAX_WIDTH } from '../../../constants/layout'
import Button from '../../common/Button'
import WheelPicker from '../../common/WheelPicker'
import { formatClock, formatDay } from '../../../utils/map/report/reportSchedule'
import { RADIUS } from '../../../constants/spacing'
import { useReportTimeSheet } from '../../../hooks/map/report/useReportTimeSheet'
import { useSheetBody } from '../../../hooks/map/report/useSheetBody'

export interface ReportTimeSheetProps {
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
  useReportTimeSheet(props)
  return (
    <Modal transparent visible={props.visible} animationType="fade" onRequestClose={props.onCancel}>
      {/* 바깥 작성창 Modal 위에 따로 뜨므로 inset 을 새로 잡는다. */}
      <SafeAreaProvider>{props.visible ? <SheetBody {...props} /> : null}</SafeAreaProvider>
    </Modal>
  )
}

function SheetBody({ title, baseMidnight, dayCount, dayLabel, isValid, initialMs, onCancel, onConfirm }: ReportTimeSheetProps) {
  const { draft, day, hour, minute, pick, dayItems, hourItems, minuteItems } = useSheetBody({ baseMidnight, dayCount, dayLabel, isValid, initialMs })

  return (
    <View style={styles.backdrop}>
      {/* 바깥을 누르면 취소. 시트를 터치 부품으로 감싸면 휠 스크롤이 자주 안 먹어(10-31) 시트 뒤에 따로 깐다. */}
      <Pressable style={StyleSheet.absoluteFill} onPress={onCancel} accessibilityRole="button" accessibilityLabel="시간 고르기 닫기" />
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
    </View>
  )
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.4)' },
  sheet: {
    width: '100%',
    maxWidth: SHEET_MAX_WIDTH,
    alignSelf: 'center',
    backgroundColor: COLORS.white,
    borderTopLeftRadius: RADIUS.sheet,
    borderTopRightRadius: RADIUS.sheet,
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
