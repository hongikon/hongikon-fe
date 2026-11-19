import {
  REPORT_MAX_DURATION_DAYS,
  REPORT_TIME_STEP_MINUTES,
  canRunDaily,
  defaultReportDays,
  kstDateKey,
  kstMidnight,
  kstMinutesOfDay,
  toReportDayHours,
  type ReportDayHours,
  type ReportDaySpan,
} from '../reportSchedule'

export const DAY_MS = 24 * 60 * 60 * 1000
export const MINUTE_MS = 60 * 1000
export const STEP_MS = REPORT_TIME_STEP_MINUTES * MINUTE_MS
export const MAX_DURATION_MS = REPORT_MAX_DURATION_DAYS * DAY_MS

/** 고칠 수 있는 하루. off 면 그날은 쉰다(첫날·마지막 날은 쉴 수 없다 — 기간을 줄이면 된다). */
export interface EditableDay extends ReportDaySpan {
  off?: boolean
}

/**
 * 고른 시작·종료와 고친 날들로 지금 보일 날짜 목록. 날마다 처음엔 시작 시각~끝 시각이고, 고친 날·쉬는 날은 남긴다.
 * 첫날 시작·마지막 날 끝은 언제나 위에서 고른 시작·종료 시각이다.
 */
export function effectiveDays(startMs: number, endMs: number, edited: readonly EditableDay[]): EditableDay[] {
  const off = new Set(edited.filter((day) => day.off).map((day) => day.date))
  const days = defaultReportDays(startMs, endMs, edited)
  return days.map((day, index) => ({ ...day, off: index > 0 && index < days.length - 1 && off.has(day.date) }))
}

/**
 * 시작을 바꿀 때(예: '지금'으로) 날마다의 시각이 새 시작 시각을 따라가지 않게, 지금 보이는 '매일' 시작 시각으로
 * 아직 고치지 않은 날을 모두 채워 둔다. 고친 날·쉬는 날은 그대로.
 */
export function pinDailyHours(
  startMs: number,
  endMs: number,
  edited: readonly EditableDay[],
  nextStartMs: number,
  nextEndMs: number,
): EditableDay[] {
  const days = effectiveDays(startMs, endMs, edited)
  const open = kstMinutesOfDay(days[days.length - 1].startMs)
  const close = kstMinutesOfDay(endMs)
  const kept = new Map(edited.map((day) => [day.date, day]))
  const out: EditableDay[] = []
  for (let midnight = kstMidnight(nextStartMs); midnight <= kstMidnight(nextEndMs); midnight += DAY_MS) {
    const date = kstDateKey(midnight)
    out.push(kept.get(date) ?? { date, startMs: midnight + open * MINUTE_MS, endMs: midnight + close * MINUTE_MS })
  }
  return out
}

/** 서버로 보낼 날짜별 운영 시간. 켜지 않았거나 쓸 수 없으면 null(한 번짜리). */
export function reportDaysFor(
  enabled: boolean,
  startMs: number,
  endMs: number,
  edited: readonly EditableDay[],
): ReportDayHours[] | null {
  if (!enabled || !canRunDaily(startMs, endMs)) return null
  const open = effectiveDays(startMs, endMs, edited).filter((day) => !day.off)
  return open.length >= 2 ? toReportDayHours(open) : null
}

/** 편집기가 부모에게 한 번에 넘기는 바뀐 값. 여러 값이 같이 바뀌어도 한 번에 넘겨야 부모가 앞의 값을 덮어쓰지 않는다. */
export interface ReportDaysPatch {
  daily?: boolean
  edited?: EditableDay[]
  /** 첫날 시작(=제보 시작)을 이 시각으로. */
  startMs?: number
  /** 마지막 날 끝(=제보 종료)을 이 시각으로. */
  endMs?: number
}

/** '매일 같은 시간'(same) 또는 '날마다 다르게'(each). */
export type DaysMode = 'same' | 'each'

const LAST_SLOT_MINUTES = 24 * 60 - REPORT_TIME_STEP_MINUTES

/** 체크를 처음 켤 때의 매일 운영 시간: 고른 시작 시각(지금이면 지금 시각의 정각)~종료 시각. 끝이 시작보다 이르면 4시간짜리로. */
export function initialHours(startMs: number, endMs: number, startIsNow: boolean): { open: number; close: number } {
  const startMinutes = kstMinutesOfDay(startMs)
  const open = startIsNow ? Math.floor(startMinutes / 60) * 60 : startMinutes
  const endMinutes = kstMinutesOfDay(endMs)
  const close = endMinutes > open ? endMinutes : Math.min(open + 4 * 60, LAST_SLOT_MINUTES)
  return { open: Math.min(open, close - REPORT_TIME_STEP_MINUTES), close }
}

/** 날마다 같은 시간인지(첫날이 '지금'이면 첫날 시작은 보지 않는다, 쉬는 날은 뺀다). */
export function allSameHours(days: readonly EditableDay[], startIsNow: boolean): boolean {
  const open = days.filter((day) => !day.off)
  if (open.length < 2) return true
  const ref = open[open.length - 1]
  const refStart = kstMinutesOfDay(ref.startMs)
  const refEnd = kstMinutesOfDay(ref.endMs)
  return open.every(
    (day, index) =>
      (index === 0 && startIsNow ? true : kstMinutesOfDay(day.startMs) === refStart) && kstMinutesOfDay(day.endMs) === refEnd,
  )
}
