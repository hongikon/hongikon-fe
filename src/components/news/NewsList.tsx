import { useCallback, type ReactElement } from 'react'
import { ActivityIndicator, FlatList, StyleSheet, View, type ListRenderItemInfo } from 'react-native'
import type { NewsItem } from '../../types'
import NewsCard from './NewsCard'
import { COLORS } from '../../constants/colors'
import { layoutStyles } from '../../constants/layout'
import * as haptics from '../../lib/haptics'

interface NewsListProps {
  items: NewsItem[]
  isBookmarked: (id: string) => boolean
  onPressItem: (item: NewsItem) => void
  onToggleBookmark: (id: string) => void
  /** 목록 위에 붙는 영역(구독 학과 칩 등). */
  header?: ReactElement | null
  /** 항목이 하나도 없을 때 보여줄 것. */
  empty: ReactElement
  /** 목록 끝에 닿았을 때(서버에서 다음 페이지를 받는다). 없으면 받은 목록만 보여준다. */
  onEndReached?: () => void
  /** 다음 페이지를 받는 중이면 목록 끝에 스피너를 보여준다. */
  loadingMore?: boolean
  /** 목록 끝에 붙일 것(다음 페이지 실패 안내 등). `loadingMore`일 땐 스피너가 우선. */
  footer?: ReactElement | null
  /** 당겨서 새로고침. 둘 다 있어야 켜진다. */
  refreshing?: boolean
  onRefresh?: () => void
}

/**
 * 소식 목록.
 *
 * FlatList 로 화면 밖 항목을 정리하고, 스크롤이 끝에 닿으면 `onEndReached`로 서버에서
 * 다음 페이지를 받아 붙인다(`useNewsFeed`). 예전엔 전체 목록을 한 번에 받아
 * 클라이언트에서 12건씩 잘라 보여줬지만(`usePagedItems`), `GET /news`가 페이지 응답으로
 * 바뀌어(hongikon-be 5f3024a) 이제 서버 페이지가 그 역할을 한다.
 */
export default function NewsList({
  items,
  isBookmarked,
  onPressItem,
  onToggleBookmark,
  header,
  empty,
  onEndReached,
  loadingMore = false,
  footer,
  refreshing,
  onRefresh,
}: NewsListProps) {

  const renderItem = useCallback(
    ({ item }: ListRenderItemInfo<NewsItem>) => (
      <NewsCard
        item={item}
        bookmarked={isBookmarked(item.id)}
        onPress={onPressItem}
        onToggleBookmark={onToggleBookmark}
      />
    ),
    [isBookmarked, onPressItem, onToggleBookmark],
  )

  const keyExtractor = useCallback((item: NewsItem) => item.id, [])

  // 당겨서 새로고침이 걸리는 순간 가볍게 진동한다.
  const handleRefresh = useCallback(() => {
    haptics.tapLight()
    onRefresh?.()
  }, [onRefresh])

  return (
    <FlatList
      style={styles.list}
      // 넓은 화면(폴드 펼침·웹)에선 카드가 화면 끝까지 늘어나지 않게 가운데 읽기 폭으로 모은다.
      contentContainerStyle={[styles.content, layoutStyles.readable]}
      data={items}
      renderItem={renderItem}
      keyExtractor={keyExtractor}
      ListHeaderComponent={header}
      ListEmptyComponent={empty}
      // 끝에서 한 화면쯤 남았을 때 미리 채워 스크롤이 멈칫하지 않게 한다.
      onEndReached={onEndReached}
      onEndReachedThreshold={0.6}
      ListFooterComponent={
        loadingMore ? (
          <View style={styles.footerLoading}>
            <ActivityIndicator size="small" color={COLORS.primary} />
          </View>
        ) : (
          footer ?? null
        )
      }
      refreshing={onRefresh ? Boolean(refreshing) : undefined}
      onRefresh={onRefresh ? handleRefresh : undefined}
      initialNumToRender={8}
      maxToRenderPerBatch={8}
      windowSize={7}
      removeClippedSubviews
    />
  )
}

const styles = StyleSheet.create({
  list: { flex: 1, backgroundColor: COLORS.background },
  content: { padding: 12, gap: 8, flexGrow: 1 },
  footerLoading: { paddingVertical: 16, alignItems: 'center' },
})
