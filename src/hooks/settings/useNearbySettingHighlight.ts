import { useCallback, useEffect, useRef, useState, type RefObject } from 'react'
import type { LayoutChangeEvent, ScrollView } from 'react-native'

/**
 * 지도(근처 알림 영역·제휴 시트)에서 '근처 제휴 알림 켜러 가기'로 넘어왔을 때(11-09).
 * ① 알림 묶음을 펼치고 '근처 제휴' 칸으로 바로 스크롤해 남색으로 강조한다 — 어디 있는지 먼저 보이게.
 * ② 탭 전환이 끝난 뒤(0.7초) 그 설정 창을 연다. 전에는 화면이 붙는 순간 창을 열어 iOS 에서 창이 안 뜨는 때가 있었고,
 *    강조도 창을 닫은 뒤에만 해 아무 표시 없이 설정 탭만 보였다.
 * 강조는 창을 닫고 3초 뒤(창이 안 떴으면 8초 뒤) 사라진다.
 */
export function useNearbySettingHighlight(scrollRef: RefObject<ScrollView | null>) {
  /** 올라갈 때마다 근처 제휴 알림 창을 연다(제휴 시트의 안내 줄 → `openNearbyAlerts`). */
  const [openSignal, setOpenSignal] = useState(0)
  const [highlight, setHighlight] = useState(false)
  /** '근처 제휴' 칸 위치 = 알림 묶음 y + 펼친 내용 y + 칸 y(각각 부모 기준 onLayout). */
  const yRef = useRef({ section: 0, body: 0, block: 0 })
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([])
  useEffect(() => () => timersRef.current.forEach(clearTimeout), [])
  const show = useCallback(() => {
    timersRef.current.forEach(clearTimeout)
    setHighlight(true)
    const scroll = setTimeout(() => {
      const { section, body, block } = yRef.current
      scrollRef.current?.scrollTo({ y: Math.max(0, section + body + block - 120), animated: true })
    }, 250)
    const open = setTimeout(() => setOpenSignal((n) => n + 1), 700)
    const off = setTimeout(() => setHighlight(false), 8000)
    timersRef.current = [scroll, open, off]
  }, [])
  const handleModalClose = useCallback(() => {
    timersRef.current.forEach(clearTimeout)
    timersRef.current = [setTimeout(() => setHighlight(false), 3000)]
  }, [])

  // 세 onLayout 은 매 렌더 새로 만들던 원래 화살표 함수와 같다(받는 쪽이 memo 가 아니다). ref 에 y 만 적는다.
  const onSectionLayout = (e: LayoutChangeEvent) => (yRef.current.section = e.nativeEvent.layout.y)
  const onBodyLayout = (e: LayoutChangeEvent) => (yRef.current.body = e.nativeEvent.layout.y)
  const onBlockLayout = (e: LayoutChangeEvent) => (yRef.current.block = e.nativeEvent.layout.y)

  return { openSignal, highlight, show, handleModalClose, onSectionLayout, onBodyLayout, onBlockLayout }
}
