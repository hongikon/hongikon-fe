import { kstDateTime, type ReportDayHours } from '../map/report/reportSchedule'
import type { ReportListItem } from '../../types'

/**
 * 개발용 `/temp/changes` — 11-08 바뀐 화면을 실제 컴포넌트와 예시 데이터로 한곳에서 본다(개발 서버·테스트 빌드 웹에서만).
 * 서버를 부르지 않는다. 지도 위 동작(핀 흐림·경로 맞춤·칩과 시트)은 글로 적는다.
 */

export const HOUR = 60 * 60 * 1000

/** 오늘부터 dayOffset 일 뒤 한국 날짜 `2026-11-14`. */
export function dateKey(dayOffset: number): string {
  const ms = kstDateTime(dayOffset, 12, 0) + 9 * HOUR
  return new Date(ms).toISOString().slice(0, 10)
}

/** 한국 시각 → 서버 형식(존 없는 UTC). */
export function serverTime(dayOffset: number, hours: number, minutes = 0): string {
  return new Date(kstDateTime(dayOffset, hours, minutes)).toISOString().slice(0, 19)
}

export function sampleReport(id: number, title: string, startsAt: string, endsAt: string, days?: ReportDayHours[]): ReportListItem {
  return {
    id,
    buildingId: null,
    floor: null,
    lat: 37.55,
    lng: 126.925,
    category: 'BOOTH',
    title,
    content: null,
    authorNickname: '예시',
    isMine: false,
    startsAt,
    endsAt,
    createdAt: serverTime(0, 9),
    ...(days ? { days } : {}),
  } as ReportListItem
}

// 2일 뒤부터 3일: 매일 14:00~18:00 / 날마다 다른 시간(가운데 날 쉼) / 한 번짜리(2일 뒤 14:00~16:00)
export const SAME = sampleReport(1, '붕어빵 부스', serverTime(2, 14), serverTime(4, 18), [
  { date: dateKey(2), start: '14:00', end: '18:00' },
  { date: dateKey(3), start: '14:00', end: '18:00' },
  { date: dateKey(4), start: '14:00', end: '18:00' },
])

export const VARIED = sampleReport(2, '플리마켓', serverTime(2, 14), serverTime(5, 17), [
  { date: dateKey(2), start: '14:00', end: '18:00' },
  { date: dateKey(3), start: '11:00', end: '15:00' },
  { date: dateKey(5), start: '13:00', end: '17:00' },
])

export const ONCE = sampleReport(3, '버스킹 공연', serverTime(2, 14), serverTime(2, 16))

export const REPORTS = [SAME, VARIED, ONCE]

export const TIMES: { label: string; ms: number }[] = [
  { label: '시작 전날 20:00', ms: kstDateTime(1, 20, 0) },
  { label: '첫날 10:00', ms: kstDateTime(2, 10, 0) },
  { label: '첫날 15:00', ms: kstDateTime(2, 15, 0) },
  { label: '첫날 15:40', ms: kstDateTime(2, 15, 40) },
  { label: '첫날 17:40', ms: kstDateTime(2, 17, 40) },
  { label: '첫날 19:00', ms: kstDateTime(2, 19, 0) },
  { label: '둘째 날 16:00', ms: kstDateTime(3, 16, 0) },
]
