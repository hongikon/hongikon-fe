import { Platform } from 'react-native'
import Constants from 'expo-constants'
import { requireOptionalNativeModule } from 'expo'
import AsyncStorage from '@react-native-async-storage/async-storage'
import * as Notifications from 'expo-notifications'
import {
  INITIAL_NEARBY_STATE,
  onDisable,
  onEnter,
  onExit,
  onRegister,
  settle,
  type NearbyAction,
  type NearbyState,
  type SnapshotPartner,
  type Step,
} from './engine'
import {
  MAX_PARTNER_REGIONS,
  insideAtRegistration,
  pickNearest,
  pickTargets,
  reselectRadius,
} from './rules'
import { nearbyAlertContent } from './copy'
import { NEARBY_FIELD_TEST, SHOW_DEVELOPER_TOOLS, loadNearbyDebug, nearbyNow, partnerRadiusMeters, toRealTime } from './debug'
import type { Partner, PartnerAffiliation } from '../../types'

/**
 * 근처 제휴 알림(백그라운드 지오펜스). 판단은 `engine.ts`, 여기서는 위치·작업·알림·저장만 한다.
 * 설계: `docs/nearby-partner-alert-impl-plan.md`.
 *
 * 켜지는 조건(모두): iOS·Android, 근처 알림 빌드(`NEARBY_ALERTS_BUILD=1` 로 빌드해 `extra.nearbyAlerts`),
 * ExpoLocation·ExpoTaskManager 네이티브 모듈이 있는 바이너리. 그 밖에는 `nearbyAlertsAvailable()` 이 false 라 아무것도 하지 않는다.
 * 이 파일은 앱 진입점(index.ts) 맨 위에서 불러 작업을 정의한다 — 앱이 꺼진 채 지오펜스 신호로 깨어날 때도 작업이 있어야 한다.
 *
 * 위치는 서버로 보내지 않는다. 기기에는 대상 업체 목록·머무름·보낸 시각만 저장한다(좌표 기록 없음).
 */

type LocationPackage = typeof import('expo-location')
type TaskManagerPackage = typeof import('expo-task-manager')

export const NEARBY_TASK = 'hongikon-nearby-partners'
/** 사용자 둘레 큰 원. 벗어나면 가까운 업체를 다시 고른다. 업체 id 와 겹치지 않게. */
const RESELECT_REGION_ID = '__reselect__'
const STORAGE_KEY = 'hongikon_nearby_alerts_v1'
/** 예약 알림은 늘 하나라 고정 id 로 덮어쓰고 지운다. */
const NOTIFICATION_ID = 'nearby-partner'
export const NEARBY_CHANNEL_ID = 'nearby-partner'

interface Packages {
  Location: LocationPackage
  TaskManager: TaskManagerPackage
}

// undefined = 아직 찾아보지 않음, null = 없음.
let cached: Packages | null | undefined

function packages(): Packages | null {
  if (cached !== undefined) return cached
  cached = null
  if (Platform.OS === 'web' || Constants.expoConfig?.extra?.nearbyAlerts !== true) return cached
  try {
    if (requireOptionalNativeModule('ExpoLocation') && requireOptionalNativeModule('ExpoTaskManager')) {
      cached = {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        Location: require('expo-location') as LocationPackage,
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        TaskManager: require('expo-task-manager') as TaskManagerPackage,
      }
    }
  } catch {
    cached = null
  }
  return cached
}

/** 이 빌드·기기에서 근처 알림을 쓸 수 있는지. false 면 설정 스위치를 숨긴다. */
export function nearbyAlertsAvailable(): boolean {
  return packages() !== null
}

function logFailure(step: string, error: unknown): void {
  if (__DEV__) console.warn(`[nearbyAlerts] ${step} 실패:`, error instanceof Error ? error.message : error)
}

// ── 저장 ───────────────────────────────────────────────

async function loadState(): Promise<NearbyState> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY)
    return raw ? { ...INITIAL_NEARBY_STATE, ...(JSON.parse(raw) as Partial<NearbyState>) } : INITIAL_NEARBY_STATE
  } catch {
    return INITIAL_NEARBY_STATE
  }
}

async function saveState(state: NearbyState): Promise<void> {
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  } catch (error) {
    logFailure('상태 저장', error)
  }
}

/** 백그라운드 작업과 화면 쪽이 같은 상태를 동시에 고치지 않게 한 줄로 세운다. */
let queue: Promise<unknown> = Promise.resolve()
function serialized<T>(job: () => Promise<T>): Promise<T> {
  const next = queue.then(job, job)
  queue = next.catch(() => {})
  return next
}

