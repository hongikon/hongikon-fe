import { useEffect, useRef } from 'react'
import { Platform } from 'react-native'
import * as Notifications from 'expo-notifications'
import Constants from 'expo-constants'
import { navigationRef } from '../navigation/navigationRef'
import { registerDevice } from '../apis/devices'
import { NEWS_BY_ID } from '../constants/news'
import { useAuth } from '../contexts/AuthContext'
import type { PushNotificationData } from '../types'

/** 앱이 켜져 있을 때 알림을 어떻게 보여줄지. 배너·목록엔 띄우되 배지·소리는 안 쓴다. */
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
})

/**
 * 알림을 탭했을 때 이동할 화면을 정한다.
 * NEWS는 상세 화면으로, REPORT는 지도 탭(기본 탭)으로 보낸다 — 좌표로 지도를
 * 자동 포커스하는 기능은 MapScreen이 아직 알림발 좌표를 받을 방법이 없어 후속 작업으로 남긴다.
 */
function routeForNotification(data: PushNotificationData): void {
  if (!navigationRef.isReady()) return

  if (data.type === 'NEWS') {
    const item = NEWS_BY_ID.get(data.newsId)
    if (!item) return
    navigationRef.navigate('NewsDetail', { item })
    return
  }

  navigationRef.navigate('Main')
}

async function getExpoPushToken(): Promise<string | null> {
  const projectId = Constants.expoConfig?.extra?.eas?.projectId
  if (!projectId) return null

  try {
    const { data } = await Notifications.getExpoPushTokenAsync({ projectId })
    return data
  } catch (error) {
    console.warn('푸시 토큰을 가져오지 못했습니다:', error)
    return null
  }
}

/**
 * 권한 요청 → Expo 푸시 토큰 발급 → 로그인 상태면 서버에 등록(`POST /users/me/devices`)까지
 * 처리한다. 기기 등록 API는 로그인을 요구해(`UserDeviceController`) 게스트는 건너뛴다.
 * 웹은 원격 푸시를 지원하지 않아 바로 종료한다.
 *
 * `App.tsx`에서 `NavigationContainer` 안(한 번만) 호출한다.
 */
export function usePushNotifications(): void {
  const { accessToken } = useAuth()
  const registeredTokenRef = useRef<string | null>(null)

  useEffect(() => {
    const subscription = Notifications.addNotificationResponseReceivedListener((response) => {
      routeForNotification(response.notification.request.content.data as PushNotificationData)
    })
    return () => subscription.remove()
  }, [])

  useEffect(() => {
    if (Platform.OS === 'web' || !accessToken) return

    let cancelled = false
    ;(async () => {
      const { status: current } = await Notifications.getPermissionsAsync()
      const status =
        current === 'granted' ? current : (await Notifications.requestPermissionsAsync()).status
      if (status !== 'granted' || cancelled) return

      const token = await getExpoPushToken()
      if (!token || cancelled || registeredTokenRef.current === token) return

      try {
        await registerDevice(
          token,
          'EXPO',
          Platform.OS === 'ios' ? 'IOS' : 'ANDROID',
          accessToken,
        )
        registeredTokenRef.current = token
      } catch (error) {
        console.warn('기기를 서버에 등록하지 못했습니다:', error)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [accessToken])
}
