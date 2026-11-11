import { Alert, Linking, Platform } from 'react-native'
import { requireOptionalNativeModule } from 'expo'

/**
 * 위치 읽기(iOS·Android). 웹은 `platform.web.ts`. 플랫폼별 차이는 `docs/nearby-partner-alert-impl-plan.md` "플랫폼별 구성".
 *
 * 지금은 앱 안 "내 주변 제휴"(누를 때 위치를 한 번 읽기)만 쓴다. "앱 사용 중" 권한만 묻고, 읽은 좌표는 화면 계산에만 쓰고
 * 저장하거나 서버로 보내지 않는다. 백그라운드 근처 알림(지오펜스)은 아직 없다.
 *
 * 왜 `expo-location` 을 바로 import 하지 않나(`appleAuth.ts`·`haptics.ts` 와 같은 이유): 이미 깔린 앱은 OTA(runtimeVersion =
 * appVersion, 같은 1.0.0)로 새 JS 만 받는데, 그 바이너리에는 ExpoLocation 네이티브 모듈이 없다. 패키지는 불러오는 순간
 * `requireNativeModule('ExpoLocation')` 을 실행해 없으면 던지므로, 모듈이 있을 때만 `require` 한다. 없으면 기능이 안 보인다.
 */

type LocationPackage = typeof import('expo-location')

// undefined = 아직 찾아보지 않음, null = 없음(구버전 바이너리).
let cached: LocationPackage | null | undefined

function getPackage(): LocationPackage | null {
  if (cached !== undefined) return cached
  cached = null
  try {
    if (requireOptionalNativeModule('ExpoLocation')) {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      cached = require('expo-location') as LocationPackage
    }
  } catch {
    cached = null
  }
  return cached
}

export type LocateResult =
  | { status: 'ok'; lat: number; lng: number; /** 오차 반경(m). 모르면 null. */ accuracy: number | null }
  /** canAskAgain=false 면 다시 물어도 시스템 창이 안 뜬다 — 휴대폰 설정으로 보내야 한다. */
  | { status: 'denied'; canAskAgain: boolean }
  /** 휴대폰 위치 서비스 자체가 꺼짐. */
  | { status: 'servicesOff' }
  /** 시간 안에 위치를 못 얻음(실내 등). */
  | { status: 'failed' }
  /** 위치 정보 사용 안내(`confirmLocationDisclosure`)에서 "동의하지 않음". 권한 창을 띄우지 않았다 — 조용히 끝낸다. */
  | { status: 'declined' }

/**
 * 위치를 얻는 순서(2026-10-27 에뮬레이터 테스트로 정함):
 * 1. Wi-Fi·기지국 위치(Balanced) — 빠르고 실내에서도 된다. 5초.
 * 2. 최근 위치(2분 안, 오차 200m 안) — 다른 앱이 방금 위치를 썼으면 바로 나온다.
 * 3. GPS(High) — Wi-Fi·기지국 위치가 없을 때(비행기 모드, 위치 정확도 개선 끔, 에뮬레이터). 10초.
 * Balanced 하나만 쓰면 Wi-Fi·기지국 위치가 없는 기기에서 늘 "위치를 확인하지 못했어요"가 됐다.
 */
const NETWORK_TIMEOUT_MS = 5_000
const GPS_TIMEOUT_MS = 10_000
const LAST_KNOWN_MAX_AGE_MS = 2 * 60 * 1000
/** 최근 위치로 대신할 때 이보다 부정확하면 쓰지 않는다(m). */
const LAST_KNOWN_REQUIRED_ACCURACY_M = 200

/** 이 기기에서 위치를 읽을 수 있는지(네이티브 모듈이 있는 빌드인지). false 면 "내 주변 제휴"를 숨긴다. */
export function canLocate(): boolean {
  return getPackage() !== null
}

/** "설정 열기" 버튼을 보여도 되는지. 웹은 사이트 권한을 앱이 열 수 없어 false. */
export const CAN_OPEN_LOCATION_SETTINGS = true

export function openLocationSettings(): void {
  Linking.openSettings().catch(() => {})
}