/** 상태를 바꾸고(engine), 저장하고, 예약·취소를 실행한다. */
function mutate(change: (state: NearbyState, now: number) => Step | Promise<Step>): Promise<NearbyState> {
  return serialized(async () => {
    await loadNearbyDebug()
    const { state, actions } = await change(await loadState(), nearbyNow())
    await saveState(state)
    await runActions(state, actions)
    return state
  })
}

// ── 알림 ───────────────────────────────────────────────

let channelReady = false
async function ensureChannel(): Promise<void> {
  if (Platform.OS !== 'android' || channelReady) return
  channelReady = true
  try {
    await Notifications.setNotificationChannelAsync(NEARBY_CHANNEL_ID, {
      name: '근처 제휴 알림',
      description: '제휴 업체 근처에 머물 때 받을 수 있는 혜택 안내(광고)',
      importance: Notifications.AndroidImportance.DEFAULT,
    })
  } catch (error) {
    channelReady = false
    logFailure('알림 채널', error)
  }
}

async function runActions(state: NearbyState, actions: NearbyAction[]): Promise<void> {
  for (const action of actions) {
    try {
      if (action.kind === 'cancel') {
        await Notifications.cancelScheduledNotificationAsync(NOTIFICATION_ID)
        continue
      }
      const partner = state.targets.find((target) => target.id === action.alert.partnerId)
      const content = partner && nearbyAlertContent(partner, state.affiliation, action.alert.othersCount)
      if (!content) continue
      await ensureChannel()
      await Notifications.scheduleNotificationAsync({
        identifier: NOTIFICATION_ID,
        content: { ...content, data: { type: 'NEARBY_PARTNER', partnerId: action.alert.partnerId } },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DATE,
          date: new Date(Math.max(toRealTime(action.alert.fireAt), Date.now() + 1000)),
          channelId: NEARBY_CHANNEL_ID,
        },
      })
    } catch (error) {
      logFailure(action.kind === 'cancel' ? '알림 취소' : '알림 예약', error)
    }
  }
}

// ── 지오펜스 ───────────────────────────────────────────

function within<T>(promise: Promise<T>, ms: number): Promise<T | null> {
  return Promise.race([promise.catch(() => null), new Promise<null>((resolve) => setTimeout(() => resolve(null), ms))])
}

/**
 * 최근 위치(2분 안) → Wi-Fi·기지국(5초) → GPS(10초). 최근 위치를 10분까지 받았더니 그사이 멀리 옮겨 간 경우
 * 떠나온 자리 둘레로 등록됐다(10-28 에뮬레이터). Wi-Fi·기지국 위치가 없는 기기(비행기 모드·에뮬레이터)에서도
 * 등록할 수 있게 GPS 까지 본다(10-28 에뮬레이터 테스트에서 Balanced 만으로는 등록이 늘 실패했다).
 */
async function currentPosition(
  Location: LocationPackage,
  { fresh = false }: { fresh?: boolean } = {},
): Promise<{ lat: number; lng: number } | null> {
  const read = (accuracy: number, ms: number) =>
    within(Location.getCurrentPositionAsync({ accuracy, mayShowUserSettingsDialog: false }), ms)
  const last = fresh
    ? null
    : await Location.getLastKnownPositionAsync({ maxAge: 2 * 60_000, requiredAccuracy: 200 }).catch(() => null)
  const position =
    last ??
    (await read(Location.Accuracy.Balanced, 5_000)) ??
    (await read(Location.Accuracy.High, 10_000))
  return position ? { lat: position.coords.latitude, lng: position.coords.longitude } : null
}

/** 개발·테스트 빌드 설정 화면에 보여 줄 마지막 등록 결과(저장하지 않음, 좌표 없음). */
export interface NearbyDebugInfo {
  at: number
  result: 'registered' | 'noLocation' | 'paused' | 'error' | 'off'
  regions: number
  reselectMeters: number
  /** 실패 이유(개발·테스트 빌드 화면용). */
  error?: string
  /** 지도 영역 보기용(메모리에만, 저장·전송하지 않음): 등록한 위치·업체·반경. */
  center?: { lat: number; lng: number }
  regionIds?: string[]
  radius?: number
}
let lastSync: NearbyDebugInfo | null = null

/**
 * 이 기기가 지오펜스를 지원하지 않는지(마지막 등록이 GeofencingUnavailable 로 실패). iOS 27.1 시뮬레이터는
 * `CLLocationManager.isMonitoringAvailable(CLCircularRegion)` 이 false 라 이렇게 된다(10-28) — 실기기는 확인 필요.
 */
