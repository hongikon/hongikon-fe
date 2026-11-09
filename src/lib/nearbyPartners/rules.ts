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
 * 11-03: 100m → 150m. 작은 원은 iOS 가 늦게·들쭉날쭉 깨워 알림이 몇 분씩 늦었다. 넓히면 가게에 닿기 전에 깨어
 * 정밀 확인이 먼저 시작된다(그만큼 GPS 를 켜 두는 구간이 조금 길어진다).
 */
export const PARTNER_REGION_RADIUS_METERS = 150
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
 * 캠퍼스 건물(강의동·기숙사) 중심에서 이만큼 안의 업체는 대상에서 뺀다 — 건물 안에 있는데 알림이 가지 않게.
 * 알림이 실제로 닿는 거리(알림 반경 + GPS 오차 여유 + 나감 여유 = 60m)로 잰다. 11-09: 깨우는 원(150m)으로 재던 것을 바꿈 —
 * 깨우는 원은 위치를 다시 재기 시작할 뿐 알리지 않는데, 150m 로 재 기숙사 앞 가게(레이브 에스프레소 바 상수 103m 등) 24곳이 빠졌다.
 */
export const CAMPUS_CLEARANCE_METERS = ALERT_RADIUS_METERS + ACCURACY_ALLOWANCE_METERS + EXIT_MARGIN_METERS
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
 * 밤에는 보내지 않는다(11-01 사용자 결정). 정보통신망법 제50조 제3항 — 광고성 정보를 21시~다음 날 8시에 보내려면 별도 동의가
 * 필요해, 기본은 이 시간에 보내지 않고 사용자가 설정에서 "밤에도 받기"를 켜(서버에 야간 수신 동의 시각을 남긴 뒤)야 보낸다.
 * 한국 시간 21시부터 다음 날 8시 전까지.
 */
export const QUIET_START_HOUR = 21
export const QUIET_END_HOUR = 8

const KST_OFFSET_MS = 9 * 60 * 60 * 1000

/** 한국 시간으로 밤(21~8시)인지. */
/** 저장된 값(`quietNight`)으로 밤에 쉬는지. 값이 없으면(처음·예전 설치) 쉰다 — `false` 는 야간 수신에 동의했을 때만 저장한다. */
export function quietAtNight(quietNight: boolean | undefined): boolean {
  return quietNight !== false
}

export function isQuietHour(ms: number): boolean {
  const hour = new Date(ms + KST_OFFSET_MS).getUTCHours()
  return hour >= QUIET_START_HOUR || hour < QUIET_END_HOUR
}

/**
 * 깨우는 원 안의 위치 갱신 단계(11-03 배터리): 'coarse' = Wi-Fi·기지국(GPS 칩 안 씀), 'fine' = GPS.
 * 어느 가게 50m 안이면 GPS 로 올리고 70m 밖이면 내린다(경계에서 오락가락하지 않게 20m 틈).
 */
export type PreciseMode = 'coarse' | 'fine'
export const FINE_ENTER_METERS = 50
export const FINE_EXIT_METERS = 70

/**
 * 다음 위치 갱신 단계. 거리에서 위치 오차를 빼고(가장 가까울 수 있는 거리) 비교한다 — Wi-Fi·기지국 위치는 실내에서 수십~수백 m
 * 틀려, 가게 안(10m)에 있어도 90m 밖으로 찍히면 GPS 로 올라가지 않아 진입을 못 재고 알림이 오지 않았다(11-04 현장).
 * 오차는 깨우는 원 크기까지만 빼 준다(이 판단은 깨우는 원 안에서만 쓰인다).
 */
export function nextPreciseMode(mode: PreciseMode, nearestMeters: number, accuracy: number | null | undefined): PreciseMode {
  const closest = nearestMeters - Math.min(Math.max(accuracy ?? 0, 0), PARTNER_REGION_RADIUS_METERS)
  if (closest <= FINE_ENTER_METERS) return 'fine'
  if (closest > FINE_EXIT_METERS) return 'coarse'
  return mode
}

/**
 * Wi-Fi·기지국 위치로 '확실히 나갔는지'. 오차를 빼고도 반경 + 나감 여유 밖일 때만 참 — 알림을 받은 가게에 앉아 있는데
 * 오차 큰 위치 하나로 나간 것으로 처리돼, 테스트 앱의 반복 알림이 끊기고 다시 들어온 것도 잡지 못했다(11-04 현장).
 */
export function coarselyOutside(meters: number, accuracy: number | null | undefined, radius: number = ALERT_RADIUS_METERS): boolean {
  return meters - Math.max(accuracy ?? 0, 0) > radius + EXIT_MARGIN_METERS
}

