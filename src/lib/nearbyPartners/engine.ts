import { kstTodayYmd } from '../../utils/exhibitions'
import { haversineMeters } from '../../utils/geo'
import {
  REENTRY_GRACE_MS,
  alertGroup,
  alertableTargetIds,
  coarselyOutside,
  decideOnEnter,
  dwellFor,
  nextPreciseMode,
  preciseInsideIds,
  quietAtNight,
  stayStartedAt,
  type DwellMinutes,
  type PreciseMode,
  type SentAlert,
  type StayRecord,
} from './rules'
import type { PartnerAffiliation } from '../../types'

/**
 * 근처 알림 상태 기계. 지오펜스 진입·이탈과 등록을 받아 "다음 상태"와 "할 일(예약/취소)"을 돌려준다.
 * 위치·알림·저장 API 를 부르지 않는 순수 함수라 `pnpm test` 로 확인한다. 실제 예약·저장은 `background.ts` 가 한다.
 *
 * 원칙
 * - 예약해 둔 알림은 늘 0개 또는 1개(`pending`). 여러 업체 반경에 함께 있으면 가장 오래 머문 곳 하나로 묶는다(`alertGroup`).
 * - 로컬 알림은 앱 코드 없이 뜨므로, "보냈다"는 다음 이벤트·앱 열기 때 `settle` 이 `pending` 의 시각이 지났는지 보고 기록한다.
 * - 같은 업체 진입이 두 번 오면(Android·iOS 모두 등록 직후 "이미 안에 있음"을 진입으로 알려 준다) 두 번째는 무시한다.
 */

/** 기기에 보관하는 대상 업체 한 곳(알림 문구를 네트워크 없이 만들 만큼만). 개인정보는 없다. */
export interface SnapshotPartner {
  id: string
  name: string
  lat: number
  lng: number
  /** 분류(카페는 머무는 시간이 짧다, `dwellFor`). */
  category?: string
  benefit?: string
  affiliations?: PartnerAffiliation[]
  affiliationBenefits?: { affiliation: PartnerAffiliation; benefit: string }[]
}

export interface PendingAlert {
  partnerId: string
  fireAt: number
  othersCount: number
}

export interface NearbyState {
  enabled: boolean
  /** 고른 소속(여러 개 가능, 11-01). 비어 있으면 총학생회 제휴만. */
  affiliations: PartnerAffiliation[]
  /** 옛 저장본(소속 하나). 불러올 때 `affiliations` 로 옮긴다(`background.loadState`). */
  affiliation?: PartnerAffiliation | null
  targets: SnapshotPartner[]
  stays: Record<string, StayRecord>
  sent: SentAlert[]
  pending: PendingAlert | null
  /** 현장 테스트 빌드: 하루·간격 제한 없이, 가게에 머무는 동안 5분마다(`FIELD_TEST_REPEAT_MS`) 알린다. */
  perVisit?: boolean
  /** 설정: 밤(22~8시)에는 받지 않기. 기본 꺼짐. */
  quietNight?: boolean
  /** 설정: 알림까지 머무는 시간(분). 없으면 카페 2분·그 밖 5분. */
  dwellMinutes?: DwellMinutes | null
  /** 알림의 "이 가게 알림 끄기"·설정에서 끈 업체 id. 기기에만 둔다. */
  muted?: string[]
}

/** 설정에서 바꾸는 값(`onPrefs`). */
export type NearbyPrefs = Pick<NearbyState, 'quietNight' | 'muted' | 'dwellMinutes'>

/** 알림 대상으로 셀 머무름(끈 업체는 뺀다). 예약 묶음·알림 문구가 같은 목록을 쓴다. */
export function activeStays(state: NearbyState): Map<string, StayRecord> {
  const muted = new Set(state.muted ?? [])
  return new Map(Object.entries(state.stays).filter(([id]) => !muted.has(id)))
}

export const INITIAL_NEARBY_STATE: NearbyState = {
  enabled: false,
  affiliations: [],
  targets: [],
  stays: {},
  sent: [],
  pending: null,
}

export type NearbyAction = { kind: 'cancel' } | { kind: 'schedule'; alert: PendingAlert }

export interface Step {
  state: NearbyState
  actions: NearbyAction[]
}

const DAY_MS = 24 * 60 * 60 * 1000

