import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { Animated, Easing, Modal, PanResponder, Platform, StyleSheet, useWindowDimensions } from 'react-native'
import { COLORS } from '../../constants/colors'

/** 왼쪽 가장자리에서 이만큼 안에서 시작한 끌기만 "뒤로"로 본다(본문의 가로 스크롤·칩과 겹치지 않게). */
const EDGE_WIDTH = 32
/** 화면 폭의 이만큼 넘게 밀거나 빠르게 튕기면 닫는다. */
const CLOSE_RATIO = 0.33
const CLOSE_VELOCITY = 0.5

/**
 * 설정에서 여는 창(11-01). 일반 화면처럼 오른쪽에서 밀려 들어오고, 왼쪽 가장자리에서 오른쪽으로 밀면 닫힌다
 * (전엔 아래에서 올라오는 창이라 뒤로 버튼으로만 닫혔다). 뒤로 버튼·Android 뒤로 가기는 `onRequestClose` 그대로.
 * 닫힐 때는 오른쪽으로 빠져나간 뒤 내용을 내린다.
 */
export default function SwipeBackModal({
  visible,
  onRequestClose,
  children,
}: {
  visible: boolean
  onRequestClose: () => void
  children: ReactNode
}) {
  const { width } = useWindowDimensions()
  const x = useRef(new Animated.Value(width)).current
  const [mounted, setMounted] = useState(visible)
  const widthRef = useRef(width)
  widthRef.current = width
  const closeRef = useRef(onRequestClose)
  closeRef.current = onRequestClose

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
        // 가장자리에서 시작해 오른쪽으로(세로보다 가로로 더) 움직일 때만 가로챈다.
        onMoveShouldSetPanResponderCapture: (_, g) => g.x0 <= EDGE_WIDTH && g.dx > 8 && Math.abs(g.dx) > Math.abs(g.dy) * 1.5,
        onPanResponderMove: (_, g) => x.setValue(Math.max(0, g.dx)),
        onPanResponderRelease: (_, g) => {
          if (g.dx > widthRef.current * CLOSE_RATIO || g.vx > CLOSE_VELOCITY) {
            Animated.timing(x, { toValue: widthRef.current, duration: 180, useNativeDriver: Platform.OS !== 'web' }).start(() =>
              closeRef.current(),
            )
          } else {
            Animated.spring(x, { toValue: 0, useNativeDriver: Platform.OS !== 'web', bounciness: 0 }).start()
          }
        },
        onPanResponderTerminate: () => Animated.spring(x, { toValue: 0, useNativeDriver: Platform.OS !== 'web', bounciness: 0 }).start(),
      }),
    [x],
  )

  return (
    <Modal visible={mounted} transparent animationType="none" onRequestClose={onRequestClose}>
      <Animated.View style={[styles.page, { transform: [{ translateX: x }] }]} {...pan.panHandlers}>
        {children}
      </Animated.View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  page: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    backgroundColor: COLORS.background,
    // 밀어 낼 때 아래 설정 화면과 경계가 보이게 왼쪽에 옅은 그림자.
    shadowColor: '#000',
    shadowOffset: { width: -2, height: 0 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
  },
})
