import AsyncStorage from '@react-native-async-storage/async-storage'
import Constants from 'expo-constants'
import { SHOW_DEVELOPER_TOOLS as APP_DEVELOPER_TOOLS } from '../appVariant'
import { ALERT_RADIUS_METERS } from './rules'

/**
 * 근처 알림 개발용 조절값(개발·테스트 빌드만, 운영 빌드에서는 늘 기본값).
 * - 시계: 밤 9시~아침 8시는 알림을 보내지 않아, 밤에 시뮬레이터로 확인하려면 앱이 보는 "지금"을 옮겨야 한다.
 *   iOS 시뮬레이터는 맥의 시계를 그대로 써서 기기 시간만 바꿀 수 없다.
 * - 반경: 반경별 오탐을 비교할 때 빌드를 다시 하지 않고 바꾼다.
 * 링크 `hongikon://dev/nearby?clock=12:00&radius=75`(시계는 한국 시간, `clock=off`·`radius=off` 로 되돌림)로 바꾼다.
 */

/**
 * 근처 알림 현장 테스트 빌드(TestFlight 내부, `NEARBY_FIELD_TEST=1`). 서버 표시 없이 혜택 있는 업체 전부를 대상으로 보고,
 * 서버 긴급 스위치·동의 저장을 건너뛴다(동의는 기기에만). 외부 배포 빌드에서는 늘 false.
 */
export const NEARBY_FIELD_TEST: boolean = Constants.expoConfig?.extra?.nearbyFieldTest === true

/** 근처 알림 개발 도구(시계·반경 링크, 설정 상태 줄, 지도 영역 보기)를 열지. 개발·테스트 빌드 또는 현장 테스트 빌드. */
export const SHOW_DEVELOPER_TOOLS: boolean = APP_DEVELOPER_TOOLS || NEARBY_FIELD_TEST

/**
 * 근처 알림 확인 도구를 쓸 수 있는지: 테스트 빌드이거나, 운영 앱에서 관리자 계정으로 로그인했을 때(11-10 사용자 요청 —
 * 운영 앱에서도 관리자는 알림 영역·판단 기록을 보고 시험할 수 있게). 관리자 여부는 화면 쪽이 `setNearbyAdmin` 으로 알려 주고
 * 기기에 저장한다(앱이 꺼진 채 깨어난 백그라운드 작업도 알 수 있게). 일반 사용자는 늘 false.
 */
export function nearbyDevTools(): boolean {
  return SHOW_DEVELOPER_TOOLS || values.admin === true
}

/** 운영 앱의 관리자 계정인지(테스트 빌드는 관리자가 아니어도 이미 도구가 열려 있다). */
export function nearbyAdminTools(): boolean {
  return !SHOW_DEVELOPER_TOOLS && values.admin === true
}

const KEY = 'hongikon_nearby_debug_v1'
const KST_OFFSET_MS = 9 * 60 * 60 * 1000
const DAY_MS = 24 * 60 * 60 * 1000

interface DebugValues {
  clockOffsetMs: number
  radiusMeters: number | null
  /** 테스트 위치(지도에서 직접 고른 곳). 있으면 근처 알림이 실제 GPS 대신 이 위치로 판단한다. */
  testLocation: { lat: number; lng: number } | null
  /**
   * 횟수·간격 제한 없이 머무는 동안 5분마다 알릴지. 현장 테스트 앱은 기본 true(끄면 운영 규칙), 관리자 계정은 기본 false(켜면 테스트 모드).
   */
  unlimited?: boolean
  /** 로그인한 계정이 관리자인지(`setNearbyAdmin`). 로그아웃하면 false. */
  admin?: boolean
}

let values: DebugValues = { clockOffsetMs: 0, radiusMeters: null, testLocation: null }
let loaded = false

export async function loadNearbyDebug(): Promise<void> {
  // 운영 앱도 관리자 표시를 읽어야 해서 늘 읽는다(작은 값 하나).
  if (loaded) return
  loaded = true
  try {
    const raw = await AsyncStorage.getItem(KEY)
    if (raw) values = { ...values, ...(JSON.parse(raw) as Partial<DebugValues>) }
  } catch {
    // 못 읽으면 기본값.
  }
}

/** 근처 알림이 보는 "지금"(ms). 운영 빌드에서는 Date.now(). */
export function nearbyNow(): number {
  return Date.now() + (nearbyDevTools() ? values.clockOffsetMs : 0)
}

