import { useCallback, useMemo, useState } from 'react'
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import type { NativeStackScreenProps } from '@react-navigation/native-stack'
import type { RootStackParamList } from '../navigation/RootNavigator'
import { COLORS } from '../constants/colors'
import { layoutStyles } from '../constants/layout'
import { FONTS } from '../constants/typography'
import { useSettings } from '../contexts/SettingsContext'
import { useNewsFeed } from '../hooks/useNewsFeed'
import { useDebouncedValue } from '../hooks/useDebouncedValue'
import { useFeedbackToggles } from '../hooks/useFeedbackToggles'
import { NewsListSkeleton } from '../components/common/Skeleton'
import NewsList from '../components/news/NewsList'
import SearchBar from '../components/news/SearchBar'
import RetryableError from '../components/common/RetryableError'
import type { NewsItem } from '../types'

type Props = NativeStackScreenProps<RootStackParamList, 'DeptNews'>

/** 학과·기관 하나의 소식 목록. 학과 트리(전체 탭·검색)에서 항목을 고르면 들어온다. */
export default function DeptNewsScreen({ route, navigation }: Props) {
  const { deptId, deptName } = route.params
  const { isBookmarked } = useSettings()
  const { toggleBookmark } = useFeedbackToggles()
  const [query, setQuery] = useState('')
  const keyword = useDebouncedValue(query.trim())
  // 학과·기관 = 수집 게시판 하나(sourceId). 검색어는 서버가 제목에서 찾는다.
  const sourceIds = useMemo(() => [deptId], [deptId])
  const newsFeed = useNewsFeed({ sourceIds, keyword })
  const isSearching = keyword.length > 0

  const handlePressItem = useCallback(
    (item: NewsItem) => navigation.navigate('NewsDetail', { item }),
    [navigation],
  )

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={[styles.header, layoutStyles.readable]}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => navigation.goBack()}
          accessibilityRole="button"
          accessibilityLabel="뒤로 가기"
        >
          <Ionicons name="arrow-back" size={17} color="#444" />
        </TouchableOpacity>
        <Text style={styles.title} numberOfLines={1}>{deptName}</Text>
      </View>
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
        header={
          <SearchBar
            value={query}
            onChangeText={setQuery}
            placeholder="소식 제목 검색"
            accessibilityLabel="소식 검색"
          />
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
            <View style={styles.emptyState}>
              <Ionicons
                name={isSearching ? 'search-outline' : 'file-tray-outline'}
                size={40}
                color="#ddd"
              />
              <Text style={styles.emptyText}>
                {isSearching ? `'${keyword}' 검색 결과가 없습니다` : '등록된 소식이 없습니다'}
              </Text>
            </View>
          )
        }
      />
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.white },
  header: {
    height: 48,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    backgroundColor: COLORS.white,
    borderBottomWidth: 0.5,
    borderBottomColor: '#ebebeb',
    gap: 8,
  },
  backBtn: {
    width: 34,
    height: 34,
    borderRadius: 9,
    backgroundColor: '#f4f4f4',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { fontSize: 14, fontFamily: FONTS.medium, color: COLORS.textPrimary, flex: 1 },
  emptyState: { height: 280, alignItems: 'center', justifyContent: 'center', gap: 12 },
  feedError: { marginTop: 12 },
  emptyText: { fontFamily: FONTS.regular, fontSize: 13, color: '#ccc' },
})
