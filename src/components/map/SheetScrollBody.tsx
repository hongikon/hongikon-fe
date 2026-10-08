import { useState, type ComponentProps } from 'react'
import { Animated, StyleSheet, View, type LayoutChangeEvent, type NativeScrollEvent, type NativeSyntheticEvent } from 'react-native'
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg'
import { COLORS } from '../../constants/colors'

const FADE_HEIGHT = 28

type Props = ComponentProps<typeof Animated.ScrollView>

/**
 * 지도 바텀시트(건물·편의시설·제휴업체·제보)의 본문 스크롤. 스크롤 막대는 그리지 않는다 — 시트를 끌 때마다 오른쪽 끝에
 * 막대가 떠 조회수·메뉴 버튼 위로 겹쳤다(10-08 요청). 대신 아래에 내용이 더 남아 있을 때만 본문 아래쪽을 흰색으로
 * 흐리게 덮어 "더 있다"를 알린다. 나머지 props 는 Animated.ScrollView 에 그대로 넘긴다(style 의 height: bodyHeight 등).
 */
export default function SheetScrollBody({ onContentSizeChange, onLayout, onScroll, children, ...rest }: Props) {
  const [viewport, setViewport] = useState(0)
  const [content, setContent] = useState(0)
  const [offset, setOffset] = useState(0)
  const moreBelow = viewport > 0 && content - (offset + viewport) > 2

  return (
    <View>
      <Animated.ScrollView
        bounces={false}
        {...rest}
        showsVerticalScrollIndicator={false}
        scrollEventThrottle={32}
        onLayout={(e: LayoutChangeEvent) => {
          setViewport(e.nativeEvent.layout.height)
          onLayout?.(e)
        }}
        onContentSizeChange={(w: number, h: number) => {
          setContent(h)
          onContentSizeChange?.(w, h)
        }}
        onScroll={(e: NativeSyntheticEvent<NativeScrollEvent>) => {
          setOffset(e.nativeEvent.contentOffset.y)
          if (typeof onScroll === 'function') onScroll(e)
        }}
      >
        {children}
      </Animated.ScrollView>
      {moreBelow && (
        <View pointerEvents="none" style={styles.fade}>
          <Svg width="100%" height={FADE_HEIGHT}>
            <Defs>
              <LinearGradient id="sheetBodyFade" x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0" stopColor={COLORS.white} stopOpacity="0" />
                <Stop offset="1" stopColor={COLORS.white} stopOpacity="1" />
              </LinearGradient>
            </Defs>
            <Rect x="0" y="0" width="100%" height={FADE_HEIGHT} fill="url(#sheetBodyFade)" />
          </Svg>
        </View>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  fade: { position: 'absolute', left: 0, right: 0, bottom: 0, height: FADE_HEIGHT },
})
