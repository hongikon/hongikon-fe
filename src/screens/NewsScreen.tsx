import { useState, useCallback, useMemo } from 'react'
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { Ionicons } from '@expo/vector-icons'
import { COLORS } from '../constants/colors'
import { TREE_DATA, NEWS_DATA, SUBSCRIBABLE_ITEMS } from '../constants/news'
import type { CategoryKey } from '../constants/colors'
import type { NewsItem, TreeChild } from '../types'
import type { RootStackParamList } from '../navigation/RootNavigator'
import { useSettings } from '../contexts/SettingsContext'
import { FONTS } from '../constants/typography'
import NewsList from '../components/news/NewsList'
import { useTreeSearch } from '../hooks/useTreeSearch'
import SubscriptionManagerModal from '../components/settings/SubscriptionManagerModal'

type TabType = '북마크' | '구독' | '전체'
type NavProp = NativeStackNavigationProp<RootStackParamList>

/** 구독 학과 id → 표시 이름. 구독 칩에 쓴다. */
const DEPT_NAME_BY_ID = new Map(SUBSCRIBABLE_ITEMS.map((item) => [item.id, item.name]))

const TABS: TabType[] = ['북마크', '구독', '전체']

/** 학과 옆 구독 벨. 행 탭(소식 보기)과 분리해 벨만 구독을 토글한다. */
function SubscribeBell({
  subscribed,
  onToggle,
}: {
  subscribed: boolean
  onToggle: () => void
}) {
  return (
    <TouchableOpacity
      style={[styles.bell, subscribed && styles.bellOn]}
      onPress={onToggle}
      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      accessibilityRole="button"
      accessibilityLabel={subscribed ? '구독 해제' : '구독'}
    >
      <Ionicons
        name={subscribed ? 'notifications' : 'notifications-outline'}
        size={15}
        color={subscribed ? COLORS.white : '#c0c0c0'}
      />
    </TouchableOpacity>
  )
}

/** 구독 단위 한 줄. 이름을 누르면 소식 목록, 벨을 누르면 구독 토글. */
function TreeLeafRow({
  child,
  indented,
  onSelectDept,
  subscribed,
  onToggleSubscribe,
}: {
  child: TreeChild
  indented?: boolean
  onSelectDept: (id: string, name: string) => void
  subscribed: boolean
  onToggleSubscribe: () => void
}) {
  return (
    <View style={[styles.treeChild, indented && styles.treeGrandChild]}>
      <Text style={styles.treeChildPrefix}>ㄴ</Text>
      <TouchableOpacity
        style={styles.treeChildTap}
        onPress={() => onSelectDept(child.id, child.name)}
      >
        <Text style={styles.treeChildName}>{child.name}</Text>
        <Ionicons name="chevron-forward" size={12} color="#ddd" />
      </TouchableOpacity>
      <SubscribeBell subscribed={subscribed} onToggle={onToggleSubscribe} />
    </View>
  )
}

/**
 * 전공이 나뉜 학부처럼 한 단계 더 들어가는 묶음.
 * 이 줄 자체는 구독 단위가 아니라서 벨 대신 펼치기 화살표만 둔다.
 */
function TreeSubGroup({
  group,
  forceOpen,
  onSelectDept,
  subscribedDepts,
  onToggleSubscribe,
}: {
  group: TreeChild
  /** 검색 중에는 결과가 접혀 있으면 안 되므로 강제로 펼친다. */
  forceOpen?: boolean
  onSelectDept: (id: string, name: string) => void
  subscribedDepts: string[]
  onToggleSubscribe: (id: string) => void
}) {
  const [open, setOpen] = useState(false)
  const isOpen = forceOpen || open

  return (
    <View>
      <TouchableOpacity
        style={styles.treeChild}
        onPress={() => setOpen((prev) => !prev)}
        accessibilityRole="button"
        accessibilityState={{ expanded: isOpen }}
      >
        <Text style={styles.treeChildPrefix}>ㄴ</Text>
        <Text style={styles.treeSubGroupName}>{group.name}</Text>
        <Ionicons name={isOpen ? 'chevron-up' : 'chevron-down'} size={13} color="#bbb" />
      </TouchableOpacity>

      {isOpen &&
        group.children?.map((child) => (
          <TreeLeafRow
            key={child.id}
            child={child}
            indented
            onSelectDept={onSelectDept}
            subscribed={subscribedDepts.includes(child.id)}
            onToggleSubscribe={() => onToggleSubscribe(child.id)}
          />
        ))}
    </View>
  )
}

