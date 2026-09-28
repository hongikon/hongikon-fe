import { useMemo, useRef } from 'react'
import { Animated, PanResponder } from 'react-native'

/** 이만큼 끌어내리면 손을 떼도 닫힌 걸로 친다. */
const DISMISS_DISTANCE_PX = 80
/** 짧게 끌어도 이 속도(px/ms)보다 빠르게 튕기면 거리와 상관없이 닫는다. */
const DISMISS_VELOCITY = 1.2

/**
 * 바텀시트 핸들바를 아래로 끌어 닫는 제스처(네이버·카카오맵 장소 카드처럼).
 * `react-native-gesture-handler` 없이 코어 `PanResponder`+`Animated` 만 쓴다 —
 * 세로 한 방향 드래그일 뿐이라 굳이 새 의존성을 들일 정도는 아니다.
 *
 * `panHandlers` 는 핸들바(손잡이)에만 건다 — 시트 본문(스크롤 영역)에 걸면
 * 스크롤 제스처와 부딪힌다.
 */
export function useSwipeDownToDismiss(onClose: () => void) {
  const translateY = useRef(new Animated.Value(0)).current
  // PanResponder 콜백은 최초 생성 시점의 onClose 를 오래 들고 있을 수 있어(리렌더마다
  // 새로 만들지 않으므로) ref 로 최신 값을 참조한다.
  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => false,
        onMoveShouldSetPanResponder: (_, gesture) =>
          gesture.dy > 4 && Math.abs(gesture.dy) > Math.abs(gesture.dx),
        onPanResponderMove: (_, gesture) => {
          // 위로는 못 끌게 막는다 — 시트가 화면 위로 더 올라갈 이유가 없다.
          if (gesture.dy > 0) translateY.setValue(gesture.dy)
        },
        onPanResponderRelease: (_, gesture) => {
          const shouldDismiss =
            gesture.dy > DISMISS_DISTANCE_PX || gesture.vy > DISMISS_VELOCITY
          if (shouldDismiss) {
            Animated.timing(translateY, {
              toValue: 600,
              duration: 180,
              useNativeDriver: true,
            }).start(() => {
              // 다음에 이 시트가 다시 뜰 때 아래에서부터 다시 나타나면 안 되니 되돌려 둔다.
              translateY.setValue(0)
              onCloseRef.current()
            })
            return
          }
          Animated.spring(translateY, {
            toValue: 0,
            useNativeDriver: true,
            bounciness: 6,
          }).start()
        },
        onPanResponderTerminate: () => {
          Animated.spring(translateY, { toValue: 0, useNativeDriver: true, bounciness: 6 }).start()
        },
      }),
    [translateY],
  )

  return { translateY, panHandlers: panResponder.panHandlers }
}
