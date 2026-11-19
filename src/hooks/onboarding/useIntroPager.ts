import { useCallback, useLayoutEffect, useRef, useState } from 'react'
import type { LayoutChangeEvent, NativeScrollEvent, NativeSyntheticEvent, ScrollView } from 'react-native'

/**
 * 첫 실행 소개의 가로 페이지 넘김. 페이지 넘김은 가로 ScrollView 의 pagingEnabled 로 한다 — 웹(react-native-web)도
 * scroll-snap 으로 같은 동작을 한다. 너비는 화면 너비가 아니라 실제로 그려진 영역 너비(onLayout)를 쓴다.
 * 웹에서 앱 영역이 창보다 좁을 수 있어서다.
 *
 * 폴드를 접고 펴거나(앱이 다시 시작되지 않고 창 크기만 바뀐다) 웹 창 크기를 바꾸면 너비가 달라진다.
 * 그때 스크롤 위치는 옛 너비 기준으로 남아 두 장 사이에 걸치므로, 보던 장으로 다시 맞춘다.
 *
 * `handleLayout` 은 페이지 영역에, `scrollRef`·`handleScroll` 은 가로 ScrollView 에 붙인다.
 */
export function useIntroPager(pageCount: number) {
  const scrollRef = useRef<ScrollView>(null)
  const [size, setSize] = useState({ width: 0, height: 0 })
  const { width, height } = size
  const [index, setIndex] = useState(0)
  // 너비가 바뀐 직후 다시 맞출 때 쓰는 "지금 보던 장". state 는 스크롤 이벤트가 먼저 덮어쓸 수 있어 따로 둔다.
  const indexRef = useRef(0)

  const handleLayout = useCallback((e: LayoutChangeEvent) => {
    const next = {
      width: Math.round(e.nativeEvent.layout.width),
      height: Math.round(e.nativeEvent.layout.height),
    }
    setSize((prev) => (prev.width === next.width && prev.height === next.height ? prev : next))
  }, [])

  // 너비가 바뀌면 보던 장의 시작점으로 스크롤을 옮긴다(애니메이션 없이). 처음 그릴 때(0번 장)는 그대로다.
  useLayoutEffect(() => {
    if (!width) return
    scrollRef.current?.scrollTo({ x: indexRef.current * width, animated: false })
  }, [width])

  const handleScroll = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      if (!width) return
      const next = Math.max(
        0,
        Math.min(pageCount - 1, Math.round(e.nativeEvent.contentOffset.x / width)),
      )
      indexRef.current = next
      setIndex(next)
    },
    [width, pageCount],
  )

  const goTo = useCallback(
    (next: number) => {
      scrollRef.current?.scrollTo({ x: next * width, animated: true })
      indexRef.current = next
      setIndex(next)
    },
    [width],
  )

  return { scrollRef, width, height, index, isLast: index === pageCount - 1, handleLayout, handleScroll, goTo }
}
