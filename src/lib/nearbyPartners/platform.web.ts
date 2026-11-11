/**
 * 위치 읽기(웹, hongikon.com). iOS·Android 는 `platform.ts` — 내보내는 이름과 모양이 같아야 한다.
 *
 * 브라우저는 페이지가 닫힌 뒤 위치 경계를 감시할 수 없어 웹에는 근처 알림이 없고, "내 주변 제휴"를 누를 때만
 * 브라우저 위치를 한 번 읽는다. 저장하거나 서버로 보내지 않는다. `expo-location` 을 쓰지 않아 웹 번들에 들어가지 않는다.
 */

import type { LocateResult, LocationPermissionState, LocationPurpose } from './platform'

export type { LocateResult, LocationPermissionState, LocationPurpose }

/** 웹은 브라우저가 사이트 위치 권한 창을 띄운다(앱이 앞에 안내를 둘 수 없는 시스템 창이 아니다). */
export async function confirmLocationDisclosure(_purpose: LocationPurpose): Promise<boolean> {
  return true
}

/** 웹은 휴대폰 위치 서비스를 켤 수 없다. */
export const CAN_TURN_ON_LOCATION_SERVICES = false

export async function turnOnLocationServices(): Promise<boolean> {
  return false
}

/** 웹은 버튼을 누를 때 브라우저가 묻는다. 설정 > 앱 권한에는 위치 줄을 그리지 않으므로 상태를 따로 읽지 않는다. */
export async function getLocationPermission(): Promise<LocationPermissionState | null> {
  return null
}

export async function requestLocationPermission(_purpose?: LocationPurpose): Promise<LocationPermissionState | null> {
  return null
}

const LOCATE_TIMEOUT_MS = 10_000
const MAX_AGE_MS = 2 * 60 * 1000

/** 브라우저 위치는 HTTPS(또는 localhost)에서만 된다. */
export function canLocate(): boolean {
  return (
    typeof navigator !== 'undefined' &&
    !!navigator.geolocation &&
    (typeof window === 'undefined' || window.isSecureContext !== false)
  )
}

/** 사이트 위치 권한은 브라우저 주소창에서만 바꿀 수 있어 앱이 열어 줄 수 없다. */
export const CAN_OPEN_LOCATION_SETTINGS = false

export function openLocationSettings(): void {}

export function locateOnce(_purpose: LocationPurpose): Promise<LocateResult> {
  if (!canLocate()) return Promise.resolve({ status: 'failed' })
  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (position) =>
        resolve({
          status: 'ok',
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          accuracy: Number.isFinite(position.coords.accuracy) ? position.coords.accuracy : null,
        }),
      (error) => {
        // 1 PERMISSION_DENIED: 한 번 막으면 브라우저가 다시 묻지 않는다.
        if (error.code === 1) resolve({ status: 'denied', canAskAgain: false })
        else resolve({ status: 'failed' })
      },
      { enableHighAccuracy: false, timeout: LOCATE_TIMEOUT_MS, maximumAge: MAX_AGE_MS },
    )
  })
}

/** 내 위치 한 점. 좌표는 화면 계산에만 쓰고 저장하거나 서버로 보내지 않는다. */
export interface LivePosition {
  lat: number
  lng: number
  accuracy: number | null
}

/**
 * 길찾기 화면을 보는 동안 위치를 계속 읽는다(platform.ts 와 같음). 브라우저가 이미 위치를 허용한 경우에만 시작해 권한 창을 새로 띄우지 않는다.
 * 허용 여부를 알 수 없는 브라우저(Permissions API 없음)에서는 시작하지 않는다.
 */
export async function watchLocation(onUpdate: (position: LivePosition) => void): Promise<() => void> {
  if (!canLocate()) return () => {}
  try {
    const status = await navigator.permissions?.query({ name: 'geolocation' as PermissionName })
    if (status?.state !== 'granted') return () => {}
  } catch {
    return () => {}
  }
  const id = navigator.geolocation.watchPosition(
    (position) =>
      onUpdate({
        lat: position.coords.latitude,
        lng: position.coords.longitude,
        accuracy: Number.isFinite(position.coords.accuracy) ? position.coords.accuracy : null,
      }),
    () => {},
    { enableHighAccuracy: true, maximumAge: 2000 },
  )
  return () => navigator.geolocation.clearWatch(id)
}
