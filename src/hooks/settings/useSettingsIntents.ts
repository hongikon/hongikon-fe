import { useCallback, useEffect } from 'react'
import { useFocusEffect } from '@react-navigation/native'
import { consumeSettingsIntent, subscribeSettingsIntent } from '../../lib/settingsIntents'
import { notify } from '../../utils/dialog'
import type { SettingsGroup } from './types'

interface Options {
  isGuest: boolean
  expandGroup: (group: SettingsGroup) => void
  openSubscriptions: () => void
  /** 지도에서 '근처 제휴 알림 켜러 가기'로 왔을 때 — 칸으로 스크롤·강조한 뒤 창을 연다(useNearbySettingHighlight). */
  showNearbySetting: () => void
  /** 반려 알림으로 들어왔을 때 그 제보를 강조해 내 제보 내역을 연다. */
  openMyReports: (reportId: number | null) => void
}

/**
 * 알림(반려) 탭 → 설정 탭으로 넘어와 내 제보 내역을 연다(`lib/settingsIntents.ts`). 게스트면 무시한다.
 * 화면에 붙을 때(포커스)와 이미 떠 있을 때(구독) 둘 다 받는다.
 */
export function useSettingsIntents({ isGuest, expandGroup, openSubscriptions, showNearbySetting, openMyReports }: Options) {
  const handleSettingsIntent = useCallback(() => {
    const intent = consumeSettingsIntent()
    if (!intent) return
    if (intent.type === 'openAlerts') {
      expandGroup('alerts')
      return
    }
    if (intent.type === 'openSubscriptions') {
      openSubscriptions()
      return
    }
    if (intent.type === 'openNearbyAlerts') {
      // 근처 알림 줄은 알림 묶음 안에 있다 — 묶음을 펼친 뒤 창을 띄운다.
      expandGroup('alerts')
      if (isGuest) {
        // 게스트는 근처 알림 줄이 없다. 그냥 설정 탭만 보이면 왜 왔는지 몰라 한 줄 알린다.
        notify('근처 제휴 알림', '근처 제휴 알림은 로그인한 뒤 알림 > 근처 제휴에서 켤 수 있어요.')
        return
      }
      showNearbySetting()
      return
    }
    if (isGuest) return
    openMyReports(intent.reportId)
  }, [isGuest, showNearbySetting, expandGroup, openSubscriptions, openMyReports])
  useFocusEffect(handleSettingsIntent)
  useEffect(() => subscribeSettingsIntent(handleSettingsIntent), [handleSettingsIntent])
}
