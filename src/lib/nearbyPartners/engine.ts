import { kstTodayYmd } from '../../utils/exhibitions'
import { haversineMeters } from '../../utils/geo'
import {
  REENTRY_GRACE_MS,
  alertGroup,
  decideOnEnter,
  dwellFor,
  stayStartedAt,
  type DwellMinutes,
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
  affiliation: PartnerAffiliation | null
  targets: SnapshotPartner[]
  stays: Record<string, StayRecord>
  sent: SentAlert[]
  pending: PendingAlert | null
  /** 현장 테스트 빌드: 하루·간격 제한 없이 가게에 들어갈 때마다 한 번씩 알린다. */
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
  affiliation: null,
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
      const decision = decideOnEnter(leadId, stays.get(group.leadId)!.enteredAt, state.sent, now, {
        perVisit: state.perVisit,
        quietNight: state.quietNight,
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
