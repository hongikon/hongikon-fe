import { useEffect, useMemo, useRef, useState } from 'react'
import {
  ActivityIndicator,
  Animated,
  Easing,
  FlatList,
  Image,
  Modal,
  PanResponder,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
  type LayoutChangeEvent,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { COLORS } from '../../constants/colors'
import { FONTS } from '../../constants/typography'
import { RADIUS } from '../../constants/spacing'

/** 위·아래로 이만큼(px) 끌거나 빠르게 튕기면 닫는다. */
const DRAG_CLOSE_DISTANCE = 80
const DRAG_CLOSE_VELOCITY = 0.6
/**
 * iOS 는 사진 칸(확대용 ScrollView)·옆 넘기기 목록의 네이티브 끌기가 JS 끌기보다 먼저 손가락을 가져가,
 * PanResponder 로는 끌어 닫기가 되다 말다 했다(11-01). iOS 는 사진 칸을 세로로 당기는 네이티브 튕김으로 재고
 * (손을 뗄 때 당긴 거리·속도로 닫기), Android 는 PanResponder 로 끈다.
 */
const NATIVE_PULL = Platform.OS === 'ios'

interface ImageViewerModalProps {
  urls: readonly string[]
  /** 처음 보여 줄 사진. null 이면 닫혀 있다. */
  startIndex: number | null
  onClose: () => void
  /**
   * 다른 Modal 안에서 열 때 true — 새 Modal 대신 부모 창 위에 덮어 그린다. 부모 창의 맨 바깥(화면을 다 덮는 자리)에 둬야 한다.
   * iOS 에서 Modal 안의 Modal 을 닫으면 바깥 창(제보 본문)까지 같이 닫혔다(10-31).
   * Android 뒤로 가기는 부모 Modal 의 onRequestClose 로 가므로, 부모가 사진이 열려 있으면 사진부터 닫아야 한다.
   */
  inline?: boolean
}

/**
 * 사진을 앱 안에서 화면 가득 보여 준다(10-18 — 전엔 원본 주소를 브라우저로 열어 긴 URL 만 보였다).
 * 여러 장이면 옆으로 넘기고, iOS 는 두 손가락으로 키울 수 있다(ScrollView 확대).
 * 위나 아래로 끌어 놓으면 닫혀 사진을 열었던 자리(바텀시트·제보 본문)로 돌아간다(11-01). 확대해 보고 있을 땐 끌어도 닫지 않는다.
 */
export default function ImageViewerModal({ urls, startIndex, onClose, inline = false }: ImageViewerModalProps) {
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

  const content = (
    <View style={[styles.root, inline && StyleSheet.absoluteFill]} onLayout={handleLayout} {...pan.handlers}>
      <Animated.View style={[StyleSheet.absoluteFill, styles.backdrop, { opacity: backdropOpacity }]} />
      <Animated.View style={[styles.root, { transform: [{ translateY: dragY }] }]}>
      <FlatList
        key={width}
        ref={listRef}
        data={urls as string[]}
        keyExtractor={(url) => url}
        horizontal
        pagingEnabled
        directionalLockEnabled
        showsHorizontalScrollIndicator={false}
        initialScrollIndex={startIndex ?? 0}
        getItemLayout={(_, i) => ({ length: width, offset: width * i, index: i })}
        onMomentumScrollEnd={handleScrollEnd}
        renderItem={({ item }) => (
          <ViewerPage
            url={item}
            width={width}
            height={height}
            onZoomChange={(zoomed) => (zoomedRef.current = zoomed)}
            onPull={(pulled) => pullY.setValue(pulled)}
            onPullEnd={handlePullEnd}
          />
        )}
      />
      </Animated.View>

      <View style={[styles.topBar, { top: insets.top + 8 }]} pointerEvents="box-none">
        {urls.length > 1 ? (
          <View style={styles.counter}>
            <Text style={styles.counterText} accessibilityLabel={`${urls.length}장 중 ${index + 1}번째 사진`}>
              {index + 1}/{urls.length}
            </Text>
          </View>
        ) : (
          <View />
        )}
        <Pressable
          onPress={onClose}
          style={styles.closeBtn}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          accessibilityRole="button"
          accessibilityLabel="사진 닫기"
        >
          <Ionicons name="close" size={24} color={COLORS.white} />
        </Pressable>
      </View>
    </View>
  )

  if (inline) return open ? content : null

  return (
    <Modal
      visible={open}
      transparent
      animationType="fade"
      onRequestClose={onClose}
      statusBarTranslucent
      supportedOrientations={['portrait', 'landscape']}
    >
      {content}
    </Modal>
  )
}

function ViewerPage({
  url,
  width,
  height,
  onZoomChange,
  onPull,
  onPullEnd,
}: {
  url: string
  width: number
  height: number
  onZoomChange: (zoomed: boolean) => void
  /** iOS: 확대 안 한 채 세로로 당긴 거리(아래로 +). */
  onPull: (pulled: number) => void
  onPullEnd: (pulled: number, velocity: number) => void
}) {
  const [loading, setLoading] = useState(true)
  const [failed, setFailed] = useState(false)

  return (
    <ScrollView
      style={{ width, height }}
      onScroll={(event) => {
        const zoomed = (event.nativeEvent.zoomScale ?? 1) > 1.01
        onZoomChange(zoomed)
        if (NATIVE_PULL && !zoomed) onPull(-event.nativeEvent.contentOffset.y)
      }}
      onScrollEndDrag={(event) => {
        if (!NATIVE_PULL || (event.nativeEvent.zoomScale ?? 1) > 1.01) return
        onPullEnd(-event.nativeEvent.contentOffset.y, event.nativeEvent.velocity?.y ?? 0)
      }}
      scrollEventThrottle={16}
      contentContainerStyle={styles.page}
      maximumZoomScale={Platform.OS === 'ios' ? 3 : 1}
      // iOS 는 세로로 당겨 닫는다(NATIVE_PULL). 가로 튕김은 옆 넘기기와 겹치지 않게 끈다.
      alwaysBounceVertical={NATIVE_PULL}
      alwaysBounceHorizontal={false}
      minimumZoomScale={1}
      centerContent
      showsHorizontalScrollIndicator={false}
      showsVerticalScrollIndicator={false}
    >
      {failed ? (
        <Text style={styles.failText}>사진을 불러오지 못했어요</Text>
      ) : (
        <Image
          source={{ uri: url }}
          style={{ width, height }}
          resizeMode="contain"
          onLoadEnd={() => setLoading(false)}
          onError={() => setFailed(true)}
          accessibilityIgnoresInvertColors
          accessibilityLabel="제보 첨부 사진"
        />
      )}
      {loading && !failed && <ActivityIndicator style={StyleSheet.absoluteFill} color={COLORS.white} />}
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  backdrop: { backgroundColor: 'rgba(0,0,0,0.95)' },
  page: { flexGrow: 1, alignItems: 'center', justifyContent: 'center' },
  topBar: {
    position: 'absolute',
    left: 16,
    right: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  counter: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: RADIUS.pill, backgroundColor: 'rgba(255,255,255,0.15)' },
  counterText: { color: COLORS.white, fontFamily: FONTS.semibold, fontSize: 14 },
  closeBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.15)',
  },
  failText: { color: COLORS.white, fontFamily: FONTS.medium, fontSize: 14 },
})