/** 앱 안에서 휴대폰 위치 서비스를 켜는 창을 띄울 수 있는지. Android 만 된다(iOS 는 설정 앱에서만). */
export const CAN_TURN_ON_LOCATION_SERVICES = Platform.OS === 'android'

/** Android 시스템 "위치 사용" 창을 띄운다. 켰으면 true. */
export async function turnOnLocationServices(): Promise<boolean> {
  const Location = getPackage()
  if (!Location || !CAN_TURN_ON_LOCATION_SERVICES) return false
  try {
    await Location.enableNetworkProviderAsync()
    return await Location.hasServicesEnabledAsync()
  } catch {
    return false
  }
}

/** 설정 > 앱 권한, "내 주변 제휴"의 복귀 확인용. 모듈이 없는 빌드면 null. */
export interface LocationPermissionState {
  status: 'granted' | 'denied' | 'undetermined'
  canAskAgain: boolean
}

export async function getLocationPermission(): Promise<LocationPermissionState | null> {
  const Location = getPackage()
  if (!Location) return null
  try {
    const res = await Location.getForegroundPermissionsAsync()
    return { status: res.granted ? 'granted' : res.status === 'denied' ? 'denied' : 'undetermined', canAskAgain: res.canAskAgain }
  } catch {
    return null
  }
}

/** 위치를 쓰는 기능(안내 문구가 달라진다). */
export type LocationPurpose = 'nearby' | 'myLocation' | 'route' | 'settings'

const PURPOSE_TEXT: Record<LocationPurpose, string> = {
  nearby: '지금 있는 곳에서 가까운 제휴 가게를 보여 주기',
  myLocation: '지도에 내 위치를 보여 주기',
  route: '내 위치에서 출발하는 길을 안내하기',
  settings: '지도에 내 위치와 가까운 제휴 가게를 보여 주고 내 위치에서 출발하는 길을 안내하기',
}

/**
 * 위치 정보 사용 명시적 공개(11-11, Google Play 사용자 데이터 정책 — "앱의 모든 영역을 확인하세요"). 시스템 위치 권한 창을
 * 처음 띄우기 바로 앞에 무엇을(이 기기의 위치) 왜(기능별 목적) 언제(앱을 사용하는 동안) 쓰는지와 휴대폰 밖으로 보내지 않는다는
 * 것을 알리고 동의를 받는다. 이미 허용했거나 시스템 창이 다시 뜨지 않는 경우(다시 묻지 않음)에는 띄우지 않는다.
 * 근처 제휴 알림(백그라운드 위치)은 따로 전체 화면 안내를 쓴다(`NearbyAlertSettings` AlwaysAllowOverlay).
 * 길찾기 '내 위치 출발'도 위치를 보내지 않는다(`apis/routes.ts` — 길 후보를 받아 휴대폰에서 고른다).
 */
export async function confirmLocationDisclosure(purpose: LocationPurpose): Promise<boolean> {
  const Location = getPackage()
  if (!Location) return true
  try {
    const current = await Location.getForegroundPermissionsAsync()
    if (current.granted || !current.canAskAgain) return true
  } catch {
    return true
  }
  return new Promise((resolve) => {
    Alert.alert(
      '위치 정보 사용 안내',
      `홍익온은 ${PURPOSE_TEXT[purpose]} 위해 이 기기의 위치 정보(정확한 위치)에 액세스합니다.\n\n` +
        '앱을 사용하는 동안에만 쓰고, 위치는 휴대폰 안에서만 처리해 서버나 다른 회사로 보내거나 저장하지 않아요. ' +
        '동의하면 휴대폰의 위치 권한 창이 떠요.',
      [
        { text: '동의하지 않음', style: 'cancel', onPress: () => resolve(false) },
        { text: '동의하고 계속', onPress: () => resolve(true) },
      ],
      { cancelable: true, onDismiss: () => resolve(false) },
    )
  })
}

export async function requestLocationPermission(purpose: LocationPurpose = 'settings'): Promise<LocationPermissionState | null> {
  const Location = getPackage()
  if (!Location) return null
  if (!(await confirmLocationDisclosure(purpose))) return getLocationPermission()
  try {
    const res = await Location.requestForegroundPermissionsAsync()
    return { status: res.granted ? 'granted' : res.status === 'denied' ? 'denied' : 'undetermined', canAskAgain: res.canAskAgain }
  } catch {
    return getLocationPermission()
  }
}

