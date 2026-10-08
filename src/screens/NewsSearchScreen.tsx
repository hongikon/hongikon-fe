import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  Animated,
  Easing,
  Keyboard,
  PanResponder,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  useWindowDimensions,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native'
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
/** iOS: 목록 맨 위에서 이만큼 더 끌어내렸다 놓으면 닫는다(바운스로 늘어난 거리). */
const PULL_CLOSE_DISTANCE = 70
/** 머리 카드를 이만큼 끌어내리거나 빠르게 튕기면 닫는다. */
const DRAG_CLOSE_DISTANCE = 120
const DRAG_CLOSE_VELOCITY = 0.9

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

  // 아래에서 올라온 화면이라 아래로 끌어내려 닫는다(10-08 요청).
  // - 머리 카드(검색창 줄)를 끌어내리면 화면이 손가락을 따라 내려가고, 충분히 내렸거나 빠르게 튕기면 닫힌다(모든 플랫폼).
  // - iOS 는 목록 맨 위에서 더 끌어내린(바운스) 거리로도 닫는다. 안드로이드·웹은 맨 위에서 더 끌어도 목록이 늘어나지 않아 머리 카드로만.
  // 웹은 화면 전환 애니메이션이 없어(native-stack 웹판) 열고 닫을 때 직접 아래에서 올리고 내린다. 앱은 slide_from_bottom 이 한다.
  const isWeb = Platform.OS === 'web'
  const { height: windowHeight } = useWindowDimensions()
  const dragY = useRef(new Animated.Value(isWeb ? windowHeight : 0)).current
  useEffect(() => {
    if (!isWeb) return
    Animated.timing(dragY, { toValue: 0, duration: 260, easing: Easing.out(Easing.cubic), useNativeDriver: false }).start()
  }, [isWeb, dragY])
  const closing = useRef(false)
  const close = useCallback(() => {
    if (closing.current) return
    closing.current = true
    Keyboard.dismiss()
    if (!isWeb) {
      navigation.goBack()
      return
    }
    Animated.timing(dragY, { toValue: windowHeight, duration: 220, easing: Easing.in(Easing.cubic), useNativeDriver: false }).start(
      () => navigation.goBack(),
    )
  }, [navigation, isWeb, dragY, windowHeight])
  const headerPan = useMemo(() => {
    const springBack = () =>
      Animated.spring(dragY, { toValue: 0, useNativeDriver: Platform.OS !== 'web', damping: 20, stiffness: 260 }).start()
    return PanResponder.create({
      // 아래로, 세로가 확실할 때만 잡는다 — 뒤로 가기·검색창 누르기와 가로 동작은 그대로 둔다.
      onMoveShouldSetPanResponder: (_, g) => g.dy > 8 && Math.abs(g.dy) > Math.abs(g.dx) * 1.5,
      onPanResponderMove: (_, g) => dragY.setValue(Math.max(0, g.dy)),
      onPanResponderRelease: (_, g) => {
        if (g.dy > DRAG_CLOSE_DISTANCE || g.vy > DRAG_CLOSE_VELOCITY) close()
        else springBack()
      },
      onPanResponderTerminate: springBack,
    })
  }, [dragY, close])
  const handleScrollEndDrag = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      if (Platform.OS === 'ios' && event.nativeEvent.contentOffset.y < -PULL_CLOSE_DISTANCE) close()
    },
    [close],
  )

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
          onScrollEndDrag={handleScrollEndDrag}
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
                icon={isSearchingPosts ? 'search-outline' : 'file-tray-outline'}
                message={isSearchingPosts ? `'${keyword}' 검색 결과가 없어요` : '등록된 소식이 없어요'}
              />
            )
          }
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
  modeRow: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 4,
  },
  feedError: { marginTop: 12 },
})
