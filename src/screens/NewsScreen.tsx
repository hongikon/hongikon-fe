import { View, StyleSheet } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { COLORS } from '../constants/colors'
import { TREE_DATA } from '../constants/news'
import { type NewsTab } from '../utils/news/feed'
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
import { useNewsScreen } from '../hooks/news/useNewsScreen'

const TABS: NewsTab[] = ['북마크', '구독', '전체']

export default function NewsScreen() {
  const { navigation, settings, isBookmarked, toggleBookmark, toggleSubscribedDept, activeTab, setActiveTab, subManagerOpen, setSubManagerOpen, listRef, treeRef, manageChipsOpen, activeFeed, selectedSource, selectSource, refreshSubscribed, isBookmarkTab, displayedNews, feedState, emptyMessage, handlePressItem, toggleManageChips, openSubManager, handleSelectDept } = useNewsScreen()

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
