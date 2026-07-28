import { useState, useCallback, useMemo } from 'react'
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { Ionicons } from '@expo/vector-icons'
import { COLORS, CATEGORY_COLORS } from '../constants/colors'
import { TREE_DATA, NEWS_DATA, SUBSCRIBABLE_ITEMS } from '../constants/news'
import type { CategoryKey } from '../constants/colors'
import type { NewsItem } from '../types'
import type { RootStackParamList } from '../navigation/RootNavigator'
import { useSettings } from '../contexts/SettingsContext'
import { FONTS } from '../constants/typography'
import SubscriptionManagerModal from '../components/settings/SubscriptionManagerModal'

type TabType = '북마크' | '구독' | '전체'
type NavProp = NativeStackNavigationProp<RootStackParamList>

/** 구독 학과 id → 표시 이름. 구독 칩에 쓴다. */
const DEPT_NAME_BY_ID = new Map(SUBSCRIBABLE_ITEMS.map((item) => [item.id, item.name]))

const TABS: TabType[] = ['북마크', '구독', '전체']

function NewsCard({
  item,
  onPress,
  bookmarked,
  onToggleBookmark,
}: {
  item: NewsItem
  onPress: () => void
  bookmarked: boolean
  onToggleBookmark: () => void
}) {
  const catColor = CATEGORY_COLORS[item.category as CategoryKey]

  return (
    <TouchableOpacity style={styles.card} activeOpacity={0.7} onPress={onPress}>
      <View style={styles.cardTop}>
        <View style={[styles.badge, { backgroundColor: catColor?.bg }]}>
          <Text style={[styles.badgeText, { color: catColor?.text }]}>{item.category}</Text>
        </View>
        <View style={styles.cardTopRight}>
          <Text style={styles.cardDate}>2024.{item.date}</Text>
          <TouchableOpacity
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            onPress={onToggleBookmark}
          >
            <Ionicons
              name={bookmarked ? 'bookmark' : 'bookmark-outline'}
              size={16}
              color={bookmarked ? COLORS.primary : '#ccc'}
            />
          </TouchableOpacity>
        </View>
      </View>
      <Text style={styles.cardTitle} numberOfLines={2}>{item.title}</Text>
      <Text style={styles.cardPreview} numberOfLines={1}>{item.preview}</Text>
      <View style={styles.cardSource}>
        <Ionicons name="business-outline" size={12} color="#ccc" />
        <Text style={styles.cardSourceName}>{item.source}</Text>
      </View>
    </TouchableOpacity>
  )
}

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

function TreeView({
  onSelectDept,
  subscribedDepts,
  onToggleSubscribe,
}: {
  onSelectDept: (id: string, name: string) => void
  subscribedDepts: string[]
  onToggleSubscribe: (id: string) => void
}) {
  const [expanded, setExpanded] = useState<Set<number>>(new Set([0]))

  const toggleNode = useCallback((idx: number) => {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(idx)) next.delete(idx)
      else next.add(idx)
      return next
    })
  }, [])

  return (
    <ScrollView style={styles.treeScroll} contentContainerStyle={styles.treeContent}>
      {TREE_DATA.map((node, idx) => {
        const isLeaf = node.children.length === 0
        const isOpen = expanded.has(idx)

        return (
          <View key={idx} style={styles.treeCard}>
            <TouchableOpacity
              style={styles.treeParent}
              onPress={() => isLeaf ? onSelectDept(node.name, node.name) : toggleNode(idx)}
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
                {node.children.map((child) => (
                  <View key={child.id} style={styles.treeChild}>
                    <Text style={styles.treeChildPrefix}>ㄴ</Text>
                    <TouchableOpacity
                      style={styles.treeChildTap}
                      onPress={() => onSelectDept(child.id, child.name)}
                    >
                      <Text style={styles.treeChildName}>{child.name}</Text>
                      <Ionicons name="chevron-forward" size={12} color="#ddd" />
                    </TouchableOpacity>
                    <SubscribeBell
                      subscribed={subscribedDepts.includes(child.id)}
                      onToggle={() => onToggleSubscribe(child.id)}
                    />
                  </View>
                ))}
              </View>
            )}
          </View>
        )
      })}
    </ScrollView>
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

  return (
    <View style={styles.deptContainer}>
      <View style={styles.deptHeader}>
        <TouchableOpacity style={styles.deptBackBtn} onPress={onBack}>
          <Ionicons name="arrow-back" size={17} color="#444" />
        </TouchableOpacity>
        <Text style={styles.deptTitle} numberOfLines={1}>{deptName}</Text>
      </View>
      <ScrollView style={styles.list} contentContainerStyle={styles.listContent}>
        {items.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="file-tray-outline" size={40} color="#ddd" />
            <Text style={styles.emptyText}>등록된 소식이 없습니다</Text>
          </View>
        ) : (
          items.map((item) => (
            <NewsCard
              key={item.id}
              item={item}
              bookmarked={isBookmarked(item.id)}
              onToggleBookmark={() => toggleBookmark(item.id)}
              onPress={() => navigation.navigate('NewsDetail', { item })}
            />
          ))
        )}
      </ScrollView>
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
        <ScrollView style={styles.list} contentContainerStyle={styles.listContent}>
          {activeTab === '구독' && settings.subscribedDepts.length > 0 && (
            <View style={styles.hub}>
              <View style={styles.hubHead}>
                <Text style={styles.hubLabel}>내 구독 학과 {settings.subscribedDepts.length}</Text>
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
                  <TouchableOpacity style={styles.chipAdd} onPress={() => setSubManagerOpen(true)}>
                    <Ionicons name="add" size={13} color={COLORS.primary} />
                    <Text style={styles.chipAddText}>학과 추가</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          )}

          {displayedNews.length === 0 ? (
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
          ) : (
            displayedNews.map((item) => (
              <NewsCard
                key={`${activeTab}-${item.id}`}
                item={item}
                bookmarked={isBookmarked(item.id)}
                onToggleBookmark={() => toggleBookmark(item.id)}
                onPress={() => navigation.navigate('NewsDetail', { item })}
              />
            ))
          )}
        </ScrollView>
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

  list: { flex: 1 },
  listContent: { padding: 12, gap: 8 },
  card: { backgroundColor: COLORS.white, borderRadius: 14, padding: 14 },
  cardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  badgeText: { fontSize: 10, fontFamily: FONTS.semibold },
  cardTopRight: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  cardDate: { fontFamily: FONTS.regular, fontSize: 11, color: '#ccc' },
  cardTitle: { fontSize: 14, fontFamily: FONTS.semibold, color: COLORS.textPrimary, lineHeight: 20, marginBottom: 4 },
  cardPreview: { fontFamily: FONTS.regular, fontSize: 12, color: COLORS.textSecondary, lineHeight: 17, marginBottom: 10 },
  cardSource: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingTop: 10,
    borderTopWidth: 0.5,
    borderTopColor: '#f2f2f2',
  },
  cardSourceName: { fontSize: 11, color: '#aaa', fontFamily: FONTS.medium },

  treeScroll: { flex: 1 },
  treeContent: { padding: 10, gap: 6 },
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
