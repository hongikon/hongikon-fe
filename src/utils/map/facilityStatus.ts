import type { Facility } from '../../types'

/**
 * 관리자가 '이용 불가'로 둔 시설(11-22, `GET /map/data` 의 facility.unavailable). 서버가 오늘 기준으로 이미 걸러 보낸다 —
 * 종료일이 지난 것은 `unavailable` 이 없다.
 */
export function isFacilityUnavailable(facility: Pick<Facility, 'unavailable'>): boolean {
  return facility.unavailable != null
}

/** 'yyyy-MM-ddTHH:mm' → '12월 1일 18:00'(하루 끝 23:59 이거나 시각이 없으면 '12월 1일'). 모양이 다르면 그대로. */
function monthDay(value: string): string {
  const m = /^\d{4}-(\d{2})-(\d{2})(?:T(\d{2}:\d{2}))?/.exec(value)
  if (!m) return value
  const day = `${Number(m[1])}월 ${Number(m[2])}일`
  return m[3] && m[3] !== '23:59' ? `${day} ${m[3]}` : day
}

/** 시설 시트·검색 줄에 쓰는 한 줄. 이용 가능이면 null. 예: '지금 이용할 수 없어요 · 공사 중 · 12월 1일까지' */
export function facilityUnavailableText(facility: Pick<Facility, 'unavailable'>): string | null {
  const status = facility.unavailable
  if (status == null) return null
  const parts = ['지금 이용할 수 없어요']
  if (status.reason?.trim()) parts.push(status.reason.trim())
  if (status.until) parts.push(`${monthDay(status.until)}까지`)
  return parts.join(' · ')
}
