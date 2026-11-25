import { useCallback, useMemo, useRef } from 'react'
import { Animated, Keyboard, PanResponder, Platform, type NativeScrollEvent, type NativeSyntheticEvent } from 'react-native'

/** iOS: 목록 맨 위에서 이만큼 더 끌어내렸다 놓으면 닫는다(바운스로 늘어난 거리). */
const PULL_CLOSE_DISTANCE = 70
/** 머리 카드를 이만큼 끌어내리거나 빠르게 튕기면 닫는다. */
const DRAG_CLOSE_DISTANCE = 120
const DRAG_CLOSE_VELOCITY = 0.9

/**
 * 아래에서 올라온 창을 아래로 끌어내려 닫기(10-08 요청 — 소식 검색과 같은 동작).
 * - `headerPanHandlers` 를 머리 카드를 감싼 View 에 붙이면, 끌어내리는 동안 `dragY` 만큼 창이 따라 내려가고
 *   충분히 내렸거나 빠르게 튕기면 `onClose` 를 부른다(모든 플랫폼). 덜 내리면 제자리로 돌아온다.
 * - `onScrollEndDrag` 를 목록(ScrollView·FlatList)에 붙이면 iOS 에선 맨 위에서 더 끌어내린(바운스) 거리로도 닫는다.
 *   안드로이드·웹은 맨 위에서 더 끌어도 목록이 늘어나지 않아 머리 카드로만 닫힌다.
 * 창 내용을 `transform: [{ translateY: dragY }]` 인 Animated.View 로 감싼다.
 */
export function useDragToClose(onClose: () => void) {
  const dragY = useRef(new Animated.Value(0)).current
  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose

  const close = useCallback(() => {
    Keyboard.dismiss()
    onCloseRef.current()
    // 창이 닫히며 사라진 뒤 다시 열면 제자리에서 시작하게 되돌려 둔다.
    setTimeout(() => dragY.setValue(0), 400)
  }, [dragY])

  const headerPanHandlers = useMemo(() => {
    const springBack = () =>
      Animated.spring(dragY, { toValue: 0, useNativeDriver: Platform.OS !== 'web', damping: 20, stiffness: 260 }).start()
    return PanResponder.create({
      // 아래로, 세로가 확실할 때만 잡는다 — 뒤로 가기·검색창 누르기와 가로 동작은 그대로 둔다.
      onMoveShouldSetPanResponder: (_, g) => g.dy > 8 && Math.abs(g.dy) > Math.abs(g.dx) * 1.5,
      onPanResponderMove: (_, g) => dragY.setValue(Math.max(0, g.dy)),
      onPanResponderRelease: (_, g) => {
        if (g.dy > DRAG_CLOSE_DISTANCE || g.vy > DRAG_CLOSE_VELOCITY) close()
        else springBack()
      },
      onPanResponderTerminate: springBack,
    }).panHandlers
  }, [dragY, close])

  const onScrollEndDrag = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      if (Platform.OS === 'ios' && event.nativeEvent.contentOffset.y < -PULL_CLOSE_DISTANCE) close()
    },
    [close],
  )

  return { dragY, headerPanHandlers, onScrollEndDrag }
}
