import { useCallback, useState } from 'react'
import { Animated, StyleSheet, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import type { NativeStackScreenProps } from '@react-navigation/native-stack'
import type { RootStackParamList } from '../navigation/RootNavigator'
import { COLORS } from '../constants/colors'
import { layoutStyles } from '../constants/layout'
import { TREE_DATA } from '../constants/news'
import { useSettings } from '../contexts/SettingsContext'
import { useTreeSearch } from '../hooks/useTreeSearch'
import { useNewsFeed } from '../hooks/useNewsFeed'
import { useDebouncedValue } from '../hooks/useDebouncedValue'
import { useFeedbackToggles } from '../hooks/useFeedbackToggles'
import { useSearchSheetDismiss } from '../hooks/news/useSearchSheetDismiss'
import SearchBar from '../components/news/SearchBar'
import DeptTreeList from '../components/news/DeptTreeList'
import PostSearchResults from '../components/news/search/PostSearchResults'
import SearchModeChips from '../components/news/search/SearchModeChips'
import ScreenHeader from '../components/common/ScreenHeader'
import type { NewsItem } from '../types'

type Props = NativeStackScreenProps<RootStackParamList, 'NewsSearch'>
type SearchMode = '게시글' | '학과'

const MODES: SearchMode[] = ['게시글', '학과']

/**
 * 소식 탭 상단 돋보기로 들어오는 통합 검색 화면.
 * 게시글 검색과 학과 검색은 대상이 달라 결과 모양도 다르므로,
 * 필터 칩으로 모드를 바꾸고 입력창 하나를 그 모드의 훅에 연결한다.
 */
export default function NewsSearchScreen({ navigation, route }: Props) {
  const { isBookmarked, settings } = useSettings()
  const { toggleBookmark, toggleSubscribedDept } = useFeedbackToggles()
  const [mode, setMode] = useState<SearchMode>('게시글')

  // 게시글 검색은 서버(`GET /news?keyword=`, 제목 부분 일치)가 한다. 타이핑마다 부르지 않도록
  // 300ms 디바운스하고, 검색어가 비면 필터 없는 전체 최신 소식을 보여준다.
  const [postQuery, setPostQuery] = useState(route.params?.query ?? '')
  const keyword = useDebouncedValue(postQuery.trim())
  const newsFeed = useNewsFeed({ keyword })
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

  // 아래로 끌어내려 닫기(머리 카드·iOS 목록 바운스)와 웹의 올라오기·내려가기(hooks/news/useSearchSheetDismiss).
  const goBack = useCallback(() => navigation.goBack(), [navigation])
  const { dragY, close, headerPan, handleScrollEndDrag } = useSearchSheetDismiss(goBack)

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <Animated.View style={[styles.sheet, { transform: [{ translateY: dragY }] }]}>
      <View {...headerPan.panHandlers}>
      <ScreenHeader onBack={close} card style={layoutStyles.readable}>
        <SearchBar
          value={active.query}
          onChangeText={active.setQuery}
          placeholder={mode === '게시글' ? '소식 제목 검색' : '학과·기관 검색'}
          accessibilityLabel="검색"
          style={styles.searchBar}
          autoFocus
        />
      </ScreenHeader>
      </View>

      <SearchModeChips modes={MODES} value={mode} onChange={setMode} />

      {mode === '게시글' ? (
        <PostSearchResults
          newsFeed={newsFeed}
          keyword={keyword}
          isBookmarked={isBookmarked}
          onPressItem={handlePressItem}
          onToggleBookmark={toggleBookmark}
          onScrollEndDrag={handleScrollEndDrag}
        />
      ) : (
        <DeptTreeList
          onScrollEndDrag={handleScrollEndDrag}
          query={deptSearch.query}
          results={deptSearch.results}
          isSearching={deptSearch.isSearching}
          onSelectDept={handleSelectDept}
          subscribedDepts={settings.subscribedDepts}
          onToggleSubscribe={toggleSubscribedDept}
        />
      )}
      </Animated.View>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  // 회색 바탕 위에 머리 카드(검색창 포함)·결과 카드가 뜬다(10-07).
  container: { flex: 1, backgroundColor: COLORS.background },
  sheet: { flex: 1 },
  // 카드 안 검색창은 회색 알약(카드와 같은 흰색이면 경계가 안 보인다).
  searchBar: { flex: 1, marginRight: 4, backgroundColor: COLORS.background, borderWidth: 0 },
})
