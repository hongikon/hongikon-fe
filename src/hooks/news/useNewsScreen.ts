import { useState, useCallback, useRef } from 'react'
import { type ScrollView, type FlatList } from 'react-native'
import { useIsFocused, useNavigation, useScrollToTop } from '@react-navigation/native'
import type { NewsItem } from '../../types'
import { useSettings } from '../../contexts/SettingsContext'
import { useSubscribedFeed } from './useSubscribedFeed'
import { feedEmptyMessage, type NewsTab } from '../../utils/news/feed'
import { useBookmarkedNews } from './useBookmarkedNews'
import { useFeedbackToggles } from '../settings/useFeedbackToggles'
import { type NavProp } from '../../utils/news/newsScreen'

/** NewsScreen 의 상태·효과·핸들러. 화면 파일은 이 훅을 불러 그리기만 한다. */
export function useNewsScreen() {
  const navigation = useNavigation<NavProp>()
  const { settings, isBookmarked } = useSettings()
  // 북마크·구독은 진동과 토스트("북마크에 저장했어요")가 붙은 버전을 쓴다.
  const { toggleBookmark, toggleSubscribedDept } = useFeedbackToggles()
  // 처음엔 구독한 게시판이 있으면 '구독', 없으면 고를 수 있는 '전체'를 연다. 북마크는 대개 비어 있어
  // 첫 화면으로 두면 빈 안내만 보였다.
  const [activeTab, setActiveTab] = useState<NewsTab>(() =>
    settings.subscribedDepts.length > 0 ? '구독' : '전체',
  )
  const [subManagerOpen, setSubManagerOpen] = useState(false)
  // 이미 소식 탭에 있을 때 하단 '소식' 탭을 다시 누르면 지금 보이는 목록을 맨 위로 올린다(10-08 요청).
  const listRef = useRef<FlatList<NewsItem>>(null)
  const treeRef = useRef<ScrollView>(null)
  useScrollToTop(listRef)
  useScrollToTop(treeRef)
  const [manageChipsOpen, setManageChipsOpen] = useState(false)

  // 구독 탭 피드와 '내 구독' 칩으로 고른 게시판(hooks/news/useSubscribedFeed).
  const screenFocused = useIsFocused()
  const onSubscribedView = screenFocused && activeTab === '구독'
  const { subscribedFeed, activeFeed, boardItems, selectedSource, selectSource, refreshSubscribed } = useSubscribedFeed({
    subscribedDepts: settings.subscribedDepts,
    onSubscribedView,
    listRef,
  })
  // 북마크 탭: 목록에서 골라낼 수 없어 id마다 상세를 받는다.
  const bookmarked = useBookmarkedNews(settings.bookmarkedNews)

  const isBookmarkTab = activeTab === '북마크'
  const displayedNews = isBookmarkTab ? bookmarked.items : boardItems
  const feedState = isBookmarkTab
    ? { ...bookmarked, retrying: bookmarked.refreshing || bookmarked.loading }
    : {
        ...activeFeed,
        // 게시판을 바꾸는 동안 받는 중 표시(뼈대 화면)로 '내 구독' 카드까지 가리지 않는다 — 처음 들어올 때만.
        loading: subscribedFeed.loading,
        retrying: activeFeed.loading || activeFeed.loadingMore || activeFeed.refreshing,
      }
  const emptyMessage = feedEmptyMessage(activeTab, selectedSource)

  // NewsList 로 넘기는 콜백은 렌더마다 새로 만들면 안 된다.
  // 새로 만들면 목록의 모든 카드가 memo 를 통과해 다시 그려진다.
  const handlePressItem = useCallback(
    (item: NewsItem) => navigation.navigate('NewsDetail', { item }),
    [navigation],
  )

  const toggleManageChips = useCallback(() => setManageChipsOpen((v) => !v), [])
  const openSubManager = useCallback(() => setSubManagerOpen(true), [])

  const handleSelectDept = useCallback(
    (id: string, name: string) => navigation.navigate('DeptNews', { deptId: id, deptName: name }),
    [navigation],
  )
  return {
    navigation,
    settings,
    isBookmarked,
    toggleBookmark,
    toggleSubscribedDept,
    activeTab,
    setActiveTab,
    subManagerOpen,
    setSubManagerOpen,
    listRef,
    treeRef,
    manageChipsOpen,
    activeFeed,
    selectedSource,
    selectSource,
    refreshSubscribed,
    isBookmarkTab,
    displayedNews,
    feedState,
    emptyMessage,
    handlePressItem,
    toggleManageChips,
    openSubManager,
    handleSelectDept,
  }
}
