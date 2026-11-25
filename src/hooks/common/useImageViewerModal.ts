import { useEffect, useMemo, useRef, useState } from 'react'
import { Animated, Easing, FlatList, PanResponder, useWindowDimensions, type LayoutChangeEvent, type NativeScrollEvent, type NativeSyntheticEvent } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { NATIVE_PULL, DRAG_CLOSE_DISTANCE, DRAG_CLOSE_VELOCITY } from '../../utils/common/imageViewerModal'
import type { ImageViewerModalProps } from '../../components/common/ImageViewerModal'

/** ImageViewerModal 의 상태·효과·핸들러. 화면 파일은 이 훅을 불러 그리기만 한다. */
export function useImageViewerModal({ startIndex, onClose }: Pick<ImageViewerModalProps, 'startIndex' | 'onClose'>) {
  const window = useWindowDimensions()
  const insets = useSafeAreaInsets()
  const [index, setIndex] = useState(startIndex ?? 0)
  // 사진 한 장 크기는 실제로 깔린 자리에 맞춘다 — 창 크기로 그리면 부모 창 안(inline)에서 위아래가 잘렸다(11-01).
  const [frame, setFrame] = useState<{ width: number; height: number } | null>(null)
  const width = frame?.width ?? window.width
  const height = frame?.height ?? window.height
  const listRef = useRef<FlatList<string>>(null)
  // 열 때마다 새 값으로 시작한다. 끌어 닫으면 값이 화면 밖(창 높이)에 남는데, 네이티브 드라이버로 움직인 값은
  // 다시 열 때 setValue(0) 이 늦게 닿아 사진이 화면 밖에 그대로 있었다 — 빈 검은 창이 터치까지 막았다(11-01).
  const open = startIndex !== null
  const dragRef = useRef<{ drag: Animated.Value; pull: Animated.Value } | null>(null)
  const wasOpenRef = useRef(false)
  if (!dragRef.current || (open && !wasOpenRef.current)) {
    dragRef.current = { drag: new Animated.Value(0), pull: new Animated.Value(0) }
  }
  wasOpenRef.current = open
  const dragY = dragRef.current.drag
  /** iOS 에서 사진 칸을 당긴 거리(아래로 당기면 +). 배경을 옅게 하는 데만 쓴다 — 사진은 네이티브로 움직인다. */
  const pullY = dragRef.current.pull
  const zoomedRef = useRef(false)
  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose

  useEffect(() => {
    if (startIndex !== null) {
      setIndex(startIndex)
      zoomedRef.current = false
    }
  }, [startIndex])

  const pan = useMemo(() => {
    const springBack = () =>
      Animated.spring(dragY, { toValue: 0, useNativeDriver: true, damping: 20, stiffness: 260 }).start()
    const isVerticalDrag = (dx: number, dy: number) =>
      !NATIVE_PULL &&
      !zoomedRef.current && Math.abs(dy) > 10 && Math.abs(dy) > Math.abs(dx) * 1.5
    const exit = (direction: number) =>
      Animated.timing(dragY, {
        toValue: direction * window.height,
        duration: 180,
        easing: Easing.in(Easing.cubic),
        useNativeDriver: true,
      }).start(() => onCloseRef.current())
    return {
      exit,
      handlers: PanResponder.create({
      // 세로가 확실할 때만 가로챈다 — 옆으로 넘기기와 확대한 사진 움직이기는 그대로 둔다.
      onMoveShouldSetPanResponderCapture: (_, g) => isVerticalDrag(g.dx, g.dy),
      onMoveShouldSetPanResponder: (_, g) => isVerticalDrag(g.dx, g.dy),
      // 사진 칸(확대용 ScrollView)·옆 넘기기 목록이 중간에 가져가면 끌던 사진이 제자리로 돌아가 한 번에 안 닫혔다(11-01).
      onPanResponderTerminationRequest: () => false,
      onPanResponderMove: (_, g) => dragY.setValue(g.dy),
      onPanResponderRelease: (_, g) => {
        if (Math.abs(g.dy) > DRAG_CLOSE_DISTANCE || Math.abs(g.vy) > DRAG_CLOSE_VELOCITY) {
          exit((g.dy || g.vy) < 0 ? -1 : 1)
        } else {
          springBack()
        }
      },
      onPanResponderTerminate: springBack,
      }).panHandlers,
    }
  }, [dragY, window.height])

  /** iOS: 사진 칸을 당겼다 놓았다. 충분히 당겼거나 빠르게 튕겼으면 당긴 쪽으로 내보내며 닫는다. */
  const handlePullEnd = (pulled: number, velocity: number) => {
    if (Math.abs(pulled) > DRAG_CLOSE_DISTANCE * 0.75 || (Math.abs(pulled) > 12 && Math.abs(velocity) > DRAG_CLOSE_VELOCITY)) {
      pan.exit(pulled < 0 ? -1 : 1)
    }
  }

  // 끌수록 뒤 화면(바텀시트·제보 본문)이 비쳐 보이게 배경을 옅게 한다.
  const backdropOpacity = Animated.add(dragY, pullY).interpolate({
    inputRange: [-window.height / 2, 0, window.height / 2],
    outputRange: [0.2, 1, 0.2],
    extrapolate: 'clamp',
  })

  const handleLayout = (event: LayoutChangeEvent) => {
    const next = { width: Math.round(event.nativeEvent.layout.width), height: Math.round(event.nativeEvent.layout.height) }
    if (next.width > 0 && next.height > 0 && (next.width !== frame?.width || next.height !== frame?.height)) setFrame(next)
  }

  const handleScrollEnd = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    setIndex(Math.round(event.nativeEvent.contentOffset.x / width))
  }
  return {
    insets,
    index,
    width,
    height,
    listRef,
    open,
    dragY,
    pullY,
    zoomedRef,
    pan,
    handlePullEnd,
    backdropOpacity,
    handleLayout,
    handleScrollEnd,
  }
}
