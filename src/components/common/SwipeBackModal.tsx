import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { Animated, Easing, Modal, PanResponder, Platform, StyleSheet, View, useWindowDimensions } from 'react-native'
import { COLORS } from '../../constants/colors'

/** 왼쪽 가장자리에서 이만큼 안에서 시작한 끌기만 "뒤로"로 본다(본문의 가로 스크롤·칩과 겹치지 않게). */
const EDGE_WIDTH = 20
/** 가장자리 띠가 시작하는 높이. 상태 표시줄 + 머리 카드(뒤로 버튼) 아래. */
const EDGE_TOP = 140
/** 화면 폭의 이만큼 넘게 밀거나 빠르게 튕기면 닫는다. */
const CLOSE_RATIO = 0.33
const CLOSE_VELOCITY = 0.5

/**
 * 화면처럼 쓰는 창(11-01 설정 창들, 이어서 제보 본문·제휴 업체 검색·길찾기). 일반 화면처럼 오른쪽에서 밀려 들어오고, 왼쪽 가장자리에서 오른쪽으로 밀면 닫힌다
 * (전엔 아래에서 올라오는 창이라 뒤로 버튼으로만 닫혔다). 뒤로 버튼·Android 뒤로 가기는 `onRequestClose` 그대로.
 * 닫힐 때는 오른쪽으로 빠져나간 뒤 내용을 내린다.
 */
export default function SwipeBackModal({
  visible,
  onRequestClose,
  onShow,
  edgeDisabled = false,
  children,
}: {
  visible: boolean
  onRequestClose: () => void
  onShow?: () => void
  /** 창 안에 덮어 그린 것(사진 크게 보기 등)이 있을 때 가장자리 밀기를 잠시 끈다. */
  edgeDisabled?: boolean
  children: ReactNode
}) {
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

  return (
    <Modal visible={mounted} transparent animationType="none" onRequestClose={onRequestClose} onShow={onShow}>
      <Animated.View style={[styles.page, { transform: [{ translateX: x }] }]}>
        {children}
        {/* 전엔 창 전체에 끌기를 달아, 본문이 스크롤되는 창(앱 권한 등)에선 스크롤이 먼저 가져가 밀어 닫기가 안 됐다(11-01). */}
        {Platform.OS !== 'web' && !edgeDisabled && <View style={styles.edge} {...pan.panHandlers} />}
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
  // 머리줄(뒤로 버튼)은 덮지 않게 그 아래부터.
  edge: { position: 'absolute', left: 0, top: EDGE_TOP, bottom: 0, width: EDGE_WIDTH },
})
