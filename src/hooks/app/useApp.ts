import { useEffect } from 'react'
import { useFonts } from 'expo-font'
import * as SplashScreen from 'expo-splash-screen'
import { FONT_ASSETS } from '../../constants/typography'

/** App 의 상태·효과·핸들러. 화면 파일은 이 훅을 불러 그리기만 한다. */
export function useApp() {
  const [fontsLoaded, fontError] = useFonts(FONT_ASSETS)

  useEffect(() => {
    // 폰트 로드에 실패해도 스플래시는 내린다. 시스템 폰트로라도 앱은 써야 한다.
    if (fontsLoaded || fontError) {
      SplashScreen.hideAsync()
    }
  }, [fontsLoaded, fontError])
  return { fontsLoaded, fontError }
}
