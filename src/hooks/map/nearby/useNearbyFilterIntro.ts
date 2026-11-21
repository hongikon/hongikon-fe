import { useEffect, useState } from 'react'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { useIsFocused } from '@react-navigation/native'
import { useAuth } from '../../../contexts/AuthContext'
import { getNearbySettings, nearbyAlertsAvailable } from '../../../lib/nearbyPartners/background'
import { usePartnerNoticePending } from '../usePartnerNoticePending'
import { SEEN_KEY } from '../../../utils/map/nearby/nearbyFilterIntro'

/** NearbyFilterIntro 의 상태·효과·핸들러. 화면 파일은 이 훅을 불러 그리기만 한다. */
export function useNearbyFilterIntro({ active }: Pick<{ active: boolean }, 'active'>) {
  const { status } = useAuth()
  const noticePending = usePartnerNoticePending()
  const focused = useIsFocused()
  const [show, setShow] = useState(false)

  useEffect(() => {
    if (!active || noticePending || status !== 'authenticated' || !nearbyAlertsAvailable()) return
    let alive = true
    void (async () => {
      const seen = await AsyncStorage.getItem(SEEN_KEY).catch(() => '1')
      if (seen) return
      const settings = await getNearbySettings()
      if (!alive) return
      if (settings.enabled) {
        // 이미 켠 사람에게는 소개할 필요가 없다. 다시 묻지 않게 본 것으로 둔다.
        AsyncStorage.setItem(SEEN_KEY, '1').catch(() => {})
        return
      }
      setShow(true)
    })()
    return () => {
      alive = false
    }
  }, [active, noticePending, status])
  return { focused, show, setShow }
}