export function nearbyGeofencingUnsupported(): boolean {
  return lastSync?.result === 'error' && /GeofencingUnavailable|not available/i.test(lastSync.error ?? '')
}

export async function getNearbyDebugInfo(): Promise<{
  last: NearbyDebugInfo | null
  lastEvent: typeof lastEvent
  state: NearbyState
}> {
  return { last: lastSync, lastEvent, state: settle(await loadState(), nearbyNow()) }
}

/** 지금 위치 둘레로 가까운 업체 19곳 + "다시 고르기" 원 1개(업체 밀도에 맞춘 반경)를 등록하고, 이미 반경 안인 업체를 진입으로 처리한다. */
async function registerAround(state: NearbyState, now: number, at: { lat: number; lng: number }): Promise<Step> {
  const pkg = packages()
  if (!pkg) return { state, actions: [] }
  const radius = partnerRadiusMeters()
  const nearest = pickNearest(state.targets, at.lat, at.lng, MAX_PARTNER_REGIONS)
  const reselectMeters = reselectRadius(state.targets, at.lat, at.lng, radius)
  // 등록이 실패해도(지오펜스 미지원 기기 등) 지도 영역 보기에서 계획한 원을 보여 주려고 먼저 남긴다.
  lastSync = {
    at: now,
    result: 'error',
    regions: 0,
    reselectMeters: Math.round(reselectMeters),
    center: at,
    regionIds: nearest.map((partner) => partner.id),
    radius,
    error: '등록 중',
  }
  await pkg.Location.startGeofencingAsync(NEARBY_TASK, [
    ...nearest.map((partner) => ({ identifier: partner.id, latitude: partner.lat, longitude: partner.lng, radius })),
    {
      identifier: RESELECT_REGION_ID,
      latitude: at.lat,
      longitude: at.lng,
      radius: reselectMeters,
      notifyOnEnter: false,
    },
  ])
  lastSync = {
    at: now,
    result: 'registered',
    regions: nearest.length,
    reselectMeters: Math.round(reselectMeters),
    center: at,
    regionIds: nearest.map((partner) => partner.id),
    radius,
  }
  const inside = insideAtRegistration(nearest, at.lat, at.lng, radius).map((partner) => partner.id)
  return onRegister(state, nearest.map((partner) => partner.id), inside, now, at)
}

async function stopGeofencing(): Promise<void> {
  const pkg = packages()
  if (!pkg) return
  try {
    if (await pkg.Location.hasStartedGeofencingAsync(NEARBY_TASK)) await pkg.Location.stopGeofencingAsync(NEARBY_TASK)
  } catch (error) {
    logFailure('지오펜스 해제', error)
  }
}

interface GeofenceEvent {
  eventType: number
  region: { identifier?: string }
}

async function quickPosition(Location: LocationPackage): Promise<{ lat: number; lng: number } | undefined> {
  const position =
    (await Location.getLastKnownPositionAsync({ maxAge: 60_000, requiredAccuracy: 100 }).catch(() => null)) ??
    (await within(Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced, mayShowUserSettingsDialog: false }), 4_000))
  return position ? { lat: position.coords.latitude, lng: position.coords.longitude } : undefined
}

/** 개발·테스트 빌드 설정 화면용 마지막 지오펜스 신호. */
let lastEvent: { at: number; kind: 'enter' | 'exit'; id: string } | null = null

async function handleGeofenceEvent(event: GeofenceEvent): Promise<void> {
  const pkg = packages()
  const id = event.region?.identifier
  if (!pkg || !id) return
  const entered = event.eventType === pkg.Location.GeofencingEventType.Enter
  lastEvent = { at: nearbyNow(), kind: entered ? 'enter' : 'exit', id }
  if (id === RESELECT_REGION_ID) {
    if (entered) return
    // 큰 원을 벗어났다 = 꽤 멀리 움직였다. 새 위치 둘레로 다시 고른다. 위치를 못 얻으면 기존 등록을 둔다.
    // 최근 위치는 쓰지 않는다 — 떠나온 자리일 수 있어 그 둘레로 다시 등록하면 새 자리 업체가 빠진다(10-28 에뮬레이터).
    const at = await currentPosition(pkg.Location, { fresh: true })
    if (!at) return
    await mutate((state, now) => (state.enabled ? registerAround(state, now, at) : { state, actions: [] }))
    return
  }
  // 이름을 내세울 업체를 가장 가까운 곳으로 고르려고 위치를 한 번 읽는다(최근 1분 위치 → Wi-Fi·기지국 4초). 못 읽으면 없이 간다.
  const at = await quickPosition(pkg.Location)
  await mutate((state, now) => (entered ? onEnter(state, id, now, at) : onExit(state, id, now, at)))
}

