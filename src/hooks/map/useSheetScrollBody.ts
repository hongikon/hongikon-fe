import { useCallback, useMemo, useRef, useState } from 'react'
import { PanResponder } from 'react-native'
import { SCROLL_SETTLE_MS, PRESS_SLOP_PX, HANDOFF_SLOP_PX } from '../../utils/map/sheetScrollBody'
import type { Props } from '../../components/map/SheetScrollBody'

/** SheetScrollBody 의 상태·효과·핸들러. 화면 파일은 이 훅을 불러 그리기만 한다. */
export function useSheetScrollBody({ sheetGesture, sheetGestureDisabled = false }: Pick<Props, 'sheetGesture' | 'sheetGestureDisabled'>) {
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
  return {
    setViewport,
    setContent,
    setOffset,
    moreBelow,
    metrics,
    handingOff,
    lastScrollAt,
    scrolledRecently,
    touchHandlers,
    handoff,
  }
}
