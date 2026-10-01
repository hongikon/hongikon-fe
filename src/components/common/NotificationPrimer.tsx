import { useEffect, useRef } from 'react'
import { Platform } from 'react-native'
import AsyncStorage from '@react-native-async-storage/async-storage'
import {
  refreshNotificationPermission,
  requestNotificationPermission,
} from '../../lib/notificationPermission'

/** 최초 실행 때 한 번 물었는지. 한 번 물은 뒤엔 다시 자동으로 띄우지 않는다(설정 화면에서 켤 수 있다). */
const ASKED_KEY = '@hongikon_notification_permission_asked'

/** 스플래시가 내려가고 첫 화면이 보인 뒤에 띄우려고 잠깐 기다린다. */
const FIRST_LAUNCH_DELAY_MS = 800

/**
 * 앱을 처음 켰을 때 시스템 알림 허용 창을 띄운다(iOS·Android, 로그인 여부와 무관).
 * 허용되면 로그인한 뒤 기기 등록이 바로 이어진다(usePushNotifications 는 권한이 허용된 뒤에만 등록한다).
 * 거절하면 설정 > 알림에서 "설정 열기"로 되돌릴 수 있다. 화면에는 아무것도 그리지 않는다.
 */
export default function NotificationPrimer() {
  const startedRef = useRef(false)

  useEffect(() => {
    if (Platform.OS === 'web' || startedRef.current) return
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
  }, [])

  return null
}
