import { useCallback, useEffect, useState } from 'react'
import { AppState } from 'react-native'
import { useAuth } from '../../contexts/AuthContext'
import { useMapData } from '../../lib/mapData'
import { patchNotificationSettings } from '../../apis/notificationSettings'
import { NEARBY_FIELD_TEST } from '../../lib/nearbyPartners/debug'
import {
  disableNearbyAlerts,
  getNearbyChecklist,
  getNearbySettings,
  nearbyGeofencingUnsupported,
  type NearbyChecklist,
  type NearbySettings,
} from '../../lib/nearbyPartners/background'
import { showConsentResult } from '../../lib/nearbyPartners/consentNotice'

/**
 * 설정 > 알림 > '근처 제휴 알림' 줄의 상태: 기기에 저장된 근처 알림 설정·권한 점검표, 창 열림, 끄기.
 * 휴대폰 설정에서 권한을 바꾸고 돌아오면 다시 읽는다.
 */
export function useNearbyAlertRow(openSignal: number) {
  const { status, accessToken } = useAuth()
  const { data, partners, buildings } = useMapData()
  const [settings, setSettings] = useState<NearbySettings | null>(null)
  const [checklist, setChecklist] = useState<NearbyChecklist | null>(null)
  const [modalVisible, setModalVisible] = useState(false)
  const [busy, setBusy] = useState(false)
  const [unsupported, setUnsupported] = useState(false)

  const refresh = useCallback(async () => {
    setSettings(await getNearbySettings())
    setChecklist(await getNearbyChecklist())
    setUnsupported(nearbyGeofencingUnsupported())
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh, status])

  // 휴대폰 설정에서 권한을 바꾸고 돌아오면 점검표를 다시 읽는다.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (next) => {
      if (next === 'active') void refresh()
    })
    return () => sub.remove()
  }, [refresh])

  // 제휴 시트의 안내 줄에서 넘어오면 창을 연다.
  useEffect(() => {
    if (openSignal > 0) setModalVisible(true)
  }, [openSignal])

  /** 감시·예약을 멈추고 서버 동의 시각을 지운다(수신 거부). 로그인(토큰 있음)일 때만 불린다. */
  const turnOff = async (token: string) => {
    setBusy(true)
    await disableNearbyAlerts()
    // 수신 거부를 서버 기록에도 남긴다. 실패해도 기기에서는 이미 꺼졌다(다음에 켤 때 다시 동의를 받는다).
    if (!NEARBY_FIELD_TEST) patchNotificationSettings({ partnerAdConsent: false }, token).catch(() => {})
    await refresh()
    setBusy(false)
    // 정보통신망법 제50조 제8항: 수신 거부 처리 결과(전송자·일자·결과)를 알린다.
    showConsentResult('withdraw')
  }

  return {
    status,
    accessToken,
    data,
    partners,
    buildings,
    settings,
    checklist,
    modalVisible,
    setModalVisible,
    busy,
    unsupported,
    refresh,
    turnOff,
  }
}
