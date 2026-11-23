import { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { Animated, Dimensions, Easing, PanResponder, Platform, useWindowDimensions, type LayoutChangeEvent } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

/** 가장 작은 크기에서 이만큼 더 끌어내리면 닫는다. */
const DISMISS_OVERSHOOT_PX = 70
/** 이 속도(px/ms)보다 빠르게 아래로 튕기면, 가장 작은 크기일 때 닫는다. */
const DISMISS_VELOCITY = 1.2
/** 손을 뗄 때 이 속도(px/ms)보다 빠르면 끈 방향의 다음 크기로 넘긴다. 느리면 가장 가까운 크기로 붙는다. */
const FLICK_VELOCITY = 0.6

interface Options {
  /** 처음 열릴 때 본문(스크롤 영역) 최대 높이(px). 보통 가장 작은 크기로 조금만 보여 준다. */
  initial: number
  /** 손을 뗄 때 붙는 크기들(px). 가장 작은 값보다 더 끌어내리면 닫힌다. */
  points: number[]
}

/**
 * 바텀시트 손잡이(회색 줄)로 시트 크기를 조절하고, 끝까지 내리면 닫는 제스처.
 * - 처음엔 조금만 보여 주고, 손잡이를 위로 끌면 커지고 아래로 끌면 작아진다. 손을 떼면 points 중 가까운 크기로 붙는다.
 * - 가장 작은 크기에서 더 끌어내리면(또는 빠르게 튕기면) 시트가 내려가며 닫힌다.
 * 본문 높이(bodyHeight)를 직접 바꾼다. 0 이면 머리줄만 남고, 가장 큰 값이면 화면 위 끝까지 올라온다.
 * `panHandlers` 는 손잡이에만 건다 — 본문 스크롤과 부딪히지 않게. 본문은 스크롤이 끝에 닿았을 때만 `bodyGesture` 로 넘긴다.
 */
export function useResizableSheet(onClose: () => void, { initial, points }: Options) {
  const translateY = useRef(new Animated.Value(0)).current
  const bodyHeight = useRef(new Animated.Value(initial)).current
  const current = useRef(initial)
  const startHeight = useRef(initial)
  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose
  const initialRef = useRef(initial)
  initialRef.current = initial
  /** 손가락으로 끄는 중인지. 그동안은 내용 높이가 바뀌어도 크기를 덮어쓰지 않는다. */
  const dragging = useRef(false)
  const snaps = useRef<number[]>([])
  snaps.current = [...points].sort((a, b) => a - b)

  // 처음 뜰 때 아래에서 부드럽게 올라온다(예전엔 시트가 한 번에 툭 나타났다).
  useEffect(() => {
    translateY.setValue(260)
    Animated.timing(translateY, {
      toValue: 0,
      duration: 260,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start()
    // 처음 한 번만.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // 크기 점이 바뀔 때(머리줄 높이 측정, 회전·창 크기) 지금 크기를 맞춘다.
  // - 아직 처음 크기 그대로면 새 처음 크기를 따라간다.
  // - 맨 위에 있었으면 새 맨 위로 — 창이 줄었을 때 손잡이·X 가 화면 밖으로 밀려나지 않게.
  // - 그 밖에는 새 크기 점 중 가장 가까운 곳으로 — 중간 높이에 남지 않게(10-12). 예전엔 댓글·메뉴가 늦게 뜨는 등 내용 높이가
  //   바뀔 때마다 고른 크기를 버리고 작게로 툭 되돌아갔다.
  const hi = points.length ? Math.max(...points) : initial
  const prevSizes = useRef({ initial, hi })
  useEffect(() => {
    const prev = prevSizes.current
    prevSizes.current = { initial, hi }
    if (prev.initial === initial && prev.hi === hi) return
    // 끄는 중이면 손가락 자리를 그대로 둔다 — 여기서 높이를 바꾸면 시트가 한 프레임에 툭 튀었다가 다음 움직임에 되돌아왔다.
    if (dragging.current) return
    let next: number
    if (Math.abs(current.current - prev.initial) <= 1) next = initial
    else if (current.current >= prev.hi - 1) next = hi
    else {
      const at = current.current
      next = snaps.current.reduce((best, p) => (Math.abs(p - at) < Math.abs(best - at) ? p : best), initial)
    }
    if (next !== current.current) {
      current.current = next
      bodyHeight.setValue(next)
    }
  }, [initial, hi, bodyHeight])

  // 닫히는 중에 시트가 사라지면(다른 핀으로 바뀌어 새 시트가 뜨는 등) 남은 애니메이션을 멈춘다 — 끝난 뒤 onClose 가 새 선택을 닫지 않게.
  const dragCleanup = useRef<(() => void) | null>(null)
  const mounted = useRef(true)
  useEffect(
    () => () => {
      mounted.current = false
      dragCleanup.current?.()
      translateY.stopAnimation()
      bodyHeight.stopAnimation()
    },
    [translateY, bodyHeight],
  )

  // 끄는 동안 높이를 바꾸고, 놓으면 가까운 크기로 붙거나 닫는다. 터치(PanResponder)·마우스(웹 포인터) 둘 다 이 함수들을 쓴다.
  const dragApi = useMemo(() => {
    const begin = () => {
      dragging.current = true
      // 화면에 보이는 지금 높이에서 시작한다. 예전엔 직전 애니메이션(열기·붙기)의 목표 크기에서 시작해, 시트가 움직이는 중에
      // 바로 잡으면(업체를 누르자마자 끌기 등) 첫 움직임에 목표 크기로 툭 튀었다. 아래로 내려 둔 만큼(translateY)은 빼 준다(move 와 같은 셈).
      let height = current.current
      let offset = 0
      bodyHeight.stopAnimation((value) => {
        height = value
      })
      translateY.stopAnimation((value) => {
        offset = value
      })
      startHeight.current = height - Math.max(0, offset)
      current.current = Math.max(snaps.current[0] ?? 0, startHeight.current)
    }
    const move = (dy: number) => {
      const lo = snaps.current[0]
      const hi = snaps.current[snaps.current.length - 1]
      const next = startHeight.current - dy
      if (next >= lo) {
        translateY.setValue(0)
        bodyHeight.setValue(Math.min(hi, next))
      } else {
        // 가장 작은 크기 아래로는 시트 자체를 내린다(닫기 직전 모양).
        bodyHeight.setValue(lo)
        translateY.setValue(lo - next)
      }
    }
    /** 놓은 높이·속도로 붙을 크기 점을 고른다. */
    const snapTarget = (height: number, vy: number) => {
      const points = snaps.current
      const lo = points[0]
      const hi = points[points.length - 1]
      const clamped = Math.min(hi, Math.max(lo, height))
      if (vy < -FLICK_VELOCITY) return points.find((p) => p > clamped + 1) ?? hi
      if (vy > FLICK_VELOCITY) return [...points].reverse().find((p) => p < clamped - 1) ?? lo
      return points.reduce((best, p) => (Math.abs(p - clamped) < Math.abs(best - clamped) ? p : best), lo)
    }
    const settle = (target: number) => {
      dragging.current = false
      current.current = target
      // 감속하며 부드럽게 붙는다(튕김 없이). damping 22 는 임계 감쇠(≈28)보다 작아 목표를 몇 px 넘었다 돌아왔다 —
      // 작게(내용 높이)로 내릴 때 본문이 내용보다 잠깐 작아져 아래 '더 있음' 흰 그라데이션이 회색 줄을 덮었다 사라졌다(10-12).
      // overshootClamping 으로 목표를 넘지 않게 한다.
      Animated.parallel([
        Animated.spring(bodyHeight, { toValue: target, useNativeDriver: false, damping: 22, stiffness: 220, mass: 0.9, overshootClamping: true }),
        Animated.spring(translateY, { toValue: 0, useNativeDriver: false, damping: 22, stiffness: 220, mass: 0.9, overshootClamping: true }),
      ]).start()
    }
    const end = (dy: number, vy: number) => {
      const [lo] = snaps.current
      const next = startHeight.current - dy
      // 실제로 아래로 끌었을 때만 닫는다 — 열리며 올라오는 중에 잡았다 놓은 것(시작부터 아래에 있던 것)까지 닫지 않게.
      if (dy > 0 && (next < lo - DISMISS_OVERSHOOT_PX || (next <= lo + 10 && vy > DISMISS_VELOCITY))) {
        dragging.current = false
        Animated.timing(translateY, {
          toValue: Math.max(800, Dimensions.get('window').height),
          duration: 200,
          easing: Easing.in(Easing.quad),
          useNativeDriver: false,
        }).start(({ finished }) => {
          // 중간에 멈췄으면(시트가 사라짐) 닫기를 부르지 않는다.
          if (!finished) return
          // 먼저 닫는다. 예전엔 위치·높이를 처음 값으로 되돌린 뒤 닫아, 화면에서 빠지기 전 한두 프레임 동안 시트가
          // 제자리에 다시 나타났다 사라지며 깜빡였다(10-12). 부모가 시트를 내리지 않고 남겨 두는 경우에만 나중에 되돌린다.
          onCloseRef.current()
          setTimeout(() => {
            if (!mounted.current) return
            translateY.setValue(0)
            current.current = initialRef.current
            bodyHeight.setValue(initialRef.current)
          }, 300)
        })
        return
      }
      // 항상 크기 점(작게·보통·맨 위) 중 하나에 붙는다(10-12 요청: 중간에 애매하게 멈춘 시트를 없앤다 — 예전 10-07 엔
      // 놓은 자리에 멈췄다). 빠르게 튕기면 그 방향 다음 크기로, 아니면 가장 가까운 크기로.
      settle(snapTarget(next, vy))
    }
    /** 손잡이를 끌지 않고 눌렀을 때: 한 단계 크게(가장 크면 처음 크기로). */
    const tap = () => {
      const points = snaps.current
      const bigger = points.find((p) => p > current.current + 1)
      settle(bigger ?? initialRef.current)
    }
    // 끌다가 끊겨도(다른 제스처가 가져감 등) 중간에 두지 않고 가까운 크기로 붙인다.
    const cancel = () => settle(snapTarget(current.current, 0))
    return { begin, move, end, tap, cancel }
    // initial 은 ref 로 읽는다 — 내용 높이를 잴 때마다 바뀌는데, 그때 PanResponder 가 끄는 도중 새로 만들어지면 손가락 위치를 잃는다.
  }, [translateY, bodyHeight])

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        // 누르기만 해도 잡는다 — 끌지 않고 떼면 '한 단계 크게'.
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dy) > 4 && Math.abs(g.dy) > Math.abs(g.dx),
        onPanResponderGrant: () => dragApi.begin(),
        onPanResponderMove: (_, g) => dragApi.move(g.dy),
        onPanResponderRelease: (_, g) => {
          if (Math.abs(g.dy) < 6 && Math.abs(g.dx) < 6) dragApi.tap()
          else dragApi.end(g.dy, g.vy)
        },
        // 손잡이는 머리줄 영역(areaHandlers) 안에 있다. 끄는 도중 머리줄이 제스처를 가져가면 '제자리로 되돌리기'와 새 끌기가
        // 겹쳐 시트가 덜컥거렸다 — 손잡이에서 시작한 제스처는 끝까지 손잡이가 맡는다.
        onPanResponderTerminationRequest: () => false,
        onPanResponderTerminate: () => dragApi.cancel(),
      }),
    [dragApi],
  )

  // 웹: 마우스로도 끌 수 있게 포인터 이벤트를 직접 받는다(PanResponder 는 웹에서 마우스 끌기를 잘 못 잡는다).
  const webHandlers =
    Platform.OS === 'web'
      ? {
          onPointerDown: (raw: unknown) => {
            type Ptr = { clientY?: number; pointerType?: string; button?: number; ctrlKey?: boolean; isPrimary?: boolean }
            const e = raw as Ptr & { preventDefault?: () => void; nativeEvent?: Ptr }
            const ne = e.nativeEvent ?? e
            if ((ne.pointerType ?? e.pointerType) === 'touch') return // 터치는 PanResponder 가 맡는다
            // 왼쪽 버튼만 — 오른쪽·ctrl 클릭은 메뉴가 떼기(pointerup)를 삼켜, 버튼을 놓은 뒤에도 시트가 마우스를 따라다녔다.
            if ((ne.button ?? 0) !== 0 || ne.ctrlKey || ne.isPrimary === false) return
            e.preventDefault?.()
            // 손잡이는 머리줄 영역(areaHandlers) 안에 있다 — 둘이 같이 끌기를 시작하지 않게 여기서 멈춘다.
            ;(e as { stopPropagation?: () => void }).stopPropagation?.()
            dragCleanup.current?.()
            const startY = e.nativeEvent?.clientY ?? e.clientY ?? 0
            let lastY = startY
            let lastT = Date.now()
            let vy = 0
            dragApi.begin()
            const cleanup = () => {
              window.removeEventListener('pointermove', onMove)
              window.removeEventListener('pointerup', onUp)
              window.removeEventListener('pointercancel', onCancel)
              window.removeEventListener('contextmenu', onCancel)
              window.removeEventListener('blur', onCancel)
              if (dragCleanup.current === cleanup) dragCleanup.current = null
            }
            // 떼기를 못 받은 채 끝난 끌기(메뉴·창 전환·취소)는 놓은 자리에 둔다.
            const onCancel = () => {
              cleanup()
              dragApi.cancel()
            }
            const onMove = (ev: PointerEvent) => {
              if (ev.buttons === 0) return onCancel() // 버튼을 이미 놓았다(떼기를 놓침)
              const now = Date.now()
              vy = (ev.clientY - lastY) / Math.max(1, now - lastT)
              lastY = ev.clientY
              lastT = now
              dragApi.move(ev.clientY - startY)
            }
            const onUp = (ev: PointerEvent) => {
              cleanup()
              const dy = ev.clientY - startY
              if (Math.abs(dy) < 6) dragApi.tap()
              else dragApi.end(dy, vy)
            }
            window.addEventListener('pointermove', onMove)
            window.addEventListener('pointerup', onUp)
            window.addEventListener('pointercancel', onCancel)
            window.addEventListener('contextmenu', onCancel)
            window.addEventListener('blur', onCancel)
            dragCleanup.current = cleanup
          },
        }
      : {}

  /**
   * 머리줄(종류·제목·닫기 줄) 전체로도 끌게 하는 핸들러(10-09 요청 — 4px 손잡이만 잡혀 시트를 올리기 어려웠다).
   * 손잡이와 달리 누르기만 해서는 크기를 바꾸지 않고, 실제로 위아래로 끌 때만 잡는다 — 닫기·메뉴 버튼과 글자 누르기는 그대로.
   */
  const areaResponder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dy) > 6 && Math.abs(g.dy) > Math.abs(g.dx),
        onPanResponderGrant: () => dragApi.begin(),
        onPanResponderMove: (_, g) => dragApi.move(g.dy),
        onPanResponderRelease: (_, g) => dragApi.end(g.dy, g.vy),
        onPanResponderTerminate: () => dragApi.cancel(),
      }),
    [dragApi],
  )

  // 웹 마우스: 누른 뒤 6px 넘게 움직여야 끌기로 본다. 버튼·링크 위에서 누른 건 건드리지 않는다(클릭이 그대로 먹게).
  const areaWebHandlers =
    Platform.OS === 'web'
      ? {
          onPointerDown: (raw: unknown) => {
            type Ptr = { clientY?: number; pointerType?: string; button?: number; ctrlKey?: boolean; isPrimary?: boolean; target?: unknown }
            const e = raw as Ptr & { nativeEvent?: Ptr }
            const ne = e.nativeEvent ?? e
            if ((ne.pointerType ?? e.pointerType) === 'touch') return // 터치는 PanResponder 가 맡는다
            if ((ne.button ?? 0) !== 0 || ne.ctrlKey || ne.isPrimary === false) return
            const target = (ne.target ?? e.target) as { closest?: (sel: string) => unknown } | undefined
            if (target?.closest?.('button, a, input, textarea, [role="button"], [role="link"], [role="switch"]')) return
            dragCleanup.current?.()
            const startY = ne.clientY ?? 0
            let lastY = startY
            let lastT = Date.now()
            let vy = 0
            let dragging = false
            const cleanup = () => {
              window.removeEventListener('pointermove', onMove)
              window.removeEventListener('pointerup', onUp)
              window.removeEventListener('pointercancel', onCancel)
              window.removeEventListener('contextmenu', onCancel)
              window.removeEventListener('blur', onCancel)
              if (dragCleanup.current === cleanup) dragCleanup.current = null
            }
            const onCancel = () => {
              cleanup()
              if (dragging) dragApi.cancel()
            }
            const onMove = (ev: PointerEvent) => {
              if (ev.buttons === 0) return onCancel()
              const dy = ev.clientY - startY
              if (!dragging) {
                if (Math.abs(dy) <= 6) return
                dragging = true
                dragApi.begin()
                // 끄는 동안 글자가 선택되지 않게.
                window.getSelection?.()?.removeAllRanges()
              }
              ev.preventDefault()
              const now = Date.now()
              vy = (ev.clientY - lastY) / Math.max(1, now - lastT)
              lastY = ev.clientY
              lastT = now
              dragApi.move(dy)
            }
            const onUp = (ev: PointerEvent) => {
              cleanup()
              if (dragging) dragApi.end(ev.clientY - startY, vy)
            }
            window.addEventListener('pointermove', onMove)
            window.addEventListener('pointerup', onUp)
            window.addEventListener('pointercancel', onCancel)
            window.addEventListener('contextmenu', onCancel)
            window.addEventListener('blur', onCancel)
            dragCleanup.current = cleanup
          },
        }
      : {}

  // 본문 스크롤이 위·아래 끝에 닿은 채 더 끌 때 시트를 대신 움직이는 데 쓴다(SheetScrollBody).
  const bodyGesture = useMemo<SheetBodyGesture>(
    () => ({
      begin: dragApi.begin,
      move: dragApi.move,
      end: dragApi.end,
      cancel: dragApi.cancel,
      canGrow: () => current.current < (snaps.current[snaps.current.length - 1] ?? 0) - 1,
    }),
    [dragApi],
  )

  return {
    translateY,
    bodyHeight,
    panHandlers: { ...panResponder.panHandlers, ...webHandlers },
    areaHandlers: { ...areaResponder.panHandlers, ...areaWebHandlers },
    bodyGesture,
  }
}

