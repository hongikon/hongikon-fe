import { useMemo } from 'react'
import { NEWS_PAGE_SIZE } from '../useNewsFeed'
import { useApiResource } from '../query/useApiResource'
import { getNews } from '../../apis/news'
import { backendSummaryToNewsItem } from '../../utils/news/newsMapping'

/**
 * 학과·기관 게시판 하나의 상단 고정 글. 고정 글 묶음은 곁다리라 로딩·오류 안내 없이 받으면 보여주고
 * 못 받으면 조용히 숨긴다(아래 목록을 막지 않게). `refetch` 는 당겨서 새로고침할 때 함께 부른다.
 */
export function useDeptPinnedNews(deptId: string) {
  const pinnedResource = useApiResource(
    (signal) => getNews({ sourceIds: [deptId], pinned: true, size: NEWS_PAGE_SIZE, signal }),
    [deptId],
  )
  const items = useMemo(
    () =>
      (pinnedResource.data?.content ?? [])
        .map(backendSummaryToNewsItem)
        // `pinned` 를 모르는 예전 서버는 파라미터를 무시하고 일반 글을 돌려주므로, 고정 표시가 있는 글만 남긴다.
        .filter((item) => item.pinned),
    [pinnedResource.data],
  )
  return { items, refetch: pinnedResource.retry }
}
