import { createContext, useCallback, useContext, useMemo, useRef, useState, type ComponentProps, type RefObject } from 'react'
import {
  Animated,
  PanResponder,
  type ScrollView,
  StyleSheet,
  TouchableOpacity,
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
/** 누른 뒤 이만큼 넘게 움직였으면 스크롤로 보고, 손을 뗄 때 줄 누르기로 치지 않는다. */
const PRESS_SLOP_PX = 8
/** 스크롤이 멈춘 직후 이 시간(ms) 안의 누르기는 스크롤을 멈추려던 손동작으로 본다. */
const SCROLL_SETTLE_MS = 120

/**
 * 본문 안 줄(행정·지원 부서, 건물 안 시설 등)을 누를 때 쓴다. 스크롤하려고 끈 손동작이 줄 누르기로 먹어 엉뚱하게 들어가던 것(10-27)을 막는다.
 * 시트 스크롤은 시트 끌기로 넘기려고 JS 응답자를 맡지 않아(disableScrollViewPanResponder), 스크롤해도 줄의 누르기가 취소되지 않는다.
 */
const SheetPressGuardContext = createContext<() => boolean>(() => false)

/** 시트 본문 안에서 누르는 줄. 스크롤하려고 끈 손동작은 누르기로 치지 않는다. */
export function SheetTouchable({ onPress, ...rest }: ComponentProps<typeof TouchableOpacity> & { onPress: () => void }) {
  const guard = useSheetPress()
  return <TouchableOpacity {...rest} onPress={guard(onPress)} />
}

/** `guard(fn)` 은 방금 스크롤한 손동작이면 fn 을 부르지 않는다. */
export function useSheetPress() {
  const scrolled = useContext(SheetPressGuardContext)
  return useCallback(
    (fn: () => void) => () => {
      if (scrolled()) return
      fn()
    },
    [scrolled],
  )
}

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

  // 이번 손동작이 스크롤이었는지. 터치 이동 거리와 마지막 스크롤 시각으로 본다(웹·앱 같은 방식).
  const touch = useRef({ startY: 0, startX: 0, moved: false })
  const lastScrollAt = useRef(0)
  const scrolledRecently = useCallback(
    () => touch.current.moved || Date.now() - lastScrollAt.current < SCROLL_SETTLE_MS,
    [],
  )
  type TouchEvt = { nativeEvent: { pageX: number; pageY: number } }
  const touchHandlers = {
    onTouchStart: (e: TouchEvt) => {
      touch.current = { startX: e.nativeEvent.pageX, startY: e.nativeEvent.pageY, moved: false }
    },
    onTouchMove: (e: TouchEvt) => {
      const t = touch.current
      if (!t.moved && Math.hypot(e.nativeEvent.pageX - t.startX, e.nativeEvent.pageY - t.startY) > PRESS_SLOP_PX) t.moved = true
    },
  }

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