/** 지난 예약을 "보냄"으로 옮기고, 오래된 기록(보낸 지 2일, 나간 지 재진입 인정 시간 넘음)을 정리한다. */
export function settle(state: NearbyState, now: number): NearbyState {
  let { sent, pending } = state
  if (pending && pending.fireAt <= now) {
    sent = [...sent, { partnerId: pending.partnerId, at: pending.fireAt }]
    pending = null
  }
  sent = sent.filter((alert) => now - alert.at < 2 * DAY_MS)
  const stays: Record<string, StayRecord> = {}
  for (const [id, stay] of Object.entries(state.stays)) {
    if (stay.exitedAt === null || now - stay.exitedAt <= REENTRY_GRACE_MS) stays[id] = stay
  }
  return { ...state, sent, pending, stays }
}

function sameAlert(a: PendingAlert | null, b: PendingAlert | null): boolean {
  return !!a && !!b && a.partnerId === b.partnerId && a.fireAt === b.fireAt && a.othersCount === b.othersCount
}

/** 현재 위치(알면). 이름을 내세울 업체를 "가장 가까운 곳"으로 고르는 데만 쓰고 저장하지 않는다. */
export interface Position {
  lat: number
  lng: number
}

/**
 * 묶음에서 이름을 내세울 업체. 위치를 알면 가장 가까운 곳, 모르면 가장 오래 머문 곳(`alertGroup` 의 lead).
 * 10-28 시뮬레이션(실제 업체 좌표, 실내 GPS 잡음 30m, 반경 100m): 가장 오래 머문 곳은 실제 들어간 가게를 29% 맞히고,
 * 위치를 몇 번 읽어 가장 가까운 곳을 고르면 75% 맞혔다 — 잡음 때문에 "먼저 걸린 곳"이 들어간 가게가 아닌 일이 많다.
 */
function chooseLead(state: NearbyState, ids: readonly string[], fallback: string, at: Position | undefined): string {
  if (!at) return fallback
  let best = fallback
  let bestMeters = Infinity
  for (const id of ids) {
    const target = state.targets.find((t) => t.id === id)
    if (!target) continue
    const meters = haversineMeters(at.lat, at.lng, target.lat, target.lng)
    if (meters < bestMeters) {
      best = id
      bestMeters = meters
    }
  }
  return best
}

/**
 * 지금 머무는 곳들로 예약 하나를 다시 맞춘다. 바뀌었을 때만 취소·예약을 낸다.
 * 알림 시각은 묶음에서 가장 먼저 들어온 때 기준(그 일대에 머문 시간), 이름은 `chooseLead`.
 */
export function plan(state: NearbyState, now: number, at?: Position): Step {
  let desired: PendingAlert | null = null
  if (state.enabled) {
    const stays = activeStays(state)
    const group = alertGroup(stays, state.sent, now, state.perVisit)
    if (group) {
      const members = [group.leadId, ...group.others]
      // 위치를 모르는 신호(이탈 등)면 이미 예약해 둔 업체가 아직 묶음에 있을 때 그대로 둔다.
      const keep = !at && state.pending && members.includes(state.pending.partnerId) ? state.pending.partnerId : group.leadId
      const leadId = chooseLead(state, members, keep, at)
      const stayStart = stays.get(group.leadId)!.enteredAt
      // 현장 테스트: 이번 머무름 중(묶음 안 업체) 마지막으로 보낸 알림 — 그 5분 뒤에 다시 예약한다.
      const sentThisStay = state.perVisit
        ? state.sent.filter((alert) => members.includes(alert.partnerId) && alert.at >= stayStart).map((alert) => alert.at)
        : []
      const decision = decideOnEnter(leadId, stayStart, state.sent, now, {
        perVisit: state.perVisit,
        lastAlertAt: sentThisStay.length > 0 ? Math.max(...sentThisStay) : null,
        quietNight: quietAtNight(state.quietNight),
        // 알림 시각은 묶음에서 가장 먼저 들어온 곳 기준이라 머무는 시간도 그곳 분류로 정한다.
        dwellMs: dwellFor(state.targets.find((t) => t.id === group.leadId)?.category, state.dwellMinutes),
      })
      if (decision.schedule) desired = { partnerId: leadId, fireAt: decision.fireAt, othersCount: group.others.length }
    }
  }
  if (sameAlert(state.pending, desired) || (!state.pending && !desired)) return { state, actions: [] }
  const actions: NearbyAction[] = []
  if (state.pending) actions.push({ kind: 'cancel' })
  if (desired) actions.push({ kind: 'schedule', alert: desired })
  return { state: { ...state, pending: desired }, actions }
}

