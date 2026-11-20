import type { NotificationPermission } from '../../lib/notificationPermission'
import type { LocationPermissionState } from '../../lib/nearbyPartners/platform'
import { MY_LOCATION_BUTTON_FROM } from '../../constants/route'

/** 화면에 보여줄 권한 상태. 알림·사진을 같은 모양으로 맞춘다. */
export type PermissionView =
  | { kind: 'loading' }
  | { kind: 'granted'; limited?: boolean }
  | { kind: 'undetermined'; canAskAgain: boolean }
  | { kind: 'denied'; canAskAgain: boolean }
  /** 이 기기에선 권한 없이 동작한다(Android 사진 선택기). */
  | { kind: 'notNeeded' }

/** expo-image-picker 의 권한 응답 중 여기서 쓰는 부분. */
interface PickerPermissionResponse {
  granted: boolean
  status: string
  canAskAgain: boolean
}

export function fromNotification(p: NotificationPermission): PermissionView {
  if (p.status === 'unknown' || p.status === 'unsupported') return { kind: 'loading' }
  if (p.status === 'granted') return { kind: 'granted' }
  return { kind: p.status, canAskAgain: p.canAskAgain }
}

export function fromCamera(res: PickerPermissionResponse): PermissionView {
  if (res.granted) return { kind: 'granted' }
  return { kind: res.status === 'denied' ? 'denied' : 'undetermined', canAskAgain: res.canAskAgain }
}

export function fromMedia(res: PickerPermissionResponse & { accessPrivileges?: string }): PermissionView {
  if (res.granted) return { kind: 'granted', limited: res.accessPrivileges === 'limited' }
  return { kind: res.status === 'denied' ? 'denied' : 'undetermined', canAskAgain: res.canAskAgain }
}

export function fromLocation(res: LocationPermissionState | null): PermissionView {
  if (!res) return { kind: 'loading' }
  if (res.status === 'granted') return { kind: 'granted' }
  return { kind: res.status, canAskAgain: res.canAskAgain }
}

export type PillKey = 'granted' | 'limited' | 'denied' | 'undetermined' | 'loading' | 'notNeeded'

/** 상태 알약 종류. 일부만 허용한 사진은 '일부 허용'. */
export function pillKey(state: PermissionView): PillKey {
  if (state.kind === 'granted') return state.limited ? 'limited' : 'granted'
  return state.kind
}

/** 아직 물을 수 있으면 '허용하기', 다시 물을 수 없으면 '설정 열기'. */
export function permissionActions(state: PermissionView): { canAsk: boolean; blocked: boolean } {
  const pending = state.kind === 'undetermined' || state.kind === 'denied'
  return { canAsk: pending && state.canAskAgain, blocked: pending && !state.canAskAgain }
}

/** 위치를 지도에 보여 주는 때. 지도 "내 위치 켜기"는 처리방침 11-16판 적용일부터 보인다(MapScreen 과 같은 날짜). `today`: KST YYYY-MM-DD. */
export function mapLocationUse(today: string): string {
  return today >= MY_LOCATION_BUTTON_FROM
    ? '길찾기 화면을 보는 동안이나 지도에서 "내 위치 켜기"를 켜 둔 동안 지도에 내 위치(와 경로)를 보여 줘요.'
    : '길찾기 화면을 보는 동안 지도에 내 위치와 경로를 보여 줘요.'
}

/** 위치 줄 설명. 근처 알림 빌드면 "항상" 위치를 쓰는 경우까지 적는다. */
export function locationPurpose(nearbyBuild: boolean, mapUse: string): string {
  return nearbyBuild
    ? `(선택) 지도 검색의 '내 주변 제휴 보기'를 누를 때 가까운 제휴 업체를 보여 주고, ${mapUse} 근처 제휴 알림을 켰다면 앱을 닫아 둬도("항상") 제휴 가게에 머무는지 확인해요. 위치는 휴대폰 안에서만 쓰고 서버로 보내거나 저장하지 않아요`
    : `(선택) 지도 검색의 '내 주변 제휴 보기'를 누를 때 가까운 제휴 업체를 보여 주고, ${mapUse} 저장하거나 서버로 보내지 않아요`
}

/**
 * 맨 아래 "쓰지 않는 권한" 안내. 근처 알림 빌드는 알림을 켜면 "항상" 위치를 쓴다 —
 * 그때는 "백그라운드 위치를 안 쓴다"고 하지 않는다(11-03).
 */
export function unusedPermissionsCopy(hasLocation: boolean, nearbyBuild: boolean): { title: string; text: string } {
  if (hasLocation && nearbyBuild) {
    return {
      title: '마이크·연락처는 사용하지 않아요',
      text: '앱을 쓰지 않을 때의 위치는 근처 제휴 알림을 직접 켠 경우에만 휴대폰 안에서 써요. 마이크, 연락처, Face ID 같은 권한은 요청하지 않아요. 제보 위치는 지도에서 직접 고른 곳만 써요.',
    }
  }
  if (hasLocation) {
    return {
      title: '백그라운드 위치·마이크·연락처는 사용하지 않아요',
      text: '앱을 쓰지 않을 때의 위치, 마이크, 연락처, Face ID 같은 권한은 요청하지 않아요. 제보 위치는 지도에서 직접 고른 곳만 써요.',
    }
  }
  return {
    title: '위치(GPS)·마이크·연락처는 사용하지 않아요',
    text: '기기 위치, 마이크, 연락처, Face ID 같은 권한은 요청하지 않아요. 제보 위치는 지도에서 직접 고른 곳만 써요.',
  }
}
