import { useState, useCallback, useRef } from 'react'
import { View, StyleSheet, type ScrollView, type FlatList } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useIsFocused, useNavigation, useScrollToTop, type CompositeNavigationProp } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { Ionicons } from '@expo/vector-icons'
import { COLORS } from '../constants/colors'
import { TREE_DATA } from '../constants/news'
import type { NewsItem } from '../types'
import type { RootStackParamList } from '../navigation/RootNavigator'
import type { NewsStackParamList } from '../navigation/NewsStackNavigator'
import { useSettings } from '../contexts/SettingsContext'
import { useSubscribedFeed } from '../hooks/news/useSubscribedFeed'
import { feedEmptyMessage, type NewsTab } from '../utils/news/feed'
import { useBookmarkedNews } from '../hooks/useBookmarkedNews'
import { useFeedbackToggles } from '../hooks/settings/useFeedbackToggles'
import { NewsListSkeleton } from '../components/common/Skeleton'
import * as haptics from '../lib/haptics'
import NewsList from '../components/news/NewsList'
import DeptTreeList from '../components/news/DeptTreeList'
import SubscriptionHub from '../components/news/feed/SubscriptionHub'
import SubscriptionManagerModal from '../components/settings/SubscriptionManagerModal'
import RetryableError from '../components/common/RetryableError'
import TabHeaderCard, { HeaderCircleButton, SegmentedTabs } from '../components/common/TabHeaderCard'
import EmptyState from '../components/common/EmptyState'
import Button from '../components/common/Button'

// 소식 탭 스택(학과 소식) 안에 있으면서 루트 스택(상세·검색)으로도 이동한다.
type NavProp = CompositeNavigationProp<
  NativeStackNavigationProp<NewsStackParamList>,
  NativeStackNavigationProp<RootStackParamList>
>

const TABS: NewsTab[] = ['북마크', '구독', '전체']

export default function NewsScreen() {
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

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* 둥근 흰 카드 안에 제목·검색, 그 아래 세그먼트 탭(10-07 A안). */}
      <TabHeaderCard
        title="소식"
        right={
          <HeaderCircleButton onPress={() => navigation.navigate('NewsSearch')} accessibilityLabel="검색">
            <Ionicons name="search" size={20} color={COLORS.textPrimary} />
          </HeaderCircleButton>
        }
      >
        <SegmentedTabs
          tabs={TABS}
          value={activeTab}
          onChange={(tab) => {
            if (tab !== activeTab) haptics.selection()
            setActiveTab(tab)
          }}
        />
      </TabHeaderCard>

      {activeTab === '전체' ? (
        <DeptTreeList
          scrollRef={treeRef}
          query=""
          results={TREE_DATA}
          isSearching={false}
          onSelectDept={handleSelectDept}
          subscribedDepts={settings.subscribedDepts}
          onToggleSubscribe={toggleSubscribedDept}
        />
      ) : feedState.loading ? (
        <NewsListSkeleton />
      ) : feedState.errorMessage && displayedNews.length === 0 ? (
        <RetryableError
          style={styles.feedError}
          message={feedState.errorMessage}
          isNetworkError={feedState.isNetworkError}
          onRetry={feedState.canRetry ? feedState.retry : undefined}
          retrying={feedState.retrying}
        />
      ) : (
        <NewsList
          listRef={listRef}
          items={displayedNews}
          isBookmarked={isBookmarked}
          onPressItem={handlePressItem}
          onToggleBookmark={toggleBookmark}
          onEndReached={isBookmarkTab ? undefined : activeFeed.loadMore}
          loadingMore={!isBookmarkTab && activeFeed.loadingMore}
          refreshing={isBookmarkTab ? undefined : activeFeed.refreshing}
          onRefresh={isBookmarkTab ? undefined : refreshSubscribed}
          footer={
            feedState.errorMessage ? (
              <RetryableError
                message={feedState.errorMessage}
                isNetworkError={feedState.isNetworkError}
                onRetry={feedState.canRetry ? feedState.retry : undefined}
                retrying={feedState.retrying}
              />
            ) : null
          }
          header={
            <View style={styles.listHeaderGroup}>
              {activeTab === '구독' && settings.subscribedDepts.length > 0 && (
                <SubscriptionHub
                  subscribedDepts={settings.subscribedDepts}
                  selectedSource={selectedSource}
                  onSelectSource={selectSource}
                  manageOpen={manageChipsOpen}
                  onToggleManage={toggleManageChips}
                  onRemoveDept={toggleSubscribedDept}
                  onAddSubscription={openSubManager}
                />
              )}
            </View>
          }
          empty={
            <EmptyState
              icon={activeTab === '북마크' ? 'bookmark-outline' : 'notifications-outline'}
              message={emptyMessage}
              action={
                activeTab === '구독' && settings.subscribedDepts.length === 0 ? (
                  <Button
                    label="구독 추가하기"
                    icon="add"
                    size="md"
                    fullWidth={false}
                    onPress={() => setSubManagerOpen(true)}
                  />
                ) : undefined
              }
            />
          }
        />
      )}

      <SubscriptionManagerModal
        visible={subManagerOpen}
        onClose={() => setSubManagerOpen(false)}
        subscribedDepts={settings.subscribedDepts}
        onToggleDept={toggleSubscribedDept}
      />
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  // 회색 바탕 위에 머리 카드·목록 카드가 뜬다. 상단 인셋(노치 아래)도 같은 회색.
  container: { flex: 1, backgroundColor: COLORS.background },

  // 카드 스타일은 components/news/NewsCard.tsx 로, 학과 트리는 components/news/DeptTreeList.tsx 로,
  // '내 구독' 카드는 components/news/feed/SubscriptionHub.tsx 로 옮겼다.
  feedError: { marginHorizontal: 12, marginTop: 12 },

  listHeaderGroup: { gap: 10 },
})
