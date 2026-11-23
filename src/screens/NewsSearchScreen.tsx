import { Animated, StyleSheet, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import type { NativeStackScreenProps } from '@react-navigation/native-stack'
import type { RootStackParamList } from '../navigation/RootNavigator'
import { COLORS } from '../constants/colors'
import { layoutStyles } from '../constants/layout'
import SearchBar from '../components/news/SearchBar'
import DeptTreeList from '../components/news/DeptTreeList'
import PostSearchResults from '../components/news/search/PostSearchResults'
import SearchModeChips from '../components/news/search/SearchModeChips'
import ScreenHeader from '../components/common/ScreenHeader'
import { useNewsSearchScreen } from '../hooks/news/useNewsSearchScreen'
import { type SearchMode } from '../utils/news/newsSearchScreen'

export type Props = NativeStackScreenProps<RootStackParamList, 'NewsSearch'>

const MODES: SearchMode[] = ['게시글', '학과']

/**
 * 소식 탭 상단 돋보기로 들어오는 통합 검색 화면.
 * 게시글 검색과 학과 검색은 대상이 달라 결과 모양도 다르므로,
 * 필터 칩으로 모드를 바꾸고 입력창 하나를 그 모드의 훅에 연결한다.
 */
export default function NewsSearchScreen({ navigation, route }: Props) {
  const { isBookmarked, settings, toggleBookmark, toggleSubscribedDept, mode, setMode, keyword, newsFeed, deptSearch, active, handlePressItem, handleSelectDept, dragY, close, headerPan, handleScrollEndDrag } = useNewsSearchScreen({ navigation, route })

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
