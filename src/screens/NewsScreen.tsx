import { useState, useCallback, useEffect, useMemo, useRef } from 'react'
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, type FlatList } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useIsFocused, useNavigation, useScrollToTop, type CompositeNavigationProp } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { Ionicons } from '@expo/vector-icons'
import { COLORS } from '../constants/colors'
import { RADIUS, SPACING } from '../constants/spacing'
import { layoutStyles } from '../constants/layout'
import { TREE_DATA, SUBSCRIBABLE_ITEMS } from '../constants/news'
import type { NewsItem } from '../types'
import type { RootStackParamList } from '../navigation/RootNavigator'
import type { NewsStackParamList } from '../navigation/NewsStackNavigator'
import { useSettings } from '../contexts/SettingsContext'
import { useNewsFeed } from '../hooks/useNewsFeed'
import { useBookmarkedNews } from '../hooks/useBookmarkedNews'
import { useFeedbackToggles } from '../hooks/useFeedbackToggles'
import { NewsListSkeleton } from '../components/common/Skeleton'
import * as haptics from '../lib/haptics'
import { FONTS } from '../constants/typography'
import NewsList from '../components/news/NewsList'
import DeptTreeList from '../components/news/DeptTreeList'
import SubscriptionManagerModal from '../components/settings/SubscriptionManagerModal'
import RetryableError from '../components/common/RetryableError'
import TabHeaderCard, { HeaderCircleButton, SegmentedTabs } from '../components/common/TabHeaderCard'
import EmptyState from '../components/common/EmptyState'
import Button from '../components/common/Button'

type TabType = '북마크' | '구독' | '전체'
// 소식 탭 스택(학과 소식) 안에 있으면서 루트 스택(상세·검색)으로도 이동한다.
type NavProp = CompositeNavigationProp<
  NativeStackNavigationProp<NewsStackParamList>,
  NativeStackNavigationProp<RootStackParamList>
>

/** 구독 학과 id → 표시 이름. 구독 칩에 쓴다. */
const DEPT_NAME_BY_ID = new Map(SUBSCRIBABLE_ITEMS.map((item) => [item.id, item.name]))

const TABS: TabType[] = ['북마크', '구독', '전체']

