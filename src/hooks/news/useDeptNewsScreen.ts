import { useCallback, useMemo, useState } from 'react'
import { SUBSCRIBABLE_ITEMS } from '../../constants/news'
import { useSettings } from '../../contexts/SettingsContext'
import { useNewsFeed } from './useNewsFeed'
import { useDeptPinnedNews } from './useDeptPinnedNews'
import { useDebouncedValue } from '../common/useDebouncedValue'
import { useFeedbackToggles } from '../settings/useFeedbackToggles'
import type { NewsItem } from '../../types'
import type { Props } from '../../screens/DeptNewsScreen'

/** DeptNewsScreen 의 상태·효과·핸들러. 화면 파일은 이 훅을 불러 그리기만 한다. */
export function useDeptNewsScreen({ route, navigation }: Pick<Props, 'route' | 'navigation'>) {
  const { deptId, deptName } = route.params
  // 웹에서 `?deptName=` 없이 `/news/dept/{id}` 로 들어오면 이름이 없다 — 빈 머리줄 대신 id 로 찾은 이름(없으면 "학과 소식")을 쓴다.
  const title = deptName || SUBSCRIBABLE_ITEMS.find((item) => item.id === deptId)?.name || '학과 소식'
  const { isBookmarked } = useSettings()
  const { toggleBookmark } = useFeedbackToggles()
  const [query, setQuery] = useState('')
  const keyword = useDebouncedValue(query.trim())
  // 학과·기관 = 수집 게시판 하나(sourceId). 검색어는 서버가 제목에서 찾는다.
  const sourceIds = useMemo(() => [deptId], [deptId])
  // 상단 고정 글은 위 "고정 공지" 묶음에서 따로 보여주므로 최신순 목록에선 뺀다.
  const newsFeed = useNewsFeed({ sourceIds, keyword, pinned: false })
  const isSearching = keyword.length > 0

  // 상단 고정 글 묶음(hooks/news/useDeptPinnedNews).
  const { items: pinnedItems, refetch: refetchPinned } = useDeptPinnedNews(deptId)
  const { refresh: refreshFeed } = newsFeed
  const handleRefresh = useCallback(() => {
    refreshFeed()
    refetchPinned()
  }, [refreshFeed, refetchPinned])

  const handlePressItem = useCallback(
    (item: NewsItem) => navigation.navigate('NewsDetail', { item }),
    [navigation],
  )
  return {
    title,
    isBookmarked,
    toggleBookmark,
    query,
    setQuery,
    keyword,
    newsFeed,
    isSearching,
    pinnedItems,
    handleRefresh,
    handlePressItem,
  }
}