function TreeView({
  onSelectDept,
  subscribedDepts,
  onToggleSubscribe,
}: {
  onSelectDept: (id: string, name: string) => void
  subscribedDepts: string[]
  onToggleSubscribe: (id: string) => void
}) {
  const { query, setQuery, results, isSearching } = useTreeSearch(TREE_DATA)
  // 펼침 상태는 이름으로 기억한다. 검색으로 목록이 걸러지면 순서가 밀려서
  // 인덱스로 기억하면 엉뚱한 단과대가 펼쳐진다.
  // 처음에는 전부 접어 둔다. 단과대가 많아 하나가 펼쳐져 있으면 나머지가 아래로 밀린다.
  const [expanded, setExpanded] = useState<Set<string>>(new Set())

  const toggleNode = useCallback((name: string) => {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(name)) next.delete(name)
      else next.add(name)
      return next
    })
  }, [])

  return (
    <View style={styles.treeScroll}>
      <View style={styles.searchBar}>
        <Ionicons name="search" size={16} color={COLORS.textTertiary} />
        <TextInput
          style={styles.searchInput}
          placeholder="학과·기관 검색"
          placeholderTextColor={COLORS.textPlaceholder}
          value={query}
          onChangeText={setQuery}
          autoCorrect={false}
          returnKeyType="search"
          accessibilityLabel="학과 검색"
        />
        {query.length > 0 && (
          <TouchableOpacity
            onPress={() => setQuery('')}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            accessibilityRole="button"
            accessibilityLabel="검색어 지우기"
          >
            <Ionicons name="close-circle" size={16} color={COLORS.textTertiary} />
          </TouchableOpacity>
        )}
      </View>

      {results.length === 0 ? (
        <View style={styles.emptyState}>
          <Ionicons name="search-outline" size={40} color="#ddd" />
          <Text style={styles.emptyText}>'{query.trim()}' 검색 결과가 없습니다</Text>
        </View>
      ) : (
        <ScrollView
          style={styles.treeScroll}
          contentContainerStyle={styles.treeContent}
          keyboardShouldPersistTaps="handled"
        >
          {results.map((node) => {
            const isLeaf = node.children.length === 0
            // 검색 중에는 걸린 결과가 바로 보이도록 모두 펼친다.
            const isOpen = isSearching || expanded.has(node.name)

            return (
              <View key={node.name} style={styles.treeCard}>
                <TouchableOpacity
                  style={styles.treeParent}
                  onPress={() =>
                    isLeaf ? onSelectDept(node.name, node.name) : toggleNode(node.name)
                  }
                >
                  <Text style={styles.treeParentName}>{node.name}</Text>
                  {isLeaf ? (
                    <SubscribeBell
                      subscribed={subscribedDepts.includes(node.name)}
                      onToggle={() => onToggleSubscribe(node.name)}
                    />
                  ) : (
                    <Ionicons
                      name={isOpen ? 'chevron-up' : 'chevron-down'}
                      size={15}
                      color="#bbb"
                    />
                  )}
                </TouchableOpacity>

                {!isLeaf && isOpen && (
                  <View style={styles.treeChildren}>
                    {node.children.map((child) =>
                      child.children?.length ? (
                        <TreeSubGroup
                          key={child.id}
                          group={child}
                          forceOpen={isSearching}
                          onSelectDept={onSelectDept}
                          subscribedDepts={subscribedDepts}
                          onToggleSubscribe={onToggleSubscribe}
                        />
                      ) : (
                        <TreeLeafRow
                          key={child.id}
                          child={child}
                          onSelectDept={onSelectDept}
                          subscribed={subscribedDepts.includes(child.id)}
                          onToggleSubscribe={() => onToggleSubscribe(child.id)}
                        />
                      )
                    )}
                  </View>
                )}
              </View>
            )
          })}
        </ScrollView>
      )}
    </View>
  )
}

