import { haversineMeters } from '../../utils/geo'
import { kstTodayYmd } from '../../utils/exhibitions'
import type { Partner, PartnerAffiliation } from '../../types'

/**
 * 근처 제휴 판단 규칙. 위치·알림·저장 API 를 부르지 않는 순수 함수만 둔다 — 시각(ms)과 좌표를 모두 인자로 받아
 * 기기 없이 `pnpm test` 로 확인한다. 숫자와 그 근거는 `docs/nearby-partner-alert-plan.md` "판단 알고리즘".
 *
 * - 앱 안 "내 주변 제휴"(포그라운드, 위치 한 번 읽기): `partnersNear`
 * - 근처 알림(백그라운드 지오펜스, 아직 연결 전): `pickTargets` → `pickNearest` → `stayStartedAt` → `decideOnEnter`
 */

/** 업체 하나의 지오펜스 반경. iOS 는 이보다 작게 잡아도 사실상 100~200m 로 동작한다. */
export const PARTNER_REGION_RADIUS_METERS = 100
/** 사용자 둘레 큰 원. 이 원을 벗어나면 가까운 업체를 다시 골라 등록한다. */
export const RESELECT_REGION_RADIUS_METERS = 500
/** iOS 등록 한도 20개 중 큰 원 1개를 뺀 수. Android(100개)도 같은 수로 맞춘다. */
export const MAX_PARTNER_REGIONS = 19
/** 이만큼 머물러야 알린다. */
export const DWELL_MS = 5 * 60 * 1000
/** 나갔다가 이 안에 다시 들어오면(위치 흔들림) 이어서 머문 것으로 본다. */
export const REENTRY_GRACE_MS = 3 * 60 * 1000
/** 하루(한국 날짜) 전체 알림 수. */
export const MAX_ALERTS_PER_DAY = 2
/** 점심·저녁 우선 시간대 밖에서는 하루 이만큼만. */
export const MAX_OFF_PEAK_ALERTS_PER_DAY = 1

const KST_OFFSET_MS = 9 * 60 * 60 * 1000
/** 정보통신망법: 21시~다음 날 8시에는 광고성 정보를 보내지 않는다(분 단위, 한국 시간). */
const QUIET_START_MINUTE = 21 * 60
const QUIET_END_MINUTE = 8 * 60
/** 점심·저녁 우선 시간대 [시작, 끝) 분. */
const PEAK_WINDOWS: readonly (readonly [number, number])[] = [
  [11 * 60 + 30, 13 * 60 + 30],
  [17 * 60 + 30, 19 * 60 + 30],
]

/** 한국 시간 하루 중 몇 번째 분인지(0~1439). `Intl` 시간대를 쓰지 않는 이유는 `utils/exhibitions.ts` 와 같다. */
function kstMinuteOfDay(now: number): number {
  const date = new Date(now + KST_OFFSET_MS)
  return date.getUTCHours() * 60 + date.getUTCMinutes()
}

export function isQuietHour(now: number): boolean {
  const minute = kstMinuteOfDay(now)
  return minute >= QUIET_START_MINUTE || minute < QUIET_END_MINUTE
}

export function isPeakHour(now: number): boolean {
  const minute = kstMinuteOfDay(now)
  return PEAK_WINDOWS.some(([start, end]) => minute >= start && minute < end)
}

/** 이 소속 사용자가 받는 혜택 문구. 소속별 예외가 있으면 그것, 없으면 기본 혜택. */
export function benefitFor(partner: Partner, affiliation: PartnerAffiliation | null): string | null {
  const special = affiliation
    ? partner.affiliationBenefits?.find((item) => item.affiliation === affiliation)?.benefit
    : undefined
  const benefit = (special ?? partner.benefit)?.trim()
  return benefit ? benefit : null
}

function endedBefore(endsOn: string | undefined, today: string): boolean {
  return endsOn !== undefined && endsOn < today
}

export interface PickTargetsOptions {
  /** 사용자가 고른 소속. null 이면 총학생회 제휴만. */
  affiliation: PartnerAffiliation | null
  /** 캠퍼스 건물 좌표. 업체 반경이 건물에 걸치면(강의실에서 알림이 가는 경우) 뺀다. */
  campusPoints: readonly { lat: number; lng: number }[]
  now: number
}

/**
 * 근처 알림 대상 업체. 관리자가 "근처 알림 대상"으로 켠 업체 중
 * 혜택 문구가 있고, 제휴가 끝나지 않았고, 사용자 소속(또는 총학생회) 제휴이며, 캠퍼스 건물과 겹치지 않는 곳.
 * 서버도 끝난 제휴를 빼서 내려주지만, 백그라운드에서는 기기에 저장해 둔 목록을 쓰므로 날짜를 다시 본다.
 */
export function pickTargets(partners: readonly Partner[], options: PickTargetsOptions): Partner[] {
  const today = kstTodayYmd(options.now)
  const { affiliation } = options
  return partners.filter((partner) => {
    if (partner.nearbyAlert !== true) return false
    if (benefitFor(partner, affiliation) === null) return false
    if (endedBefore(partner.endsOn, today)) return false

    const affiliations = partner.affiliations ?? []
    const eligible = affiliations.filter((item) => {
      if (item !== '총학생회' && item !== affiliation) return false
      const end = partner.affiliationEnds?.find((e) => e.affiliation === item)?.endsOn
      return !endedBefore(end, today)
    })
    if (eligible.length === 0) return false

    return !options.campusPoints.some(
      (point) => haversineMeters(point.lat, point.lng, partner.lat, partner.lng) < PARTNER_REGION_RADIUS_METERS,
    )
  })
}

