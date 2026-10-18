import { useCallback, useEffect, useState } from 'react'
import { Modal, Pressable, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { COLORS } from '../../constants/colors'
import { FONTS } from '../../constants/typography'
import Button from '../common/Button'
import ReportTimeSheet from './ReportTimeSheet'
import { menuStyles } from './ModerationMenu'
import {
  REPORT_MAX_DURATION_DAYS,
  REPORT_START_MAX_DAYS,
  dayChipLabel,
  formatClock,
  formatDay,
  kstMidnight,
  nextStepAfter,
} from '../../utils/reportSchedule'
import { parseServerTime } from '../../utils/serverTime'

const DAY_MS = 24 * 60 * 60 * 1000
const MAX_DURATION_MS = REPORT_MAX_DURATION_DAYS * DAY_MS

interface ReportScheduleEditModalProps {
  visible: boolean
  /** 서버 시각 문자열(UTC). */
  startsAt: string
  endsAt: string
  saving: boolean
  onClose: () => void
  /** 시작을 고치지 않았으면 받은 startsAt 문자열을 그대로 넘긴다(서버가 같은 값이면 지난 시작도 받는다). */
  onSave: (next: { startsAt: string; endsAt: string }) => void
}

/**
 * 공식 계정 작성자의 제보 시간 수정 시트(10-19 요청 — 행사가 늦게 시작하거나 길어질 때).
 * 이미 시작한 제보는 시작 시각을 바꿀 수 없고 종료만 고친다. 시작 전이면 둘 다(등록과 같은 범위).
 */
export default function ReportScheduleEditModal({
  visible,
  startsAt,
  endsAt,
  saving,
  onClose,
  onSave,
}: ReportScheduleEditModalProps) {
  const insets = useSafeAreaInsets()
  const originalStartMs = parseServerTime(startsAt)
  const [startMs, setStartMs] = useState(originalStartMs)
  const [endMs, setEndMs] = useState(parseServerTime(endsAt))
  const [picker, setPicker] = useState<'start' | 'end' | null>(null)
  const [now, setNow] = useState(Date.now())

  // 열 때마다 받은 값으로 되돌린다.
  useEffect(() => {
    if (!visible) return
    setStartMs(parseServerTime(startsAt))
    setEndMs(parseServerTime(endsAt))
    setNow(Date.now())
  }, [visible, startsAt, endsAt])

  const started = originalStartMs <= now
  const startChanged = startMs !== originalStartMs
  const todayMidnight = kstMidnight(now)
  const firstValidStart = nextStepAfter(now - 1)

  const startValid = useCallback(
    (ms: number) => ms >= firstValidStart && ms < todayMidnight + REPORT_START_MAX_DAYS * DAY_MS,
    [firstValidStart, todayMidnight],
  )
  const endBase = kstMidnight(startMs)
  const endValid = useCallback(
    (ms: number) => ms > startMs && ms - startMs <= MAX_DURATION_MS && ms > now,
    [startMs, now],
  )
  const startDayLabel = useCallback((index: number) => dayChipLabel(index, now), [now])
  const endDayLabel = useCallback(
    (index: number) => dayChipLabel(Math.round((endBase + index * DAY_MS - todayMidnight) / DAY_MS), now),
    [endBase, todayMidnight, now],
  )

  const problem =
    endMs <= startMs
      ? '종료 시각은 시작 시각보다 뒤여야 해요.'
      : endMs <= now
        ? '종료 시각이 이미 지났어요.'
        : endMs - startMs > MAX_DURATION_MS
          ? `진행 기간은 최대 ${REPORT_MAX_DURATION_DAYS}일까지 정할 수 있어요.`
          : null
  const unchanged = !startChanged && endMs === parseServerTime(endsAt)

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={menuStyles.scrim} onPress={onClose} accessibilityRole="button" accessibilityLabel="시간 수정 닫기">
        <Pressable style={[menuStyles.sheet, { paddingBottom: Math.max(insets.bottom, 12) }]} onPress={() => {}}>
          <Text style={styles.title} accessibilityRole="header">
            제보 시간 수정
          </Text>

          <TimeRow
            label="시작 시각"
            value={`${formatDay(startMs)} ${formatClock(startMs)}`}
            note={started ? '이미 시작해 바꿀 수 없어요' : undefined}
            disabled={started || saving}
            onPress={() => setPicker('start')}
          />
          <View style={styles.divider} />
          <TimeRow
            label="종료 시각"
            value={`${formatDay(endMs)} ${formatClock(endMs)}`}
            disabled={saving}
            onPress={() => setPicker('end')}
          />
          {problem ? <Text style={styles.problem}>{problem}</Text> : null}

          <View style={styles.actions}>
            <Button label="취소" variant="secondary" onPress={onClose} style={styles.action} />
            <Button
              label="저장"
              loading={saving}
              disabled={!!problem || unchanged}
              onPress={() =>
                onSave({
                  startsAt: startChanged ? new Date(startMs).toISOString() : startsAt,
                  endsAt: new Date(endMs).toISOString(),
                })
              }
              style={styles.action}
            />
          </View>

          <ReportTimeSheet
            visible={picker === 'start'}
            title="시작 시각"
            baseMidnight={todayMidnight}
            dayCount={REPORT_START_MAX_DAYS}
            dayLabel={startDayLabel}
            isValid={startValid}
            initialMs={startMs}
            onCancel={() => setPicker(null)}
            onConfirm={(ms) => {
              setPicker(null)
              // 진행 기간을 그대로 두고 종료도 같이 옮긴다(등록 화면과 같은 동작).
              setEndMs((prev) => prev + (ms - startMs))
              setStartMs(ms)
            }}
          />
          <ReportTimeSheet
            visible={picker === 'end'}
            title="종료 시각"
            baseMidnight={endBase}
            dayCount={REPORT_MAX_DURATION_DAYS + 1}
            dayLabel={endDayLabel}
            isValid={endValid}
            initialMs={endMs}
            onCancel={() => setPicker(null)}
            onConfirm={(ms) => {
              setPicker(null)
              setEndMs(ms)
            }}
          />
        </Pressable>
      </Pressable>
    </Modal>
  )
}