function DeptNewsList({
  deptId,
  deptName,
  onBack,
}: {
  deptId: string
  deptName: string
  onBack: () => void
}) {
  const navigation = useNavigation<NavProp>()
  const { isBookmarked, toggleBookmark } = useSettings()
  const items = useMemo(
    () => NEWS_DATA.filter((n) => n.sourceId === deptId),
    [deptId]
  )

  const handlePressItem = useCallback(
    (item: NewsItem) => navigation.navigate('NewsDetail', { item }),
    [navigation],
  )

  return (
    <View style={styles.deptContainer}>
      <View style={styles.deptHeader}>
        <TouchableOpacity style={styles.deptBackBtn} onPress={onBack}>
          <Ionicons name="arrow-back" size={17} color="#444" />
        </TouchableOpacity>
        <Text style={styles.deptTitle} numberOfLines={1}>{deptName}</Text>
      </View>
      <NewsList
        items={items}
        isBookmarked={isBookmarked}
        onPressItem={handlePressItem}
        onToggleBookmark={toggleBookmark}
        empty={
          <View style={styles.emptyState}>
            <Ionicons name="file-tray-outline" size={40} color="#ddd" />
            <Text style={styles.emptyText}>등록된 소식이 없습니다</Text>
          </View>
        }
      />
    </View>
  )
}

