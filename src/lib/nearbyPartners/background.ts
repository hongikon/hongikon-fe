import { Platform } from 'react-native'
import Constants from 'expo-constants'
import { requireOptionalNativeModule } from 'expo'
import AsyncStorage from '@react-native-async-storage/async-storage'
import * as Notifications from 'expo-notifications'
import {
  INITIAL_NEARBY_STATE,
  activeStays,
  onDisable,
  onEnter,
  onExit,
  onPrefs,
  onRegister,
  settle,
  type NearbyAction,
  type NearbyPrefs,
  type NearbyState,
  type SnapshotPartner,
  type Step,
} from './engine'
import {
  DEFAULT_DWELL_MINUTES,
  MAX_PARTNER_REGIONS,
  PARTNER_REGION_RADIUS_METERS,
  alertGroup,
  insideAtRegistration,
  pickNearest,
  pickTargets,
  preciselyInside,
  quietAtNight,
  reselectRadius,
  type DwellMinutes,
} from './rules'
import { nearbyAlertContent, nearbyGroupContent } from './copy'
import {
  NEARBY_FIELD_TEST,
  SHOW_DEVELOPER_TOOLS,
  fieldTestUnlimited,
  loadNearbyDebug,
  nearbyNow,
  partnerRadiusMeters,
  setTestLocation,
  testLocation,
  toRealTime,
} from './debug'
import { haversineMeters } from '../../utils/geo'
import type { Partner, PartnerAffiliation } from '../../types'

/**
 * 근처 제휴 알림(백그라운드 지오펜스). 판단은 `engine.ts`, 여기서는 위치·작업·알림·저장만 한다.
 * 설계: `docs/nearby-partner-alert-impl-plan.md`.
 *
 * 켜지는 조건(모두): iOS·Android, 근처 알림 빌드(`NEARBY_ALERTS_BUILD=1` 로 빌드해 `extra.nearbyAlerts`),
 * ExpoLocation·ExpoTaskManager 네이티브 모듈이 있는 바이너리. 그 밖에는 `nearbyAlertsAvailable()` 이 false 라 아무것도 하지 않는다.
 * 이 파일은 앱 진입점(index.ts) 맨 위에서 불러 작업을 정의한다 — 앱이 꺼진 채 지오펜스 신호로 깨어날 때도 작업이 있어야 한다.
 *
 * 두 단계로 잰다(10-29, 알림 반경 20m):
 * 1. 운영체제 지오펜스(업체마다 100m, `PARTNER_REGION_RADIUS_METERS`) — 가게 근처에 오면 앱을 깨운다. iOS 는 이보다 작은
 *    원을 믿을 만하게 알려 주지 않는다.
 * 2. 깨운 원 안에 있는 동안만 GPS 위치 갱신(`NEARBY_PRECISE_TASK`)을 켜 업체까지 거리를 재고, 알림 반경(기본 20m) 안이면
 *    머무름을 센다. 모든 깨운 원에서 멀어지거나 2시간이 지나면 끈다. 위치 갱신을 켤 수 없는 기기(Android 포그라운드 서비스
 *    없는 빌드 등)는 1단계 신호를 그대로 머무름으로 쓴다(반경 100m).
 *
 * 위치는 서버로 보내지 않는다. 기기에는 대상 업체 목록·머무름·보낸 시각만 저장한다(좌표 기록 없음).
 */

type LocationPackage = typeof import('expo-location')
type TaskManagerPackage = typeof import('expo-task-manager')

