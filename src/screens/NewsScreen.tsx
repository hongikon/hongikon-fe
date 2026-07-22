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
import { TREE_DATA, NEWS_DATA } from '../constants/news'
import type { CategoryKey } from '../constants/colors'
import type { NewsItem } from '../types'
import type { RootStackParamList } from '../navigation/RootNavigator'
import { useSettings } from '../contexts/SettingsContext'
import { FONTS } from '../constants/typography'

type TabType = '북마크' | '구독' | '전체'
type NavProp = NativeStackNavigationProp<RootStackParamList>

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

function TreeView({ onSelectDept }: { onSelectDept: (id: string, name: string) => void }) {
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
              <Ionicons
                name={isLeaf ? 'chevron-forward' : isOpen ? 'chevron-up' : 'chevron-down'}
                size={15}
                color="#bbb"
              />
            </TouchableOpacity>

            {!isLeaf && isOpen && (
              <View style={styles.treeChildren}>
                {node.children.map((child) => (
                  <TouchableOpacity
                    key={child.id}
                    style={styles.treeChild}
                    onPress={() => onSelectDept(child.id, child.name)}
                  >
                    <Text style={styles.treeChildPrefix}>ㄴ</Text>
                    <Text style={styles.treeChildName}>{child.name}</Text>
                    <Ionicons name="chevron-forward" size={12} color="#ddd" />
                  </TouchableOpacity>
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
  const { settings, isBookmarked, toggleBookmark } = useSettings()
  const [activeTab, setActiveTab] = useState<TabType>('북마크')
  const [selectedDept, setSelectedDept] = useState<{ id: string; name: string } | null>(null)

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
        <TreeView onSelectDept={handleSelectDept} />
      ) : (
        <ScrollView style={styles.list} contentContainerStyle={styles.listContent}>
          {displayedNews.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons
                name={activeTab === '북마크' ? 'bookmark-outline' : 'file-tray-outline'}
                size={40}
                color="#ddd"
              />
              <Text style={styles.emptyText}>{emptyMessage}</Text>
              {activeTab === '구독' && (
                <Text style={styles.emptyHint}>설정 → 구독 관리에서 기관·학과를 추가하세요</Text>
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
    paddingVertical: 11,
    borderTopWidth: 0.5,
    borderTopColor: '#f8f8f8',
    gap: 7,
  },
  treeChildPrefix: { fontFamily: FONTS.regular, fontSize: 12, color: '#c8c8c8', width: 14 },
  treeChildName: { fontFamily: FONTS.regular, fontSize: 13, color: '#444', flex: 1 },

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

  emptyState: { height: 280, alignItems: 'center', justifyContent: 'center', gap: 10 },
  emptyText: { fontFamily: FONTS.regular, fontSize: 13, color: '#ccc' },
  emptyHint: { fontFamily: FONTS.regular, fontSize: 12, color: '#d5d5d5', marginTop: -4 },
})
