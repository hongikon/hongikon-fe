import { useEffect, useRef, useState } from 'react'
import { AppState, Platform } from 'react-native'
import * as Notifications from 'expo-notifications'
import Constants from 'expo-constants'
import { navigationRef } from '../navigation/navigationRef'
import { registerDevice } from '../apis/devices'
import { isRetryableError } from '../apis/client'
import { useReconnect } from './connectivity'
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
 * 아직 처리하지 못한 알림 탭. 앱이 꺼진 상태에서 알림으로 켜지면(콜드 스타트) 내비게이션이
 * 준비되기 전이거나 웰컴 화면(로그인 전 — 상세 화면이 아직 없음)이라 바로 이동할 수 없다.
 * 여기 두었다가 이동할 수 있게 되는 순간(내비게이션 준비, 둘러보기/로그인 완료) 처리한다.
 */
let pendingNotification: PushNotificationData | null = null
/** 같은 알림을 두 번 처리하지 않게(콜드 스타트 조회와 탭 리스너가 같은 알림을 함께 줄 수 있다). */
let lastHandledNotificationId: string | null = null

function canRouteTo(routeName: 'NewsDetail' | 'Main'): boolean {
  if (!navigationRef.isReady()) return false
  const routeNames = navigationRef.getRootState()?.routeNames ?? []
  return routeNames.includes(routeName)
}

function handleNotificationResponse(response: Notifications.NotificationResponse | null): void {
  if (!response) return
  const id = response.notification.request.identifier
  if (id === lastHandledNotificationId) return
  lastHandledNotificationId = id
  pendingNotification = (response.notification.request.content.data ?? null) as PushNotificationData | null
  flushPendingNotification()
}

/** 보관해 둔 알림 탭이 있고 지금 이동할 수 있으면 이동한다. */
function flushPendingNotification(): void {
  const data = pendingNotification
  if (!data) return
  const target = data.type === 'NEWS' ? 'NewsDetail' : 'Main'
  if (!canRouteTo(target)) return
  pendingNotification = null
  routeForNotification(data)
}

/**
 * 알림을 탭했을 때 이동할 화면을 정한다.
 * NEWS는 상세 화면(id로 상세 API 조회)으로, REPORT는 지도 탭(기본 탭)으로 보낸다 — 좌표로 지도를
 * 자동 포커스하는 기능은 MapScreen이 아직 알림발 좌표를 받을 방법이 없어 후속 작업으로 남긴다.
 */
function routeForNotification(data: PushNotificationData): void {
  if (!navigationRef.isReady()) return

  if (data.type === 'NEWS') {
    // 목록(`GET /news`)이 페이지 단위라 id로 항목을 찾을 수 없다 — id만 넘기면 상세 화면이
    // `GET /news/{id}`로 받아 그린다. 백엔드(NewsPushDispatcher)는 newsId 를 숫자로 보낸다.
    const newsId = String(data.newsId ?? '').trim()
    if (!/^\d+$/.test(newsId)) return
    navigationRef.navigate('NewsDetail', { newsId })
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
    if (__DEV__) console.warn('푸시 토큰을 가져오지 못했습니다:', error)
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
  const { accessToken, status } = useAuth()
  const registeredTokenRef = useRef<string | null>(null)
  /**
   * 기기 등록이 연결 문제로 실패했는지. 사용자가 볼 화면이 없는 백그라운드 작업이라
   * 버튼 대신 연결이 돌아오거나 앱으로 돌아올 때 조용히 다시 시도한다.
   * (POST 라 client 는 자동 재시도하지 않는다 — 같은 토큰 재등록은 이렇게 드문 시점에만 한다.)
   */
  const registrationFailedRef = useRef(false)
  const [retryNonce, setRetryNonce] = useState(0)

  const retryRegistration = () => {
    if (!registrationFailedRef.current) return
    registrationFailedRef.current = false
    setRetryNonce((n) => n + 1)
  }

  useReconnect(retryRegistration, Platform.OS !== 'web' && Boolean(accessToken))

  useEffect(() => {
    if (Platform.OS === 'web' || !accessToken) return
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') retryRegistration()
    })
    return () => subscription.remove()
  }, [accessToken])

  // 앱이 켜져 있거나 백그라운드일 때 알림 탭
  useEffect(() => {
    if (Platform.OS === 'web') return
    const subscription = Notifications.addNotificationResponseReceivedListener(handleNotificationResponse)
    return () => subscription.remove()
  }, [])

  // 앱이 꺼진 상태에서 알림을 눌러 켜진 경우(콜드 스타트). 리스너가 붙기 전에 일어난 탭이라 따로 조회한다.
  useEffect(() => {
    if (Platform.OS === 'web') return
    Notifications.getLastNotificationResponseAsync()
      .then(handleNotificationResponse)
      .catch(() => {})
  }, [])

  // 내비게이션이 준비되거나 화면 구성이 바뀔 때(웰컴 → 둘러보기/로그인) 보관해 둔 알림을 처리한다.
  useEffect(() => {
    flushPendingNotification()
    const unsubscribe = navigationRef.addListener('state', flushPendingNotification)
    return unsubscribe
  }, [status])

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
        registrationFailedRef.current = false
      } catch (error) {
        if (cancelled) return
        registrationFailedRef.current = isRetryableError(error)
        if (__DEV__) console.warn('기기를 서버에 등록하지 못했습니다:', error)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [accessToken, retryNonce])
}
