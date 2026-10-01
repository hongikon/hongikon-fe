import { useEffect, useSyncExternalStore } from 'react'
import { AppState, Platform } from 'react-native'
import * as Notifications from 'expo-notifications'

/**
 * 휴대폰(iOS·Android)의 알림 권한 상태를 앱 전체가 함께 본다.
 * - 시스템 허용 창은 앱이 이유를 먼저 설명한 뒤(NotificationPrimer, 설정 화면) 사용자가 누를 때만 띄운다.
 *   예전엔 로그인 직후 설명 없이 바로 띄워 거절되기 쉬웠고, 한 번 거절하면 iOS 는 다시 묻지 않는다.
 * - 거절된 뒤(canAskAgain=false)에는 휴대폰 설정 화면으로 보내는 길만 남는다.
 * 웹은 원격 푸시가 없어 'unsupported'.
 */
export type NotificationPermission =
  | { status: 'unknown' }
  | { status: 'unsupported' }
  | { status: 'granted' }
  | { status: 'undetermined' | 'denied'; canAskAgain: boolean }

let current: NotificationPermission =
  Platform.OS === 'web' ? { status: 'unsupported' } : { status: 'unknown' }
const listeners = new Set<() => void>()

function set(next: NotificationPermission): void {
  current = next
  listeners.forEach((listener) => listener())
}

function fromResponse(res: Notifications.NotificationPermissionsStatus): NotificationPermission {
  if (res.status === 'granted') return { status: 'granted' }
  return { status: res.status === 'denied' ? 'denied' : 'undetermined', canAskAgain: res.canAskAgain }
}

export async function refreshNotificationPermission(): Promise<NotificationPermission> {
  if (Platform.OS === 'web') return current
  try {
    set(fromResponse(await Notifications.getPermissionsAsync()))
  } catch {
    // 읽지 못하면 이전 값을 유지한다.
  }
  return current
}

/** 시스템 허용 창을 띄운다(물을 수 있을 때만). 결과 상태를 돌려준다. */
export async function requestNotificationPermission(): Promise<NotificationPermission> {
  if (Platform.OS === 'web') return current
  try {
    set(fromResponse(await Notifications.requestPermissionsAsync()))
  } catch {
    await refreshNotificationPermission()
  }
  return current
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

/**
 * 현재 권한 상태. 처음 쓸 때와 앱이 앞으로 돌아올 때(사용자가 휴대폰 설정에서 바꾸고 왔을 수 있다) 다시 읽는다.
 */
export function useNotificationPermission(): NotificationPermission {
  const permission = useSyncExternalStore(subscribe, () => current, () => current)

  useEffect(() => {
    if (Platform.OS === 'web') return
    void refreshNotificationPermission()
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') void refreshNotificationPermission()
    })
    return () => sub.remove()
  }, [])

  return permission
}
