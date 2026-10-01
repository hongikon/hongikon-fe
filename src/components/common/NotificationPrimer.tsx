import { useEffect, useRef } from 'react'
import { Platform } from 'react-native'
import AsyncStorage from '@react-native-async-storage/async-storage'
import {
  refreshNotificationPermission,
  requestNotificationPermission,
} from '../../lib/notificationPermission'
import { useOnboardingDone } from '../../lib/onboarding'

/** 최초 실행 때 한 번 물었는지. 한 번 물은 뒤엔 다시 자동으로 띄우지 않는다(설정 화면에서 켤 수 있다). */
const ASKED_KEY = '@hongikon_notification_permission_asked'

/**
 * 첫 실행 온보딩의 알림 단계가 화면에 나오면 부른다. 그 단계가 허용 창을 맡으므로
 * 온보딩이 끝난 뒤 NotificationPrimer 가 같은 걸 또 묻지 않게 물었다고 기록해 둔다.
 */
export async function markNotificationPermissionAsked(): Promise<void> {
  try {
    await AsyncStorage.setItem(ASKED_KEY, '1')
  } catch {
    // 못 남겨도 NotificationPrimer 는 권한이 이미 정해졌으면(허용·거절) 묻지 않는다.
  }
}

/** 스플래시가 내려가고 첫 화면이 보인 뒤에 띄우려고 잠깐 기다린다. */
const FIRST_LAUNCH_DELAY_MS = 800

/**
 * 앱을 처음 켰을 때 시스템 알림 허용 창을 띄운다(iOS·Android, 로그인 여부와 무관).
 * 처음 설치한 사용자는 온보딩의 알림 단계가 먼저 묻는다 — 그래서 온보딩이 끝날 때까지 기다렸다가,
 * 온보딩이 남긴 기록(ASKED_KEY)을 보고 그냥 넘어간다. 온보딩 없이 들어온 예전 사용자에게만 실제로 띄운다.
 * 허용되면 로그인한 뒤 기기 등록이 바로 이어진다(usePushNotifications 는 권한이 허용된 뒤에만 등록한다).
 * 거절하면 설정 > 알림에서 "설정 열기"로 되돌릴 수 있다. 화면에는 아무것도 그리지 않는다.
 */
export default function NotificationPrimer() {
  const startedRef = useRef(false)
  const onboardingDone = useOnboardingDone()

  useEffect(() => {
    if (Platform.OS === 'web' || !onboardingDone || startedRef.current) return
    startedRef.current = true

    let cancelled = false
    const timer = setTimeout(async () => {
      try {
        if ((await AsyncStorage.getItem(ASKED_KEY)) === '1' || cancelled) return
        const permission = await refreshNotificationPermission()
        // 이미 허용했거나(다른 경로로) 더는 물을 수 없으면 묻지 않고 기록만 남긴다.
        if (permission.status === 'undetermined' && permission.canAskAgain && !cancelled) {
          await requestNotificationPermission()
        }
        await AsyncStorage.setItem(ASKED_KEY, '1')
      } catch {
        // 저장소·권한 조회 실패는 무시한다 — 다음 실행 때 다시 시도된다.
      }
    }, FIRST_LAUNCH_DELAY_MS)

    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [onboardingDone])

  return null
}