// 앱 진입점에서 이 파일을 불러올 때 작업을 정의한다(한 번만).
;(() => {
  const pkg = packages()
  if (!pkg || pkg.TaskManager.isTaskDefined(NEARBY_TASK)) return
  pkg.TaskManager.defineTask<GeofenceEvent>(NEARBY_TASK, async ({ data, error }) => {
    if (error) {
      logFailure('지오펜스 신호', error)
      return
    }
    try {
      await handleGeofenceEvent(data)
    } catch (e) {
      logFailure('지오펜스 처리', e)
    }
  })
})()

// ── 권한 ───────────────────────────────────────────────

/** granted: 항상 허용 / foregroundOnly: 앱 사용 중만 / denied: 거부(canAskAgain 이면 다시 물을 수 있음) */
export type NearbyPermission =
  | { status: 'granted' }
  | { status: 'foregroundOnly'; canAskAgain: boolean }
  | { status: 'denied'; canAskAgain: boolean }
  | { status: 'unavailable' }

export async function getNearbyPermission(): Promise<NearbyPermission> {
  const pkg = packages()
  if (!pkg) return { status: 'unavailable' }
  try {
    const fg = await pkg.Location.getForegroundPermissionsAsync()
    if (!fg.granted) return { status: 'denied', canAskAgain: fg.canAskAgain }
    const bg = await pkg.Location.getBackgroundPermissionsAsync()
    return bg.granted ? { status: 'granted' } : { status: 'foregroundOnly', canAskAgain: bg.canAskAgain }
  } catch {
    return { status: 'unavailable' }
  }
}

/**
 * "앱 사용 중" → "항상" 순서로 묻는다. Android 11 이상은 "항상"을 앱 안 창으로 고를 수 없어
 * 시스템이 앱 위치 설정 화면을 연다 — 돌아온 뒤 `getNearbyPermission` 으로 다시 확인한다.
 */
export async function requestNearbyPermission(): Promise<NearbyPermission> {
  const pkg = packages()
  if (!pkg) return { status: 'unavailable' }
  try {
    const fg = await pkg.Location.requestForegroundPermissionsAsync()
    if (!fg.granted) return { status: 'denied', canAskAgain: fg.canAskAgain }
    const bg = await pkg.Location.requestBackgroundPermissionsAsync()
    return bg.granted ? { status: 'granted' } : { status: 'foregroundOnly', canAskAgain: bg.canAskAgain }
  } catch (error) {
    logFailure('권한 요청', error)
    return getNearbyPermission()
  }
}

// ── 화면에서 쓰는 것 ───────────────────────────────────

export interface NearbySource {
  partners: readonly Partner[]
  /** 캠퍼스 건물 좌표(업체 반경이 걸치면 대상에서 뺀다). */
  campusPoints: readonly { lat: number; lng: number }[]
  /** 서버 긴급 스위치(`/map/data` nearbyAlertsEnabled). */
  serverEnabled: boolean
}

function snapshot(partners: readonly Partner[], affiliation: PartnerAffiliation | null, campusPoints: NearbySource['campusPoints'], now: number): SnapshotPartner[] {
  // 현장 테스트 빌드: 서버에 업체별 대상 표시가 없어도 혜택 있는 업체를 모두 대상으로 본다.
  const source = NEARBY_FIELD_TEST ? partners.map((p) => ({ ...p, nearbyAlert: true })) : partners
  return pickTargets(source, { affiliation, campusPoints, now }).map((p) => ({
    id: p.id,
    name: p.name,
    lat: p.lat,
    lng: p.lng,
    benefit: p.benefit,
    affiliations: p.affiliations,
    affiliationBenefits: p.affiliationBenefits,
  }))
}

export async function getNearbySettings(): Promise<{ enabled: boolean; affiliation: PartnerAffiliation | null; targetCount: number }> {
  const state = settle(await loadState(), nearbyNow())
  return { enabled: state.enabled, affiliation: state.affiliation, targetCount: state.targets.length }
}

/**
 * 켜거나 다시 맞춘다(앱 열기·지도 데이터 갱신·소속 변경). 권한·긴급 스위치를 확인하고, 대상 업체를 새로 골라 등록한다.
 * `enable`: 설정에서 켤 때 true(꺼져 있어도 켠다). 아니면 이미 켜져 있을 때만 다시 맞춘다.
 * 돌려주는 값: 지금 실제로 감시 중인지.
 */