export const NEARBY_TASK = 'hongikon-nearby-partners'
/** 깨운 원 안에서만 켜는 GPS 위치 갱신 작업. */
export const NEARBY_PRECISE_TASK = 'hongikon-nearby-precise'
const PRECISE_SINCE_KEY = 'hongikon_nearby_precise_since'
/** GPS 를 이만큼 넘게 켜 두지 않는다(가게 근처에 오래 머물러도 배터리를 계속 쓰지 않게). */
const PRECISE_MAX_MS = 2 * 60 * 60 * 1000
/** 모든 대상 업체에서 깨우는 원 + 이만큼 멀어지면 GPS 를 끈다. */
const PRECISE_STOP_MARGIN_METERS = 50
/** 사용자 둘레 큰 원. 벗어나면 가까운 업체를 다시 고른다. 업체 id 와 겹치지 않게. */
const RESELECT_REGION_ID = '__reselect__'
const STORAGE_KEY = 'hongikon_nearby_alerts_v1'
/** 예약 알림은 늘 하나라 고정 id 로 덮어쓰고 지운다. */
const NOTIFICATION_ID = 'nearby-partner'
export const NEARBY_CHANNEL_ID = 'nearby-partner'
/** 알림 아래 버튼(길게 누르거나 내려 펼치면 보인다): 이 가게 알림 끄기. */
export const NEARBY_CATEGORY_ID = 'nearby-partner'
export const NEARBY_ACTION_MUTE = 'NEARBY_MUTE'

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
    if (!raw) return INITIAL_NEARBY_STATE
    const saved = JSON.parse(raw) as Partial<NearbyState>
    // 옛 저장본은 소속 하나(affiliation)였다 — 목록으로 옮긴다.
    const affiliations = saved.affiliations ?? (saved.affiliation ? [saved.affiliation] : [])
    return { ...INITIAL_NEARBY_STATE, ...saved, affiliations, affiliation: undefined }
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

let categoryReady = false
/**
 * 알림 버튼 등록. 버튼을 누르면 앱이 열리며 처리한다(`handleNearbyNotificationAction`) — 앱을 열지 않는 버튼은
 * 앱이 꺼져 있을 때 JS 가 돌지 않아 눌러도 아무 일이 없을 수 있다.
 */
async function ensureCategory(): Promise<void> {
  if (categoryReady) return
  categoryReady = true
  try {
    await Notifications.setNotificationCategoryAsync(NEARBY_CATEGORY_ID, [
      { identifier: NEARBY_ACTION_MUTE, buttonTitle: '이 가게 알림 끄기', options: { opensAppToForeground: true } },
    ])
  } catch (error) {
    categoryReady = false
    logFailure('알림 버튼 등록', error)
  }
}

let channelReady = false
async function ensureChannel(): Promise<void> {
  await ensureCategory()
  if (Platform.OS !== 'android' || channelReady) return
  channelReady = true
  try {
    await Notifications.setNotificationChannelAsync(NEARBY_CHANNEL_ID, {
      name: '근처 제휴 알림',
      description: '제휴 가게에 머물 때 받을 수 있는 혜택 안내',
      importance: Notifications.AndroidImportance.DEFAULT,
    })
  } catch (error) {
    channelReady = false
    logFailure('알림 채널', error)
  }
}

/**
 * 몇 초 뒤 알림 트리거(시간 간격). 10-28 iOS 27.1(Xcode 27 빌드)에서 expo-notifications 의 시간 간격·날짜·달력 트리거가
 * 모두 "undefined reason" 으로 실패했다(즉시 알림은 됨) — 네이티브가 트리거 값(@Field)을 못 읽어 0 초가 됐다.
 * `patches/expo-notifications@57.0.24.patch` 가 시간 간격 트리거를 직접 읽게 고친다.
 */
function triggerAfter(seconds: number): Notifications.NotificationTriggerInput {
  return { type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL, seconds, channelId: NEARBY_CHANNEL_ID }
}

/** 개발 도구 상태 줄용: 마지막 예약·취소 결과(실패면 이유). */
let lastScheduleNote: string | null = null

