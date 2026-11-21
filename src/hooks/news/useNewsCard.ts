import { useCallback } from 'react'
import { CATEGORY_COLORS } from '../../constants/colors'
import type { CategoryKey } from '../../constants/colors'
import type { NewsCardProps } from '../../components/news/NewsCard'

/** NewsCardComponent 의 상태·효과·핸들러. 화면 파일은 이 훅을 불러 그리기만 한다. */
export function useNewsCard({ item, onPress, onToggleBookmark }: Pick<NewsCardProps, 'item' | 'onPress' | 'onToggleBookmark'>) {
  const catColor = CATEGORY_COLORS[item.category as CategoryKey]

  const handlePress = useCallback(() => onPress(item), [onPress, item])
  const handleToggleBookmark = useCallback(
    () => onToggleBookmark(item.id),
    [onToggleBookmark, item.id],
  )
  return { catColor, handlePress, handleToggleBookmark }
}
