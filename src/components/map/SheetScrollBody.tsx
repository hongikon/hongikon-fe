import { type ComponentProps, type RefObject } from 'react'
import { Animated, type ScrollView, StyleSheet, TouchableOpacity, View, type LayoutChangeEvent, type NativeScrollEvent, type NativeSyntheticEvent } from 'react-native'
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg'
import { COLORS } from '../../constants/colors'
import type { SheetBodyGesture } from '../../hooks/map/useResizableSheet'
import { useSheetScrollBody } from '../../hooks/map/useSheetScrollBody'
import { SheetPressGuardContext, useSheetPress } from '../../hooks/map/useSheetPress'

const FADE_HEIGHT = 28

/** 시트 본문 안에서 누르는 줄. 스크롤하려고 끈 손동작은 누르기로 치지 않는다. */
export function SheetTouchable({ onPress, ...rest }: ComponentProps<typeof TouchableOpacity> & { onPress: () => void }) {
  const guard = useSheetPress()
  return <TouchableOpacity {...rest} onPress={guard(onPress)} />
}

export type Props = ComponentProps<typeof Animated.ScrollView> & {
  /** `useSheetSizing().bodyGesture`. 주면 스크롤이 맨 위에서 아래로 끌면 시트가 작아지고(끝까지 내리면 닫힘),
   *  맨 아래(또는 스크롤할 게 없을 때)에서 위로 끌면 시트가 커진다(10-12 요청). */
  sheetGesture?: SheetBodyGesture
  /** 본문 안에서 메뉴(Modal)를 띄운 동안 true — Modal 터치도 React 트리를 따라 여기로 올라오므로 시트를 끌지 않게. */
  sheetGestureDisabled?: boolean
  /** 본문을 코드로 스크롤할 때(검색으로 찾아간 줄 보이기 등). */
  scrollRef?: RefObject<ScrollView | null>
}

/**
 * 지도 바텀시트(건물·편의시설·제휴업체·제보)의 본문 스크롤. 스크롤 막대는 그리지 않는다 — 시트를 끌 때마다 오른쪽 끝에
 * 막대가 떠 조회수·메뉴 버튼 위로 겹쳤다(10-08 요청). 대신 아래에 내용이 더 남아 있을 때만 본문 아래쪽을 흰색으로
 * 흐리게 덮어 "더 있다"를 알린다. 나머지 props 는 Animated.ScrollView 에 그대로 넘긴다(style 의 height: bodyHeight 등).
 */
export default function SheetScrollBody({
  onContentSizeChange,
  onLayout,
  onScroll,
  sheetGesture,
  sheetGestureDisabled = false,
  scrollRef,
  children,
  ...rest
}: Props) {
  const { setViewport, setContent, setOffset, moreBelow, metrics, handingOff, lastScrollAt, scrolledRecently, touchHandlers, handoff } = useSheetScrollBody({ sheetGesture, sheetGestureDisabled })

  return (
    <SheetPressGuardContext.Provider value={scrolledRecently}>
    <View {...(sheetGesture ? handoff.panHandlers : null)} {...touchHandlers}>
      <Animated.ScrollView
        ref={scrollRef}
        bounces={false}
        // 댓글 창(Modal)은 화면으론 따로 뜨지만 React 트리상 이 스크롤 안에 있어 터치가 여기로 거슬러 온다.
        // 기본값('never')이면 키보드가 떠 있을 때 첫 탭을 키보드 닫기로 먹어 댓글 보내기가 눌리지 않았다(10-09).
        keyboardShouldPersistTaps="handled"
        {...rest}
        // ScrollView 는 이번 손동작에서 한 번이라도 스크롤했으면 JS 응답자를 내주지 않는다(_observedScrollSinceBecomingResponder).
        // 그러면 끝까지 스크롤한 그 손가락으로 계속 끌어도 시트로 안 넘어가고, 손을 뗐다 다시 끌어야 했다(10-14 요청).
        // 스크롤은 네이티브가 하므로 JS 응답자를 맡지 않게 해 두면, 끝에 닿은 순간 위 PanResponder 가 바로 이어받는다.
        // iOS 는 네이티브 스크롤이 JS 터치를 끊지 않아 같은 손동작에서 넘어간다. Android 는 네이티브 스크롤이 터치를 가져가 여전히 다시 끌어야 할 수 있다.
        disableScrollViewPanResponder={sheetGesture ? true : rest.disableScrollViewPanResponder}
        scrollEnabled={rest.scrollEnabled !== false && !handingOff}
        showsVerticalScrollIndicator={false}
        scrollEventThrottle={32}
        onLayout={(e: LayoutChangeEvent) => {
          setViewport(e.nativeEvent.layout.height)
          metrics.current.viewport = e.nativeEvent.layout.height
          onLayout?.(e)
        }}
        onContentSizeChange={(w: number, h: number) => {
          setContent(h)
          metrics.current.content = h
          onContentSizeChange?.(w, h)
        }}
        onScroll={(e: NativeSyntheticEvent<NativeScrollEvent>) => {
          setOffset(e.nativeEvent.contentOffset.y)
          lastScrollAt.current = Date.now()
          metrics.current.offset = e.nativeEvent.contentOffset.y
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
    </SheetPressGuardContext.Provider>
  )
}

const styles = StyleSheet.create({
  fade: { position: 'absolute', left: 0, right: 0, bottom: 0, height: FADE_HEIGHT },
})