function isTarget(state: NearbyState, partnerId: string): boolean {
  return state.targets.some((target) => target.id === partnerId)
}

export function onEnter(input: NearbyState, partnerId: string, now: number, at?: Position): Step {
  const state = settle(input, now)
  if (!state.enabled || !isTarget(state, partnerId)) return { state, actions: [] }
  const previous = state.stays[partnerId] ?? null
  // 이미 안에 있다고 기록돼 있으면(등록 직후 중복 진입 신호) 무시한다.
  if (previous && previous.exitedAt === null) return plan(state, now, at)
  const enteredAt = stayStartedAt(previous, now)
  return plan({ ...state, stays: { ...state.stays, [partnerId]: { enteredAt, exitedAt: null } } }, now, at)
}

export function onExit(input: NearbyState, partnerId: string, now: number, at?: Position): Step {
  const state = settle(input, now)
  const previous = state.stays[partnerId]
  // 들어온 기록이 없는 이탈(Android 는 등록 직후 바깥 영역마다 이탈을 보낸다)은 무시한다.
  if (!previous || previous.exitedAt !== null) return plan(state, now, at)
  return plan({ ...state, stays: { ...state.stays, [partnerId]: { ...previous, exitedAt: now } } }, now, at)
}

/**
 * GPS 위치가 새로 왔다(안팎이 바뀐 업체가 없어도). 예약한 알림의 이름을 지금 가장 가까운 업체로 다시 맞춘다 —
 * 진입·이탈 때만 고르면 처음 고른 먼 가게가 그대로 남았다(11-03 현장). 대표가 그대로면 할 일이 없다.
 */
export function onPosition(input: NearbyState, now: number, at: Position): Step {
  return plan(settle(input, now), now, at)
}

/** 깨우는 원 안에서 받은 위치 하나(백그라운드 위치 갱신). 위치는 저장하지 않는다. */
export interface PreciseFix {
  at: Position
  /** 운영체제가 알려 준 오차(m). 모르면 null. */
  accuracy: number | null
  /** 이 위치를 받은 단계: Wi-Fi·기지국(coarse) 또는 GPS(fine). */
  mode: PreciseMode
}

export interface PreciseRadii {
  /** 알림 반경(기본 20m, 테스트 앱에서 바꿀 수 있음). */
  alert: number
  /** 운영체제 지오펜스(깨우는 원) 반경. */
  wake: number
  /** 모든 대상에서 깨우는 원 + 이만큼 멀어지면 위치 갱신을 끈다. */
  stopMargin: number
}

export interface PreciseOutcome extends Step {
  /** 다음 위치 갱신 단계. */
  nextMode: PreciseMode
  /** 위치 갱신을 끌지(근처 대상이 없거나 알림이 꺼짐). */
  stop: boolean
  /** 아직 알릴 수 있는 가게 중 가장 가까운 곳까지 거리(m). 없으면 Infinity. */
  nearestMeters: number
}

/**
 * 위치 하나로 알림 반경 안팎을 다시 맞춘다: 안으로 들어온 업체는 진입, 멀어진 업체는 이탈.
 * Wi-Fi·기지국 위치(`allowEnter` false)로는 진입을 정하지 않고, 오차를 빼고도 밖일 때만 이탈로 본다(`coarselyOutside`).
 * 이름을 내세울 업체 고르기(`chooseLead`)에도 이 위치를 쓴다.
 */
export function preciseStep(input: NearbyState, now: number, at: Position, accuracy: number | null, allowEnter: boolean, radius: number): Step {
  let step: Step = { state: input, actions: [] }
  const actions: NearbyAction[] = []
  const wasInsideIds = new Set(
    Object.entries(input.stays)
      .filter(([, stay]) => stay.exitedAt === null)
      .map(([id]) => id),
  )
  const insideIds = preciseInsideIds(input.targets, at, accuracy, wasInsideIds, radius)
  for (const target of input.targets) {
    const wasInside = wasInsideIds.has(target.id)
    const inside = insideIds.has(target.id)
    if (inside === wasInside) continue
    if (inside && !allowEnter) continue
    if (!inside && !allowEnter && !coarselyOutside(haversineMeters(at.lat, at.lng, target.lat, target.lng), accuracy, radius)) continue
    step = inside ? onEnter(step.state, target.id, now, at) : onExit(step.state, target.id, now, at)
    actions.push(...step.actions)
  }
  // 안팎이 그대로여도 대표 가게는 지금 가장 가까운 곳으로 다시 맞춘다(오차 큰 위치로는 바꾸지 않는다).
  if (allowEnter) {
    step = onPosition(step.state, now, at)
    actions.push(...step.actions)
  }
  return { state: step.state, actions }
}

