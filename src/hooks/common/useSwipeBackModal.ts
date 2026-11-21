import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { Animated, Easing, PanResponder, Platform, useWindowDimensions } from 'react-native'
import { CLOSE_RATIO, CLOSE_VELOCITY } from '../../utils/common/swipeBackModal'

/** SwipeBackModal 의 상태·효과·핸들러. 화면 파일은 이 훅을 불러 그리기만 한다. */
export function useSwipeBackModal({ visible, onRequestClose }: Pick<{
  visible: boolean
  onRequestClose: () => void
  onShow?: () => void
  /** 창 안에 덮어 그린 것(사진 크게 보기 등)이 있을 때 가장자리 밀기를 잠시 끈다. */
  edgeDisabled?: boolean
  children: ReactNode
}, 'visible' | 'onRequestClose'>) {
  const { width } = useWindowDimensions()
  const x = useRef(new Animated.Value(width)).current
  const [mounted, setMounted] = useState(visible)
  const widthRef = useRef(width)
  widthRef.current = width
  const closeRef = useRef(onRequestClose)
  closeRef.current = onRequestClose
  const visibleRef = useRef(visible)
  visibleRef.current = visible

  useEffect(() => {
    if (visible) {
      setMounted(true)
      x.setValue(widthRef.current)
      Animated.timing(x, { toValue: 0, duration: 260, easing: Easing.out(Easing.cubic), useNativeDriver: Platform.OS !== 'web' }).start()
    } else {
      Animated.timing(x, { toValue: widthRef.current, duration: 220, easing: Easing.in(Easing.cubic), useNativeDriver: Platform.OS !== 'web' }).start(
        () => setMounted(false),
      )
    }
  }, [visible, x])

  const pan = useMemo(
    () =>
      PanResponder.create({
        // 가장자리 띠에서 시작한 끌기만 받는다. 띠가 본문 위에 떠 있어 스크롤 창(iOS 네이티브)이 먼저 가져가지 못한다.
        onStartShouldSetPanResponder: () => true,
        onPanResponderTerminationRequest: () => false,
        onPanResponderMove: (_, g) => x.setValue(Math.max(0, g.dx)),
        onPanResponderRelease: (_, g) => {
          if (g.dx > widthRef.current * CLOSE_RATIO || g.vx > CLOSE_VELOCITY) {
            Animated.timing(x, { toValue: widthRef.current, duration: 180, useNativeDriver: Platform.OS !== 'web' }).start(() => {
              closeRef.current()
              // 닫기를 받은 쪽이 창을 닫지 않으면(공지 본문 → 목록으로만 돌아감, 작성 중 확인 등) 내용이 화면 밖에 밀려난 채
              // 투명한 창이 남아 앱 전체가 눌리지 않았다(11-06 iOS, 공지 본문에서 밀어 나오면 멈춤). 그대로 열려 있으면 다시 들인다.
              setTimeout(() => {
                if (!visibleRef.current) return
                Animated.timing(x, { toValue: 0, duration: 220, easing: Easing.out(Easing.cubic), useNativeDriver: Platform.OS !== 'web' }).start()
              }, 50)
            })
          } else {
            Animated.spring(x, { toValue: 0, useNativeDriver: Platform.OS !== 'web', bounciness: 0 }).start()
          }
        },
        onPanResponderTerminate: () => Animated.spring(x, { toValue: 0, useNativeDriver: Platform.OS !== 'web', bounciness: 0 }).start(),
      }),
    [x],
  )
  return { x, mounted, pan }
}
