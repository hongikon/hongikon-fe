import { REPORT_TIME_STEP_MINUTES } from './reportSchedule'

export const MINUTE_MS = 60 * 1000

export const HOUR_MS = 60 * MINUTE_MS

export const DAY_MS = 24 * HOUR_MS

export const STEP_MS = REPORT_TIME_STEP_MINUTES * MINUTE_MS

export const SLOTS_PER_DAY = DAY_MS / STEP_MS

export const HOURS = Array.from({ length: 24 }, (_, hour) => hour)

export const MINUTES = Array.from({ length: 60 / REPORT_TIME_STEP_MINUTES }, (_, i) => i * REPORT_TIME_STEP_MINUTES)
