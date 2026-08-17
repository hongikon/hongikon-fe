import { useCallback, type ReactElement } from 'react'
import { FlatList, StyleSheet, View, type ListRenderItemInfo } from 'react-native'
import { usePagedItems } from '../../hooks/usePagedItems'
import type { NewsItem } from '../../types'
import NewsCard from './NewsCard'
import { COLORS } from '../../constants/colors'

interface NewsListProps {
  items: NewsItem[]
  isBookmarked: (id: string) => boolean
  onPressItem: (item: NewsItem) => void
  onToggleBookmark: (id: string) => void
  /** 목록 위에 붙는 영역(구독 학과 칩 등). */
  header?: ReactElement | null
  /** 항목이 하나도 없을 때 보여줄 것. */
  empty: ReactElement
}

/**
 * 소식 목록.
 *
 * FlatList 로 화면 밖 항목을 정리하고, 스크롤이 끝에 닿으면 조금씩 더 붙인다.
 * 학과에 따라 80건, 구독을 여러 개 걸면 500건이 넘는데
 * 예전처럼 ScrollView 에 전부 펼치면 진입할 때 그만큼을 한 번에 만들어야 했다.
 */
export default function NewsList({
  items,
  isBookmarked,
  onPressItem,
  onToggleBookmark,
  header,
  empty,
}: NewsListProps) {
  const { visible, hasMore, loadMore } = usePagedItems(items)

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

  return (
    <FlatList
      style={styles.list}
      contentContainerStyle={styles.content}
      data={visible}
      renderItem={renderItem}
      keyExtractor={keyExtractor}
      ListHeaderComponent={header}
      ListEmptyComponent={empty}
      // 끝에서 한 화면쯤 남았을 때 미리 채워 스크롤이 멈칫하지 않게 한다.
      onEndReached={loadMore}
      onEndReachedThreshold={0.6}
      ListFooterComponent={hasMore ? <View style={styles.footerSpace} /> : null}
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
  footerSpace: { height: 24 },
})
