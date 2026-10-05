import { useCallback, useEffect, useMemo, useRef, useState, type ComponentProps } from 'react'
import { Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useFocusEffect, useIsFocused } from '@react-navigation/native'
import { Ionicons } from '@expo/vector-icons'
import { COLORS } from '../constants/colors'
import { FONTS } from '../constants/typography'
import { layoutStyles } from '../constants/layout'
import { RADIUS, SCREEN_GUTTER, SPACING } from '../constants/spacing'
import { LargeTitleHeader } from '../components/common/ScreenHeader'
import { useAdminOverview } from './AdminAccess'
import { consumeAdminIntent, subscribeAdminIntent, type AdminIntent } from '../lib/adminIntents'
import { getMockMode } from './api'
import type { AdminSection } from './types'
import { ADMIN_COLORS, AdminHostProvider, AdminScrollProvider, type AdminScrollHandle } from './ui'
import DashboardScreen from './screens/DashboardScreen'
import ReportsScreen from './screens/ReportsScreen'
import FeedbackScreen from './screens/FeedbackScreen'
import UsersScreen from './screens/UsersScreen'
import ToolsScreen from './screens/ToolsScreen'

/**
 * 앱 하단 "관리" 탭. 웹 `/admin` 콘솔의 화면들을 그대로 쓰되, 앱 로그인 토큰으로 요청하고(AdminAccessProvider)
 * 폰 너비에 맞춰 그린다(`AdminHostProvider value="app"` → 44pt 버튼·확인 창·가로 필터).
 * 탭 자체는 관리자일 때만 TabNavigator 에 붙는다.
 */

const SECTIONS: { section: AdminSection; label: string; icon: ComponentProps<typeof Ionicons>['name'] }[] = [
  { section: 'dashboard', label: '대시보드', icon: 'speedometer-outline' },
  { section: 'reports', label: '제보 검토', icon: 'flag-outline' },
  { section: 'feedback', label: '문의', icon: 'chatbox-ellipses-outline' },
  { section: 'users', label: '회원', icon: 'people-outline' },
  { section: 'tools', label: '운영 도구', icon: 'construct-outline' },
]

/** 웹 관리 탭에서 마지막으로 본 섹션. 이 탭(sessionStorage)에만 두어 탭을 닫으면 지워진다. 네이티브는 쓰지 않는다. */
const SECTION_STORAGE_KEY = 'hongikon_manage_section'

function readSavedSection(): AdminSection {
  if (Platform.OS !== 'web') return 'dashboard'
  try {
    const saved = window.sessionStorage.getItem(SECTION_STORAGE_KEY)
    return SECTIONS.some((item) => item.section === saved) ? (saved as AdminSection) : 'dashboard'
  } catch {
    return 'dashboard'
  }
}

function saveSection(section: AdminSection): void {
  if (Platform.OS !== 'web') return
  try {
    window.sessionStorage.setItem(SECTION_STORAGE_KEY, section)
  } catch {
    // 저장하지 못하면 새로고침 때 대시보드부터 연다.
  }
}

