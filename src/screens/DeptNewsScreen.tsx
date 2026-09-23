import { useCallback, useMemo } from 'react'
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import type { NativeStackScreenProps } from '@react-navigation/native-stack'
import type { RootStackParamList } from '../navigation/RootNavigator'
import { COLORS } from '../constants/colors'
import { FONTS } from '../constants/typography'
import { useSettings } from '../contexts/SettingsContext'
import { useNewsSearch } from '../hooks/useNewsSearch'
import { useNewsFeed } from '../hooks/useNewsFeed'
import NewsList from '../components/news/NewsList'
import SearchBar from '../components/news/SearchBar'
import RetryableError from '../components/common/RetryableError'
import type { NewsItem } from '../types'

type Props = NativeStackScreenProps<RootStackParamList, 'DeptNews'>

/** 학과·기관 하나의 소식 목록. 학과 트리(전체 탭·검색)에서 항목을 고르면 들어온다. */
export default function DeptNewsScreen({ route, navigation }: Props) {
  const { deptId, deptName } = route.params
  const { isBookmarked, toggleBookmark } = useSettings()
  const newsFeed = useNewsFeed()
  const items = useMemo(
    () => (newsFeed.data ?? []).filter((n) => n.sourceId === deptId),
    [newsFeed.data, deptId],
  )
  const search = useNewsSearch(items)

  const handlePressItem = useCallback(
    (item: NewsItem) => navigation.navigate('NewsDetail', { item }),
    [navigation],
  )

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={17} color="#444" />
        </TouchableOpacity>
        <Text style={styles.title} numberOfLines={1}>{deptName}</Text>
      </View>
      {newsFeed.loading ? (
        <View style={styles.emptyState}>
          <ActivityIndicator size="small" color={COLORS.primary} />
        </View>
      ) : newsFeed.errorMessage && items.length === 0 ? (
        <RetryableError
          style={styles.feedError}
          message={newsFeed.errorMessage}
          isNetworkError={newsFeed.isNetworkError}
          onRetry={newsFeed.canRetry ? newsFeed.retry : undefined}
          retrying={newsFeed.refreshing}
        />
      ) : (
      <NewsList
        items={search.results}
        isBookmarked={isBookmarked}
        onPressItem={handlePressItem}
        onToggleBookmark={toggleBookmark}
        header={
          <SearchBar
            value={search.query}
            onChangeText={search.setQuery}
            placeholder="소식 검색"
            accessibilityLabel="소식 검색"
          />
        }
        empty={
          <View style={styles.emptyState}>
            <Ionicons
              name={search.isSearching ? 'search-outline' : 'file-tray-outline'}
              size={40}
              color="#ddd"
            />
            <Text style={styles.emptyText}>
              {search.isSearching
                ? `'${search.query.trim()}' 검색 결과가 없습니다`
                : '등록된 소식이 없습니다'}
            </Text>
          </View>
        }
      />
      )}
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
  feedError: { marginHorizontal: 12, marginTop: 12 },
  emptyText: { fontFamily: FONTS.regular, fontSize: 13, color: '#ccc' },
})