function TimeRow({
  label,
  value,
  note,
  disabled,
  onPress,
}: {
  label: string
  value: string
  note?: string
  disabled: boolean
  onPress: () => void
}) {
  return (
    <TouchableOpacity
      style={[styles.row, disabled && styles.rowDisabled]}
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={`${label} ${value}${note ? `, ${note}` : ', 바꾸기'}`}
    >
      <View style={styles.rowText}>
        <Text style={styles.rowLabel}>{label}</Text>
        {note ? <Text style={styles.rowNote}>{note}</Text> : null}
      </View>
      <Text style={styles.rowValue}>{value}</Text>
      {!disabled && <Ionicons name="chevron-forward" size={16} color={COLORS.textTertiary} />}
    </TouchableOpacity>
  )
}

const styles = StyleSheet.create({
  title: { fontFamily: FONTS.semibold, fontSize: 16, color: COLORS.textPrimary, textAlign: 'center', marginBottom: 12 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 52, paddingVertical: 8 },
  rowDisabled: { opacity: 0.6 },
  rowText: { flex: 1 },
  rowLabel: { fontFamily: FONTS.medium, fontSize: 14, color: COLORS.textSecondary },
  rowNote: { fontFamily: FONTS.regular, fontSize: 12, color: COLORS.textTertiary, marginTop: 2 },
  rowValue: { fontFamily: FONTS.semibold, fontSize: 15, color: COLORS.primary },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: COLORS.divider },
  problem: { fontFamily: FONTS.regular, fontSize: 12, color: COLORS.danger, marginTop: 8 },
  actions: { flexDirection: 'row', gap: 8, marginTop: 16 },
  action: { flex: 1 },
})
