import { StyleSheet, type NativeScrollEvent, type NativeSyntheticEvent } from 'react-native'
import NewsList from '../NewsList'
import RetryableError from '../../common/RetryableError'
import EmptyState from '../../common/EmptyState'
import { NewsListSkeleton } from '../../common/Skeleton'
import type { NewsFeed } from '../../../hooks/news/useNewsFeed'
import type { NewsItem } from '../../../types'

interface Props {
  /** 게시글 검색 결과(검색어가 비면 필터 없는 최신 소식). */
  newsFeed: NewsFeed
  /** 디바운스한 검색어(공백 제거). 비어 있으면 검색 중이 아니다. */
  keyword: string
  isBookmarked: (id: string) => boolean
  onPressItem: (item: NewsItem) => void
  onToggleBookmark: (id: string) => void
  onScrollEndDrag: (event: NativeSyntheticEvent<NativeScrollEvent>) => void
}

/**
 * [게시글 검색 결과] 소식 목록과 그 끝의 다시 시도, 빈 목록 자리의 받는 중 모양·오류·결과 없음 안내.
 * 목록에 넘기는 콜백은 부르는 쪽에서 고정(useCallback)해 넘긴다 — 카드 memo 가 깨지지 않게.
 */
export default function PostSearchResults({
  newsFeed,
  keyword,
  isBookmarked,
  onPressItem,
  onToggleBookmark,
  onScrollEndDrag,
}: Props) {
  const isSearchingPosts = keyword.length > 0
  return (
    <NewsList
      onScrollEndDrag={onScrollEndDrag}
      items={newsFeed.items}
      isBookmarked={isBookmarked}
      onPressItem={onPressItem}
      onToggleBookmark={onToggleBookmark}
      onEndReached={newsFeed.loadMore}
      loadingMore={newsFeed.loadingMore}
      refreshing={newsFeed.refreshing}
      onRefresh={newsFeed.refresh}
      footer={
        newsFeed.errorMessage && newsFeed.items.length > 0 ? (
          <RetryableError
            message={newsFeed.errorMessage}
            isNetworkError={newsFeed.isNetworkError}
            onRetry={newsFeed.canRetry ? newsFeed.retry : undefined}
            retrying={newsFeed.loadingMore}
          />
        ) : null
      }
      empty={
        newsFeed.loading ? (
          <NewsListSkeleton inList count={4} />
        ) : newsFeed.errorMessage ? (
          <RetryableError
            style={styles.feedError}
            message={newsFeed.errorMessage}
            isNetworkError={newsFeed.isNetworkError}
            onRetry={newsFeed.canRetry ? newsFeed.retry : undefined}
          />
        ) : (
          <EmptyState
            icon={isSearchingPosts ? 'search-outline' : 'file-tray-outline'}
            message={isSearchingPosts ? `'${keyword}' 검색 결과가 없어요` : '등록된 소식이 없어요'}
          />
        )
      }
    />
  )
}

const styles = StyleSheet.create({
  feedError: { marginTop: 12 },
})