async function runActions(state: NearbyState, actions: NearbyAction[]): Promise<void> {
  for (const action of actions) {
    try {
      if (action.kind === 'cancel') {
        await Notifications.cancelScheduledNotificationAsync(NOTIFICATION_ID)
        continue
      }
      const partner = state.targets.find((target) => target.id === action.alert.partnerId)
      if (!partner) continue
      // 함께 잡힌 곳(앞세운 곳 + 나머지를 그곳에서 가까운 순). 2곳 이상이면 "근처에 N곳" 알림, 누르면 목록.
      const group = alertGroup(activeStays(state), state.sent, nearbyNow(), state.perVisit)
      const others = (group ? [group.leadId, ...group.others] : [])
        .filter((id) => id !== partner.id)
        .flatMap((id) => state.targets.filter((target) => target.id === id))
        .sort((a, b) => haversineMeters(partner.lat, partner.lng, a.lat, a.lng) - haversineMeters(partner.lat, partner.lng, b.lat, b.lng))
      const members = [partner, ...others]
      const content = members.length > 1 ? nearbyGroupContent(members) : nearbyAlertContent(partner, state.affiliations)
      if (!content) continue
      await ensureChannel()
      // "몇 초 뒤"로 예약한다. DATE 트리거는 iOS 에서 밀리초를 버린 뒤 남은 시간으로 바꾸는데, 0 이하가 되거나 날짜가
      // 이상하면 "undefined reason" 으로 예약이 실패했다(10-28 iOS 시뮬레이터). 최소 2초.
      const seconds = Math.max(2, Math.round((toRealTime(action.alert.fireAt) - Date.now()) / 1000))
      if (!Number.isFinite(seconds)) throw new Error(`예약 시각이 올바르지 않음(fireAt=${action.alert.fireAt})`)
      await Notifications.scheduleNotificationAsync({
        identifier: NOTIFICATION_ID,
        content: {
          ...content,
          categoryIdentifier: NEARBY_CATEGORY_ID,
          data: { type: 'NEARBY_PARTNER', partnerId: partner.id, partnerIds: members.map((m) => m.id) },
        },
        trigger: triggerAfter(seconds),
      })
      lastScheduleNote = `예약함 ${seconds}초 뒤(${new Date(Date.now() + seconds * 1000).toTimeString().slice(0, 5)})`
    } catch (error) {
      logFailure(action.kind === 'cancel' ? '알림 취소' : '알림 예약', error)
      lastScheduleNote = `${action.kind === 'cancel' ? '취소' : '예약'} 실패: ${(error instanceof Error ? error.message : String(error)).replace(/\s+/g, ' ').slice(0, 200)}`
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
  const fake = testLocation()
  if (fake) return fake
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

/** 운영체제에 거는 업체 원(깨우는 원). 알림 반경보다 작지 않게. */
function wakeRadiusMeters(): number {
  return Math.max(PARTNER_REGION_RADIUS_METERS, partnerRadiusMeters())
}

// ── GPS 로 알림 반경 재기 ─────────────────────────────

/** 개발 도구 상태 줄용: GPS 갱신 상태. */
let preciseNote: string = '꺼짐'
/** 이번 실행에서 위치 갱신을 켜지 못했으면 지오펜스 신호를 그대로 머무름으로 쓴다. */
let preciseUnavailable = false

async function startPrecise(): Promise<boolean> {
  const pkg = packages()
  if (!pkg || preciseUnavailable) return false
  try {
    if (await pkg.Location.hasStartedLocationUpdatesAsync(NEARBY_PRECISE_TASK)) return true
    await pkg.Location.startLocationUpdatesAsync(NEARBY_PRECISE_TASK, {
      accuracy: pkg.Location.Accuracy.High,
      // 11-03: 5m 움직여야 새 위치를 주던 것을 0으로. 가게에 들어가 가만히 있으면 위치가 더 오지 않아, 들어갈 때 실내 오차로
      // '20m 밖'으로 잡히면 머문 시간을 세지 못해 알림이 들쭉날쭉 늦었다. 깨우는 원 안에서만 켜지고 멀어지면 끈다.
      distanceInterval: 0,
      timeInterval: 5_000,
      pausesUpdatesAutomatically: false,
      activityType: pkg.Location.ActivityType.Other,
      // 위치를 쓰는 동안 상태 막대에 표시한다(가게 근처에 있을 때만 켜지니 숨기지 않는다).
      showsBackgroundLocationIndicator: true,
      foregroundService: {
        notificationTitle: '근처 제휴 가게 확인 중',
        notificationBody: '제휴 가게 근처에 있는 동안만 위치를 확인해요. 위치는 휴대폰 밖으로 보내지 않아요.',
      },
    })
    await AsyncStorage.setItem(PRECISE_SINCE_KEY, String(Date.now())).catch(() => {})
    preciseNote = '켜짐'
    return true
  } catch (error) {
    preciseUnavailable = true
    preciseNote = `못 켬(반경 ${PARTNER_REGION_RADIUS_METERS}m 로 판단): ${(error instanceof Error ? error.message : String(error)).replace(/\s+/g, ' ').slice(-100)}`
    logFailure('GPS 위치 갱신', error)
    return false
  }
}

async function stopPrecise(): Promise<void> {
  const pkg = packages()
  if (!pkg) return
  try {
    if (await pkg.Location.hasStartedLocationUpdatesAsync(NEARBY_PRECISE_TASK)) await pkg.Location.stopLocationUpdatesAsync(NEARBY_PRECISE_TASK)
    await AsyncStorage.removeItem(PRECISE_SINCE_KEY).catch(() => {})
    if (!preciseUnavailable) preciseNote = '꺼짐'
  } catch (error) {
    logFailure('GPS 위치 갱신 끄기', error)
  }
}

/** 감시 중인 업체 중 깨우는 원(+여유) 안에 있는 곳이 있는지. 없으면 GPS 를 켤 이유가 없다. */
function nearAnyTarget(state: NearbyState, at: { lat: number; lng: number }, margin = 0): boolean {
  const limit = wakeRadiusMeters() + margin
  return state.targets.some((t) => haversineMeters(at.lat, at.lng, t.lat, t.lng) <= limit)
}

/**
 * GPS 위치 하나로 알림 반경 안팎을 다시 맞춘다: 안으로 들어온 업체는 진입, 멀어진 업체는 이탈.
 * 이름을 내세울 업체 고르기(`chooseLead`)에도 이 위치를 쓴다. 위치는 저장하지 않는다.
 */
function preciseStep(input: NearbyState, now: number, at: { lat: number; lng: number }, accuracy: number | null): Step {
  const radius = partnerRadiusMeters()
  let step: Step = { state: input, actions: [] }
  const actions: NearbyAction[] = []
  for (const target of input.targets) {
    const stay = step.state.stays[target.id]
    const wasInside = !!stay && stay.exitedAt === null
    const inside = preciselyInside(haversineMeters(at.lat, at.lng, target.lat, target.lng), accuracy, wasInside, radius)
    if (inside === wasInside) continue
    step = inside ? onEnter(step.state, target.id, now, at) : onExit(step.state, target.id, now, at)
    actions.push(...step.actions)
  }
  return { state: step.state, actions }
}

/** GPS 위치 갱신 한 번(백그라운드 작업). 근처 업체가 없거나 오래 켜졌으면 끈다. */
async function handlePreciseLocations(locations: { coords: { latitude: number; longitude: number; accuracy: number | null } }[]): Promise<void> {
  // 앱이 꺼진 채 깨어난 경우 개발 도구 값(테스트 위치)을 아직 안 읽었다 — 먼저 읽어야 테스트 위치 모드에서 실제 GPS 를 쓰지 않는다.
  await loadNearbyDebug()
  if (testLocation()) {
    await stopPrecise()
    return
  }
  const latest = locations[locations.length - 1]
  if (!latest) return
  const at = { lat: latest.coords.latitude, lng: latest.coords.longitude }
  const accuracy = latest.coords.accuracy ?? null
  const since = Number(await AsyncStorage.getItem(PRECISE_SINCE_KEY).catch(() => null)) || Date.now()
  let stop = Date.now() - since > PRECISE_MAX_MS
  await mutate((state, now) => {
    if (!state.enabled) {
      stop = true
      return { state, actions: [] }
    }
    if (!nearAnyTarget(state, at, PRECISE_STOP_MARGIN_METERS)) stop = true
    preciseNote = `켜짐 · 오차 ${accuracy === null ? '?' : Math.round(accuracy)}m`
    return preciseStep(state, now, at, accuracy)
  })
  if (stop) await stopPrecise()
}

/**
 * 테스트 위치 모드(개발 도구): 운영체제 지오펜스를 쓰지 않고, 고른 위치와 업체 사이 거리로 진입·이탈을 앱이 직접 판단한다.
 * 다시 고르기 원 밖이면 그 자리 둘레 19곳을 새로 고르고, 반경 안으로 들어온 곳은 진입·벗어난 곳은 이탈로 처리한다.
 * 실제 GPS·지오펜스 지원 여부와 상관없이 머무름 → 예약 → 알림 → 탭까지 실기기에서 확인하려는 것이다.
 */
async function simulateAt(input: NearbyState, now: number, at: { lat: number; lng: number }): Promise<Step> {
  await stopGeofencing()
  await stopPrecise()
  const radius = partnerRadiusMeters()
  const outside = !lastSync?.center || !lastSync.regionIds || haversineMeters(lastSync.center.lat, lastSync.center.lng, at.lat, at.lng) > lastSync.reselectMeters
  if (outside) {
    const nearest = pickNearest(input.targets, at.lat, at.lng, MAX_PARTNER_REGIONS)
    lastSync = {
      at: now,
      result: 'registered',
      regions: nearest.length,
      reselectMeters: Math.round(reselectRadius(input.targets, at.lat, at.lng, radius)),
      center: at,
      regionIds: nearest.map((partner) => partner.id),
      radius,
      error: undefined,
    }
  }
  const regionIds = lastSync!.regionIds!
  const regions = input.targets.filter((t) => regionIds.includes(t.id))
  const inside = insideAtRegistration(regions, at.lat, at.lng, radius).map((p) => p.id)
  let step = onRegister(input, regionIds, inside, now, at)
  const actions = [...step.actions]
  for (const [id, stay] of Object.entries(step.state.stays)) {
    if (stay.exitedAt === null && !inside.includes(id)) {
      step = onExit(step.state, id, now, at)
      actions.push(...step.actions)
    }
  }
  return { state: step.state, actions }
}

/** 지도에서 고른 테스트 위치로 바꾸고(null 이면 실제 GPS 로 되돌리고) 바로 다시 판단한다. */
export async function applyNearbyTestLocation(
  location: { lat: number; lng: number } | null,
  source: NearbySource,
): Promise<boolean> {
  if (!packages() || !SHOW_DEVELOPER_TOOLS) return false
  await setTestLocation(location)
  // 실제 GPS 로 돌아갈 때는 테스트 위치 기준 등록을 버리고 실제 위치 둘레로 새로 등록하게 한다.
  if (!location) lastSync = null
  return syncNearbyAlerts(source)
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
  /** 마지막 예약 결과와 운영체제에 실제로 걸려 있는 근처 알림 예약 수. */
  schedule: string
}> {
  let scheduled = -1
  try {
    scheduled = (await Notifications.getAllScheduledNotificationsAsync()).filter((n) => n.identifier === NOTIFICATION_ID).length
  } catch {
    // 못 읽으면 -1
  }
  const permission = await Notifications.getPermissionsAsync().then((p) => p.status).catch(() => 'unknown')
  return {
    last: lastSync,
    lastEvent,
    state: settle(await loadState(), nearbyNow()),
    schedule: `반경 ${partnerRadiusMeters()}m(깨우기 ${wakeRadiusMeters()}m) · GPS ${preciseNote} · 알림권한 ${permission} · 걸린 예약 ${scheduled}${lastScheduleNote ? ` · ${lastScheduleNote}` : ''}`,
  }
}

/** 지금 위치 둘레로 가까운 업체 19곳 + "다시 고르기" 원 1개(업체 밀도에 맞춘 반경)를 등록하고, 이미 반경 안인 업체를 진입으로 처리한다. */
async function registerAround(state: NearbyState, now: number, at: { lat: number; lng: number }): Promise<Step> {
  const pkg = packages()
  if (!pkg) return { state, actions: [] }
  const radius = partnerRadiusMeters()
  const wake = wakeRadiusMeters()
  const nearest = pickNearest(state.targets, at.lat, at.lng, MAX_PARTNER_REGIONS)
  const reselectMeters = reselectRadius(state.targets, at.lat, at.lng, wake)
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
    ...nearest.map((partner) => ({ identifier: partner.id, latitude: partner.lat, longitude: partner.lng, radius: wake })),
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
  // 이미 깨우는 원 안이면 GPS 로 재기 시작한다. 못 켜면 깨우는 원 안을 머무름으로 본다(예전 방식).
  const near = nearAnyTarget(state, at)
  const precise = near ? await startPrecise() : (await stopPrecise(), false)
  const inside = insideAtRegistration(nearest, at.lat, at.lng, precise || !near ? radius : wake).map((partner) => partner.id)
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
  const fake = testLocation()
  if (fake) return fake
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
  // 테스트 위치 모드는 운영체제 원을 쓰지 않는다(늦게 온 실제 위치 신호는 버린다).
  await loadNearbyDebug()
  if (testLocation()) return
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
  // 깨우는 원에 들어왔다 → GPS 를 켜 알림 반경(20m)은 위치 갱신이 판단한다. 못 켜면 이 신호를 머무름으로 쓴다.
  if (entered && !testLocation() && (await startPrecise())) return
  // 깨우는 원(100m)을 나갔으면 알림 반경 밖인 것도 확실하다.
  await mutate((state, now) => (entered ? onEnter(state, id, now, at) : onExit(state, id, now, at)))
}

// 앱 진입점에서 이 파일을 불러올 때 작업을 정의한다(한 번만).
;(() => {
  const pkg = packages()
  if (!pkg) return
  if (!pkg.TaskManager.isTaskDefined(NEARBY_PRECISE_TASK)) {
    pkg.TaskManager.defineTask<{ locations: Parameters<typeof handlePreciseLocations>[0] }>(NEARBY_PRECISE_TASK, async ({ data, error }) => {
      if (error) {
        logFailure('GPS 위치 신호', error)
        return
      }
      try {
        await handlePreciseLocations(data?.locations ?? [])
      } catch (e) {
        logFailure('GPS 위치 처리', e)
      }
    })
  }
  if (pkg.TaskManager.isTaskDefined(NEARBY_TASK)) return
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

/** 설정 화면 "알림이 오려면" 점검표. precise: 정확한 위치(iOS 정확한 위치·Android 정밀) — 모르면 null. */
export interface NearbyChecklist {
  notifications: boolean
  always: boolean
  precise: boolean | null
}

export async function getNearbyChecklist(): Promise<NearbyChecklist> {
  const pkg = packages()
  const notifications = await Notifications.getPermissionsAsync()
    .then((p) => p.granted)
    .catch(() => false)
  if (!pkg) return { notifications, always: false, precise: null }
  const always = (await getNearbyPermission()).status === 'granted'
  try {
    const fg = await pkg.Location.getForegroundPermissionsAsync()
    const precise = fg.ios ? fg.ios.accuracy === 'full' : fg.android ? fg.android.accuracy === 'fine' : null
    return { notifications, always, precise: fg.granted ? precise : null }
  } catch {
    return { notifications, always, precise: null }
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

function snapshot(partners: readonly Partner[], affiliations: readonly PartnerAffiliation[], campusPoints: NearbySource['campusPoints'], now: number): SnapshotPartner[] {
  // 현장 테스트 빌드: 서버에 업체별 대상 표시가 없어도, 소속과 상관없이 혜택 있는 업체를 모두 대상으로 본다
  // (10-29 — 문과대학 전용 제휴 앞에서 알림이 안 와 헷갈렸다). 알림 문구에 어느 소속 제휴인지 붙는다(copy.ts).
  const source = NEARBY_FIELD_TEST ? partners.map((p) => ({ ...p, nearbyAlert: true })) : partners
  return pickTargets(source, { affiliations, campusPoints, now, anyAffiliation: NEARBY_FIELD_TEST }).map((p) => ({
    id: p.id,
    name: p.name,
    lat: p.lat,
    lng: p.lng,
    category: p.category,
    benefit: p.benefit,
    affiliations: p.affiliations,
    affiliationBenefits: p.affiliationBenefits,
  }))
}

export interface NearbySettings {
  enabled: boolean
  affiliations: PartnerAffiliation[]
  targetCount: number
  quietNight: boolean
  dwellMinutes: DwellMinutes
  /** 알림을 끈 가게(이름을 알면 이름, 대상 목록에서 빠졌으면 id). */
  muted: { id: string; name: string }[]
}

export async function getNearbySettings(): Promise<NearbySettings> {
  const state = settle(await loadState(), nearbyNow())
  return {
    enabled: state.enabled,
    affiliations: state.affiliations,
    targetCount: state.targets.length,
    quietNight: quietAtNight(state.quietNight),
    dwellMinutes: state.dwellMinutes ?? DEFAULT_DWELL_MINUTES,
    muted: (state.muted ?? []).map((id) => ({ id, name: state.targets.find((t) => t.id === id)?.name ?? id })),
  }
}

/** 설정 화면·알림 버튼에서 바꾸는 값. 바로 저장하고 예약을 다시 맞춘다. */
export async function setNearbyPrefs(prefs: NearbyPrefs): Promise<void> {
  if (!packages()) return
  await mutate((state, now) => onPrefs(state, prefs, now))
}

/** 이 가게(들) 알림 끄기. 다시 받으려면 설정 > 근처 제휴 알림 > 알림 안 받는 가게. */
export async function muteNearbyPartners(ids: readonly string[]): Promise<void> {
  if (!packages() || ids.length === 0) return
  await mutate((state, now) => onPrefs(state, { muted: [...new Set([...(state.muted ?? []), ...ids])] }, now))
}

export async function unmuteNearbyPartner(id: string): Promise<void> {
  if (!packages()) return
  await mutate((state, now) => onPrefs(state, { muted: (state.muted ?? []).filter((m) => m !== id) }, now))
}

/**
 * 근처 알림의 버튼을 눌렀다(`lib/pushNotifications.ts`). 처리했으면 무엇을 했는지 짧은 안내 문구, 아니면 null.
 * 버튼이 아닌 알림 본문 탭은 여기서 다루지 않는다(지도로 이동).
 */
export async function handleNearbyNotificationAction(actionId: string, data: unknown): Promise<string | null> {
  if (actionId !== NEARBY_ACTION_MUTE) return null
  const payload = (data ?? {}) as { partnerId?: unknown; partnerIds?: unknown }
  const ids = Array.isArray(payload.partnerIds)
    ? payload.partnerIds.filter((id): id is string => typeof id === 'string')
    : typeof payload.partnerId === 'string'
      ? [payload.partnerId]
      : []
  await muteNearbyPartners(ids)
  return ids.length > 1 ? `이 ${ids.length}곳 알림을 껐어요. 설정에서 다시 켤 수 있어요.` : '이 가게 알림을 껐어요. 설정에서 다시 켤 수 있어요.'
}

/**
 * 테스트 앱 전용: 걷지 않고 알림 모양·버튼·탭 이동을 확인하려고, 가장 가까운(모르면 첫) 대상 가게 알림을 몇 초 뒤에 띄운다.
 * 예약·보낸 기록에는 남기지 않는다(실제 판단과 섞이지 않게).
 */
export async function sendNearbyTestAlert(seconds = 5, group = false): Promise<string> {
  const pkg = packages()
  if (!pkg || !SHOW_DEVELOPER_TOOLS) return '테스트 앱에서만 쓸 수 있어요.'
  await loadNearbyDebug()
  const state = await loadState()
  if (state.targets.length === 0) return '대상 가게가 없어요. 먼저 근처 제휴 알림을 켜 주세요.'
  const at = (await quickPosition(pkg.Location)) ?? null
  const sorted = at
    ? [...state.targets].sort((a, b) => haversineMeters(at.lat, at.lng, a.lat, a.lng) - haversineMeters(at.lat, at.lng, b.lat, b.lng))
    : state.targets
  const members = sorted.slice(0, group ? 3 : 1)
  const content = members.length > 1 ? nearbyGroupContent(members) : nearbyAlertContent(members[0], state.affiliations)
  if (!content) return '혜택 문구가 없는 가게라 알림을 만들 수 없어요.'
  await ensureChannel()
  await Notifications.scheduleNotificationAsync({
    identifier: 'nearby-partner-test',
    content: {
      ...content,
      categoryIdentifier: NEARBY_CATEGORY_ID,
      data: { type: 'NEARBY_PARTNER', partnerId: members[0].id, partnerIds: members.map((m) => m.id) },
    },
    trigger: triggerAfter(seconds),
  })
  return `${seconds}초 뒤 ${members.length > 1 ? `${members.length}곳 묶음` : members[0].name} 알림이 와요. 앱을 닫거나 홈 화면으로 나가 보세요.`
}

/**
 * 켜거나 다시 맞춘다(앱 열기·지도 데이터 갱신·소속 변경). 권한·긴급 스위치를 확인하고, 대상 업체를 새로 골라 등록한다.
 * `enable`: 설정에서 켤 때 true(꺼져 있어도 켠다). 아니면 이미 켜져 있을 때만 다시 맞춘다.
 * 돌려주는 값: 지금 실제로 감시 중인지.
 */
export async function syncNearbyAlerts(
  source: NearbySource,
  options: { enable?: boolean; affiliations?: PartnerAffiliation[] } = {},
): Promise<boolean> {
  const pkg = packages()
  if (!pkg) return false
  const permission = await getNearbyPermission()
  let watching = false
  await mutate(async (input, now) => {
    let state: NearbyState = {
      ...input,
      enabled: options.enable ? true : input.enabled,
      affiliations: options.affiliations ?? input.affiliations,
    }
    if (!state.enabled) {
      lastSync = { at: now, result: 'off', regions: 0, reselectMeters: 0 }
      return { state, actions: [] }
    }
    // 긴급 끄기·권한 없음: 설정은 켜 둔 채 감시만 멈춘다(돌아오면 다음 sync 때 다시 건다).
    if (!(source.serverEnabled || NEARBY_FIELD_TEST) || permission.status !== 'granted') {
      await stopGeofencing()
      await stopPrecise()
      lastSync = { at: now, result: 'paused', regions: 0, reselectMeters: 0 }
      const paused = onDisable(state, now)
      return { state: { ...paused.state, enabled: true }, actions: paused.actions }
    }
    state = {
      ...state,
      targets: snapshot(source.partners, state.affiliations, source.campusPoints, now),
      // 현장 테스트 앱은 기본으로 횟수 제한 없이. 설정의 [테스트] 스위치로 운영 규칙(하루 최대 수·간격)을 켜 볼 수 있다.
      perVisit: NEARBY_FIELD_TEST && fieldTestUnlimited(),
    }
    const at = await currentPosition(pkg.Location)
    if (!at) {
      lastSync = { at: now, result: 'noLocation', regions: 0, reselectMeters: 0 }
      return { state, actions: [] }
    }
    try {
      const step = testLocation() ? await simulateAt(state, now, at) : await registerAround(state, now, at)
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
  await stopPrecise()
  await mutate((state, now) => onDisable(state, now))
}

/** 지도 "근처 알림 영역 보기"(개발 도구)에 그릴 것. 등록 전이면 null. */
export interface NearbyOverlay {
  center: { lat: number; lng: number }
  reselectMeters: number
  /** 등록이 실패했으면 그 이유(원은 계획만 그린 것). */
  error?: string
  /** 테스트 위치 모드면 그 위치(빨간 점). */
  testLocation?: { lat: number; lng: number }
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
  return { center: lastSync.center, reselectMeters: lastSync.reselectMeters, regions, error, testLocation: testLocation() ?? undefined }
}

/**
 * 개발 도구 전용(`hongikon://dev/nearby?notifytest=1`): 로컬 알림 예약을 네 가지 모양으로 시험해 어느 것이 실패하는지 본다.
 * iOS 에서 근처 알림 예약이 "undefined reason" 으로 실패해(10-28) 원인을 좁히려는 것. 결과는 설정 상태 줄에 보인다.
 */
export async function runNotificationScheduleTest(): Promise<void> {
  if (!SHOW_DEVELOPER_TOOLS) return
  const tries: [string, Notifications.NotificationRequestInput][] = [
    ['즉시', { content: { title: '테스트', body: '즉시' }, trigger: null }],
    ['5초', { content: { title: '테스트', body: '5초' }, trigger: { type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL, seconds: 5 } }],
    [
      '문구+data',
      {
        content: { title: '시험 가게에 계신가요?', body: '제휴 혜택: 10%\n알림 끄기: 설정', data: { type: 'NEARBY_PARTNER', partnerId: 'x' } },
        trigger: { type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL, seconds: 6 },
      },
    ],
    ['간격10초', { content: { title: '테스트', body: '간격' }, trigger: triggerAfter(10) }],
    [
      '+id+channel',
      {
        identifier: 'nearby-test-probe',
        content: { title: '시험', body: '시험', data: { type: 'NEARBY_PARTNER', partnerId: 'x' } },
        trigger: { type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL, seconds: 7, channelId: NEARBY_CHANNEL_ID },
      },
    ],
  ]
  const results: string[] = []
  for (const [name, request] of tries) {
    try {
      await Notifications.scheduleNotificationAsync(request)
      results.push(`${name} OK`)
    } catch (error) {
      const e = error as { code?: string; message?: string }
      results.push(`${name} 실패(${e.code ?? ''} ${String(e.message ?? error).slice(0, 60)})`)
    }
  }
  lastScheduleNote = `시험: ${results.join(' / ')}`
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
