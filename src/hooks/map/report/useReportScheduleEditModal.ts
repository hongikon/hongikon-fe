import { useCallback, useEffect, useState } from 'react'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { REPORT_MAX_DURATION_DAYS, REPORT_START_MAX_DAYS, dayChipLabel, canRunDaily, kstDateKey, kstMidnight, nextStepAfter, parseReportDays } from '../../../utils/map/report/reportSchedule'
import { parseServerTime } from '../../../utils/common/serverTime'
import { reportDaysFor, type EditableDay } from '../../../utils/map/report/reportDays'
import { normalizeDays, DAY_MS, MAX_DURATION_MS } from '../../../utils/map/report/reportScheduleEditModal'
import type { ReportScheduleEditModalProps } from '../../../components/map/report/ReportScheduleEditModal'

/** ReportScheduleEditModal 의 상태·효과·핸들러. 화면 파일은 이 훅을 불러 그리기만 한다. */
export function useReportScheduleEditModal({ visible, startsAt, endsAt, days }: Pick<ReportScheduleEditModalProps, 'visible' | 'startsAt' | 'endsAt' | 'days'>) {
  const insets = useSafeAreaInsets()
  const originalStartMs = parseServerTime(startsAt)
  const [startMs, setStartMs] = useState(originalStartMs)
  const [endMs, setEndMs] = useState(parseServerTime(endsAt))
  const [picker, setPicker] = useState<'start' | 'end' | null>(null)
  const [now, setNow] = useState(Date.now())
  const [daily, setDaily] = useState(false)
  const [editedDays, setEditedDays] = useState<EditableDay[]>([])

  // 열 때마다 받은 값으로 되돌린다. 날짜별 운영 시간이 있으면 그 날들을 그대로, 빠진 가운데 날은 쉬는 날로 둔다.
  useEffect(() => {
    if (!visible) return
    setStartMs(parseServerTime(startsAt))
    setEndMs(parseServerTime(endsAt))
    setNow(Date.now())
    const spans = parseReportDays({ days })
    setDaily(spans !== null)
    if (!spans) {
      setEditedDays([])
      return
    }
    const open = new Set(spans.map((span) => span.date))
    const offDays: EditableDay[] = []
    for (let midnight = kstMidnight(spans[0].startMs); midnight < kstMidnight(spans[spans.length - 1].startMs); midnight += DAY_MS) {
      const date = kstDateKey(midnight)
      if (!open.has(date)) offDays.push({ date, startMs: midnight, endMs: midnight, off: true })
    }
    setEditedDays([...spans, ...offDays])
  }, [visible, startsAt, endsAt, days])

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
  const dailyAvailable = canRunDaily(startMs, endMs)
  const nextDays = reportDaysFor(daily && dailyAvailable, startMs, endMs, editedDays)
  const unchanged =
    !startChanged && endMs === parseServerTime(endsAt) && JSON.stringify(nextDays) === JSON.stringify(normalizeDays(days))
  return {
    insets,
    startMs,
    setStartMs,
    endMs,
    setEndMs,
    picker,
    setPicker,
    daily,
    setDaily,
    editedDays,
    setEditedDays,
    started,
    startChanged,
    todayMidnight,
    firstValidStart,
    startValid,
    endBase,
    endValid,
    startDayLabel,
    endDayLabel,
    problem,
    nextDays,
    unchanged,
  }
}