/**
 * Wi-Fi·기지국 위치로는 나갔는지 정할 수 없는 경우: 찍힌 자리로는 반경 + 나감 여유 밖인데 오차가 커서 `coarselyOutside` 가 아니다.
 * 이대로 두면 머무름이 열린 채 남아, 가게에서 150m 떨어져도 "안"으로 남고 테스트 앱은 5분마다 다시 알렸다(11-06).
 * 이럴 때는 GPS 로 한 번 재서 정한다(`background.fineCheck`).
 */
export function coarseExitUncertain(meters: number, accuracy: number | null | undefined, radius: number = ALERT_RADIUS_METERS): boolean {
  return meters > radius + EXIT_MARGIN_METERS && !coarselyOutside(meters, accuracy, radius)
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

/**
 * GPS 위치 하나로 알림 반경 안에 있는 업체 id. 나감 여유(`EXIT_MARGIN_METERS`)는 지금 가장 가까운 업체에만 준다 —
 * 지나온 가게(C)가 여유 때문에 "안"으로 남아, 더 가까운 가게(A·B) 앞에 서 있는데도 C 이름으로 알리던 문제(11-03 현장).
 */
export function preciseInsideIds<T extends Located>(
  targets: readonly T[],
  at: { lat: number; lng: number },
  accuracy: number | null | undefined,
  wasInside: ReadonlySet<string>,
  radius: number = ALERT_RADIUS_METERS,
): Set<string> {
  const ranked = byDistance(targets, at.lat, at.lng)
  const nearestId = ranked[0]?.partner.id
  return new Set(
    ranked
      .filter(({ partner, meters }) => preciselyInside(meters, accuracy, partner.id === nearestId && wasInside.has(partner.id), radius))
      .map(({ partner }) => partner.id),
  )
}

/** 혜택 문구를 정하는 데 필요한 필드만. 기기에 저장해 둔 업체(`engine.SnapshotPartner`)도 쓴다. */
export type BenefitSource = Pick<Partner, 'benefit' | 'affiliationBenefits'>

/** 좌표를 가진 업체(지도 데이터의 Partner, 기기 저장본 모두). */
export interface Located {
  id: string
  lat: number
  lng: number
}

/**
 * 이 사용자가 받는 혜택 문구. 고른 소속(여러 개 가능, 11-01) 중 앞에서부터 소속별 예외가 있으면 그것, 없으면 기본 혜택.
 */
export function benefitFor(partner: BenefitSource, affiliations: readonly PartnerAffiliation[]): string | null {
  const special = affiliations
    .map((affiliation) => partner.affiliationBenefits?.find((item) => item.affiliation === affiliation)?.benefit)
    .find((benefit) => benefit !== undefined)
  const benefit = (special ?? partner.benefit)?.trim()
  return benefit ? benefit : null
}

function endedBefore(endsOn: string | undefined, today: string): boolean {
  return endsOn !== undefined && endsOn < today
}

export interface PickTargetsOptions {
  /** 사용자가 고른 소속(여러 개 가능). 비어 있으면 총학생회 제휴만. */
  affiliations: readonly PartnerAffiliation[]
  /** 캠퍼스 건물 좌표. 건물에서 `CAMPUS_CLEARANCE_METERS` 안의 업체는 뺀다(강의실·기숙사 방에서 알림이 가지 않게). */
  campusPoints: readonly { lat: number; lng: number }[]
  now: number
  /** 소속을 보지 않고 모든 제휴를 대상으로(현장 테스트 빌드만, 10-29). 제휴가 끝났는지는 그대로 본다. */
  anyAffiliation?: boolean
}

/**
 * 근처 알림 대상 업체. 혜택 문구가 있고, 제휴가 끝나지 않았고, 사용자가 고른 소속(공과대학·기숙사 등, 또는 총학생회) 제휴이며,
 * 캠퍼스 건물과 겹치지 않는 곳. 11-09 운영진 요청: 관리자가 업체마다 켜는 "근처 알림 대상" 표시(`nearbyAlert`)는 더 보지 않고
 * 소속 필터로만 정한다(표시가 켜진 곳이 1곳뿐이라 거의 울리지 않았다).
 * 서버도 끝난 제휴를 빼서 내려주지만, 백그라운드에서는 기기에 저장해 둔 목록을 쓰므로 날짜를 다시 본다.
 */
export function pickTargets(partners: readonly Partner[], options: PickTargetsOptions): Partner[] {
  const today = kstTodayYmd(options.now)
  const mine = options.affiliations
  return partners.filter((partner) => {
    if (benefitFor(partner, mine) === null) return false
    if (endedBefore(partner.endsOn, today)) return false

    const affiliations = partner.affiliations ?? []
    const eligible = affiliations.filter((item) => {
      if (!options.anyAffiliation && item !== '총학생회' && !mine.includes(item)) return false
      const end = partner.affiliationEnds?.find((e) => e.affiliation === item)?.endsOn
      return !endedBefore(end, today)
    })
    if (eligible.length === 0) return false

    return !options.campusPoints.some(
      (point) => haversineMeters(point.lat, point.lng, partner.lat, partner.lng) < CAMPUS_CLEARANCE_METERS,
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
  // perVisit(현장 테스트, 11-04): 보낸 곳도 빼지 않는다 — 같은 가게에 머무는 동안 `FIELD_TEST_REPEAT_MS` 마다 다시 알린다
  // (간격은 decideOnEnter 의 lastAlertAt 이 맞춘다).
  const alerted = (id: string) => !perVisit && alertedToday.has(id)
  const inside = [...stays.entries()]
    .filter(([id, stay]) => stay.exitedAt === null && !alerted(id))
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
  /** 현장 테스트: 이번 머무름 중 마지막으로 보낸 알림 시각. 있으면 그 뒤 `FIELD_TEST_REPEAT_MS` 에 다시 알린다. */
  lastAlertAt?: number | null
}

/** 현장 테스트 빌드: 같은 가게 영역 안에 머무는 동안 다시 알리는 간격(11-04 사용자 요청, 테스트 빌드만). */
export const FIELD_TEST_REPEAT_MS = 5 * 60 * 1000

/** 업체 반경에 들어왔을 때 알림을 예약할지. 모든 판단은 알림이 실제로 뜰 시각(`fireAt`) 기준이다(날짜·간격). */
export function decideOnEnter(
  partnerId: string,
  stayStart: number,
  sent: readonly SentAlert[],
  now: number,
  options: DecideOptions = {},
): EnterDecision {
  const repeatAt = options.perVisit && options.lastAlertAt != null ? options.lastAlertAt + FIELD_TEST_REPEAT_MS : 0
  const fireAt = Math.max(stayStart + (options.dwellMs ?? DWELL_MS), repeatAt, now)
  // 밤에는 받지 않기: 테스트 앱에서도 지킨다(설정을 확인할 수 있게). 아침까지 미루지 않고 이번 방문은 넘어간다.
  if (options.quietNight && isQuietHour(fireAt)) return { schedule: false, reason: 'quiet' }
  // 현장 테스트(10-29·11-04 사용자 요청): 횟수·간격 제한 없이, 머무는 동안 5분마다 다시.
  if (options.perVisit) return { schedule: true, fireAt }

  const day = kstTodayYmd(fireAt)
  const today = sent.filter((alert) => kstTodayYmd(alert.at) === day)
  if (today.some((alert) => alert.partnerId === partnerId)) return { schedule: false, reason: 'partnerToday' }
  if (today.length >= MAX_ALERTS_PER_DAY) return { schedule: false, reason: 'dailyLimit' }
  if (sent.some((alert) => Math.abs(fireAt - alert.at) < MIN_ALERT_GAP_MS)) return { schedule: false, reason: 'tooSoon' }
  return { schedule: true, fireAt }
}

/**
 * GPS 로 20m 를 잴 만한 업체(11-03, 배터리). 오늘 이미 알린 곳·하루 한도를 채운 날은 더 잴 게 없어 GPS 를 켜지 않는다 —
 * 알림을 받은 카페에 두 시간 앉아 있어도 GPS 가 계속 켜져 있던 것을 막는다. 예약해 둔 곳(pendingId)은 그 전에 나가면
 * 취소해야 해서 계속 잰다. perVisit(현장 테스트)는 이번 방문에 이미 보낸 곳만 뺀다.
 */
export function alertableTargetIds(
  targetIds: readonly string[],
  sent: readonly SentAlert[],
  stays: ReadonlyMap<string, StayRecord>,
  pendingId: string | null,
  now: number,
  perVisit = false,
): Set<string> {
  const result = new Set<string>()
  const day = kstTodayYmd(now)
  const today = sent.filter((alert) => kstTodayYmd(alert.at) === day)
  if (!perVisit && today.length >= MAX_ALERTS_PER_DAY) {
    if (pendingId) result.add(pendingId)
    return result
  }
  for (const id of targetIds) {
    if (id === pendingId) {
      result.add(id)
      continue
    }
    const stay = stays.get(id)
    // 현장 테스트는 머무는 동안 다시 알리므로(FIELD_TEST_REPEAT_MS) 보낸 곳도 GPS 로 계속 잰다.
    const done = !perVisit && today.some((alert) => alert.partnerId === id)
    if (!done) result.add(id)
  }
  return result
}
