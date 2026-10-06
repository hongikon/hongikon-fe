import type { Exhibition, Facility } from '../types'
import type { FacilityMarker } from './facilities'

/**
 * 전시 날짜 계산. 날짜는 모두 한국 날짜 'YYYY-MM-DD'(양끝 포함)이고, 오늘도 한국 시간(고정 +9)으로 정한다.
 * `Intl` 의 timeZone 을 쓰지 않는 이유는 `reportSchedule.ts` 와 같다(Hermes 빌드마다 다름).
 */

const DAY_MS = 24 * 60 * 60 * 1000
const KST_OFFSET_MS = 9 * 60 * 60 * 1000
const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토']
const YMD_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/

/** 'YYYY-MM-DD' → 1970-01-01 부터의 일 번호. 형식이 틀렸거나 없는 날짜(2월 30일 등)면 null. */
export function ymdToDayIndex(ymd: string): number | null {
  const match = YMD_PATTERN.exec(ymd)
  if (!match) return null
  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  const ms = Date.UTC(year, month - 1, day)
  const check = new Date(ms)
  if (check.getUTCFullYear() !== year || check.getUTCMonth() !== month - 1 || check.getUTCDate() !== day) return null
  return Math.floor(ms / DAY_MS)
}

/** 오늘(한국 날짜)의 일 번호. */
export function kstTodayIndex(now: number = Date.now()): number {
  return Math.floor((now + KST_OFFSET_MS) / DAY_MS)
}

/** 오늘(한국 날짜) 'YYYY-MM-DD'. */
export function kstTodayYmd(now: number = Date.now()): string {
  return new Date(kstTodayIndex(now) * DAY_MS).toISOString().slice(0, 10)
}

/** '10/12(월)' */
export function formatYmdShort(ymd: string): string {
  const index = ymdToDayIndex(ymd)
  if (index === null) return ymd
  const date = new Date(index * DAY_MS)
  return `${date.getUTCMonth() + 1}/${date.getUTCDate()}(${WEEKDAYS[date.getUTCDay()]})`
}

/** '10/12(월) ~ 10/16(금)'. 하루짜리면 '10/12(월)'. */
export function formatExhibitionPeriod(exhibition: Pick<Exhibition, 'startsOn' | 'endsOn'>): string {
  if (exhibition.startsOn === exhibition.endsOn) return formatYmdShort(exhibition.startsOn)
  return `${formatYmdShort(exhibition.startsOn)} ~ ${formatYmdShort(exhibition.endsOn)}`
}

export type ExhibitionPhase = 'current' | 'upcoming' | 'past'

export function exhibitionPhase(exhibition: Pick<Exhibition, 'startsOn' | 'endsOn'>, today: number): ExhibitionPhase {
  const start = ymdToDayIndex(exhibition.startsOn) ?? Number.POSITIVE_INFINITY
  const end = ymdToDayIndex(exhibition.endsOn) ?? Number.NEGATIVE_INFINITY
  if (end < today) return 'past'
  if (start > today) return 'upcoming'
  return 'current'
}

/** 시작까지 남은 날(오늘 시작이면 0). */
export function daysUntilStart(exhibition: Pick<Exhibition, 'startsOn'>, today: number): number {
  const start = ymdToDayIndex(exhibition.startsOn)
  return start === null ? 0 : start - today
}

/** 'D-3' · 내일이면 'D-1'. */
export function dDayLabel(days: number): string {
  return days <= 0 ? 'D-DAY' : `D-${days}`
}

function byStartThenEnd(a: Exhibition, b: Exhibition): number {
  return a.startsOn.localeCompare(b.startsOn) || a.endsOn.localeCompare(b.endsOn) || a.id - b.id
}

export interface VenueExhibitions {
  /** 오늘 열려 있는 전시(보통 하나). 먼저 시작한 순. */
  current: Exhibition[]
  /** 아직 시작하지 않은 전시. 가까운 순으로 최대 `upcomingLimit` 개. */
  upcoming: Exhibition[]
}

/** 한 시설(전시장)의 지금 전시와 다음 전시. */
export function exhibitionsForVenue(
  exhibitions: readonly Exhibition[],
  facilityId: string,
  now: number = Date.now(),
  upcomingLimit = 2,
): VenueExhibitions {
  const today = kstTodayIndex(now)
  const mine = exhibitions.filter((exhibition) => exhibition.facilityId === facilityId).sort(byStartThenEnd)
  return {
    current: mine.filter((exhibition) => exhibitionPhase(exhibition, today) === 'current'),
    upcoming: mine.filter((exhibition) => exhibitionPhase(exhibition, today) === 'upcoming').slice(0, upcomingLimit),
  }
}

/**
 * '행사·전시' 핀 이름표에 '· 전시 중'을 붙인다. 오늘 열린 전시가 있는 시설이 그 건물에 하나라도 있을 때만.
 * 지도 페이지(mapHtml)는 이름표 문구만 받아 그리므로 페이지를 고치지 않고 문구로만 알린다.
 */
export function withExhibitionHints(
  markers: FacilityMarker[],
  facilities: readonly Facility[],
  exhibitions: readonly Exhibition[],
  now: number = Date.now(),
): FacilityMarker[] {
  if (exhibitions.length === 0) return markers
  const today = kstTodayIndex(now)
  const openFacilityIds = new Set(
    exhibitions.filter((exhibition) => exhibitionPhase(exhibition, today) === 'current').map((exhibition) => exhibition.facilityId),
  )
  if (openFacilityIds.size === 0) return markers
  const openBuildings = new Set(
    facilities
      .filter((facility) => facility.kind === '행사·전시' && openFacilityIds.has(facility.id))
      .map((facility) => facility.buildingName),
  )
  return markers.map((marker) =>
    marker.kind === '행사·전시' && openBuildings.has(marker.buildingName)
      ? { ...marker, label: `${marker.label} · 전시 중` }
      : marker,
  )
}
