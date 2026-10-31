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

/**
 * 업체 하나의 운영체제 지오펜스 반경(깨우는 원). iOS 는 이보다 작게 잡아도 사실상 100~200m 로 동작해,
 * 이 원은 "가게 근처에 왔다"는 신호로만 쓰고 실제 알림 반경(`ALERT_RADIUS_METERS`)은 GPS 로 다시 잰다.
 */
export const PARTNER_REGION_RADIUS_METERS = 100
/**
 * 알림 반경: 업체 좌표에서 이만큼 안에 머물러야 알린다(10-29 — 100m 는 옆 가게·길 건너까지 걸려 20m 로).
 * 깨우는 원에 들어오면 GPS 를 켜 이 거리를 잰다(`preciselyInside`).
 */
export const ALERT_RADIUS_METERS = 20
/** GPS 오차를 얼마까지 반경에 더해 줄지(실내 오차가 커도 반경이 끝없이 넓어지지 않게). */
const ACCURACY_ALLOWANCE_METERS = 15
/** 한 번 안으로 본 뒤에는 이만큼 더 멀어져야 나간 것으로 본다(위치 흔들림으로 들락날락하지 않게). */
const EXIT_MARGIN_METERS = 25
/**
 * 사용자 둘레 "다시 고르기" 원의 한계. 실제 반경은 `reselectRadius` 가 업체 밀도에 맞춰 정한다.
 * 홍대 앞은 500m 안에 제휴 업체가 중앙값 86곳이라(10-28 운영 데이터) 고정 500m 원이면 19곳 밖 업체 반경에
 * 원을 벗어나기 전에 닿는다. 최소값은 운영체제가 이탈을 믿을 만하게 알려 주는 크기(Android 권장 100~150m).
 */
export const MIN_RESELECT_RADIUS_METERS = 150
export const MAX_RESELECT_RADIUS_METERS = 1000
/** @deprecated 고정 반경 대신 `reselectRadius` 를 쓴다. */
export const RESELECT_REGION_RADIUS_METERS = 500
/** iOS 등록 한도 20개 중 큰 원 1개를 뺀 수. Android(100개)도 같은 수로 맞춘다. */
export const MAX_PARTNER_REGIONS = 19
/** 이만큼 머물러야 알린다. */
export const DWELL_MS = 5 * 60 * 1000
/** 카페는 주문만 하고 나가기도 해 2분이면 알린다(10-31 사용자 요청). */
export const CAFE_DWELL_MS = 2 * 60 * 1000

/** 설정에서 고르는 "알림까지 머무는 시간"(분). 1분 미만이면 지나가기만 해도 오고, 10분 넘으면 나간 뒤에 온다. */
export const MIN_DWELL_MINUTES = 1
export const MAX_DWELL_MINUTES = 10

/** 사용자가 바꾼 머무는 시간(분). 없으면 기본(카페 2분, 그 밖 5분). */
export interface DwellMinutes {
  cafe: number
  other: number
}

export const DEFAULT_DWELL_MINUTES: DwellMinutes = { cafe: CAFE_DWELL_MS / 60_000, other: DWELL_MS / 60_000 }

export function clampDwellMinutes(minutes: number): number {
  return Math.min(MAX_DWELL_MINUTES, Math.max(MIN_DWELL_MINUTES, Math.round(minutes)))
}

/** 업체 분류별로 머물러야 하는 시간(ms). 카페와 그 밖 두 가지. */
export function dwellFor(category: string | undefined, custom?: DwellMinutes | null): number {
  const minutes = custom ?? DEFAULT_DWELL_MINUTES
  return clampDwellMinutes(category === '카페' ? minutes.cafe : minutes.other) * 60_000
}
/** 나갔다가 이 안에 다시 들어오면(위치 흔들림) 이어서 머문 것으로 본다. */
export const REENTRY_GRACE_MS = 3 * 60 * 1000
/** 하루(한국 날짜) 전체 알림 수. 같은 가게는 하루 1번(`partnerToday`)이라, 가게를 옮겨 다닐 때만 더 온다. */
export const MAX_ALERTS_PER_DAY = 3
/**
 * 알림 사이 최소 간격. 20m 반경이면 실제로 그 가게에 있을 때만 오므라 2시간(10-28)은 길었다 — 밥 먹고 카페로 옮기면
 * 카페 알림이 오게 30분(10-29). 시간대 제한(밤 9시~아침 8시, 점심·저녁 우선)은 10-29 사용자 요청으로 없앴다.
 */