export default function AdminTabScreen() {
  const overview = useAdminOverview()
  const { refresh } = overview
  const [section, setSection] = useState<AdminSection>(readSavedSection)
  // 웹: 새로고침해도 보던 섹션으로 다시 연다(`/manage` 주소는 섹션까지 담지 않는다).
  useEffect(() => saveSection(section), [section])
  const scrollRef = useRef<ScrollView>(null)
  /**
   * 관리자 알림을 눌러 들어왔을 때 연 섹션의 필터·강조할 항목. key 가 바뀌면 그 섹션 화면을 새로 그려 필터를 다시 적용한다.
   * 사용자가 섹션을 직접 바꾸면 지운다.
   */
  const [focus, setFocus] = useState<{ intent: AdminIntent; key: number } | null>(null)

  /** 관리자 알림(`adminIntents`)으로 넘어온 요청이 있으면 그 섹션을 연다. */
  const applyIntent = useCallback(() => {
    const intent = consumeAdminIntent()
    if (!intent || intent.section === 'open') return
    setFocus({ intent, key: Date.now() })
    setSection(intent.section)
    scrollRef.current?.scrollTo({ y: 0, animated: false })
  }, [])
  const scrollYRef = useRef(0)
  const scrollHandle = useMemo<AdminScrollHandle>(
    () => ({
      scrollBy: (dy) => scrollRef.current?.scrollTo({ y: Math.max(0, scrollYRef.current + dy), animated: true }),
    }),
    [],
  )

  // 탭에 들어올 때마다 다시 묻는다 — 권한이 회수됐으면 403 으로 탭이 닫히고, 배지 수도 맞춘다.
  useFocusEffect(
    useCallback(() => {
      refresh()
      applyIntent()
    }, [refresh, applyIntent]),
  )

  // 관리 탭을 보고 있는 중에 관리자 알림을 누른 경우(포커스가 바뀌지 않는다).
  const isFocused = useIsFocused()
  const isFocusedRef = useRef(isFocused)
  isFocusedRef.current = isFocused
  useEffect(
    () =>
      subscribeAdminIntent(() => {
        if (isFocusedRef.current) applyIntent()
      }),
    [applyIntent],
  )

  const navigate = useCallback((next: AdminSection) => {
    setFocus(null)
    setSection(next)
    scrollRef.current?.scrollTo({ y: 0, animated: false })
  }, [])

  const data = overview.data
  const badgeFor = (item: AdminSection): number => {
    if (!data) return 0
    if (item === 'reports') return data.reports.pending
    if (item === 'feedback') return data.feedback.open
    return 0
  }

  const reportFocus = focus?.intent.section === 'reports' ? focus.intent : null
  const feedbackFocus = focus?.intent.section === 'feedback' ? focus.intent : null
  const usersFocus = focus?.intent.section === 'users' ? focus.intent : null

  let content
  if (section === 'reports')
    content = (
      <ReportsScreen
        key={reportFocus ? focus?.key : 'reports'}
        onChanged={refresh}
        overview={data}
        initialFilter={reportFocus?.reportFilter}
        focusReportId={reportFocus?.reportId ?? null}
      />
    )
  else if (section === 'users')
    content = (
      <UsersScreen
        key={usersFocus ? focus?.key : 'users'}
        initialQuery={usersFocus?.userId != null ? String(usersFocus.userId) : ''}
      />
    )
  else if (section === 'feedback')
    content = (
      <FeedbackScreen
        key={feedbackFocus ? focus?.key : 'feedback'}
        onChanged={refresh}
        overview={data}
        focusFeedbackId={feedbackFocus?.feedbackId ?? null}
      />
    )
  else if (section === 'tools') content = <ToolsScreen onChanged={refresh} />
  else content = <DashboardScreen overview={overview} onNavigate={navigate} />

  const mock = getMockMode()

  return (
    <AdminHostProvider value="app">
      <SafeAreaView style={styles.root} edges={['top']}>
        <LargeTitleHeader
          title="관리"
          style={layoutStyles.readable}
          right={
            mock ? (
              <View style={styles.mockBadge}>
                <Text style={styles.mockBadgeText}>목업 데이터</Text>
              </View>
            ) : undefined
          }
        />
        <View style={styles.navBar}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.nav}
            accessibilityRole="tablist"
          >
            {SECTIONS.map((item) => {
              const selected = item.section === section
              const badge = badgeFor(item.section)
              return (
                <Pressable
                  key={item.section}
                  onPress={() => navigate(item.section)}
                  accessibilityRole="tab"
                  accessibilityState={{ selected }}
                  accessibilityLabel={badge > 0 ? `${item.label}, ${badge}건` : item.label}
                  style={({ pressed }) => [styles.navItem, selected && styles.navItemSelected, pressed && styles.pressed]}
                >
                  <Ionicons name={item.icon} size={16} color={selected ? COLORS.white : COLORS.textSecondary} />
                  <Text style={[styles.navText, selected && styles.navTextSelected]}>{item.label}</Text>
                  {badge > 0 ? (
                    <View style={[styles.navBadge, selected && styles.navBadgeSelected]}>
                      <Text style={[styles.navBadgeText, selected && styles.navBadgeTextSelected]}>
                        {badge > 99 ? '99+' : badge}
                      </Text>
                    </View>
                  ) : null}
                </Pressable>
              )
            })}
          </ScrollView>
        </View>
        <ScrollView
          ref={scrollRef}
          style={styles.scroll}
          contentContainerStyle={[styles.content, layoutStyles.readable]}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
          // iOS: 키보드가 올라오면 그만큼 아래 여백을 넣는다. 이것만으로는 입력칸 윗부분만 보이고 확인 버튼이 가려져서,
          // ConfirmBar 가 AdminScrollProvider 로 자기 전체(입력칸 + 버튼)를 키보드 위로 올린다(ui.tsx).
          automaticallyAdjustKeyboardInsets
          onScroll={(event) => {
            scrollYRef.current = event.nativeEvent.contentOffset.y
          }}
          scrollEventThrottle={16}
        >
          <AdminScrollProvider value={scrollHandle}>{content}</AdminScrollProvider>
        </ScrollView>
      </SafeAreaView>
    </AdminHostProvider>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.white },
  navBar: {
    backgroundColor: COLORS.white,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: COLORS.border,
  },
  nav: { gap: SPACING.sm, paddingHorizontal: SCREEN_GUTTER, paddingBottom: SPACING.md },
  navItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    minHeight: 44,
    paddingHorizontal: 14,
    borderRadius: RADIUS.pill,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.white,
  },
  navItemSelected: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  pressed: { opacity: 0.75 },
  navText: { fontFamily: FONTS.medium, fontSize: 14, color: COLORS.textPrimary },
  navTextSelected: { fontFamily: FONTS.semibold, color: COLORS.white },
  navBadge: { minWidth: 20, paddingHorizontal: 6, borderRadius: 10, backgroundColor: COLORS.danger, alignItems: 'center' },
  navBadgeSelected: { backgroundColor: COLORS.white },
  navBadgeText: { fontFamily: FONTS.bold, fontSize: 11, lineHeight: 20, color: COLORS.white },
  navBadgeTextSelected: { color: COLORS.primary },
  scroll: { flex: 1, backgroundColor: ADMIN_COLORS.pageBg },
  content: { padding: SCREEN_GUTTER, paddingBottom: SPACING.xxxl },
  mockBadge: {
    marginRight: SPACING.sm,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    backgroundColor: ADMIN_COLORS.warningBg,
  },
  mockBadgeText: { fontFamily: FONTS.semibold, fontSize: 11, color: ADMIN_COLORS.warning },
})
