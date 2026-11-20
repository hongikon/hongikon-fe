import { useCallback, useState } from 'react'
import {
  DAY_MS,
  MAX_DURATION_MS,
  MINUTE_MS,
  STEP_MS,
  allSameHours,
  effectiveDays,
  initialHours,
  pinDailyHours,
  type DaysMode,
  type EditableDay,
  type ReportDaysPatch,
} from '../../../utils/map/reportDays'
import { canRunDaily, kstDateKey, kstMidnight, kstMinutesOfDay } from '../../../utils/reportSchedule'

interface Options {
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
  startIsNow: boolean
  /** 첫날 시작을 바꿀 수 없으면(이미 시작한 제보의 시간 수정) true. */
  startLocked: boolean
}

/**
 * 날짜별 운영 시간 편집기의 상태와 동작: 체크 켜기/끄기, 마지막 날 늘이기·줄이기, '매일 같은 시간'/'날마다 다르게',
 * 날마다 시각 고르기(`picker`)와 매일 시각 고르기(`hoursPicker`). 바뀐 값은 `onChange` 로 한 번에 넘긴다.
 */
export function useReportDaysEditor({
  startMs,
  endMs,
  enabled,
  edited,
  onChange,
  earliestStart,
  startIsNow,
  startLocked,
}: Options) {
  // 체크는 켜 있어도 시각을 바꿔 하루짜리가 되면 꺼진 것으로 보인다(부모도 그때는 한 번짜리로 올린다).
  const multiDay = canRunDaily(startMs, endMs)
  const on = enabled && multiDay
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
    if (on) return onChange({ daily: false })
    const hours = initialHours(startMs, endMs, startIsNow)
    setMode('same')
    if (multiDay) return applySame(hours.open, hours.close, { daily: true })
    // 하루 안에서 끝나는 시간이면 내일까지 같은 시간으로 늘린다(첫날은 고른 시작부터).
    const firstMidnight = kstMidnight(startMs)
    const nextMidnight = firstMidnight + DAY_MS
    const firstEnd = Math.max(firstMidnight + hours.close * MINUTE_MS, startMs + STEP_MS)
    const nextEnd = nextMidnight + hours.close * MINUTE_MS
    onChange({
      daily: true,
      endMs: nextEnd,
      edited: [
        { date: kstDateKey(firstMidnight), startMs, endMs: firstEnd },
        { date: kstDateKey(nextMidnight), startMs: nextMidnight + hours.open * MINUTE_MS, endMs: nextEnd },
      ],
    })
  }

  /** 마지막 날을 하루 늘이거나 줄인다. 고친 날·쉬는 날은 그대로, 새 날은 '매일' 시각으로. */
  const moveLastDay = (delta: 1 | -1) => {
    const nextEnd = endMs + delta * DAY_MS
    onChange({ endMs: nextEnd, edited: pinDailyHours(startMs, endMs, edited, startMs, nextEnd) })
  }
  const canShorten = days.length > 2
  const canExtend = endMs + DAY_MS - startMs <= MAX_DURATION_MS

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


  return {
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
  }
}
