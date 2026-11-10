import { parseServerTime } from './serverTime'

/**
 * 예정 제보 — 시작·종료 시각 고르기와 표시.
 *
 * 규칙은 서버(`ReportService.validateSchedule`)와 같다: 시작은 지금 ~ 14일 안, 종료는 시작보다 뒤이고 최대 7일.
 * 시각은 모두 한국 시간(고정 +9, 서머타임 없음)으로 고르고 보여 주며, 서버에는 UTC ISO(`toISOString`)로 보낸다.
 * `Intl` 의 timeZone 을 쓰지 않는 이유는 `formatKstTime`(utils/reports.ts)과 같다(Hermes 빌드마다 다름).
 */

export const REPORT_START_MAX_DAYS = 14
/** 진행 기간 상한(일). 여러 날 행사도 올릴 수 있다 — 길이는 작성자가 정하고 운영진이 검토한다. */
export const REPORT_MAX_DURATION_DAYS = 7
/** 시각을 고르는 간격(분). */
export const REPORT_TIME_STEP_MINUTES = 10

const MINUTE_MS = 60 * 1000
const HOUR_MS = 60 * MINUTE_MS
const DAY_MS = 24 * HOUR_MS
const KST_OFFSET_MS = 9 * HOUR_MS
const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토']

/** 한국 시간으로 본 epoch ms 의 날짜·시각 조각. */
interface KstParts {
  month: number
  day: number
  weekday: string
  hours: number
  minutes: number
  /** 한국 시간 자정 기준 일 번호 — 같은 날인지 비교용 */
  dayIndex: number
}

function kstParts(ms: number): KstParts {
  const shifted = new Date(ms + KST_OFFSET_MS)
  return {
    month: shifted.getUTCMonth() + 1,
    day: shifted.getUTCDate(),
    weekday: WEEKDAYS[shifted.getUTCDay()],
    hours: shifted.getUTCHours(),
    minutes: shifted.getUTCMinutes(),
    dayIndex: Math.floor((ms + KST_OFFSET_MS) / DAY_MS),
  }
}

function pad(value: number): string {
  return value < 10 ? `0${value}` : String(value)
}

/** 오늘(한국 시간) 자정의 epoch ms. */
export function kstMidnight(now: number = Date.now()): number {
  return Math.floor((now + KST_OFFSET_MS) / DAY_MS) * DAY_MS - KST_OFFSET_MS
}

/** 오늘부터 dayOffset 일 뒤의 hours:minutes(한국 시간) → epoch ms. */
export function kstDateTime(dayOffset: number, hours: number, minutes: number, now: number = Date.now()): number {
  return kstMidnight(now) + dayOffset * DAY_MS + hours * HOUR_MS + minutes * MINUTE_MS
}

/** `11:00` */
export function formatClock(ms: number): string {
  const parts = kstParts(ms)
  return `${pad(parts.hours)}:${pad(parts.minutes)}`
}

/** `10/3(토)` */
export function formatDay(ms: number): string {
  const parts = kstParts(ms)
  return `${parts.month}/${parts.day}(${parts.weekday})`
}

/** 날짜 칩 이름: 오늘 · 내일 · 모레 · 그 뒤는 `10/6(화)`. */
export function dayChipLabel(dayOffset: number, now: number = Date.now()): string {
  if (dayOffset === 0) return '오늘'
  if (dayOffset === 1) return '내일'
  if (dayOffset === 2) return '모레'
  return formatDay(kstDateTime(dayOffset, 12, 0, now))
}

/**
 * `10/3(토) 11:00 ~ 15:00`. 날을 넘기면 `10/3(토) 22:00 ~ 10/4(일) 02:00`.
 * startLabel 을 주면 시작 쪽을 그 글자로 바꾼다(예: '지금').
 */
export function formatScheduleRange(startMs: number, endMs: number, startLabel?: string): string {
  // 시작과 같은 날에 끝나면 끝은 시각만 적는다. '지금 ~ …' 은 시작이 곧 지금이다.
  const sameDay = kstParts(startMs).dayIndex === kstParts(endMs).dayIndex
  const start = startLabel ?? `${formatDay(startMs)} ${formatClock(startMs)}`
  const end = sameDay ? formatClock(endMs) : `${formatDay(endMs)} ${formatClock(endMs)}`
  return `${start} ~ ${end}`
}

