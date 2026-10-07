import { useCallback, useState } from 'react'
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import type { NativeStackScreenProps } from '@react-navigation/native-stack'
import type { RootStackParamList } from '../navigation/RootNavigator'
import { COLORS } from '../constants/colors'
import { layoutStyles } from '../constants/layout'
import { FONTS } from '../constants/typography'
import { TREE_DATA } from '../constants/news'
import { useSettings } from '../contexts/SettingsContext'
import { useTreeSearch } from '../hooks/useTreeSearch'
import { useNewsFeed } from '../hooks/useNewsFeed'
import { useDebouncedValue } from '../hooks/useDebouncedValue'
import { useFeedbackToggles } from '../hooks/useFeedbackToggles'
import { NewsListSkeleton } from '../components/common/Skeleton'
import * as haptics from '../lib/haptics'
import NewsList from '../components/news/NewsList'
import SearchBar from '../components/news/SearchBar'
import DeptTreeList from '../components/news/DeptTreeList'
import RetryableError from '../components/common/RetryableError'
import ScreenHeader from '../components/common/ScreenHeader'
import EmptyState from '../components/common/EmptyState'
import Chip from '../components/common/Chip'
import type { NewsItem } from '../types'

type Props = NativeStackScreenProps<RootStackParamList, 'NewsSearch'>
type SearchMode = '게시글' | '학과'

const MODES: SearchMode[] = ['게시글', '학과']

/**
 * 소식 탭 상단 돋보기로 들어오는 통합 검색 화면.
 * 게시글 검색과 학과 검색은 대상이 달라 결과 모양도 다르므로,
 * 필터 칩으로 모드를 바꾸고 입력창 하나를 그 모드의 훅에 연결한다.
 */
export default function NewsSearchScreen({ navigation }: Props) {
  const { isBookmarked, settings } = useSettings()
  const { toggleBookmark, toggleSubscribedDept } = useFeedbackToggles()
  const [mode, setMode] = useState<SearchMode>('게시글')

  // 게시글 검색은 서버(`GET /news?keyword=`, 제목 부분 일치)가 한다. 타이핑마다 부르지 않도록
  // 300ms 디바운스하고, 검색어가 비면 필터 없는 전체 최신 소식을 보여준다.
  const [postQuery, setPostQuery] = useState('')
  const keyword = useDebouncedValue(postQuery.trim())
  const newsFeed = useNewsFeed({ keyword })
  const isSearchingPosts = keyword.length > 0
  const postSearch = { query: postQuery, setQuery: setPostQuery }
  const deptSearch = useTreeSearch(TREE_DATA)
  // 모드를 오가도 서로의 검색어를 지우지 않도록 상태를 둘 다 들고 있고,
  // 입력창은 현재 모드의 상태만 보여준다.
  const active = mode === '게시글' ? postSearch : deptSearch

  const handlePressItem = useCallback(
    (item: NewsItem) => navigation.navigate('NewsDetail', { item }),
    [navigation],
  )

  const handleSelectDept = useCallback(
    (id: string, name: string) => // 학과 소식은 소식 탭 안의 화면이다(탭바 유지). 검색 화면은 닫고 그쪽으로 간다.
      navigation.navigate('Main', { screen: 'News', params: { screen: 'DeptNews', params: { deptId: id, deptName: name } } }),
    [navigation],
  )

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScreenHeader onBack={() => navigation.goBack()} card style={layoutStyles.readable}>
        <SearchBar
          value={active.query}
          onChangeText={active.setQuery}
          placeholder={mode === '게시글' ? '소식 제목 검색' : '학과·기관 검색'}
          accessibilityLabel="검색"
          style={styles.searchBar}
          autoFocus
        />
      </ScreenHeader>

      <View style={[styles.modeRow, layoutStyles.readable]} accessibilityRole="radiogroup">
        {MODES.map((m) => {
          const isActive = mode === m
          return (
            <Chip
              key={m}
              label={m}
              selected={isActive}
              role="radio"
              onPress={() => {
                if (m !== mode) haptics.selection()
                setMode(m)
              }}
            />
          )
        })}
      </View>

      {mode === '게시글' ? (
        <NewsList
          items={newsFeed.items}
          isBookmarked={isBookmarked}
          onPressItem={handlePressItem}
          onToggleBookmark={toggleBookmark}
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
                icon="search-outline"
                message={isSearchingPosts ? `'${keyword}' 검색 결과가 없어요` : '등록된 소식이 없어요'}
              />
            )
          }
        />
      ) : (
        <DeptTreeList
          query={deptSearch.query}
          results={deptSearch.results}
          isSearching={deptSearch.isSearching}
          onSelectDept={handleSelectDept}
          subscribedDepts={settings.subscribedDepts}
          onToggleSubscribe={toggleSubscribedDept}
        />
      )}
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  // 회색 바탕 위에 머리 카드(검색창 포함)·결과 카드가 뜬다(10-07).
  container: { flex: 1, backgroundColor: COLORS.background },
  // 카드 안 검색창은 회색 알약(카드와 같은 흰색이면 경계가 안 보인다).
  searchBar: { flex: 1, marginRight: 4, backgroundColor: COLORS.background, borderWidth: 0 },
  modeRow: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 4,
  },
  feedError: { marginTop: 12 },
})
