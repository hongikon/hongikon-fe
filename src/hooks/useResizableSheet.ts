import { useEffect, useMemo, useRef } from 'react'
import { Animated, PanResponder } from 'react-native'

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
 * 본문 높이는 maxHeight 로 바꾸므로 내용이 짧으면 늘려도 내용 높이까지만 커진다.
 * `panHandlers` 는 손잡이에만 건다 — 본문 스크롤과 부딪히지 않게.
 */
export function useResizableSheet(onClose: () => void, { initial, points }: Options) {
  const translateY = useRef(new Animated.Value(0)).current
  const bodyMaxHeight = useRef(new Animated.Value(initial)).current
  const current = useRef(initial)
  const startHeight = useRef(initial)
  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose
  const snaps = useRef<number[]>([])
  snaps.current = [...points].sort((a, b) => a - b)

  // 화면 크기가 바뀌면(회전·창 크기) 보통 크기로 되돌린다.
  useEffect(() => {
    current.current = initial
    bodyMaxHeight.setValue(initial)
  }, [initial, bodyMaxHeight])

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
            bodyMaxHeight.setValue(Math.min(hi, next))
          } else {
            // 가장 작은 크기 아래로는 시트 자체를 내린다(닫기 직전 모양).
            bodyMaxHeight.setValue(lo)
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
              bodyMaxHeight.setValue(initial)
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
            Animated.spring(bodyMaxHeight, { toValue: target, useNativeDriver: false, damping: 22, stiffness: 220, mass: 0.9 }),
            Animated.spring(translateY, { toValue: 0, useNativeDriver: false, damping: 22, stiffness: 220, mass: 0.9 }),
          ]).start()
        },
        onPanResponderTerminate: () => {
          Animated.parallel([
            Animated.spring(bodyMaxHeight, { toValue: current.current, useNativeDriver: false }),
            Animated.spring(translateY, { toValue: 0, useNativeDriver: false }),
          ]).start()
        },
      }),
    [translateY, bodyMaxHeight, initial],
  )

  return { translateY, bodyMaxHeight, panHandlers: panResponder.panHandlers }
}