/** `2시간` · `1시간 30분` · `40분` · `2일 7시간` · `3일` (하루가 넘으면 분은 뺀다) */
export function formatDurationMinutes(totalMinutes: number): string {
  const days = Math.floor(totalMinutes / (24 * 60))
  const hours = Math.floor((totalMinutes % (24 * 60)) / 60)
  const minutes = totalMinutes % 60
  if (days > 0) return hours === 0 ? `${days}일` : `${days}일 ${hours}시간`
  if (hours === 0) return `${minutes}분`
  return minutes === 0 ? `${hours}시간` : `${hours}시간 ${minutes}분`
}

/** 다음 10분 단위 시각(지금이 정확히 10분 단위면 그다음). */
export function nextStepAfter(now: number = Date.now()): number {
  const step = REPORT_TIME_STEP_MINUTES * MINUTE_MS
  return Math.floor(now / step) * step + step
}

/** 같은 날(한국 시간)인지. */
export function isSameKstDay(a: number, b: number): boolean {
  return kstParts(a).dayIndex === kstParts(b).dayIndex
}

/** 시작 시각 확인. 문제가 없으면 null, 있으면 서버와 같은 해요체 문구. */
export function scheduleError(startMs: number, endMs: number, now: number = Date.now()): string | null {
  if (startMs < now - MINUTE_MS) return '시작 시각이 이미 지났어요. 지금 또는 이후 시각을 골라 주세요.'
  if (startMs > now + REPORT_START_MAX_DAYS * DAY_MS) {
    return `시작 시각은 오늘부터 ${REPORT_START_MAX_DAYS}일 안으로 골라 주세요.`
  }
  if (endMs <= startMs) return '종료 시각은 시작 시각보다 뒤여야 해요.'
  if (endMs - startMs > REPORT_MAX_DURATION_DAYS * DAY_MS) {
    return `진행 기간은 최대 ${REPORT_MAX_DURATION_DAYS}일까지 정할 수 있어요.`
  }
  if (endMs <= now) return '종료 시각이 이미 지났어요. 시간을 다시 골라 주세요.'
  return null
}

/** 아직 시작 전인 제보(서버 `include=upcoming` 으로 받은 예정 제보). */
export function isUpcomingReport(report: { startsAt: string }, now: number = Date.now()): boolean {
  return parseServerTime(report.startsAt) > now
}

/** 서버 시각 문자열 두 개 → `10/3(토) 11:00 ~ 15:00`. */
export function formatServerSchedule(startsAt: string, endsAt: string): string {
  return formatScheduleRange(parseServerTime(startsAt), parseServerTime(endsAt))
}

/** 예정 제보 마커·시트에 붙이는 짧은 시작 표시: 오늘이면 `11:00`, 내일이면 `내일 11:00`, 그 뒤면 `10/5(월) 11:00`. */
export function formatStartShort(startMs: number, now: number = Date.now()): string {
  const diff = kstParts(startMs).dayIndex - kstParts(now).dayIndex
  const clock = formatClock(startMs)
  if (diff === 0) return clock
  if (diff === 1) return `내일 ${clock}`
  return `${formatDay(startMs)} ${clock}`
}

// ── 여러 날 제보의 날짜별 운영 시간(11-08) ──────────────────────────────
// 지도에는 기간(startsAt~endsAt = 첫날 시작 ~ 마지막 날 끝) 내내 올라가 있고, 핀·시트가 오늘 상태를 알려 준다.
// 서버 `days: [{date:"2026-11-14", start:"14:00", end:"18:00"}]`(한국 시간, 날마다 다를 수 있음, 쉬는 날은 없음).
// 규칙은 ReportService.validateDays 와 같다.

/** 끝나기 이만큼(분) 전부터 '곧 종료'로 보여 준다. 한 번짜리 제보에도 같다. */
export const REPORT_ENDING_SOON_MINUTES = 30

/** 서버와 주고받는 하루 운영 시간(한국 시간). */
export interface ReportDayHours {
  date: string
  start: string
  end: string
}

/** 하루 운영 시간을 epoch ms 로 푼 것. */
export interface ReportDaySpan {
  date: string
  startMs: number
  endMs: number
}

function parseClockMinutes(value: string | null | undefined): number | null {
  if (!value) return null
  const [h, m] = value.split(':').map((part) => Number(part))
  if (!Number.isInteger(h) || !Number.isInteger(m) || h < 0 || h > 23 || m < 0 || m > 59) return null
  return h * 60 + m
}

