import { Platform } from 'react-native'
import { ApiError, apiRequest } from './client'
import { resolveMockMode } from '../admin/session'

/** 끼니 한 칸. 휴무(공휴일 등)면 `closed` 이고 `items` 에는 사유(예: '한글날')가 들어 있을 수 있다. */
export interface CafeteriaMeal {
  meal: string
  time?: string
  price?: string
  items: string[]
  closed: boolean
}

export interface CafeteriaRestaurant {
  code: string
  /** 지도 편의시설 id(`Facility.id`). 이 값으로 시설 시트의 줄과 맞춘다. */
  facilityId: string
  name: string
  meals: CafeteriaMeal[]
}

/** `GET /cafeteria/menus?date=` 응답(하루치). */
export interface CafeteriaDay {
  /** 'YYYY-MM-DD'(한국 날짜) */
  date: string
  source: string
  sourceUrl: string
  fetchedAt: string
  restaurants: CafeteriaRestaurant[]
}

/** `GET /cafeteria/menus/week?date=` 응답(그 주 월~금). */
export interface CafeteriaWeek {
  days: CafeteriaDay[]
}

/**
 * 메뉴를 보여 주는 식당의 지도 시설 id. 응답이 오기 전·실패했을 때 "이 줄은 메뉴가 있는 식당"인지 가리는 데만 쓴다
 * (실제로 메뉴를 붙일 줄은 응답의 `facilityId` 로 정한다).
 */
export const CAFETERIA_FACILITY_IDS: ReadonlySet<string> = new Set([
  'hi-dorm2-b2f-restaurant-01',
  'hi-mh-16f-restaurant',
])

/** 개발 웹에서 `?mock=1`(관리자 목업과 같은 스위치)이면 서버 없이 목업 메뉴를 쓴다. 운영 빌드는 늘 false. */
function isCafeteriaMock(): boolean {
  return __DEV__ && Platform.OS === 'web' && resolveMockMode() === 'on'
}

function str(value: unknown): string {
  return typeof value === 'string' ? value : ''
}

function arrayOf(value: unknown): unknown[] {
  return Array.isArray(value) ? value : []
}

function parseMeal(raw: unknown): CafeteriaMeal | null {
  if (!raw || typeof raw !== 'object') return null
  const m = raw as Record<string, unknown>
  const meal = str(m.meal).trim()
  if (!meal) return null
  return {
    meal,
    time: str(m.time).trim() || undefined,
    price: str(m.price).trim() || undefined,
    items: arrayOf(m.items)
      .map((item) => str(item).trim())
      .filter(Boolean),
    closed: m.closed === true,
  }
}

function parseRestaurant(raw: unknown): CafeteriaRestaurant | null {
  if (!raw || typeof raw !== 'object') return null
  const r = raw as Record<string, unknown>
  const facilityId = str(r.facilityId)
  if (!facilityId) return null
  return {
    code: str(r.code),
    facilityId,
    name: str(r.name),
    meals: arrayOf(r.meals)
      .map(parseMeal)
      .filter((meal): meal is CafeteriaMeal => meal !== null),
  }
}

function parseDay(raw: unknown): CafeteriaDay | null {
  if (!raw || typeof raw !== 'object') return null
  const d = raw as Record<string, unknown>
  const date = str(d.date)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null
  return {
    date,
    source: str(d.source) || '홍익대학교 홈페이지',
    sourceUrl: str(d.sourceUrl),
    fetchedAt: str(d.fetchedAt),
    restaurants: arrayOf(d.restaurants)
      .map(parseRestaurant)
      .filter((r): r is CafeteriaRestaurant => r !== null),
  }
}

/** 그 주(월~금) 학식 메뉴. 공개 조회라 토큰을 붙이지 않는다. 모양이 어긋난 항목은 버린다. */
export async function getCafeteriaWeek(date: string, options: { signal?: AbortSignal } = {}): Promise<CafeteriaWeek> {
  const raw = isCafeteriaMock()
    ? await (await import('./cafeteriaMock')).mockGetCafeteriaWeek(date)
    : await apiRequest<unknown>(`/cafeteria/menus/week?date=${encodeURIComponent(date)}`, {
        signal: options.signal,
      })
  const days = arrayOf((raw as { days?: unknown } | null)?.days)
    .map(parseDay)
    .filter((d): d is CafeteriaDay => d !== null)
    .sort((a, b) => a.date.localeCompare(b.date))
  return { days }
}

/**
 * 서버에 학식 API 가 아직 없다(배포 전 404·405, 또는 없는 경로를 Spring `/error` 가 401·403 으로 돌려줌 —
 * 이 조회는 토큰 없이 부르므로 401 이 날 다른 이유가 없다). 이때는 메뉴 칸을 아예 그리지 않는다.
 */
export function isCafeteriaApiMissing(error: unknown): boolean {
  return error instanceof ApiError && [401, 403, 404, 405].includes(error.status)
}