export default function NewsScreen() {
  const navigation = useNavigation<NavProp>()
  const { settings, isBookmarked, toggleBookmark, toggleSubscribedDept } = useSettings()
  const [activeTab, setActiveTab] = useState<TabType>('북마크')
  const [selectedDept, setSelectedDept] = useState<{ id: string; name: string } | null>(null)
  const [subManagerOpen, setSubManagerOpen] = useState(false)
  const [manageChipsOpen, setManageChipsOpen] = useState(false)

  const bookmarkedNews = useMemo(
    () => NEWS_DATA.filter((n) => settings.bookmarkedNews.includes(n.id)),
    [settings.bookmarkedNews]
  )
  const subscribedNews = useMemo(
    () =>
      NEWS_DATA.filter(
        (n) =>
          settings.subscribedDepts.includes(n.sourceId) &&
          settings.subscribedCategories.includes(n.category as CategoryKey)
      ),
    [settings.subscribedDepts, settings.subscribedCategories]
  )

  const displayedNews = activeTab === '북마크' ? bookmarkedNews : subscribedNews
  const emptyMessage =
    activeTab === '북마크'
      ? '북마크한 소식이 없습니다'
      : '구독한 기관·학과의 소식이 없습니다'

  // NewsList 로 넘기는 콜백은 렌더마다 새로 만들면 안 된다.
  // 새로 만들면 목록의 모든 카드가 memo 를 통과해 다시 그려진다.
  const handlePressItem = useCallback(
    (item: NewsItem) => navigation.navigate('NewsDetail', { item }),
    [navigation],
  )

  const handleSelectDept = useCallback((id: string, name: string) => {
    setSelectedDept({ id, name })
  }, [])

  const handleBackFromDept = useCallback(() => {
    setSelectedDept(null)
  }, [])

  if (activeTab === '전체' && selectedDept) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>소식</Text>
        </View>
        <View style={styles.tabBar}>
          {TABS.map((tab) => {
            const isActive = activeTab === tab
            return (
              <TouchableOpacity
                key={tab}
                style={styles.tab}
                onPress={() => { setActiveTab(tab); setSelectedDept(null) }}
              >
                <Text style={[styles.tabText, isActive && styles.tabTextActive]}>{tab}</Text>
                <View style={[styles.tabIndicator, isActive && styles.tabIndicatorActive]} />
              </TouchableOpacity>
            )
          })}
        </View>
        <DeptNewsList
          deptId={selectedDept.id}
          deptName={selectedDept.name}
          onBack={handleBackFromDept}
        />
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>소식</Text>
      </View>

      <View style={styles.tabBar}>
        {TABS.map((tab) => {
          const isActive = activeTab === tab
          return (
            <TouchableOpacity
              key={tab}
              style={styles.tab}
              onPress={() => { setActiveTab(tab); setSelectedDept(null) }}
            >
              <Text style={[styles.tabText, isActive && styles.tabTextActive]}>{tab}</Text>
              <View style={[styles.tabIndicator, isActive && styles.tabIndicatorActive]} />
            </TouchableOpacity>
          )
        })}
      </View>

      {activeTab === '전체' ? (
        <TreeView
          onSelectDept={handleSelectDept}
          subscribedDepts={settings.subscribedDepts}
          onToggleSubscribe={toggleSubscribedDept}
        />
      ) : (
        <NewsList
          items={displayedNews}
          isBookmarked={isBookmarked}
          onPressItem={handlePressItem}
          onToggleBookmark={toggleBookmark}
          header={
            activeTab === '구독' && settings.subscribedDepts.length > 0 ? (
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
            ) : null
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
  container: { flex: 1, backgroundColor: COLORS.background },
  header: {
    paddingHorizontal: 16,
    paddingTop: 4,
    paddingBottom: 8,
    backgroundColor: COLORS.white,
  },
  headerTitle: { fontSize: 20, fontFamily: FONTS.bold, color: COLORS.textPrimary },
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

  // 카드 스타일은 components/news/NewsCard.tsx 로 함께 옮겼다.

  treeScroll: { flex: 1 },
  treeContent: { padding: 10, gap: 6 },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginHorizontal: 10,
    marginTop: 10,
    paddingHorizontal: 12,
    height: 40,
    borderRadius: 12,
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  searchInput: {
    flex: 1,
    fontFamily: FONTS.regular,
    fontSize: 13,
    color: COLORS.textPrimary,
    padding: 0,
  },
  treeCard: { backgroundColor: COLORS.white, borderRadius: 12, overflow: 'hidden' },
  treeParent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 13,
  },
  treeParentName: { fontSize: 14, fontFamily: FONTS.semibold, color: COLORS.textPrimary },
  treeChildren: { borderTopWidth: 0.5, borderTopColor: '#f2f2f2' },
  treeChild: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderTopWidth: 0.5,
    borderTopColor: '#f8f8f8',
    gap: 7,
  },
  // 학부 아래 전공 줄. 한 단계 더 들어갔다는 걸 들여쓰기와 배경으로 보여준다.
  treeGrandChild: { paddingLeft: 30, backgroundColor: '#fbfbfd' },
  treeSubGroupName: { flex: 1, fontFamily: FONTS.medium, fontSize: 13, color: '#444' },
  treeChildTap: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 7 },
  treeChildPrefix: { fontFamily: FONTS.regular, fontSize: 12, color: '#c8c8c8', width: 14 },
  treeChildName: { fontFamily: FONTS.regular, fontSize: 13, color: '#444', flex: 1 },
  bell: {
    width: 30,
    height: 30,
    borderRadius: 9,
    borderWidth: 1.2,
    borderColor: '#e2e2e2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bellOn: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },

  deptContainer: { flex: 1 },
  deptHeader: {
    height: 48,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    backgroundColor: COLORS.white,
    borderBottomWidth: 0.5,
    borderBottomColor: '#ebebeb',
    gap: 8,
  },
  deptBackBtn: {
    width: 34,
    height: 34,
    borderRadius: 9,
    backgroundColor: '#f4f4f4',
    alignItems: 'center',
    justifyContent: 'center',
  },
  deptTitle: { fontSize: 14, fontFamily: FONTS.medium, color: COLORS.textPrimary, flex: 1 },

  emptyState: { height: 280, alignItems: 'center', justifyContent: 'center', gap: 12 },
  emptyText: { fontFamily: FONTS.regular, fontSize: 13, color: '#ccc' },

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
