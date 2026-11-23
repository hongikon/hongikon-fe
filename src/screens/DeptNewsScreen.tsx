import { View, StyleSheet } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import type { CompositeScreenProps } from '@react-navigation/native'
import type { NativeStackScreenProps } from '@react-navigation/native-stack'
import type { RootStackParamList } from '../navigation/RootNavigator'
import type { NewsStackParamList } from '../navigation/NewsStackNavigator'
import { COLORS } from '../constants/colors'
import { layoutStyles } from '../constants/layout'
import { NewsListSkeleton } from '../components/common/Skeleton'
import NewsList from '../components/news/NewsList'
import SearchBar from '../components/news/SearchBar'
import PinnedNoticeSection from '../components/news/PinnedNoticeSection'
import RetryableError from '../components/common/RetryableError'
import ScreenHeader from '../components/common/ScreenHeader'
import EmptyState from '../components/common/EmptyState'
import { useDeptNewsScreen } from '../hooks/news/useDeptNewsScreen'

export type Props = CompositeScreenProps<
  NativeStackScreenProps<NewsStackParamList, 'DeptNews'>,
  NativeStackScreenProps<RootStackParamList>
>

/** 학과·기관 하나의 소식 목록. 학과 트리(전체 탭·검색)에서 항목을 고르면 들어온다. */
export default function DeptNewsScreen({ route, navigation }: Props) {
  const { title, isBookmarked, toggleBookmark, query, setQuery, keyword, newsFeed, isSearching, pinnedItems, handleRefresh, handlePressItem } = useDeptNewsScreen({ route, navigation })

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScreenHeader title={title} onBack={() => navigation.goBack()} card style={layoutStyles.readable} />
      {/* 검색창이 목록 헤더라, 검색어를 바꿔 다시 받는 동안에도 목록은 그대로 두고(입력 포커스 유지)
          로딩·오류는 빈 목록 자리에 보여준다. */}
      <NewsList
        items={newsFeed.items}
        isBookmarked={isBookmarked}
        onPressItem={handlePressItem}
        onToggleBookmark={toggleBookmark}
        onEndReached={newsFeed.loadMore}
        loadingMore={newsFeed.loadingMore}
        refreshing={newsFeed.refreshing}
        onRefresh={handleRefresh}
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
        header={
          <View style={styles.listHeaderGroup}>
            <SearchBar
              value={query}
              onChangeText={setQuery}
              placeholder="소식 제목 검색"
              accessibilityLabel="소식 검색"
            />
            {/* 검색 결과엔 고정 글이 빠져 있어(pinned: false) 묶음까지 남기면 결과와 헷갈린다. */}
            {!isSearching && <PinnedNoticeSection items={pinnedItems} onPressItem={handlePressItem} />}
          </View>
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
              icon={isSearching ? 'search-outline' : 'file-tray-outline'}
              message={isSearching ? `'${keyword}' 검색 결과가 없어요` : '등록된 소식이 없어요'}
            />
          )
        }
      />
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  // 회색 바탕 위에 머리 카드·검색창·소식 카드가 뜬다(10-07).
  container: { flex: 1, backgroundColor: COLORS.background },
  feedError: { marginTop: 12 },
  listHeaderGroup: { gap: 10 },
})
