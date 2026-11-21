import { REPORT_MAX_DURATION_DAYS, type ReportDayHours } from './reportSchedule'

export const DAY_MS = 24 * 60 * 60 * 1000

export const MAX_DURATION_MS = REPORT_MAX_DURATION_DAYS * DAY_MS

/** 비교용: 서버 값을 `reportDaysFor` 가 돌려주는 모양(시각 HH:mm)으로. */
export function normalizeDays(days: ReportDayHours[] | null | undefined): ReportDayHours[] | null {
  if (!days || days.length < 2) return null
  return days.map((day) => ({ date: day.date, start: day.start.slice(0, 5), end: day.end.slice(0, 5) }))
}
