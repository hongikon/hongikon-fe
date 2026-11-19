import { useCallback, useEffect, useMemo, useRef } from 'react'
import {
  Animated,
  Easing,
  Keyboard,
  PanResponder,
  Platform,
  useWindowDimensions,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native'
import { isDownwardDrag, shouldCloseOnPull, shouldCloseOnRelease } from '../../utils/news/searchGestures'

/**
 * 아래에서 올라온 검색 화면을 아래로 끌어내려 닫는다(10-08 요청).
 * - 머리 카드(검색창 줄)를 끌어내리면 화면이 손가락을 따라 내려가고, 충분히 내렸거나 빠르게 튕기면 닫힌다(모든 플랫폼).
 * - iOS 는 목록 맨 위에서 더 끌어내린(바운스) 거리로도 닫는다. 안드로이드·웹은 맨 위에서 더 끌어도 목록이 늘어나지 않아 머리 카드로만.
 * 웹은 화면 전환 애니메이션이 없어(native-stack 웹판) 열고 닫을 때 직접 아래에서 올리고 내린다. 앱은 slide_from_bottom 이 한다.
 *
 * `dragY` 는 화면 전체의 translateY, `headerPan` 은 머리 카드에, `handleScrollEndDrag` 는 목록에 붙인다.
 * `close` 는 한 번만 돈다(뒤로 가기 버튼도 이것을 쓴다).
 */
export function useSearchSheetDismiss(goBack: () => void) {
  const isWeb = Platform.OS === 'web'
  const { height: windowHeight } = useWindowDimensions()
  const dragY = useRef(new Animated.Value(isWeb ? windowHeight : 0)).current
  useEffect(() => {
    if (!isWeb) return
    Animated.timing(dragY, { toValue: 0, duration: 260, easing: Easing.out(Easing.cubic), useNativeDriver: false }).start()
  }, [isWeb, dragY])
  const closing = useRef(false)
  const close = useCallback(() => {
    if (closing.current) return
    closing.current = true
    Keyboard.dismiss()
    if (!isWeb) {
      goBack()
      return
    }
    Animated.timing(dragY, { toValue: windowHeight, duration: 220, easing: Easing.in(Easing.cubic), useNativeDriver: false }).start(
      () => goBack(),
    )
  }, [goBack, isWeb, dragY, windowHeight])
  const headerPan = useMemo(() => {
    const springBack = () =>
      Animated.spring(dragY, { toValue: 0, useNativeDriver: Platform.OS !== 'web', damping: 20, stiffness: 260 }).start()
    return PanResponder.create({
      onMoveShouldSetPanResponder: (_, g) => isDownwardDrag(g.dx, g.dy),
      onPanResponderMove: (_, g) => dragY.setValue(Math.max(0, g.dy)),
      onPanResponderRelease: (_, g) => {
        if (shouldCloseOnRelease(g.dy, g.vy)) close()
        else springBack()
      },
      onPanResponderTerminate: springBack,
    })
  }, [dragY, close])
  const handleScrollEndDrag = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      if (shouldCloseOnPull(Platform.OS, event.nativeEvent.contentOffset.y)) close()
    },
    [close],
  )
  return { dragY, close, headerPan, handleScrollEndDrag }
}