/** 시트 본문 스크롤이 끝에 닿았을 때 시트 크기 조절로 넘기는 손잡이. */
export interface SheetBodyGesture {
  begin: () => void
  move: (dy: number) => void
  end: (dy: number, vy: number) => void
  cancel: () => void
  /** 지금 크기보다 더 커질 수 있는지(맨 위가 아닌지). */
  canGrow: () => boolean
}

/**
 * 지도 화면 위 오버레이(검색바·필터 칩)와 시트가 겹칠 때를 알린다. 시트는 화면 맨 위까지 올라갈 수 있고(10-07 요청),
 * 시트 윗변이 오버레이 아래 끝을 넘으면 `onCoverHeader(true)` 로 오버레이를 숨기게 한다 —
 * 예전엔 칩·검색바가 시트 위에 겹쳐 그려져 깨져 보였다.
 */
export const SheetHeaderContext = createContext<{ headerHeight: number; onCoverHeader?: (covered: boolean) => void }>({
  headerHeight: 0,
})

interface SheetSizingOptions {
  /** 처음 열 때(작게) 본문 높이 = 화면 높이 × 이 값. 내용이 더 짧으면 내용 높이(빈칸 없이). */
  smallRatio?: number
  /** 보통 크기 = 시트 전체(머리줄 포함)가 화면 높이 × 이 값을 차지하는 크기. */
  midRatio?: number
  /** 처음 열 크기. 기본은 작게. 검색으로 찾아온 줄을 보여 줄 때처럼 작게로는 잘려 보이면 'mid'(보통). */
  openAt?: 'small' | 'mid'
}

