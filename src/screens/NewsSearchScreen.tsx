import { useCallback, useState } from 'react'
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import type { NativeStackScreenProps } from '@react-navigation/native-stack'
import type { RootStackParamList } from '../navigation/RootNavigator'
import { COLORS } from '../constants/colors'
import { FONTS } from '../constants/typography'
import { TREE_DATA } from '../constants/news'
import { useSettings } from '../contexts/SettingsContext'
import { useNewsSearch } from '../hooks/useNewsSearch'
import { useTreeSearch } from '../hooks/useTreeSearch'
import { useNewsFeed } from '../hooks/useNewsFeed'
import NewsList from '../components/news/NewsList'
import SearchBar from '../components/news/SearchBar'
import DeptTreeList from '../components/news/DeptTreeList'
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
  const { isBookmarked, toggleBookmark, settings, toggleSubscribedDept } = useSettings()
  const [mode, setMode] = useState<SearchMode>('게시글')

  const newsFeed = useNewsFeed()
  const postSearch = useNewsSearch(newsFeed.data ?? [])
  const deptSearch = useTreeSearch(TREE_DATA)
  // 모드를 오가도 서로의 검색어를 지우지 않도록 훅을 둘 다 항상 호출하고,
  // 입력창은 현재 모드의 상태만 보여준다.
  const active = mode === '게시글' ? postSearch : deptSearch

  const handlePressItem = useCallback(
    (item: NewsItem) => navigation.navigate('NewsDetail', { item }),
    [navigation],
  )

  const handleSelectDept = useCallback(
    (id: string, name: string) => navigation.navigate('DeptNews', { deptId: id, deptName: name }),
    [navigation],
  )

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={17} color="#444" />
        </TouchableOpacity>
        <SearchBar
          value={active.query}
          onChangeText={active.setQuery}
          placeholder={mode === '게시글' ? '소식 검색' : '학과·기관 검색'}
          accessibilityLabel="검색"
          style={styles.searchBar}
          autoFocus
        />
      </View>

      <View style={styles.modeRow}>
        {MODES.map((m) => {
          const isActive = mode === m
          return (
            <TouchableOpacity
              key={m}
              style={[styles.modeChip, isActive && styles.modeChipActive]}
              onPress={() => setMode(m)}
              accessibilityRole="button"
              accessibilityState={{ selected: isActive }}
            >
              <Text style={[styles.modeChipText, isActive && styles.modeChipTextActive]}>
                {m}
              </Text>
            </TouchableOpacity>
          )
        })}
      </View>

      {mode === '게시글' ? (
        <NewsList
          items={postSearch.results}
          isBookmarked={isBookmarked}
          onPressItem={handlePressItem}
          onToggleBookmark={toggleBookmark}
          empty={
            <View style={styles.emptyState}>
              {newsFeed.loading ? (
                <ActivityIndicator size="small" color={COLORS.primary} />
              ) : (
                <Ionicons name="search-outline" size={40} color="#ddd" />
              )}
              <Text style={styles.emptyText}>
                {newsFeed.loading
                  ? '소식을 불러오는 중…'
                  : postSearch.isSearching
                    ? `'${postSearch.query.trim()}' 검색 결과가 없습니다`
                    : '제목·미리보기·출처로 검색합니다'}
              </Text>
            </View>
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
  container: { flex: 1, backgroundColor: COLORS.white },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingTop: 6,
    paddingBottom: 10,
    backgroundColor: COLORS.white,
  },
  backBtn: {
    width: 34,
    height: 34,
    borderRadius: 9,
    backgroundColor: '#f4f4f4',
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchBar: { flex: 1 },
  modeRow: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 12,
    paddingBottom: 10,
    borderBottomWidth: 0.5,
    borderBottomColor: '#E8E8E8',
  },
  modeChip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 15,
    backgroundColor: '#f4f4f4',
  },
  modeChipActive: { backgroundColor: COLORS.primary },
  modeChipText: { fontSize: 13, fontFamily: FONTS.semibold, color: '#999' },
  modeChipTextActive: { color: COLORS.white },
  emptyState: { height: 280, alignItems: 'center', justifyContent: 'center', gap: 12 },
  emptyText: { fontFamily: FONTS.regular, fontSize: 13, color: '#ccc' },
})
