import { useEffect, useState } from 'react'
import { AppState, Platform } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import * as Updates from 'expo-updates'

/** UpdateBanner 의 상태·효과·핸들러. 화면 파일은 이 훅을 불러 그리기만 한다. */
export function useUpdateBanner() {
  const insets = useSafeAreaInsets()
  const [reloading, setReloading] = useState(false)
  const { isUpdatePending } = Updates.useUpdates()
  useEffect(() => {
    if (!Updates.isEnabled || Platform.OS === 'web') return

    // 앱을 계속 켜두고 있어도 받을 수 있도록, 포그라운드로 돌아올 때마다 다시 확인한다.
    // 받은 업데이트는 배너의 "지금 적용"을 눌러야 적용된다(갑자기 리로드되면 안 되니까). 시스템 알림창은 띄우지 않는다(11-03 운영진).
    const checkAndDownload = () => {
      Updates.checkForUpdateAsync()
        .then((result) => (result.isAvailable ? Updates.fetchUpdateAsync() : undefined))
        .catch((error) => {
          if (__DEV__) console.warn('[updates] 확인 실패:', error)
        })
    }

    checkAndDownload()
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') checkAndDownload()
    })
    return () => subscription.remove()
  }, [])
  return { insets, reloading, setReloading, isUpdatePending }
}
