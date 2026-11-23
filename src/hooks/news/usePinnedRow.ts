import { useCallback } from 'react'
import type { NewsItem } from '../../types'

/** PinnedRow 의 상태·효과·핸들러. 화면 파일은 이 훅을 불러 그리기만 한다. */
export function usePinnedRow({ item, onPress }: Pick<{
  item: NewsItem
  onPress: (item: NewsItem) => void
}, 'item' | 'onPress'>) {
  const handlePress = useCallback(() => onPress(item), [onPress, item])
  return { handlePress }
}
