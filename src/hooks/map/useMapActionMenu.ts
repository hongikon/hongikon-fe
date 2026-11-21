import { useCallback, useEffect, useRef, useState } from 'react'
import { Animated, Platform, ScrollView } from 'react-native'
import * as haptics from '../../lib/haptics'
import type { MapActionMenuProps } from '../../components/map/MapActionMenu'

/** MapActionMenu 의 상태·효과·핸들러. 화면 파일은 이 훅을 불러 그리기만 한다. */
export function useMapActionMenu() {
  const [open, setOpen] = useState(false)
  /** '제보 보기'를 눌러 종류 줄을 펼쳤는지. 메뉴를 닫으면 다시 접는다. */
  const [filterOpen, setFilterOpen] = useState(false)
  const progress = useRef(new Animated.Value(0)).current
  const scrollRef = useRef<ScrollView>(null)

  useEffect(() => {
    Animated.timing(progress, {
      toValue: open ? 1 : 0,
      duration: 160,
      useNativeDriver: Platform.OS !== 'web',
    }).start()
  }, [open, progress])

  const toggle = useCallback(() => {
    haptics.selection()
    setOpen((value) => !value)
    setFilterOpen(false)
  }, [])

  const itemsMotion = {
    opacity: progress,
    transform: [{ translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [12, 0] }) }],
  }
  return { open, setOpen, filterOpen, setFilterOpen, progress, scrollRef, toggle, itemsMotion }
}