export default function NewsScreen() {
  const navigation = useNavigation<NavProp>()
  const { settings, isBookmarked } = useSettings()
  // 북마크·구독은 진동과 토스트("북마크에 저장했어요")가 붙은 버전을 쓴다.
  const { toggleBookmark, toggleSubscribedDept } = useFeedbackToggles()
  // 처음엔 구독한 게시판이 있으면 '구독', 없으면 고를 수 있는 '전체'를 연다. 북마크는 대개 비어 있어
  // 첫 화면으로 두면 빈 안내만 보였다.
  const [activeTab, setActiveTab] = useState<TabType>(() =>
    settings.subscribedDepts.length > 0 ? '구독' : '전체',
  )
  const [subManagerOpen, setSubManagerOpen] = useState(false)
  // 이미 소식 탭에 있을 때 하단 '소식' 탭을 다시 누르면 지금 보이는 목록을 맨 위로 올린다(10-08 요청).
  const listRef = useRef<FlatList<NewsItem>>(null)
  const treeRef = useRef<ScrollView>(null)
  useScrollToTop(listRef)
  useScrollToTop(treeRef)
  const [manageChipsOpen, setManageChipsOpen] = useState(false)

  // 구독 탭: 구독한 게시판(리프 id)들을 sourceId 로 서버에서 거른다. 구독이 없으면 부르지 않고 빈 화면 안내를
  // 그대로 보여준다. 분야로는 거르지 않는다 — 설정의 '알림 받을 분야'는 푸시 알림에만 쓰이고 피드와는 따로다.
  //
  // 피드에 쓰는 구독 목록(feedSourceIds)은 구독 화면을 보는 동안에는 고정한다. '관리'에서 하나 지우거나 더할 때마다
  // 목록을 비우고 처음부터 다시 받아, 뼈대 화면이 뜨며 '내 구독' 카드까지 사라졌다 나타나고 맨 위로 튀었다(11-06).
  // 지운 게시판 글은 화면에서 바로 빼고(displayedNews), 새로 받는 건 구독 화면을 벗어날 때(다른 탭·다른 화면) 뒤에서 한다.
  // 서버 구독(알림)은 이와 따로 SettingsContext 가 바로 맞춘다. 당겨서 새로고침하면 그때도 맞춘다.
  const screenFocused = useIsFocused()
  const onSubscribedView = screenFocused && activeTab === '구독'
  const [feedSourceIds, setFeedSourceIds] = useState<readonly string[]>(settings.subscribedDepts)
  useEffect(() => {
    // 구독이 하나도 없던 상태에서 처음 구독하면 비울 목록이 없어 바로 받는다(빈 안내가 남지 않게).
    if (!onSubscribedView || feedSourceIds.length === 0) setFeedSourceIds(settings.subscribedDepts)
  }, [onSubscribedView, settings.subscribedDepts, feedSourceIds.length])
  const subscribedFeed = useNewsFeed(
    { sourceIds: feedSourceIds },
    // 탭을 오갈 때마다 다시 받지 않도록 활성 탭과 무관하게 켜 둔다.
    { enabled: feedSourceIds.length > 0 },
  )
  const subscribedSet = useMemo(() => new Set(settings.subscribedDepts), [settings.subscribedDepts])
  const subscribedItems = useMemo(
    () => subscribedFeed.items.filter((item) => subscribedSet.has(item.sourceId)),
    [subscribedFeed.items, subscribedSet],
  )
  // '내 구독' 칩으로 고른 게시판(null = 전체). 고르면 그 게시판만 따로 받아 끝까지 넘겨 볼 수 있게 하고,
  // 받는 동안은 이미 받아 둔 전체 목록에서 그 게시판 글만 먼저 보여 줘 빈 화면이 끼지 않게 한다.
  const [selectedSource, setSelectedSource] = useState<string | null>(null)
  useEffect(() => {
    if (selectedSource !== null && !subscribedSet.has(selectedSource)) setSelectedSource(null)
  }, [selectedSource, subscribedSet])
  const boardFeed = useNewsFeed(
    { sourceIds: selectedSource !== null ? [selectedSource] : [] },
    { enabled: selectedSource !== null },
  )
  const selectSource = useCallback((id: string | null) => {
    setSelectedSource(id)
    listRef.current?.scrollToOffset({ offset: 0, animated: false })
  }, [])
  const activeFeed = selectedSource !== null ? boardFeed : subscribedFeed
  const boardItems = useMemo(() => {
    if (selectedSource === null) return subscribedItems
    if (boardFeed.items.length > 0 || !boardFeed.loading) return boardFeed.items
    return subscribedItems.filter((item) => item.sourceId === selectedSource)
  }, [selectedSource, subscribedItems, boardFeed.items, boardFeed.loading])
  const feedPending = feedSourceIds.join('\u0000') !== settings.subscribedDepts.join('\u0000')
  const refreshSubscribed = useCallback(() => {
    if (selectedSource !== null) boardFeed.refresh()
    else if (feedPending) setFeedSourceIds(settings.subscribedDepts)
    else subscribedFeed.refresh()
  }, [selectedSource, boardFeed, feedPending, settings.subscribedDepts, subscribedFeed])
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
  const emptyMessage =
    activeTab === '북마크'
      ? '북마크한 소식이 없어요'
      : selectedSource !== null
        ? '이 게시판의 소식이 아직 없어요'
        : '구독한 기관·학과의 소식이 없어요'

  // NewsList 로 넘기는 콜백은 렌더마다 새로 만들면 안 된다.
  // 새로 만들면 목록의 모든 카드가 memo 를 통과해 다시 그려진다.
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
                <View style={styles.hub}>
                  <View style={styles.hubHead}>
                    <Text style={styles.hubLabel}>
                      내 구독 {settings.subscribedDepts.length}
                    </Text>
                    <TouchableOpacity
                      style={styles.hubManage}
                      onPress={() => setManageChipsOpen((v) => !v)}
                      accessibilityRole="button"
                    >
                      <Ionicons
                        name={manageChipsOpen ? 'chevron-up' : 'options-outline'}
                        size={13}
                        color={COLORS.primary}
                      />
                      <Text style={styles.hubManageText}>관리</Text>
                    </TouchableOpacity>
                  </View>

                  {!manageChipsOpen && settings.subscribedDepts.length > 1 && (
                    <ScrollView
                      horizontal
                      showsHorizontalScrollIndicator={false}
                      contentContainerStyle={styles.filterRow}
                      style={styles.filterScroll}
                    >
                      {[null, ...settings.subscribedDepts].map((id) => {
                        const selected = selectedSource === id
                        const label = id === null ? '전체' : (DEPT_NAME_BY_ID.get(id) ?? id)
                        return (
                          <TouchableOpacity
                            key={id ?? '__all'}
                            style={[styles.filterChip, selected && styles.filterChipOn]}
                            onPress={() => selectSource(id)}
                            accessibilityRole="button"
                            accessibilityState={{ selected }}
                            accessibilityLabel={id === null ? '구독 전체 보기' : `${label}만 보기`}
                          >
                            <Text style={[styles.filterChipText, selected && styles.filterChipTextOn]}>{label}</Text>
                          </TouchableOpacity>
                        )
                      })}
                    </ScrollView>
                  )}

                  {manageChipsOpen && (
                    <View style={styles.chips}>
                      {settings.subscribedDepts.map((id) => (
                        <View key={id} style={styles.chip}>
                          <Text style={styles.chipText}>{DEPT_NAME_BY_ID.get(id) ?? id}</Text>
                          <TouchableOpacity
                            onPress={() => toggleSubscribedDept(id)}
                            hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                            accessibilityLabel={`${DEPT_NAME_BY_ID.get(id) ?? id} 구독 해제`}
                          >
                            <View style={styles.chipX}>
                              <Ionicons name="close" size={11} color={COLORS.white} />
                            </View>
                          </TouchableOpacity>
                        </View>
                      ))}
                      <TouchableOpacity
                        style={styles.chipAdd}
                        onPress={() => setSubManagerOpen(true)}
                        accessibilityRole="button"
                      >
                        <Ionicons name="add" size={13} color={COLORS.primary} />
                        <Text style={styles.chipAddText}>구독 추가</Text>
                      </TouchableOpacity>
                    </View>
                  )}
                </View>
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

  // 카드 스타일은 components/news/NewsCard.tsx 로, 학과 트리는 components/news/DeptTreeList.tsx 로 옮겼다.


  feedError: { marginHorizontal: 12, marginTop: 12 },

  listHeaderGroup: { gap: 10 },
  // 목록 카드와 같은 곡률·안쪽 여백(10-08) — 글자가 아래 카드 글자와 세로로 줄이 맞는다.
  hub: { backgroundColor: COLORS.white, borderRadius: RADIUS.lg, padding: SPACING.lg },
  hubHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  hubLabel: { fontSize: 13, fontFamily: FONTS.semibold, color: COLORS.textSecondary },
  hubManage: { flexDirection: 'row', alignItems: 'center', gap: 3, paddingVertical: 2, paddingLeft: 8 },
  hubManageText: { fontSize: 12, fontFamily: FONTS.semibold, color: COLORS.primary },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm, marginTop: 12 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: COLORS.primary,
    paddingLeft: 11,
    paddingRight: 7,
    paddingVertical: 6,
    borderRadius: RADIUS.pill,
  },
  chipText: { color: COLORS.white, fontSize: 12, fontFamily: FONTS.semibold },
  chipX: {
    width: 15,
    height: 15,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.25)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipAdd: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: RADIUS.pill,
    borderWidth: 1.2,
    borderColor: COLORS.chipBorder,
    borderStyle: 'dashed',
  },
  chipAddText: { color: COLORS.primary, fontSize: 12, fontFamily: FONTS.semibold },
  // 관리를 닫았을 때의 고르기 칩(전체·게시판). 카드 안쪽 여백(lg)을 넘어 끝까지 넘기게 좌우로 늘린다.
  filterScroll: { marginTop: 12, marginHorizontal: -SPACING.lg },
  filterRow: { gap: SPACING.sm, paddingHorizontal: SPACING.lg },
  filterChip: {
    paddingHorizontal: 13,
    paddingVertical: 7,
    borderRadius: RADIUS.pill,
    borderWidth: 1.2,
    borderColor: COLORS.chipBorder,
    backgroundColor: COLORS.white,
  },
  filterChipOn: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  filterChipText: { color: COLORS.textSecondary, fontSize: 12, fontFamily: FONTS.semibold },
  filterChipTextOn: { color: COLORS.white },
})
