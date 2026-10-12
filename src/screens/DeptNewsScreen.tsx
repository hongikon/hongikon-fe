import { useCallback, useMemo, useState } from 'react'
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import type { CompositeScreenProps } from '@react-navigation/native'
import type { NativeStackScreenProps } from '@react-navigation/native-stack'
import type { RootStackParamList } from '../navigation/RootNavigator'
import type { NewsStackParamList } from '../navigation/NewsStackNavigator'
import { COLORS } from '../constants/colors'
import { layoutStyles } from '../constants/layout'
import { FONTS } from '../constants/typography'
import { SUBSCRIBABLE_ITEMS } from '../constants/news'
import { useSettings } from '../contexts/SettingsContext'
import { NEWS_PAGE_SIZE, useNewsFeed } from '../hooks/useNewsFeed'
import { useApiResource } from '../hooks/useApiResource'
import { getNews } from '../apis/news'
import { backendSummaryToNewsItem } from '../utils/newsMapping'
import { useDebouncedValue } from '../hooks/useDebouncedValue'
import { useFeedbackToggles } from '../hooks/useFeedbackToggles'
import { NewsListSkeleton } from '../components/common/Skeleton'
import NewsList from '../components/news/NewsList'
import SearchBar from '../components/news/SearchBar'
import PinnedNoticeSection from '../components/news/PinnedNoticeSection'
import RetryableError from '../components/common/RetryableError'
import ScreenHeader from '../components/common/ScreenHeader'
import EmptyState from '../components/common/EmptyState'
import type { NewsItem } from '../types'

type Props = CompositeScreenProps<
  NativeStackScreenProps<NewsStackParamList, 'DeptNews'>,
  NativeStackScreenProps<RootStackParamList>
>

/** 학과·기관 하나의 소식 목록. 학과 트리(전체 탭·검색)에서 항목을 고르면 들어온다. */
export default function DeptNewsScreen({ route, navigation }: Props) {
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

  // 고정 글 묶음은 곁다리라 로딩·오류 안내 없이 받으면 보여주고 못 받으면 조용히 숨긴다(아래 목록을 막지 않게).
  const pinnedResource = useApiResource(
    (signal) => getNews({ sourceIds: [deptId], pinned: true, size: NEWS_PAGE_SIZE, signal }),
    [deptId],
  )
  const pinnedItems = useMemo(
    () =>
      (pinnedResource.data?.content ?? [])
        .map(backendSummaryToNewsItem)
        // `pinned` 를 모르는 예전 서버는 파라미터를 무시하고 일반 글을 돌려주므로, 고정 표시가 있는 글만 남긴다.
        .filter((item) => item.pinned),
    [pinnedResource.data],
  )
  const { retry: refetchPinned } = pinnedResource
  const { refresh: refreshFeed } = newsFeed
  const handleRefresh = useCallback(() => {
    refreshFeed()
    refetchPinned()
  }, [refreshFeed, refetchPinned])

  const handlePressItem = useCallback(
    (item: NewsItem) => navigation.navigate('NewsDetail', { item }),
    [navigation],
  )

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
