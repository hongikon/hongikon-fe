import { memo, type ReactNode } from 'react'
import { Animated, StyleSheet, type LayoutChangeEvent } from 'react-native'

interface Props {
  /** 상태 바 높이(insets.top). 제목 줄이 없어 그 아래 8 만 띄운다. */
  topInset: number
  /** 0~1. 시트를 맨 위까지 올리면 0 으로 흐려 숨긴다. */
  opacity: Animated.Value
  /** 숨긴 동안에는 눌리지 않게 한다. */
  covered: boolean
  /** 그려진 높이. 지도 위 안내 줄·막대를 이만큼 아래로 민다. */
  onHeight: (height: number) => void
  children: ReactNode
}

/**
 * 지도 맨 위에 뜨는 막대(검색바·칩). 지도 위 오버레이라 실제 높이를 재서 다른 오버레이가 겹치지 않게 알린다.
 * 검색바·칩은 지도처럼 창 너비를 다 쓴다 — 폴드를 펴거나 웹 창을 늘려도 지도와 같이 늘어난다.
 */
function MapTopBar({ topInset, opacity, covered, onHeight, children }: Props) {
  return (
    <Animated.View
      style={[styles.overlay, { paddingTop: topInset + 8, opacity }]}
      pointerEvents={covered ? 'none' : 'box-none'}
      onLayout={(e: LayoutChangeEvent) => onHeight(e.nativeEvent.layout.height)}
    >
      {children}
    </Animated.View>
  )
}

export default memo(MapTopBar)

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
  },
})
