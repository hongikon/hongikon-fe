import { createNavigationContainerRef } from '@react-navigation/native'
import type { RootStackParamList } from './RootNavigator'

/**
 * `NavigationContainer` 밖(알림 탭 리스너 등)에서 화면을 전환하기 위한 참조.
 * `App.tsx`에서 `<NavigationContainer ref={navigationRef}>`로 연결한다.
 */
export const navigationRef = createNavigationContainerRef<RootStackParamList>()