export interface PartnerDistance {
  partner: Partner
  meters: number
}

function byDistance(partners: readonly Partner[], lat: number, lng: number): PartnerDistance[] {
  return partners
    .map((partner) => ({ partner, meters: haversineMeters(lat, lng, partner.lat, partner.lng) }))
    .sort((a, b) => a.meters - b.meters || a.partner.id.localeCompare(b.partner.id))
}

/** 지오펜스로 등록할 가까운 업체(거리순, 같으면 id 순). */
export function pickNearest(
  targets: readonly Partner[],
  lat: number,
  lng: number,
  limit: number = MAX_PARTNER_REGIONS,
): Partner[] {
  return byDistance(targets, lat, lng)
    .slice(0, limit)
    .map((item) => item.partner)
}

/** 앱 안 "내 주변 제휴": 반경 안 업체를 가까운 순으로. */
export function partnersNear(
  partners: readonly Partner[],
  lat: number,
  lng: number,
  radiusMeters: number,
  limit: number,
): PartnerDistance[] {
  return byDistance(partners, lat, lng)
    .filter((item) => item.meters <= radiusMeters)
    .slice(0, limit)
}

/** "120m", "1.2km". 1km 미만은 10m 단위로 반올림한다(위치 오차보다 촘촘하게 보여 줄 이유가 없다). */
export function formatDistance(meters: number): string {
  if (meters < 1000) return `${Math.max(10, Math.round(meters / 10) * 10)}m`
  return `${(meters / 1000).toFixed(1)}km`
}

/** 업체 하나에 대해 기억해 둔 마지막 머무름. */
export interface StayRecord {
  enteredAt: number
  /** 아직 안에 있으면 null. */
  exitedAt: number | null
}

/** 이번 진입을 언제부터 머문 것으로 칠지. 나간 지 3분 안에 다시 들어왔으면 처음 들어온 때부터. */
export function stayStartedAt(previous: StayRecord | null, now: number): number {
  if (previous && previous.exitedAt !== null && now - previous.exitedAt <= REENTRY_GRACE_MS) {
    return previous.enteredAt
  }
  return now
}

/**
 * 지오펜스를 새로 등록할 때 이미 반경 안에 있는 업체. 운영체제는 경계를 "넘을 때"만 알려 주므로, 가게 안에 가만히
 * 앉은 채로 기능을 켜거나 업체를 바꿔 등록하면 진입 신호가 오지 않을 수 있다. 등록하는 쪽이 이 목록을 "지금 들어옴"으로 처리한다.
 */
export function insideAtRegistration(regions: readonly Partner[], lat: number, lng: number): Partner[] {
  return regions.filter(
    (partner) => haversineMeters(lat, lng, partner.lat, partner.lng) <= PARTNER_REGION_RADIUS_METERS,
  )
}

/**
 * 알림 한 번에 담을 업체. 가게가 몰린 곳에서는 반경 100m 안에 여러 곳이 겹친다 — 업체마다 따로 알리지 않고
 * 가장 오래 머문 곳(같으면 id 순) 하나를 이름으로 내세우고 나머지는 "외 N곳"으로 묶는다. 오늘 이미 알린 업체는 뺀다.
 */
export function alertGroup(
  stays: ReadonlyMap<string, StayRecord>,
  sent: readonly SentAlert[],
  now: number,
): { leadId: string; others: string[] } | null {
  const day = kstTodayYmd(now)
  const alertedToday = new Set(sent.filter((alert) => kstTodayYmd(alert.at) === day).map((alert) => alert.partnerId))
  const inside = [...stays.entries()]
    .filter(([id, stay]) => stay.exitedAt === null && !alertedToday.has(id))
    .sort(([idA, a], [idB, b]) => a.enteredAt - b.enteredAt || idA.localeCompare(idB))
  if (inside.length === 0) return null
  return { leadId: inside[0][0], others: inside.slice(1).map(([id]) => id) }
}

/** 실제로 보낸 알림 기록. */
export interface SentAlert {
  partnerId: string
  at: number
}

export type EnterDecision =
  | { schedule: true; fireAt: number }
  | { schedule: false; reason: 'quietHour' | 'partnerToday' | 'dailyLimit' | 'offPeakLimit' }

/**
 * 업체 반경에 들어왔을 때 알림을 예약할지. 모든 판단은 알림이 실제로 뜰 시각(`fireAt`) 기준이다 —
 * 20:57 에 들어와도 21:02 에 뜨면 밤 시간이므로 보내지 않는다.
 */
export function decideOnEnter(
  partnerId: string,
  stayStart: number,
  sent: readonly SentAlert[],
  now: number,
): EnterDecision {
  const fireAt = Math.max(stayStart + DWELL_MS, now)
  if (isQuietHour(fireAt)) return { schedule: false, reason: 'quietHour' }

  const day = kstTodayYmd(fireAt)
  const today = sent.filter((alert) => kstTodayYmd(alert.at) === day)
  if (today.some((alert) => alert.partnerId === partnerId)) return { schedule: false, reason: 'partnerToday' }
  if (today.length >= MAX_ALERTS_PER_DAY) return { schedule: false, reason: 'dailyLimit' }
  if (!isPeakHour(fireAt)) {
    const offPeak = today.filter((alert) => !isPeakHour(alert.at)).length
    if (offPeak >= MAX_OFF_PEAK_ALERTS_PER_DAY) return { schedule: false, reason: 'offPeakLimit' }
  }
  return { schedule: true, fireAt }
}