export const MIN_ALERT_GAP_MS = 30 * 60 * 1000
/**
 * "밤에는 받지 않기"(설정에서 고름, 기본 꺼짐 — 10-29 에 고정 금지 시간대를 뺀 결정은 그대로 두고 사용자가 고르게 했다).
 * 한국 시간 22시부터 다음 날 8시 전까지.
 */
export const QUIET_START_HOUR = 22
export const QUIET_END_HOUR = 8

const KST_OFFSET_MS = 9 * 60 * 60 * 1000

/** 한국 시간으로 밤(22~8시)인지. */
export function isQuietHour(ms: number): boolean {
  const hour = new Date(ms + KST_OFFSET_MS).getUTCHours()
  return hour >= QUIET_START_HOUR || hour < QUIET_END_HOUR
}

/**
 * GPS 로 잰 거리로 알림 반경 안인지. 오차(accuracy)만큼은 반경에 더해 주되 `ACCURACY_ALLOWANCE_METERS` 까지만,
 * 이미 안으로 본 곳(`wasInside`)은 `EXIT_MARGIN_METERS` 더 멀어져야 나간 것으로 본다.
 */
export function preciselyInside(
  meters: number,
  accuracy: number | null | undefined,
  wasInside: boolean,
  radius: number = ALERT_RADIUS_METERS,
): boolean {
  const allowance = Math.min(Math.max(accuracy ?? 0, 0), ACCURACY_ALLOWANCE_METERS)
  return meters <= radius + allowance + (wasInside ? EXIT_MARGIN_METERS : 0)
}

/** 혜택 문구를 정하는 데 필요한 필드만. 기기에 저장해 둔 업체(`engine.SnapshotPartner`)도 쓴다. */
export type BenefitSource = Pick<Partner, 'benefit' | 'affiliationBenefits'>

/** 좌표를 가진 업체(지도 데이터의 Partner, 기기 저장본 모두). */
export interface Located {
  id: string
  lat: number
  lng: number
}

/** 이 소속 사용자가 받는 혜택 문구. 소속별 예외가 있으면 그것, 없으면 기본 혜택. */
export function benefitFor(partner: BenefitSource, affiliation: PartnerAffiliation | null): string | null {
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
  /** 소속을 보지 않고 모든 제휴를 대상으로(현장 테스트 빌드만, 10-29). 제휴가 끝났는지는 그대로 본다. */
  anyAffiliation?: boolean
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
      if (!options.anyAffiliation && item !== '총학생회' && item !== affiliation) return false
      const end = partner.affiliationEnds?.find((e) => e.affiliation === item)?.endsOn
      return !endedBefore(end, today)
    })
    if (eligible.length === 0) return false

    return !options.campusPoints.some(
      (point) => haversineMeters(point.lat, point.lng, partner.lat, partner.lng) < PARTNER_REGION_RADIUS_METERS,
    )
  })
}

export interface Distanced<T extends Located> {
  partner: T
  meters: number
}

export type PartnerDistance = Distanced<Partner>

function byDistance<T extends Located>(partners: readonly T[], lat: number, lng: number): Distanced<T>[] {
  return partners
    .map((partner) => ({ partner, meters: haversineMeters(lat, lng, partner.lat, partner.lng) }))
    .sort((a, b) => a.meters - b.meters || a.partner.id.localeCompare(b.partner.id))
}

/** 지오펜스로 등록할 가까운 업체(거리순, 같으면 id 순). */
export function pickNearest<T extends Located>(
  targets: readonly T[],
  lat: number,
  lng: number,
  limit: number = MAX_PARTNER_REGIONS,
): T[] {
  return byDistance(targets, lat, lng)
    .slice(0, limit)
    .map((item) => item.partner)
}

/**
 * "다시 고르기" 원 반경: 등록하지 못한 업체 중 가장 가까운 곳(20번째) 반경에 닿기 전에 원을 벗어나도록
 * (그 거리 - 업체 반경). 너무 작으면 이탈 신호를 믿을 수 없어 150m, 업체가 적어 모두 등록했으면 1km.
 */
