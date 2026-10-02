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