function timeout(ms: number): Promise<null> {
  return new Promise((resolve) => setTimeout(() => resolve(null), ms))
}

/** 실패 이유는 개발 빌드에서만 남긴다. 좌표는 남기지 않는다. */
function logFailure(step: string, error: unknown): null {
  if (__DEV__) console.warn(`[nearbyPartners] ${step} 실패:`, error instanceof Error ? error.message : error)
  return null
}

/** "앱 사용 중" 위치 권한을 (필요하면 위치 정보 사용 안내 뒤에) 묻고 위치를 한 번 읽는다. */
export async function locateOnce(purpose: LocationPurpose): Promise<LocateResult> {
  const Location = getPackage()
  if (!Location) return { status: 'failed' }
  if (!(await confirmLocationDisclosure(purpose))) return { status: 'declined' }

  try {
    const permission = await Location.requestForegroundPermissionsAsync()
    if (!permission.granted) return { status: 'denied', canAskAgain: permission.canAskAgain }
    if (!(await Location.hasServicesEnabledAsync())) return { status: 'servicesOff' }

    // mayShowUserSettingsDialog: Android 의 "위치 정확도 개선을 켜세요" 창을 띄우지 않는다. 500m 목록에 필요 없는 방해이고,
    // 거기서 "괜찮습니다"를 누르면 위치 요청이 통째로 실패했다(10-27 에뮬레이터).
    const read = (accuracy: number, ms: number, step: string) =>
      Promise.race([
        Location.getCurrentPositionAsync({ accuracy, mayShowUserSettingsDialog: false }).catch((e) => logFailure(step, e)),
        timeout(ms),
      ])

    const position =
      (await read(Location.Accuracy.Balanced, NETWORK_TIMEOUT_MS, 'Wi-Fi·기지국 위치')) ??
      (await Location.getLastKnownPositionAsync({
        maxAge: LAST_KNOWN_MAX_AGE_MS,
        requiredAccuracy: LAST_KNOWN_REQUIRED_ACCURACY_M,
      }).catch((e) => logFailure('최근 위치', e))) ??
      (await read(Location.Accuracy.High, GPS_TIMEOUT_MS, 'GPS'))
    if (!position) return { status: 'failed' }
    return {
      status: 'ok',
      lat: position.coords.latitude,
      lng: position.coords.longitude,
      accuracy: position.coords.accuracy ?? null,
    }
  } catch (error) {
    logFailure('위치 확인', error)
    return { status: 'failed' }
  }
}

/** 내 위치 한 점. 좌표는 화면 계산에만 쓰고 저장하거나 서버로 보내지 않는다. */
export interface LivePosition {
  lat: number
  lng: number
  /** 오차 반경(m). 모르면 null. */
  accuracy: number | null
}

/**
 * 길찾기 화면을 보는 동안 위치를 계속 읽는다(11-03). "앱 사용 중" 권한이 이미 있을 때만 시작하고, 권한 창은 띄우지 않는다
 * (권한은 사용자가 출발지 "내 위치"를 고를 때 `requestLocationPermission` 으로 묻는다). 돌려준 함수를 부르면 멈춘다.
 * 위치 모듈이 없는 예전 빌드·권한 없음이면 아무것도 하지 않고 빈 함수를 돌려준다.
 */
export async function watchLocation(onUpdate: (position: LivePosition) => void): Promise<() => void> {
  const Location = getPackage()
  if (!Location) return () => {}
  try {
    const permission = await Location.getForegroundPermissionsAsync()
    if (!permission.granted) return () => {}
    const subscription = await Location.watchPositionAsync(
      { accuracy: Location.Accuracy.BestForNavigation, distanceInterval: 2, timeInterval: 1000, mayShowUserSettingsDialog: false },
      (position) =>
        onUpdate({ lat: position.coords.latitude, lng: position.coords.longitude, accuracy: position.coords.accuracy ?? null }),
    )
    return () => subscription.remove()
  } catch (error) {
    logFailure('위치 계속 읽기', error)
    return () => {}
  }
}
