import {
  REPORT_MAX_DURATION_DAYS,
  REPORT_TIME_STEP_MINUTES,
  type ReportDayHours,
} from '../reportSchedule'
import { reportDaysFor, type EditableDay } from './reportDays'

export const MINUTE_MS = 60 * 1000
export const HOUR_MS = 60 * MINUTE_MS
export const DAY_MS = 24 * HOUR_MS
export const STEP_MS = REPORT_TIME_STEP_MINUTES * MINUTE_MS
export const MAX_DURATION_MS = REPORT_MAX_DURATION_DAYS * DAY_MS

/**
 * 제보 시각. 시작은 '지금' 또는 고른 시각(오늘부터 14일 안, 10분 단위), 끝은 진행 시간 프리셋 또는 직접 고른 날짜·시각
 * (시작부터 최대 7일 — 여러 날 행사).
 * 고른 시작·종료는 epoch ms(UTC)로 들고 있고 화면엔 한국 시간으로 보인다.
 */
export interface ReportSchedule {
  startMode: 'now' | 'scheduled'
  /** startMode 가 scheduled 일 때의 시작(10분 단위). */
  scheduledStartMs: number
  endMode: 'duration' | 'custom'
  durationHours: number
  /** endMode 가 custom 일 때의 종료(10분 단위). */
  customEndMs: number
  /**
   * '매일 정해진 시간에만 운영'(11-08). 켜도 `scheduleDaysFor` 가 쓸 수 있다고 볼 때(이틀 이상에 걸침)만 보낸다 —
   * 시각을 바꿔 조건이 깨지면 체크는 남아도 한 번짜리로 올라간다(체크 줄도 사라진다). 시작이 '지금'이어도 된다(11-09).
   */
  daily: boolean
  /** 날짜별로 고친 운영 시간·쉬는 날(`ReportDaysEditor`). 고르지 않은 날은 시작 시각~끝 시각이다. */
  editedDays: EditableDay[]
}

/** 지금 고른 값으로 보낼 날짜별 운영 시간. 쓸 수 없으면 null(한 번짜리). */
export function scheduleDaysFor(
  schedule: ReportSchedule,
  resolved: { startMs: number; endMs: number },
): ReportDayHours[] | null {
  return reportDaysFor(schedule.daily, resolved.startMs, resolved.endMs, schedule.editedDays)
}

export function initialReportSchedule(defaultDurationHours: number, now: number = Date.now()): ReportSchedule {
  const start = defaultScheduledStart(now)
  return {
    startMode: 'now',
    scheduledStartMs: start,
    endMode: 'duration',
    durationHours: defaultDurationHours,
    customEndMs: start + defaultDurationHours * HOUR_MS,
    daily: false,
    editedDays: [],
  }
}

/** '날짜·시간 선택'을 처음 눌렀을 때의 시작: 30분 뒤 이후의 첫 정각. */
export function defaultScheduledStart(now: number): number {
  return Math.ceil((now + 30 * MINUTE_MS) / HOUR_MS) * HOUR_MS
}

/** 지금 보이는 시작·종료(ms). '지금'이면 now 가 시작이다. */
export function resolveSchedule(schedule: ReportSchedule, now: number = Date.now()): { startMs: number; endMs: number } {
  const startMs = schedule.startMode === 'now' ? now : schedule.scheduledStartMs
  const endMs = schedule.endMode === 'duration' ? startMs + schedule.durationHours * HOUR_MS : schedule.customEndMs
  return { startMs, endMs }
}

/** 시작 이후, 최대 7일 안의 가장 가까운 10분 단위 종료로 맞춘다. */
export function clampEnd(endMs: number, startMs: number): number {
  const earliest = Math.ceil((startMs + 1) / STEP_MS) * STEP_MS
  const latest = Math.floor((startMs + MAX_DURATION_MS) / STEP_MS) * STEP_MS
  return Math.min(Math.max(endMs, earliest), latest)
}