/** 근처 알림 시각(nearbyNow 기준)을 실제 시각으로 — 알림 예약은 실제 시계로 한다. */
export function toRealTime(nearbyMs: number): number {
  return nearbyMs - (nearbyDevTools() ? values.clockOffsetMs : 0)
}

/** 개발 도구에서 고른 테스트 위치(없으면 null). 운영 빌드에서는 늘 null. */
export function testLocation(): { lat: number; lng: number } | null {
  return nearbyDevTools() ? values.testLocation : null
}

export async function setTestLocation(location: { lat: number; lng: number } | null): Promise<void> {
  if (!nearbyDevTools()) return
  values = { ...values, testLocation: location }
  try {
    await AsyncStorage.setItem(KEY, JSON.stringify(values))
  } catch {
    // 저장 못 해도 이번 실행에는 적용된다.
  }
}

/** 알림 반경(m). 테스트 빌드에서 고른 값이 있으면 그것, 없으면 `ALERT_RADIUS_METERS`. */
export function partnerRadiusMeters(): number {
  return (nearbyDevTools() && values.radiusMeters) || ALERT_RADIUS_METERS
}

/** 테스트 빌드 설정 화면에서 고른 업체 반경(null 이면 기본값). 바꾼 뒤 `syncNearbyAlerts` 로 다시 등록해야 적용된다. */
export async function setPartnerRadius(meters: number | null): Promise<void> {
  if (!nearbyDevTools()) return
  values = { ...values, radiusMeters: meters }
  try {
    await AsyncStorage.setItem(KEY, JSON.stringify(values))
  } catch {
    // 저장 못 해도 이번 실행에는 적용된다.
  }
}

/** 횟수 제한 없이 알릴지(테스트 모드). 현장 테스트 앱은 기본 켜짐, 관리자 계정은 켰을 때만. 그 밖에는 늘 false. */
export function fieldTestUnlimited(): boolean {
  if (NEARBY_FIELD_TEST) return values.unlimited !== false
  return values.admin === true && values.unlimited === true
}

/** 바꾼 뒤 `syncNearbyAlerts` 로 다시 맞춰야 적용된다. */
export async function setFieldTestUnlimited(on: boolean): Promise<void> {
  if (!NEARBY_FIELD_TEST && values.admin !== true) return
  values = { ...values, unlimited: on }
  try {
    await AsyncStorage.setItem(KEY, JSON.stringify(values))
  } catch {
    // 저장 못 해도 이번 실행에는 적용된다.
  }
}

/**
 * 로그인한 계정이 관리자인지 알려 준다(AdminAccess 의 `useIsAdmin`). 관리자가 아니게 되면 테스트 모드·시험 위치·반경도 되돌린다.
 */
export async function setNearbyAdmin(admin: boolean): Promise<void> {
  await loadNearbyDebug()
  if ((values.admin === true) === admin) return
  values = admin
    ? { ...values, admin: true }
    : SHOW_DEVELOPER_TOOLS
      ? { ...values, admin: false }
      : { clockOffsetMs: 0, radiusMeters: null, testLocation: null, admin: false }
  try {
    await AsyncStorage.setItem(KEY, JSON.stringify(values))
  } catch {
    // 저장 못 해도 이번 실행에는 적용된다.
  }
}

/** `hongikon://dev/nearby?...` 이면 값을 바꾸고 true. 운영 빌드·다른 링크는 false. */
export async function applyNearbyDebugUrl(url: string): Promise<boolean> {
  if (!nearbyDevTools() || !/^hongikon:\/\/dev\/nearby\b/.test(url)) return false
  const params = new URLSearchParams(url.split('?')[1] ?? '')
  const clock = params.get('clock')
  if (clock === 'off') values.clockOffsetMs = 0
  else if (clock && /^\d{1,2}:\d{2}$/.test(clock)) {
    const [hh, mm] = clock.split(':').map(Number)
    const now = Date.now()
    const dayStart = Math.floor((now + KST_OFFSET_MS) / DAY_MS) * DAY_MS - KST_OFFSET_MS
    values.clockOffsetMs = dayStart + (hh * 60 + mm) * 60_000 - now
  }
  const radius = params.get('radius')
  if (radius === 'off') values.radiusMeters = null
  else if (radius && /^\d{2,3}$/.test(radius)) values.radiusMeters = Number(radius)
  try {
    await AsyncStorage.setItem(KEY, JSON.stringify(values))
  } catch {
    // 저장 못 해도 이번 실행에는 적용된다.
  }
  return true
}