/**
 * 지도 바텀시트 공통 크기 조절. 손잡이(회색 줄)로 작게 → 보통(화면의 약 63%) → 화면 위 끝까지 세 단계를 오가고, 작게에서 더
 * 내리면 닫힌다(10-12 요청: 머리줄만 남는 단계와 절반 단계를 빼고 단계를 줄임). 처음엔 작게 연다.
 * 보통·맨 위는 내용 길이와 상관없이 모든 시트가 같다(10-12 요청 — 항목이 하나뿐이어도 끝까지 올릴 수 있게 UX 통일).
 * 작게(처음 열 때)만 내용 높이로 잘라, 짧은 시트가 아래에 빈칸을 단 채 열리지 않게 한다(10-12 요청).
 * 쓰는 법: 손잡이+머리줄을 감싼 View 에 `onChromeLayout`, 본문 ScrollView(Animated)에 `onContentSizeChange` 와
 * `style={{ height: bodyHeight }}`, 손잡이에 `panHandlers`, 시트에 `transform: [{ translateY }]`.
 */
export function useSheetSizing(
  onClose: () => void,
  { smallRatio = 0.22, midRatio = 0.63, openAt = 'small' }: SheetSizingOptions = {},
) {
  const { height: windowHeight } = useWindowDimensions()
  const insets = useSafeAreaInsets()
  const header = useContext(SheetHeaderContext)
  const [chromeHeight, setChromeHeight] = useState(110)
  const [contentHeight, setContentHeight] = useState<number | null>(null)
  // 시트 위아래 여백(위 10 + 아래 30)과 상태 표시줄·홈 인디케이터를 빼고 남는 만큼이 '화면 끝까지' 높이다.
  const fullHeight = Math.max(160, windowHeight - insets.top - insets.bottom - chromeHeight - 48)
  const cap = (h: number) => Math.min(h, fullHeight)
  const small = Math.round(cap(Math.min(windowHeight * smallRatio, contentHeight ?? Infinity)))
  // 머리줄·아래 여백까지 합쳐 시트가 화면의 midRatio 만큼 차지하게 본문 높이를 정한다.
  const mid = Math.round(cap(Math.max(small, windowHeight * midRatio - chromeHeight - insets.bottom - 40)))
  const top = Math.round(cap(fullHeight))
  const points = Array.from(new Set([small, mid, top]))
  // 처음 크기는 열 때 한 번만 정한다 — 열린 뒤 같은 시트에서 다시 검색해 와도 사용자가 고른 크기를 바꾸지 않게.
  const [openMid] = useState(openAt === 'mid')
  const { translateY, bodyHeight, panHandlers, areaHandlers, bodyGesture } = useResizableSheet(onClose, {
    initial: openMid ? mid : small,
    points,
  })

  // 본문이 이 높이를 넘으면 시트 윗변이 검색바·칩 오버레이 밑으로 들어간다 → 오버레이를 숨기게 알린다.
  const coverAt = windowHeight - Math.max(insets.top, header.headerHeight) - insets.bottom - chromeHeight - 48
  const onCoverRef = useRef(header.onCoverHeader)
  onCoverRef.current = header.onCoverHeader
  const coveredRef = useRef(false)
  useEffect(() => {
    if (!onCoverRef.current) return
    const apply = (value: number) => {
      // 경계 위아래로 8px 여유(히스테리시스)를 둔다 — 그 근처에서 끌면 숨김·보임이 번갈아 깜빡였다.
      const next =
        header.headerHeight > 0 && (coveredRef.current ? value > coverAt - 8 : value > coverAt + 8)
      if (next !== coveredRef.current) {
        coveredRef.current = next
        onCoverRef.current?.(next)
      }
    }
    // addListener 는 앞으로의 변화만 알린다 → 지금 크기로 바로 한 번 따진다. 예전엔 열 때·창 크기·머리줄/칩 높이가
    // 바뀔 때 이미 덮고 있어도 몰라서 검색바·칩이 시트 제목·손잡이 위에 겹쳐 그려졌다.
    apply((bodyHeight as unknown as { __getValue: () => number }).__getValue())
    const id = bodyHeight.addListener(({ value }) => apply(value))
    return () => bodyHeight.removeListener(id)
  }, [bodyHeight, coverAt, header.headerHeight])
  // 오버레이는 시트가 실제로 사라질 때만 되살린다(다시 구독할 때마다 되살리면 덮인 시트 위에 다시 그려졌다).
  useEffect(
    () => () => {
      if (coveredRef.current) onCoverRef.current?.(false)
    },
    [],
  )
  return {
    translateY,
    bodyHeight,
    panHandlers,
    /** 머리줄(손잡이 + 종류·제목 줄)을 감싼 View 에 건다 — 그 영역 어디를 끌어도 시트 크기가 바뀐다. */
    chromeHandlers: areaHandlers,
    onChromeLayout: (e: LayoutChangeEvent) => setChromeHeight(e.nativeEvent.layout.height),
    onContentSizeChange: (_w: number, h: number) => setContentHeight(h),
    /** 본문 `SheetScrollBody` 의 `sheetGesture` 로 넘긴다 — 스크롤 끝에서 더 끌면 시트가 커지거나 작아진다. */
    bodyGesture,
  }
}
