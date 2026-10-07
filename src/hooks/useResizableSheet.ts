import { useEffect, useMemo, useRef, useState } from 'react'
import { Animated, Easing, PanResponder, useWindowDimensions, type LayoutChangeEvent } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

/** 가장 작은 크기에서 이만큼 더 끌어내리면 닫는다. */
const DISMISS_OVERSHOOT_PX = 70
/** 이 속도(px/ms)보다 빠르게 아래로 튕기면, 가장 작은 크기일 때 닫는다. */
const DISMISS_VELOCITY = 1.2
/** 손을 뗄 때 이 속도보다 빠르면 끈 방향의 다음 크기로 넘긴다. */
const SNAP_VELOCITY = 0.4
/** 다음 크기까지 거리의 이 비율만 넘기면 그 크기로 붙는다. */
const SNAP_FRACTION = 0.25

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
 * 작은·보통 크기는 시트 쪽에서 내용 높이로 잘라 넘겨, 내용이 짧을 때 빈칸이 생기지 않게 한다.
 * `panHandlers` 는 손잡이에만 건다 — 본문 스크롤과 부딪히지 않게.
 */
export function useResizableSheet(onClose: () => void, { initial, points }: Options) {
  const translateY = useRef(new Animated.Value(0)).current
  const bodyHeight = useRef(new Animated.Value(initial)).current
  const current = useRef(initial)
  const startHeight = useRef(initial)
  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose
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

  // 화면 크기가 바뀌면(회전·창 크기) 보통 크기로 되돌린다.
  useEffect(() => {
    current.current = initial
    bodyHeight.setValue(initial)
  }, [initial, bodyHeight])

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => false,
        onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dy) > 4 && Math.abs(g.dy) > Math.abs(g.dx),
        onPanResponderGrant: () => {
          startHeight.current = current.current
        },
        onPanResponderMove: (_, g) => {
          const lo = snaps.current[0]
          const hi = snaps.current[snaps.current.length - 1]
          const next = startHeight.current - g.dy
          if (next >= lo) {
            translateY.setValue(0)
            bodyHeight.setValue(Math.min(hi, next))
          } else {
            // 가장 작은 크기 아래로는 시트 자체를 내린다(닫기 직전 모양).
            bodyHeight.setValue(lo)
            translateY.setValue(lo - next)
          }
        },
        onPanResponderRelease: (_, g) => {
          const [lo] = snaps.current
          const next = startHeight.current - g.dy
          if (next < lo - DISMISS_OVERSHOOT_PX || (next <= lo + 10 && g.vy > DISMISS_VELOCITY)) {
            Animated.timing(translateY, { toValue: 800, duration: 180, useNativeDriver: false }).start(() => {
              translateY.setValue(0)
              current.current = initial
              bodyHeight.setValue(initial)
              onCloseRef.current()
            })
            return
          }
          // 끈 방향으로 다음 크기까지 거리의 1/4 만 넘어가도 그 크기로 미끄러지듯 붙는다(크게 쪽으로 끌다 놓으면 끝까지 올라간다).
          // 빠르게 튕기면 거리와 상관없이 그 방향 다음 크기로.
          const points = snaps.current
          const start = startHeight.current
          let target = start
          if (next > start) {
            for (const p of points) {
              if (p <= start + 1) continue
              const prev = points[points.indexOf(p) - 1] ?? start
              if (next >= prev + (p - prev) * SNAP_FRACTION || g.vy < -SNAP_VELOCITY) target = p
              if (next < p) break
            }
          } else if (next < start) {
            for (const p of [...points].reverse()) {
              if (p >= start - 1) continue
              const prev = points[points.indexOf(p) + 1] ?? start
              if (next <= prev - (prev - p) * SNAP_FRACTION || g.vy > SNAP_VELOCITY) target = p
              if (next > p) break
            }
          }
          if (!points.includes(target)) {
            target = points.reduce((best, p) => (Math.abs(p - next) < Math.abs(best - next) ? p : best), points[0])
          }
          current.current = target
          // 감속하며 부드럽게 붙는다(튕김 없이).
          Animated.parallel([
            Animated.spring(bodyHeight, { toValue: target, useNativeDriver: false, damping: 22, stiffness: 220, mass: 0.9 }),
            Animated.spring(translateY, { toValue: 0, useNativeDriver: false, damping: 22, stiffness: 220, mass: 0.9 }),
          ]).start()
        },
        onPanResponderTerminate: () => {
          Animated.parallel([
            Animated.spring(bodyHeight, { toValue: current.current, useNativeDriver: false }),
            Animated.spring(translateY, { toValue: 0, useNativeDriver: false }),
          ]).start()
        },
      }),
    [translateY, bodyHeight, initial],
  )

  return { translateY, bodyHeight, panHandlers: panResponder.panHandlers }
}

interface SheetSizingOptions {
  /** 처음 열 때(작게) 본문 높이 = 화면 높이 × 이 값. 내용이 더 짧으면 내용 높이. */
  smallRatio?: number
  /** 보통 크기 = 화면 높이 × 이 값(내용 높이로 자른다). */
  midRatio?: number
}

/**
 * 지도 바텀시트 공통 크기 조절. 손잡이(회색 줄)로 머리줄만 → 작게 → 보통 → 화면 위 끝까지를 오가고, 머리줄만 남긴 채 더
 * 내리면 닫힌다. 처음엔 작게 연다. 작게·보통은 내용 높이로 잘라 빈칸이 생기지 않게 한다.
 * 쓰는 법: 손잡이+머리줄을 감싼 View 에 `onChromeLayout`, 본문 ScrollView(Animated)에 `onContentSizeChange` 와
 * `style={{ height: bodyHeight }}`, 손잡이에 `panHandlers`, 시트에 `transform: [{ translateY }]`.
 */
export function useSheetSizing(
  onClose: () => void,
  { smallRatio = 0.22, midRatio = 0.5 }: SheetSizingOptions = {},
) {
  const { height: windowHeight } = useWindowDimensions()
  const insets = useSafeAreaInsets()
  const [contentHeight, setContentHeight] = useState<number | null>(null)
  const [chromeHeight, setChromeHeight] = useState(110)
  // 시트 위아래 여백(위 10 + 아래 30)과 상태 표시줄·홈 인디케이터를 빼고 남는 만큼이 '화면 끝까지' 높이다.
  const fullHeight = Math.max(160, windowHeight - insets.top - insets.bottom - chromeHeight - 48)
  const cap = (h: number) => Math.min(contentHeight === null ? h : Math.min(h, contentHeight), fullHeight)
  const small = Math.round(cap(windowHeight * smallRatio))
  const mid = Math.round(cap(windowHeight * midRatio))
  const points = Array.from(new Set([0, small, mid, Math.round(fullHeight)]))
  const { translateY, bodyHeight, panHandlers } = useResizableSheet(onClose, { initial: small, points })
  return {
    translateY,
    bodyHeight,
    panHandlers,
    onChromeLayout: (e: LayoutChangeEvent) => setChromeHeight(e.nativeEvent.layout.height),
    onContentSizeChange: (_w: number, h: number) => setContentHeight(h),
  }
}
