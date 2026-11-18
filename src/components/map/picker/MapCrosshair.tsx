import { memo, type ReactNode } from 'react'
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native'
import { COLORS } from '../../../constants/colors'

interface Props {
  /** 십자선 두 줄에 더할 모양(테스트 위치 고르기는 더 굵고 길게). */
  lineStyle?: StyleProp<ViewStyle>
  /** 십자선 위에 얹을 것(핀 등). */
  children?: ReactNode
}

/**
 * 지도 가운데 십자선. 지도 칸 전체를 덮는 층의 정가운데에 그려 map.getCenter() 와 겹친다(눌리지 않음).
 * 위치 고르기(제보·정보 제보·길찾기 도착)와 근처 알림 테스트 위치 고르기가 같이 쓴다.
 */
function MapCrosshair({ lineStyle, children }: Props) {
  return (
    <View pointerEvents="none" style={styles.wrap}>
      <View style={[styles.vertical, lineStyle]} />
      <View style={[styles.horizontal, lineStyle]} />
      {children}
    </View>
  )
}

export default memo(MapCrosshair)

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  vertical: {
    position: 'absolute',
    width: 1,
    height: 22,
    backgroundColor: COLORS.danger,
    opacity: 0.5,
  },
  horizontal: {
    position: 'absolute',
    width: 22,
    height: 1,
    backgroundColor: COLORS.danger,
    opacity: 0.5,
  },
})
