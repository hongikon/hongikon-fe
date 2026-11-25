import { useCallback, useEffect, useRef, useState } from 'react'
import { COLORS } from '../../constants/colors'
import { REPORT_START_MAX_DAYS, canRunDaily, dayChipLabel, formatDaysRange, formatDurationMinutes, formatScheduleRange, kstMidnight, nextStepAfter } from '../../utils/map/report/reportSchedule'
import { useAttentionFlash } from '../common/useAttentionFlash'
import { effectiveDays } from '../../utils/map/report/reportDays'
import { DAY_MS, MAX_DURATION_MS, MINUTE_MS, STEP_MS, clampEnd, defaultScheduledStart, resolveSchedule, type ReportSchedule } from '../../utils/map/report/reportScheduleState'
import type { ReportScheduleFieldsProps } from '../../components/map/ReportScheduleFields'

/** ReportScheduleFields 의 상태·효과·핸들러. 화면 파일은 이 훅을 불러 그리기만 한다. */
export function useReportScheduleFields({ value, onChange, now, flashKey, invalid = false }: Pick<ReportScheduleFieldsProps, 'value' | 'onChange' | 'now' | 'flashKey' | 'invalid'>) {
  const summaryFlash = useAttentionFlash(flashKey, invalid, COLORS.primarySoft)
  const { startMs, endMs } = resolveSchedule(value, now)
  const scheduled = value.startMode === 'scheduled'
  const firstValidStart = nextStepAfter(now - 1)
  const todayMidnight = kstMidnight(now)
  const [sheet, setSheet] = useState<'start' | 'end' | null>(null)

  // 시작을 옮기다 고른 종료를 자동으로 맞췄을 때 한 줄 알려 준다. 종료를 다시 고르면 지운다.
  const [endAutoFit, setEndAutoFit] = useState(false)

  /**
   * 시작을 바꿀 때의 종료. 직접 고른 종료는 고른 시각 그대로 둔다 — 전에는 진행 기간을 유지한 채 같이 밀려
   * 고른 종료가 엉뚱한 시각으로 옮겨졌다(10-22 지적). 새 시작보다 앞이거나 7일을 넘어 쓸 수 없게 되면
   * 원래 진행 시간만큼 새 시작 뒤로 자동으로 맞춘다(제보 시간 수정 창과 같은 동작) — 전에는 'N시간 뒤' 칩으로
   * 돌아가 종료를 먼저 고른 사람에게 고르지 않은 칩이 켜져 보였다(10-27 지적).
   */
  const endFor = (nextStartMs: number): Pick<ReportSchedule, 'endMode' | 'customEndMs'> => {
    if (value.endMode !== 'custom') return { endMode: value.endMode, customEndMs: value.customEndMs }
    const fits = value.customEndMs > nextStartMs && value.customEndMs - nextStartMs <= MAX_DURATION_MS
    if (fits) return { endMode: 'custom', customEndMs: value.customEndMs }
    const kept = Math.max(value.customEndMs - startMs, STEP_MS)
    return { endMode: 'custom', customEndMs: clampEnd(Math.ceil((nextStartMs + kept) / STEP_MS) * STEP_MS, nextStartMs) }
  }

  const changeStart = (next: Pick<ReportSchedule, 'startMode' | 'scheduledStartMs'>, nextStartMs: number) => {
    const end = endFor(nextStartMs)
    setEndAutoFit(value.endMode === 'custom' && end.customEndMs !== value.customEndMs)
    onChange({ ...value, ...next, ...end })
  }

  const setStart = (nextStartMs: number) => {
    changeStart({ startMode: 'scheduled', scheduledStartMs: nextStartMs }, nextStartMs)
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
  // '매일 정해진 시간에만'은 여러 날에 걸칠 때 쓰인다. 하루짜리여도 체크는 보이고, 켜면 내일까지로 늘어난다(11-09 요청).
  const dailyAvailable = canRunDaily(startMs, endMs)
  const daily = dailyAvailable && value.daily
  const summary = daily
    ? formatDaysRange(effectiveDays(startMs, endMs, value.editedDays).filter((day) => !day.off), { firstFromNow: !scheduled })
    : `${formatScheduleRange(startMs, endMs, scheduled ? undefined : '지금')} · ${formatDurationMinutes(durationMinutes)}`
  return {
    summaryFlash,
    startMs,
    endMs,
    scheduled,
    firstValidStart,
    todayMidnight,
    sheet,
    setSheet,
    endAutoFit,
    setEndAutoFit,
    endFor,
    changeStart,
    setStart,
    startValid,
    startDayLabel,
    endBase,
    endValid,
    endDayLabel,
    endInitial,
    startInitial,
    daily,
    summary,
  }
}
