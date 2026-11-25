import { useCallback } from 'react'
import type { NewsItem } from '../../types'
import * as haptics from '../../lib/haptics'
import { useTabBarInset } from '../common/useTabBarInset'
import type { NewsListProps } from '../../components/news/NewsList'

/** NewsList 의 상태·효과·핸들러. 화면 파일은 이 훅을 불러 그리기만 한다. */
export function useNewsList({ onRefresh }: Pick<NewsListProps, 'onRefresh'>) {
  const tabInset = useTabBarInset()

  const keyExtractor = useCallback((item: NewsItem) => item.id, [])

  // 당겨서 새로고침이 걸리는 순간 가볍게 진동한다.
  const handleRefresh = useCallback(() => {
    haptics.tapLight()
    onRefresh?.()
  }, [onRefresh])
  return { tabInset, keyExtractor, handleRefresh }
}
