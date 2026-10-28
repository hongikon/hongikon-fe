import { useEffect, useRef } from 'react'
import { AppState, Linking } from 'react-native'
import { useAuth } from '../../contexts/AuthContext'
import { useMapData } from '../mapData'
import { nearbyAlertsAvailable, resetNearbyHistoryForDebug, syncNearbyAlerts, wipeNearbyAlerts } from './background'
import { applyNearbyDebugUrl } from './debug'

/**
 * 근처 제휴 알림을 앱 상태에 맞춘다. `App.tsx` 에서 `usePushNotifications` 옆에서 한 번 부른다.
 *
 * - 앱을 열 때·앞으로 돌아올 때·지도 데이터(업체·긴급 스위치)가 바뀔 때: 켜져 있으면 대상 업체를 다시 골라 등록한다
 *   (Android 는 재부팅·업데이트 때 지오펜스가 지워져 앱을 열 때 다시 건다).
 * - 로그아웃·게스트: 끄고 기기 기록을 지운다(근처 알림은 로그인한 계정의 수신 동의로만 켤 수 있다).
 * - 개발·테스트 빌드: `hongikon://dev/nearby?clock=12:00&radius=75&reset=1` 링크로 시계·반경을 바꾸거나 기록을 비우고
 *   다시 맞춘다(`debug.ts`).
 */
export function useNearbyPartnerAlerts(): void {
  const available = nearbyAlertsAvailable()
  const { status } = useAuth()
  const { data, partners, buildings } = useMapData()
  const sourceRef = useRef({ partners, campusPoints: buildings, serverEnabled: data?.nearbyAlertsEnabled === true })
  sourceRef.current = { partners, campusPoints: buildings, serverEnabled: data?.nearbyAlertsEnabled === true }
  const signedIn = status === 'authenticated'

  useEffect(() => {
    if (!available || status === 'loading') return
    if (!signedIn) {
      void wipeNearbyAlerts()
      return
    }
    // 지도 데이터를 아직 못 받았으면(첫 실행 오프라인) 기다린다 — 빈 목록으로 등록하면 기존 등록이 지워진다.
    if (!data) return
    void syncNearbyAlerts(sourceRef.current)
  }, [available, status, signedIn, data])

  useEffect(() => {
    if (!available || !signedIn) return
    const sub = AppState.addEventListener('change', (next) => {
      if (next === 'active' && sourceRef.current.partners.length > 0) void syncNearbyAlerts(sourceRef.current)
    })
    return () => sub.remove()
  }, [available, signedIn])

  useEffect(() => {
    if (!available) return
    const handle = async (url: string | null) => {
      if (!url || !(await applyNearbyDebugUrl(url))) return
      if (/[?&]reset=1\b/.test(url)) await resetNearbyHistoryForDebug()
      if (sourceRef.current.partners.length > 0) void syncNearbyAlerts(sourceRef.current)
    }
    void Linking.getInitialURL().then(handle)
    const sub = Linking.addEventListener('url', ({ url }) => void handle(url))
    return () => sub.remove()
  }, [available])
}