/** `2026-11-14`(한국 날짜) → 그날 한국 자정의 epoch ms. */
function kstDateMidnight(date: string): number | null {
  const [y, mo, d] = date.split('-').map((part) => Number(part))
  if (!Number.isInteger(y) || !Number.isInteger(mo) || !Number.isInteger(d)) return null
  return Date.UTC(y, mo - 1, d) - KST_OFFSET_MS
}

/** epoch ms → 한국 날짜 `2026-11-14`. */
export function kstDateKey(ms: number): string {
  const shifted = new Date(ms + KST_OFFSET_MS)
  return `${shifted.getUTCFullYear()}-${pad(shifted.getUTCMonth() + 1)}-${pad(shifted.getUTCDate())}`
}

/** 서버 값 → 날짜별 운영 시간(날짜 순). 이틀이 안 되거나 값이 이상하면 null(한 번짜리로 본다). */
export function parseReportDays(report: { days?: readonly ReportDayHours[] | null }): ReportDaySpan[] | null {
  if (!report.days || report.days.length < 2) return null
  const spans: ReportDaySpan[] = []
  for (const day of report.days) {
    const midnight = kstDateMidnight(day.date)
    const start = parseClockMinutes(day.start)
    const end = parseClockMinutes(day.end)
    if (midnight === null || start === null || end === null || end <= start) return null
    spans.push({ date: day.date, startMs: midnight + start * MINUTE_MS, endMs: midnight + end * MINUTE_MS })
  }
  spans.sort((a, b) => a.startMs - b.startMs)
  return spans
}

/** 날짜별 운영 시간 → 서버로 보낼 값. */
export function toReportDayHours(spans: readonly ReportDaySpan[]): ReportDayHours[] {
  return spans.map((span) => ({ date: span.date, start: formatClock(span.startMs), end: formatClock(span.endMs) }))
}

export function kstMinutesOfDay(ms: number): number {
  const parts = kstParts(ms)
  return parts.hours * 60 + parts.minutes
}

/**
 * 고른 시작·종료로 '날짜별 운영 시간'을 켤 수 있는지: 이틀 이상에 걸치면 된다
 * (예: 11/14 14:00 ~ 11/17 18:00 → 날마다 14:00~18:00로 시작, 날마다 고칠 수 있다).
 * 마지막 날 끝이 첫날 시작 시각보다 이르더라도(11/14 14:00 ~ 11/16 13:00) 날마다 맞춰 준다(`defaultReportDays`).
 */
export function canRunDaily(startMs: number, endMs: number): boolean {
  return endMs > startMs && !isSameKstDay(startMs, endMs)
}

/** 시작 날부터 끝 날까지 날마다 시작 시각~끝 시각으로 채운 운영 시간. `keep` 에 같은 날이 있으면 그 시간을 남긴다(첫날 시작·마지막 날 끝은 고른 값). */
export function defaultReportDays(startMs: number, endMs: number, keep: readonly ReportDaySpan[] = []): ReportDaySpan[] {
  const startMinutes = kstMinutesOfDay(startMs)
  const endMinutes = kstMinutesOfDay(endMs)
  const firstMidnight = kstMidnight(startMs)
  const lastMidnight = kstMidnight(endMs)
  const kept = new Map(keep.map((span) => [span.date, span]))
  const days: ReportDaySpan[] = []
  for (let midnight = firstMidnight; midnight <= lastMidnight; midnight += DAY_MS) {
    const date = kstDateKey(midnight)
    const previous = kept.get(date)
    let dayStart = previous ? previous.startMs : midnight + startMinutes * MINUTE_MS
    let dayEnd = previous ? previous.endMs : midnight + endMinutes * MINUTE_MS
    if (midnight === firstMidnight) dayStart = startMs
    if (midnight === lastMidnight) dayEnd = endMs
    // 시작이 끝보다 늦어진 날(예: 마지막 날 13:00에 끝나는데 기본 시작이 14:00)은 한 시간짜리로 맞춘다. 고정된 쪽은 그대로 둔다.
    if (dayEnd <= dayStart) {
      if (midnight === lastMidnight && midnight !== firstMidnight) {
        dayStart = Math.max(midnight, dayEnd - HOUR_MS)
      } else {
        dayEnd = Math.min(midnight + DAY_MS - REPORT_TIME_STEP_MINUTES * MINUTE_MS, dayStart + HOUR_MS)
      }
    }
    days.push({ date, startMs: dayStart, endMs: dayEnd })
  }
  return days
}

