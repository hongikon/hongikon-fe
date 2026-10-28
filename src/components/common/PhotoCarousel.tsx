import { useEffect, useState } from 'react'
import {
  FlatList,
  Image,
  Pressable,
  StyleSheet,
  View,
  type LayoutChangeEvent,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native'
import { COLORS } from '../../constants/colors'

/** 사진 틀이 가장 세로로 길어질 수 있는 비율(가로/세로). 이보다 긴 사진은 틀 안에 줄여 넣는다. */
const MIN_FRAME_RATIO = 3 / 4
/** 가장 가로로 넓어질 수 있는 비율. */
const MAX_FRAME_RATIO = 16 / 9
const FALLBACK_RATIO = 4 / 3

/**
 * 본문 사진 — 자르지 않고 원래 비율 그대로 보여 준다. 여러 장이면 옆으로 넘기고, 아래 점으로 몇 번째 장인지 알린다.
 * 틀 높이는 가장 세로로 긴 사진에 맞추고(MIN_FRAME_RATIO 까지), 나머지 사진은 그 틀 안에 비율대로 들어간다.
 * 누르면 onPressPhoto(순번) — 앱 안 전체 화면 보기(ImageViewerModal)를 연다.
 */
export default function PhotoCarousel({
  urls,
  onPressPhoto,
  labelPrefix = '첨부 사진',
}: {
  urls: readonly string[]
  onPressPhoto: (index: number) => void
  labelPrefix?: string
}) {
  const [width, setWidth] = useState(0)
  const [index, setIndex] = useState(0)
  const [ratios, setRatios] = useState<Record<string, number>>({})
  // 부모가 렌더마다 새 배열을 넘겨도 같은 사진이면 다시 재지 않는다.
  const urlsKey = urls.join('\n')

  useEffect(() => {
    let alive = true
    urls.forEach((url) => {
      Image.getSize(
        url,
        (w, h) => {
          if (alive && w > 0 && h > 0) setRatios((prev) => (prev[url] ? prev : { ...prev, [url]: w / h }))
        },
        () => {},
      )
    })
    return () => {
      alive = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [urlsKey])

  useEffect(() => {
    if (index >= urls.length) setIndex(Math.max(0, urls.length - 1))
  }, [urls.length, index])

  if (urls.length === 0) return null

  const known = urls.map((url) => ratios[url]).filter((ratio): ratio is number => !!ratio)
  const frameRatio = known.length
    ? Math.min(MAX_FRAME_RATIO, Math.max(MIN_FRAME_RATIO, Math.min(...known)))
    : FALLBACK_RATIO
  const height = width ? width / frameRatio : 0

  const handleLayout = (event: LayoutChangeEvent) => {
    const next = Math.round(event.nativeEvent.layout.width)
    if (next !== width) setWidth(next)
  }
  const handleScrollEnd = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    if (!width) return
    const next = Math.round(event.nativeEvent.contentOffset.x / width)
    setIndex(Math.min(urls.length - 1, Math.max(0, next)))
  }

  return (
    <View onLayout={handleLayout}>
      {width > 0 && (
        <FlatList
          data={urls as string[]}
          keyExtractor={(url) => url}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onMomentumScrollEnd={handleScrollEnd}
          onScrollEndDrag={handleScrollEnd}
          scrollEnabled={urls.length > 1}
          getItemLayout={(_, i) => ({ length: width, offset: width * i, index: i })}
          style={[styles.frame, { width, height }]}
          renderItem={({ item, index: i }) => (
            <Pressable
              style={{ width, height }}
              onPress={() => onPressPhoto(i)}
              accessibilityRole="imagebutton"
              accessibilityLabel={
                urls.length > 1 ? `${labelPrefix} ${i + 1}/${urls.length}, 크게 보기` : `${labelPrefix}, 크게 보기`
              }
            >
              <Image source={{ uri: item }} style={styles.photo} resizeMode="contain" />
            </Pressable>
          )}
        />
      )}
      {urls.length > 1 && (
        <View style={styles.dots} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
          {urls.map((url, i) => (
            <View key={url} style={[styles.dot, i === index && styles.dotActive]} />
          ))}
        </View>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  frame: { borderRadius: 12, overflow: 'hidden', backgroundColor: COLORS.fill },
  photo: { width: '100%', height: '100%' },
  dots: { flexDirection: 'row', justifyContent: 'center', gap: 6, marginTop: 10 },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: COLORS.border },
  dotActive: { backgroundColor: COLORS.primary },
})
