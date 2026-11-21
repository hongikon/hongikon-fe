import { Animated, StyleSheet } from 'react-native'
import LaunchView from './LaunchView'
import { useLaunchOverlay } from '../../hooks/common/useLaunchOverlay'

/**
 * 앱을 처음 켤 때 화면 전체를 덮는 시작 화면. 이 동안 첫 화면(지도)에 필요한 지도 데이터와, 소식 첫 페이지를 함께 불러온다.
 * - 막대: 그려진 시점 30% → 기다리는 동안 85%까지 천천히 → 지도 데이터가 준비되면 100% 후 사라짐.
 * - 두 번째 실행부터는 지도 데이터가 저장본으로 곧바로 준비돼 안내·막대 없이 바로 걷힌다. 처음 실행은 서버에서 받을 때까지(최소 0.4초, 최대 2.5초).
 * - 덮기만 할 뿐 밑의 앱(로그인 복원·온보딩·설정)은 함께 시작된다. 콜드 스타트 한 번만 뜬다(App 루트에 한 번 마운트).
 */
export default function LaunchOverlay() {
  const { progress, opacity, bottomOpacity, gone } = useLaunchOverlay()

  if (gone) return null
  return (
    <Animated.View style={[StyleSheet.absoluteFill, { opacity }]} pointerEvents="auto">
      <LaunchView progress={progress} bottomOpacity={bottomOpacity} />
    </Animated.View>
  )
}