/**
 * 날짜별 운영 시간 한 줄: `11/14(토) ~ 11/17(화) · 매일 14:00~18:00`. 가운데 쉬는 날이 있으면 `… · 쉬는 날 1일`을 붙이고,
 * 날마다 시각이 다르면 `… · 날마다 시간 다름`. `firstFromNow` 면 첫날은 '지금'부터라 첫날 시작 시각은 보지 않는다.
 */
export function formatDaysRange(spans: readonly ReportDaySpan[], options: { firstFromNow?: boolean } = {}): string {
  const first = spans[0]
  const last = spans[spans.length - 1]
  const range = `${options.firstFromNow ? '지금' : formatDay(first.startMs)} ~ ${formatDay(last.startMs)}`
  const refStart = kstMinutesOfDay(last.startMs)
  const refEnd = kstMinutesOfDay(last.endMs)
  const same = spans.every(
    (span, index) =>
      (index === 0 && options.firstFromNow ? true : kstMinutesOfDay(span.startMs) === refStart) &&
      kstMinutesOfDay(span.endMs) === refEnd,
  )
  if (!same) return `${range} · 날마다 시간 다름`
  const offDays = Math.round((kstMidnight(last.startMs) - kstMidnight(first.startMs)) / DAY_MS) + 1 - spans.length
  return `${range} · 매일 ${formatClock(last.startMs)}~${formatClock(last.endMs)}${offDays > 0 ? ` · 쉬는 날 ${offDays}일` : ''}`
}

/** 서버 시각·운영 시간 → 시트에 적을 일정 한 줄. 날짜별 운영 시간이 없으면 지금의 `10/3(토) 11:00 ~ 15:00`. */
export function formatReportSchedule(report: { startsAt: string; endsAt: string; days?: readonly ReportDayHours[] | null }): string {
  const spans = parseReportDays(report)
  if (!spans) return formatScheduleRange(parseServerTime(report.startsAt), parseServerTime(report.endsAt))
  return formatDaysRange(spans)
}

/** 날짜 하나의 줄: `11/14(토) 14:00~18:00` */
export function formatDaySpan(span: ReportDaySpan): string {
  return `${formatDay(span.startMs)} ${formatClock(span.startMs)}~${formatClock(span.endMs)}`
}

/**
 * 지금 이 제보의 상태와 핀·시트에 붙일 짧은 글.
 * - upcoming: 기간이 아직 시작 전(예정). text 는 `11:00` · `내일 11:00` · `11/14(금) 14:00`.
 * - later: 날짜별 운영 제보인데 지금은 운영 시간 밖. `오늘 14:00 시작` · `내일 13:00 시작` · `11/16(월) 13:00 시작`.
 * - live: 운영 중. 날짜별 운영 제보는 `운영 중 · 18:00까지`, 한 번짜리는 text 없음(지금처럼 이름만).
 * - ending: 끝나기 30분 안. `곧 종료 · 18:00`(날짜별 운영 제보는 그날 끝, 한 번짜리는 종료 시각).
 */
export type ReportPhaseKind = 'upcoming' | 'later' | 'live' | 'ending'

export interface ReportPhase {
  kind: ReportPhaseKind
  text: string | null
}

export function reportPhase(
  report: { startsAt: string; endsAt: string; days?: readonly ReportDayHours[] | null },
  now: number = Date.now(),
): ReportPhase {
  const startMs = parseServerTime(report.startsAt)
  const endMs = parseServerTime(report.endsAt)
  if (startMs > now) return { kind: 'upcoming', text: formatStartShort(startMs, now) }

  const soonMs = REPORT_ENDING_SOON_MINUTES * MINUTE_MS
  const spans = parseReportDays(report)
  const current = spans?.find((span) => span.endMs > now)
  if (!spans || !current) {
    return endMs - now <= soonMs ? { kind: 'ending', text: `곧 종료 · ${formatClock(endMs)}` } : { kind: 'live', text: null }
  }
  if (now < current.startMs) {
    const diff = kstParts(current.startMs).dayIndex - kstParts(now).dayIndex
    const day = diff === 0 ? '오늘' : diff === 1 ? '내일' : formatDay(current.startMs)
    return { kind: 'later', text: `${day} ${formatClock(current.startMs)} 시작` }
  }
  const endClock = formatClock(current.endMs)
  return current.endMs - now <= soonMs
    ? { kind: 'ending', text: `곧 종료 · ${endClock}` }
    : { kind: 'live', text: `운영 중 · ${endClock}까지` }
}
