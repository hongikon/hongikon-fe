import { useEffect, useRef, useState } from 'react'
import {
  ActivityIndicator,
  FlatList,
  Image,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { COLORS } from '../../constants/colors'
import { FONTS } from '../../constants/typography'

interface ImageViewerModalProps {
  urls: readonly string[]
  /** 처음 보여 줄 사진. null 이면 닫혀 있다. */
  startIndex: number | null
  onClose: () => void
}

/**
 * 사진을 앱 안에서 화면 가득 보여 준다(10-18 — 전엔 원본 주소를 브라우저로 열어 긴 URL 만 보였다).
 * 여러 장이면 옆으로 넘기고, iOS 는 두 손가락으로 키울 수 있다(ScrollView 확대).
 */
export default function ImageViewerModal({ urls, startIndex, onClose }: ImageViewerModalProps) {
  const { width, height } = useWindowDimensions()
  const insets = useSafeAreaInsets()
  const [index, setIndex] = useState(startIndex ?? 0)
  const listRef = useRef<FlatList<string>>(null)

  useEffect(() => {
    if (startIndex !== null) setIndex(startIndex)
  }, [startIndex])

  const handleScrollEnd = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    setIndex(Math.round(event.nativeEvent.contentOffset.x / width))
  }

  return (
    <Modal
      visible={startIndex !== null}
      transparent
      animationType="fade"
      onRequestClose={onClose}
      statusBarTranslucent
      supportedOrientations={['portrait', 'landscape']}
    >
      <View style={styles.backdrop}>
        <FlatList
          ref={listRef}
          data={urls as string[]}
          keyExtractor={(url) => url}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          initialScrollIndex={startIndex ?? 0}
          getItemLayout={(_, i) => ({ length: width, offset: width * i, index: i })}
          onMomentumScrollEnd={handleScrollEnd}
          renderItem={({ item }) => <ViewerPage url={item} width={width} height={height} />}
        />

        <View style={[styles.topBar, { top: insets.top + 8 }]} pointerEvents="box-none">
          {urls.length > 1 ? (
            <Text style={styles.counter}>
              {index + 1} / {urls.length}
            </Text>
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
    </Modal>
  )
}

function ViewerPage({ url, width, height }: { url: string; width: number; height: number }) {
  const [loading, setLoading] = useState(true)
  const [failed, setFailed] = useState(false)

  return (
    <ScrollView
      style={{ width, height }}
      contentContainerStyle={styles.page}
      maximumZoomScale={Platform.OS === 'ios' ? 3 : 1}
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
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.95)' },
  page: { flexGrow: 1, alignItems: 'center', justifyContent: 'center' },
  topBar: {
    position: 'absolute',
    left: 16,
    right: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  counter: { color: COLORS.white, fontFamily: FONTS.semibold, fontSize: 14 },
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
