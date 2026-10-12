import { useMemo, useRef, useState, type ComponentProps, type RefObject } from 'react'
import {
  Animated,
  PanResponder,
  type ScrollView,
  StyleSheet,
  View,
  type LayoutChangeEvent,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native'
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg'
import { COLORS } from '../../constants/colors'
import type { SheetBodyGesture } from '../../hooks/useResizableSheet'

const FADE_HEIGHT = 28
/** 이만큼 세로로 끌어야 시트 끌기로 넘긴다(가로 사진 넘기기·탭과 헷갈리지 않게). */
const HANDOFF_SLOP_PX = 8

type Props = ComponentProps<typeof Animated.ScrollView> & {
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
  const [viewport, setViewport] = useState(0)
  const [content, setContent] = useState(0)
  const [offset, setOffset] = useState(0)
  const moreBelow = viewport > 0 && content - (offset + viewport) > 2

  // 제스처 판단은 렌더를 기다리지 않게 ref 로 읽는다.
  const metrics = useRef({ viewport: 0, content: 0, offset: 0 })
  const gestureRef = useRef(sheetGesture)
  gestureRef.current = sheetGesture
  const disabledRef = useRef(sheetGestureDisabled)
  disabledRef.current = sheetGestureDisabled
  // 시트를 끄는 동안 본문 스크롤을 멈춘다 — 같은 손가락으로 되돌아 끌 때 시트와 내용이 같이 움직이지 않게.
  const [handingOff, setHandingOff] = useState(false)

  const handoff = useMemo(() => {
    let startDy = 0
    const finish = () => setHandingOff(false)
    return PanResponder.create({
      // 캡처 단계에서 본다 — 스크롤이 끝에 닿아 더 움직일 수 없을 때만 가져간다. 그 밖에는 평소처럼 스크롤.
      onMoveShouldSetPanResponderCapture: (_, g) => {
        const gesture = gestureRef.current
        if (!gesture || disabledRef.current) return false
        if (Math.abs(g.dy) < HANDOFF_SLOP_PX || Math.abs(g.dy) <= Math.abs(g.dx)) return false
        const { viewport: v, content: c, offset: o } = metrics.current
        if (g.dy > 0) return o <= 1
        return c - (o + v) <= 1 && gesture.canGrow()
      },
      onPanResponderGrant: (_, g) => {
        startDy = g.dy
        setHandingOff(true)
        gestureRef.current?.begin()
      },
      onPanResponderMove: (_, g) => gestureRef.current?.move(g.dy - startDy),
      onPanResponderRelease: (_, g) => {
        finish()
        gestureRef.current?.end(g.dy - startDy, g.vy)
      },
      onPanResponderTerminationRequest: () => false,
      onPanResponderTerminate: () => {
        finish()
        gestureRef.current?.cancel()
      },
    })
  }, [])

  return (
    <View {...(sheetGesture ? handoff.panHandlers : null)}>
      <Animated.ScrollView
        ref={scrollRef}
        bounces={false}
        // 댓글 창(Modal)은 화면으론 따로 뜨지만 React 트리상 이 스크롤 안에 있어 터치가 여기로 거슬러 온다.
        // 기본값('never')이면 키보드가 떠 있을 때 첫 탭을 키보드 닫기로 먹어 댓글 보내기가 눌리지 않았다(10-09).
        keyboardShouldPersistTaps="handled"
        {...rest}
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
  )
}

const styles = StyleSheet.create({
  fade: { position: 'absolute', left: 0, right: 0, bottom: 0, height: FADE_HEIGHT },
})
