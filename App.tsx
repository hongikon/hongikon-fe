import { useEffect } from 'react'
import { Platform } from 'react-native'
import { useFonts } from 'expo-font'
import * as SplashScreen from 'expo-splash-screen'
import { StatusBar } from 'expo-status-bar'
import { NavigationContainer } from '@react-navigation/native'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import { SettingsProvider } from './src/contexts/SettingsContext'
import { AuthProvider } from './src/contexts/AuthContext'
import RootNavigator from './src/navigation/RootNavigator'
import TempEntranceDebugScreen from './src/screens/TempEntranceDebugScreen'
import { FONT_ASSETS } from './src/constants/typography'

/**
 * 임시 - 출입구 좌표 검증용 웹 전용 경로. 로그인 상태와 무관하게 바로 보여야 해서
 * RootNavigator/NavigationContainer 를 아예 거치지 않고 여기서 분기한다.
 * buildings.ts/pathNodes.ts 에 실 데이터가 반영되면 이 블록과
 * `src/screens/TempEntranceDebugScreen.tsx` 를 통째로 지운다.
 */
const isTempDotsRoute =
  Platform.OS === 'web' &&
  typeof window !== 'undefined' &&
  window.location.pathname.replace(/\/+$/, '') === '/temp/dots'

// 폰트가 준비될 때까지 스플래시를 띄워 둔다. 그렇게 하지 않으면
// 시스템 폰트로 한 프레임 그려졌다가 Pretendard 로 바뀌며 글자가 튄다.
SplashScreen.preventAutoHideAsync()

export default function App() {
  const [fontsLoaded, fontError] = useFonts(FONT_ASSETS)

  useEffect(() => {
    // 폰트 로드에 실패해도 스플래시는 내린다. 시스템 폰트로라도 앱은 써야 한다.
    if (fontsLoaded || fontError) {
      SplashScreen.hideAsync()
    }
  }, [fontsLoaded, fontError])

  if (!fontsLoaded && !fontError) {
    return null
  }

  if (isTempDotsRoute) {
    return <TempEntranceDebugScreen />
  }

  return (
    <SafeAreaProvider>
      <AuthProvider>
        <SettingsProvider>
          <NavigationContainer>
            <RootNavigator />
            <StatusBar style="dark" />
          </NavigationContainer>
        </SettingsProvider>
      </AuthProvider>
    </SafeAreaProvider>
  )
}
