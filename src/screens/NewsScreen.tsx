import { useState, useCallback } from 'react'
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { Ionicons } from '@expo/vector-icons'
import { COLORS } from '../constants/colors'
import { TREE_DATA, SUBSCRIBABLE_ITEMS } from '../constants/news'
import type { NewsItem } from '../types'
import type { RootStackParamList } from '../navigation/RootNavigator'
import { useSettings } from '../contexts/SettingsContext'
import { useNewsFeed } from '../hooks/useNewsFeed'
import { useBookmarkedNews } from '../hooks/useBookmarkedNews'
import { FONTS } from '../constants/typography'
import NewsList from '../components/news/NewsList'
import DeptTreeList from '../components/news/DeptTreeList'
import SubscriptionManagerModal from '../components/settings/SubscriptionManagerModal'
import RetryableError from '../components/common/RetryableError'

type TabType = '북마크' | '구독' | '전체'
type NavProp = NativeStackNavigationProp<RootStackParamList>

/** 구독 학과 id → 표시 이름. 구독 칩에 쓴다. */
const DEPT_NAME_BY_ID = new Map(SUBSCRIBABLE_ITEMS.map((item) => [item.id, item.name]))

const TABS: TabType[] = ['북마크', '구독', '전체']

export default function NewsScreen() {
  const navigation = useNavigation<NavProp>()
  const { settings, isBookmarked, toggleBookmark, toggleSubscribedDept } = useSettings()
  const [activeTab, setActiveTab] = useState<TabType>('북마크')
  const [subManagerOpen, setSubManagerOpen] = useState(false)
  const [manageChipsOpen, setManageChipsOpen] = useState(false)

  // 구독 탭: 구독한 게시판(리프 id)들을 sourceId 로 서버에서 거른다. 구독이 없거나 카테고리를
  // 전부 끈 상태면 부르지 않고 빈 화면 안내를 그대로 보여준다. 카테고리는 하나일 때만 서버에서,
  // 여러 개면 페이지마다 클라이언트에서 거른다(백엔드 category 파라미터가 하나만 받음 — useNewsFeed 참고).
  const subscribedFeed = useNewsFeed(
    { sourceIds: settings.subscribedDepts, categories: settings.subscribedCategories },
    // 탭을 오갈 때마다 다시 받지 않도록 활성 탭과 무관하게 켜 둔다.
    { enabled: settings.subscribedDepts.length > 0 && settings.subscribedCategories.length > 0 },
  )
  // 북마크 탭: 목록에서 골라낼 수 없어 id마다 상세를 받는다.
  const bookmarked = useBookmarkedNews(settings.bookmarkedNews)

  const isBookmarkTab = activeTab === '북마크'
  const displayedNews = isBookmarkTab ? bookmarked.items : subscribedFeed.items
  const feedState = isBookmarkTab
    ? { ...bookmarked, retrying: bookmarked.refreshing || bookmarked.loading }
    : { ...subscribedFeed, retrying: subscribedFeed.loading || subscribedFeed.loadingMore || subscribedFeed.refreshing }
  const emptyMessage =
    activeTab === '북마크' ? '북마크한 소식이 없습니다' : '구독한 기관·학과의 소식이 없습니다'

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
      <View style={styles.header}>
        <Text style={styles.headerTitle}>소식</Text>
        <TouchableOpacity
          style={styles.searchBtn}
          onPress={() => navigation.navigate('NewsSearch')}
          accessibilityRole="button"
          accessibilityLabel="검색"
        >
          <Ionicons name="search" size={20} color={COLORS.textPrimary} />
        </TouchableOpacity>
      </View>

      <View style={styles.tabBar}>
        {TABS.map((tab) => {
          const isActive = activeTab === tab
          return (
            <TouchableOpacity
              key={tab}
              style={styles.tab}
              onPress={() => setActiveTab(tab)}
            >
              <Text style={[styles.tabText, isActive && styles.tabTextActive]}>{tab}</Text>
              <View style={[styles.tabIndicator, isActive && styles.tabIndicatorActive]} />
            </TouchableOpacity>
          )
        })}
      </View>

      {activeTab === '전체' ? (
        <DeptTreeList
          query=""
          results={TREE_DATA}
          isSearching={false}
          onSelectDept={handleSelectDept}
          subscribedDepts={settings.subscribedDepts}
          onToggleSubscribe={toggleSubscribedDept}
        />
      ) : feedState.loading ? (
        <View style={styles.feedLoading}>
          <ActivityIndicator size="small" color={COLORS.primary} />
          <Text style={styles.feedLoadingText}>소식을 불러오는 중…</Text>
        </View>
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
          items={displayedNews}
          isBookmarked={isBookmarked}
          onPressItem={handlePressItem}
          onToggleBookmark={toggleBookmark}
          onEndReached={isBookmarkTab ? undefined : subscribedFeed.loadMore}
          loadingMore={!isBookmarkTab && subscribedFeed.loadingMore}
          refreshing={isBookmarkTab ? undefined : subscribedFeed.refreshing}
          onRefresh={isBookmarkTab ? undefined : subscribedFeed.refresh}
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
                      내 구독 학과 {settings.subscribedDepts.length}
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
                      >
                        <Ionicons name="add" size={13} color={COLORS.primary} />
                        <Text style={styles.chipAddText}>학과 추가</Text>
                      </TouchableOpacity>
                    </View>
                  )}
                </View>
              )}
            </View>
          }
          empty={
            <View style={styles.emptyState}>
              <Ionicons
                name={activeTab === '북마크' ? 'bookmark-outline' : 'notifications-outline'}
                size={40}
                color="#ddd"
              />
              <Text style={styles.emptyText}>{emptyMessage}</Text>
              {activeTab === '구독' && settings.subscribedDepts.length === 0 && (
                <TouchableOpacity style={styles.cta} onPress={() => setSubManagerOpen(true)}>
                  <Ionicons name="add" size={16} color={COLORS.white} />
                  <Text style={styles.ctaText}>학과 구독하기</Text>
                </TouchableOpacity>
              )}
            </View>
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
  // SafeAreaView 상단 인셋(노치 아래 여백)은 바로 밑 header 와 같은 흰색이어야 한다.
  // 콘텐츠의 회색 배경은 DeptTreeList/NewsList 가 각자 칠한다.
  container: { flex: 1, backgroundColor: COLORS.white },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 4,
    paddingBottom: 8,
    backgroundColor: COLORS.white,
  },
  headerTitle: { fontSize: 20, fontFamily: FONTS.bold, color: COLORS.textPrimary },
  searchBtn: {
    width: 34,
    height: 34,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: COLORS.white,
    borderBottomWidth: 0.5,
    borderBottomColor: '#E8E8E8',
  },
  tab: { flex: 1, alignItems: 'center', paddingTop: 10 },
  tabText: { fontSize: 14, color: '#BFBFBF', fontFamily: FONTS.medium, paddingBottom: 10 },
  tabTextActive: { color: COLORS.textPrimary, fontFamily: FONTS.bold },
  tabIndicator: { width: '60%', height: 3, borderRadius: 1.5, backgroundColor: 'transparent' },
  tabIndicatorActive: { backgroundColor: COLORS.primary },

  // 카드 스타일은 components/news/NewsCard.tsx 로, 학과 트리는 components/news/DeptTreeList.tsx 로 옮겼다.

  emptyState: { height: 280, alignItems: 'center', justifyContent: 'center', gap: 12 },
  emptyText: { fontFamily: FONTS.regular, fontSize: 13, color: '#ccc' },

  feedLoading: { height: 280, alignItems: 'center', justifyContent: 'center', gap: 10 },
  feedLoadingText: { fontFamily: FONTS.regular, fontSize: 13, color: '#bbb' },
  feedError: { marginHorizontal: 12, marginTop: 12 },

  listHeaderGroup: { gap: 10 },
  hub: { backgroundColor: COLORS.white, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 12 },
  hubHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  hubLabel: { fontSize: 12, fontFamily: FONTS.bold, color: '#9a9aa5', letterSpacing: 0.3 },
  hubManage: { flexDirection: 'row', alignItems: 'center', gap: 3, paddingVertical: 2, paddingLeft: 8 },
  hubManageText: { fontSize: 12, fontFamily: FONTS.semibold, color: COLORS.primary },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 7, marginTop: 12 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: COLORS.primary,
    paddingLeft: 11,
    paddingRight: 7,
    paddingVertical: 6,
    borderRadius: 15,
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
    borderRadius: 15,
    borderWidth: 1.2,
    borderColor: '#c8c7d6',
    borderStyle: 'dashed',
  },
  chipAddText: { color: COLORS.primary, fontSize: 12, fontFamily: FONTS.semibold },
  cta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: COLORS.primary,
    paddingHorizontal: 22,
    paddingVertical: 12,
    borderRadius: 13,
  },
  ctaText: { color: COLORS.white, fontSize: 14, fontFamily: FONTS.semibold },
})