/**
 * 백그라운드 위치 갱신 한 번에 대한 판단 전부: 안팎 맞추기(`preciseStep`), 다음 단계(`nextPreciseMode` — 아직 알릴 수 있는
 * 가게 기준), 끌지. `background.ts` 는 이 결과대로 저장·예약하고 위치 갱신을 켜고 끈다.
 */
export function preciseUpdate(input: NearbyState, now: number, fix: PreciseFix, radii: PreciseRadii): PreciseOutcome {
  if (!input.enabled) return { state: input, actions: [], nextMode: fix.mode, stop: true, nearestMeters: Infinity }
  const { at, accuracy } = fix
  const stop = !input.targets.some((t) => haversineMeters(at.lat, at.lng, t.lat, t.lng) <= radii.wake + radii.stopMargin)
  // GPS 는 아직 알릴 수 있는 가게(오늘 안 알린 곳·예약 중인 곳) 가까이에서만 켠다. 알림을 받은 카페에 오래 앉아 있으면
  // Wi-Fi·기지국으로 내린다(나간 것은 그걸로도 판정한다).
  const alertable = alertableTargetIds(
    input.targets.map((t) => t.id),
    input.sent,
    new Map(Object.entries(input.stays)),
    input.pending?.partnerId ?? null,
    now,
    input.perVisit,
  )
  const distances = input.targets.filter((t) => alertable.has(t.id)).map((t) => haversineMeters(at.lat, at.lng, t.lat, t.lng))
  const nearest = distances.length > 0 ? Math.min(...distances) : Infinity
  const step = preciseStep(input, now, at, accuracy, fix.mode === 'fine', radii.alert)
  return { ...step, nextMode: nextPreciseMode(fix.mode, nearest, accuracy), stop, nearestMeters: nearest }
}

/**
 * 지오펜스를 (다시) 등록했다. 더 이상 감시하지 않는 업체는 나간 것으로 보고, 이미 반경 안인 업체(`insideIds`)는
 * 지금 들어온 것으로 본다(운영체제 진입 신호가 늦거나 안 와도 머무름을 셀 수 있게).
 */
export function onRegister(
  input: NearbyState,
  monitoredIds: readonly string[],
  insideIds: readonly string[],
  now: number,
  at?: Position,
): Step {
  let state = settle(input, now)
  const monitored = new Set(monitoredIds)
  const stays = { ...state.stays }
  for (const [id, stay] of Object.entries(stays)) {
    if (!monitored.has(id) && stay.exitedAt === null) stays[id] = { ...stay, exitedAt: now }
  }
  state = { ...state, stays }
  for (const id of insideIds) {
    const previous = state.stays[id]
    if (previous && previous.exitedAt === null) continue
    if (!isTarget(state, id)) continue
    state = { ...state, stays: { ...state.stays, [id]: { enteredAt: stayStartedAt(previous ?? null, now), exitedAt: null } } }
  }
  return plan(state, now, at)
}

/**
 * 설정 바꾸기(밤에 받지 않기·끈 업체·머무는 시간). 바뀐 설정으로 예약을 다시 맞춘다 — 예약해 둔 가게를 끄면 그 예약은 취소된다.
 */
export function onPrefs(input: NearbyState, prefs: NearbyPrefs, now: number): Step {
  const state = settle({ ...input, ...prefs }, now)
  return plan(state, now)
}

/** 끄기·긴급 끄기·로그아웃. 예약을 지우고 머무름 기록을 비운다(보낸 기록은 횟수 제한 때문에 남긴다). */
export function onDisable(input: NearbyState, now: number): Step {
  const state = settle(input, now)
  const actions: NearbyAction[] = state.pending ? [{ kind: 'cancel' }] : []
  return { state: { ...state, enabled: false, stays: {}, pending: null }, actions }
}

/** 오늘(한국 날짜) 보낸 알림 수 — 설정 화면 안내용. */
export function sentToday(state: NearbyState, now: number): number {
  const day = kstTodayYmd(now)
  return state.sent.filter((alert) => kstTodayYmd(alert.at) === day).length
}