export async function syncNearbyAlerts(
  source: NearbySource,
  options: { enable?: boolean; affiliation?: PartnerAffiliation | null } = {},
): Promise<boolean> {
  const pkg = packages()
  if (!pkg) return false
  const permission = await getNearbyPermission()
  let watching = false
  await mutate(async (input, now) => {
    let state: NearbyState = {
      ...input,
      enabled: options.enable ? true : input.enabled,
      affiliation: options.affiliation !== undefined ? options.affiliation : input.affiliation,
    }
    if (!state.enabled) {
      lastSync = { at: now, result: 'off', regions: 0, reselectMeters: 0 }
      return { state, actions: [] }
    }
    // 긴급 끄기·권한 없음: 설정은 켜 둔 채 감시만 멈춘다(돌아오면 다음 sync 때 다시 건다).
    if (!(source.serverEnabled || NEARBY_FIELD_TEST) || permission.status !== 'granted') {
      await stopGeofencing()
      lastSync = { at: now, result: 'paused', regions: 0, reselectMeters: 0 }
      const paused = onDisable(state, now)
      return { state: { ...paused.state, enabled: true }, actions: paused.actions }
    }
    state = { ...state, targets: snapshot(source.partners, state.affiliation, source.campusPoints, now) }
    const at = await currentPosition(pkg.Location)
    if (!at) {
      lastSync = { at: now, result: 'noLocation', regions: 0, reselectMeters: 0 }
      return { state, actions: [] }
    }
    try {
      const step = await registerAround(state, now, at)
      watching = true
      return step
    } catch (error) {
      logFailure('지오펜스 등록', error)
      lastSync = {
        ...lastSync,
        at: now,
        result: 'error',
        regions: 0,
        reselectMeters: lastSync?.reselectMeters ?? 0,
        // Expo 오류는 "…has failed … → Caused by: <진짜 이유>" 꼴이라 끝부분을 남긴다.
        error: (error instanceof Error ? error.message : String(error)).replace(/\s+/g, ' ').slice(-160),
      }
      return { state, actions: [] }
    }
  })
  return watching
}

/** 설정에서 끔. 감시·예약을 멈춘다. */
export async function disableNearbyAlerts(): Promise<void> {
  if (!packages()) return
  await stopGeofencing()
  await mutate((state, now) => onDisable(state, now))
}

/** 지도 "근처 알림 영역 보기"(개발 도구)에 그릴 것. 등록 전이면 null. */
export interface NearbyOverlay {
  center: { lat: number; lng: number }
  reselectMeters: number
  /** 등록이 실패했으면 그 이유(원은 계획만 그린 것). */
  error?: string
  regions: { id: string; name: string; lat: number; lng: number; radius: number; inside: boolean; pending: boolean }[]
}

export async function getNearbyOverlay(): Promise<NearbyOverlay | null> {
  if (!SHOW_DEVELOPER_TOOLS || !lastSync?.center || !lastSync.regionIds) return null
  const state = settle(await loadState(), nearbyNow())
  const radius = lastSync.radius ?? partnerRadiusMeters()
  const regions = lastSync.regionIds.flatMap((id) => {
    const t = state.targets.find((target) => target.id === id)
    if (!t) return []
    const stay = state.stays[id]
    return [{ id, name: t.name, lat: t.lat, lng: t.lng, radius, inside: !!stay && stay.exitedAt === null, pending: state.pending?.partnerId === id }]
  })
  const error = lastSync.result === 'error' ? lastSync.error : undefined
  return { center: lastSync.center, reselectMeters: lastSync.reselectMeters, regions, error }
}

/** 개발·테스트 빌드 전용(`hongikon://dev/nearby?reset=1`): 보낸 기록·머무름·예약을 비운다. 켜짐·소속·대상은 둔다. */
export async function resetNearbyHistoryForDebug(): Promise<void> {
  if (!packages() || !SHOW_DEVELOPER_TOOLS) return
  await mutate((state) => ({
    state: { ...state, sent: [], stays: {}, pending: null },
    actions: state.pending ? [{ kind: 'cancel' }] : [],
  }))
}

/** 로그아웃·탈퇴. 끄고 기기에 저장한 것(대상 업체·머무름·보낸 기록·소속)을 모두 지운다. */
export async function wipeNearbyAlerts(): Promise<void> {
  if (!packages()) return
  await disableNearbyAlerts()
  await serialized(async () => {
    try {
      await AsyncStorage.removeItem(STORAGE_KEY)
    } catch (error) {
      logFailure('기록 삭제', error)
    }
  })
}
