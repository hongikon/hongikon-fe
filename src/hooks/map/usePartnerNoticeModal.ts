import { useSyncExternalStore } from 'react'
import { useIsFocused } from '@react-navigation/native'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { setNoticeState, subscribe, noticeState, STORAGE_KEY } from '../../utils/map/partnerNoticeModal'

/** PartnerNoticeModal 의 상태·효과·핸들러. 화면 파일은 이 훅을 불러 그리기만 한다. */
export function usePartnerNoticeModal() {
  const visible = useSyncExternalStore(subscribe, () => noticeState, () => noticeState) === 'pending'
  // 지도 탭이 화면에 보일 때만 띄운다. 소식 상세 링크로 바로 들어오면 지도 탭이 뒤에서 먼저 그려지는데,
  // 그때 이 창이 소식 화면 위를 덮었다.
  const focused = useIsFocused()

  const handleConfirm = () => {
    setNoticeState('seen')
    AsyncStorage.setItem(STORAGE_KEY, '1').catch(() => {})
  }
  return { visible, focused, handleConfirm }
}