export function reselectRadius<T extends Located>(
  targets: readonly T[],
  lat: number,
  lng: number,
  partnerRadius: number = PARTNER_REGION_RADIUS_METERS,
  registered: number = MAX_PARTNER_REGIONS,
): number {
  const firstLeftOut = byDistance(targets, lat, lng)[registered]
  if (!firstLeftOut) return MAX_RESELECT_RADIUS_METERS
  return Math.min(MAX_RESELECT_RADIUS_METERS, Math.max(MIN_RESELECT_RADIUS_METERS, firstLeftOut.meters - partnerRadius))
}

/** 앱 안 "내 주변 제휴": 반경 안 업체를 가까운 순으로. */
export function partnersNear<T extends Located>(
  partners: readonly T[],
  lat: number,
  lng: number,
  radiusMeters: number,
  limit: number,
): Distanced<T>[] {
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
export function insideAtRegistration<T extends Located>(
  regions: readonly T[],
  lat: number,
  lng: number,
  radiusMeters: number = PARTNER_REGION_RADIUS_METERS,
): T[] {
  return regions.filter((partner) => haversineMeters(lat, lng, partner.lat, partner.lng) <= radiusMeters)
}

/**
 * 알림 한 번에 담을 업체. 가게가 몰린 곳에서는 반경 안에 여러 곳이 겹친다 — 업체마다 따로 알리지 않고
 * 가장 오래 머문 곳(같으면 id 순) 하나를 이름으로 내세우고 나머지는 "외 N곳"으로 묶는다. 오늘 이미 알린 업체는 뺀다.
 */
export function alertGroup(
  stays: ReadonlyMap<string, StayRecord>,
  sent: readonly SentAlert[],
  now: number,
  perVisit = false,
): { leadId: string; others: string[] } | null {
  const day = kstTodayYmd(now)
  const alertedToday = new Set(sent.filter((alert) => kstTodayYmd(alert.at) === day).map((alert) => alert.partnerId))
  // perVisit(현장 테스트): 오늘 보낸 곳도 다시 — 이번에 들어온 뒤 이미 보낸 곳만 뺀다(나갔다 다시 들어오면 또 온다).
  const alerted = (id: string, stay: StayRecord) =>
    perVisit ? sent.some((alert) => alert.partnerId === id && alert.at >= stay.enteredAt) : alertedToday.has(id)
  const inside = [...stays.entries()]
    .filter(([id, stay]) => stay.exitedAt === null && !alerted(id, stay))
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
  | { schedule: false; reason: 'partnerToday' | 'dailyLimit' | 'tooSoon' | 'quiet' }

export interface DecideOptions {
  /** 현장 테스트: 횟수·간격 제한 없이 방문마다 한 번. */
  perVisit?: boolean
  /** 밤(22~8시)에는 알리지 않기(설정). */
  quietNight?: boolean
  /** 머물러야 하는 시간(`dwellFor`). 기본 `DWELL_MS`. */
  dwellMs?: number
}

/** 업체 반경에 들어왔을 때 알림을 예약할지. 모든 판단은 알림이 실제로 뜰 시각(`fireAt`) 기준이다(날짜·간격). */
export function decideOnEnter(
  partnerId: string,
  stayStart: number,
  sent: readonly SentAlert[],
  now: number,
  options: DecideOptions = {},
): EnterDecision {
  const fireAt = Math.max(stayStart + (options.dwellMs ?? DWELL_MS), now)
  // 밤에는 받지 않기: 테스트 앱에서도 지킨다(설정을 확인할 수 있게). 아침까지 미루지 않고 이번 방문은 넘어간다.
  if (options.quietNight && isQuietHour(fireAt)) return { schedule: false, reason: 'quiet' }
  // 현장 테스트(10-29 사용자 요청): 횟수·간격 제한 없이 방문마다 한 번(같은 방문 중복은 alertGroup 이 막는다).
  if (options.perVisit) return { schedule: true, fireAt }

  const day = kstTodayYmd(fireAt)
  const today = sent.filter((alert) => kstTodayYmd(alert.at) === day)
  if (today.some((alert) => alert.partnerId === partnerId)) return { schedule: false, reason: 'partnerToday' }
  if (today.length >= MAX_ALERTS_PER_DAY) return { schedule: false, reason: 'dailyLimit' }
  if (sent.some((alert) => Math.abs(fireAt - alert.at) < MIN_ALERT_GAP_MS)) return { schedule: false, reason: 'tooSoon' }
  return { schedule: true, fireAt }
}
