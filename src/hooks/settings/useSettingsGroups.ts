import { useCallback, useEffect, useState, type RefObject } from 'react'
import type { ScrollView } from 'react-native'
import * as haptics from '../../lib/haptics'
import type { SettingsGroup } from './types'

/** 탭 내비게이터가 보내는 'tabPress' 만 쓰려고 좁힌 내비게이션 모양. */
interface TabPressNavigation {
  isFocused: () => boolean
}

/**
 * 설정 묶음 펼침 상태와 하단 '설정' 탭을 다시 눌렀을 때 맨 위로 올리기.
 */
export function useSettingsGroups(navigation: TabPressNavigation, scrollRef: RefObject<ScrollView | null>) {
  const [expanded, setExpanded] = useState<ReadonlySet<SettingsGroup>>(new Set())
  // 설정 탭에 있을 때 하단 '설정'을 다시 누르면 맨 위로(11-01 — useScrollToTop 만으로는 올라가지 않았다).
  useEffect(() => {
    const unsubscribe = (navigation as unknown as { addListener: (type: 'tabPress', cb: () => void) => () => void }).addListener(
      'tabPress',
      () => {
        if (navigation.isFocused()) scrollRef.current?.scrollTo({ y: 0, animated: true })
      },
    )
    return unsubscribe
  }, [navigation])
  const toggleGroup = useCallback((group: SettingsGroup) => {
    haptics.selection()
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(group)) next.delete(group)
      else next.add(group)
      return next
    })
  }, [])
  /** 묶음을 펼친다(이미 펼쳐져 있으면 그대로). 알림·지도에서 넘어올 때 쓴다. */
  const expandGroup = useCallback((group: SettingsGroup) => {
    setExpanded((prev) => new Set(prev).add(group))
  }, [])

  return { expanded, toggleGroup, expandGroup }
}
