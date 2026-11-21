import { ActivityIndicator, Animated, FlatList, Image, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { COLORS } from '../../constants/colors'
import { FONTS } from '../../constants/typography'
import { RADIUS } from '../../constants/spacing'
import { useImageViewerModal } from '../../hooks/common/useImageViewerModal'
import { useViewerPage } from '../../hooks/common/useViewerPage'
import { NATIVE_PULL } from '../../utils/common/imageViewerModal'

export interface ImageViewerModalProps {
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
  const { insets, index, width, height, listRef, open, dragY, pullY, zoomedRef, pan, handlePullEnd, backdropOpacity, handleLayout, handleScrollEnd } = useImageViewerModal({ startIndex, onClose })

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
  const { loading, setLoading, failed, setFailed } = useViewerPage()

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
