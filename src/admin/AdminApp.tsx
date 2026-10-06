import { useCallback, useEffect, useRef, useState, type ComponentProps } from 'react'
import { Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { getErrorMessage, isCancelledError, isNetworkError, ApiError } from '../apis/client'
import { COLORS } from '../constants/colors'
import { FONTS } from '../constants/typography'
import { completeLogin, fetchOverview, logout, setMockMode, subscribeAdminAuth } from './api'
import { clearMockMode, getTokens, resolveMockMode, type MockMode } from './session'
import type { AdminOverview, AdminSection, OverviewState } from './types'
import { ADMIN_COLORS, Loading } from './ui'
import LoginScreen from './screens/LoginScreen'
import ForbiddenScreen from './screens/ForbiddenScreen'
import DashboardScreen from './screens/DashboardScreen'
import ReportsScreen from './screens/ReportsScreen'
import FlaggedCommentsScreen from './screens/FlaggedCommentsScreen'
import FeedbackScreen from './screens/FeedbackScreen'
import UsersScreen from './screens/UsersScreen'
import ToolsScreen from './screens/ToolsScreen'

/**
 * 웹 관리자 콘솔(`/admin`). App.tsx 가 경로를 보고 앱의 AuthProvider/내비게이션을
 * 통째로 건너뛰어 이 컴포넌트만 그린다. 로그인·토큰도 앱과 따로 관리한다(`session.ts`).
 *
 * 화면 전환은 react-navigation 대신 history API 로 한다 — 섹션 4개뿐이고,
 * 주소창 경로(`/admin/reports` 등)와 뒤로 가기가 그대로 맞아야 해서다.
 */

type Phase =
  /** 목업 여부·저장된 토큰·?code= 를 확인하는 중 */
  | 'booting'
  /** 카카오 로그인에서 돌아와 1회용 코드를 토큰으로 바꾸는 중 */
  | 'exchanging'
  | 'signedOut'
  /** 로그인은 됐지만 ADMIN 이 아니다(403) */
  | 'forbidden'
  | 'ready'

const SECTION_PATHS: Record<AdminSection, string> = {
  dashboard: '/admin',
  reports: '/admin/reports',
  comments: '/admin/comments',
  users: '/admin/users',
  feedback: '/admin/feedback',
  tools: '/admin/tools',
}

const NAV_ITEMS: { section: AdminSection; label: string; icon: ComponentProps<typeof Ionicons>['name'] }[] = [
  { section: 'dashboard', label: '대시보드', icon: 'speedometer-outline' },
  { section: 'reports', label: '제보 검토', icon: 'flag-outline' },
  { section: 'comments', label: '신고 댓글', icon: 'chatbubbles-outline' },
  { section: 'users', label: '회원', icon: 'people-outline' },
  { section: 'feedback', label: '문의', icon: 'chatbox-ellipses-outline' },
  { section: 'tools', label: '운영 도구', icon: 'construct-outline' },
]

/** 이 너비부터 왼쪽 사이드바, 그보다 좁으면 위쪽 가로 메뉴. */
const WIDE_BREAKPOINT = 860

function sectionFromPath(pathname: string): AdminSection {
  const path = pathname.replace(/\/+$/, '')
  const match = (Object.keys(SECTION_PATHS) as AdminSection[]).find((key) => SECTION_PATHS[key] === path)
  return match ?? 'dashboard'
}

/** 검색엔진에 잡히지 않게 하고 탭 제목을 바꾼다. 관리자 화면을 떠나면(전체 새로고침) 원래대로 돌아간다. */
function useAdminDocumentHead() {
  useEffect(() => {
    if (typeof document === 'undefined') return
    document.title = '홍익온 관리자'
    let meta = document.querySelector<HTMLMetaElement>('meta[name="robots"]')
    if (!meta) {
      meta = document.createElement('meta')
      meta.name = 'robots'
      document.head.appendChild(meta)
    }
    meta.content = 'noindex, nofollow'
  }, [])
}

/** 로그인 코드는 1회용이라, 새로고침·방문 기록에 남지 않게 주소에서 바로 지운다. */
function takeAuthCodeFromUrl(): string | null {
  const url = new URL(window.location.href)
  const code = url.searchParams.get('code')
  if (!code) return null
  url.searchParams.delete('code')
  url.searchParams.delete('state')
  window.history.replaceState(window.history.state, '', `${url.pathname}${url.search}${url.hash}`)
  return code
}

function exchangeErrorMessage(error: unknown): string {
  if (isNetworkError(error)) return '네트워크 연결이 불안정해 로그인을 마치지 못했습니다. 다시 로그인해주세요.'
  if (error instanceof ApiError && error.status >= 400 && error.status < 500) {
    return '로그인 정보가 만료되었거나 올바르지 않습니다. 다시 로그인해주세요.'
  }
  return getErrorMessage(error, '로그인 처리 중 문제가 생겼습니다. 다시 로그인해주세요.')
}

export type { OverviewState } from './types'

export default function AdminApp() {
  useAdminDocumentHead()
  const { width } = useWindowDimensions()
  const wide = width >= WIDE_BREAKPOINT

  const [phase, setPhase] = useState<Phase>('booting')
  const [mockMode, setMockModeState] = useState<MockMode | null>(null)
  const [loginMessage, setLoginMessage] = useState<string | null>(null)
  const [section, setSection] = useState<AdminSection>(() => sectionFromPath(window.location.pathname))

  // ── 시작: 목업 / ?code= / 저장된 토큰 ──
  useEffect(() => {
    const mode = resolveMockMode()
    setMockMode(mode)
    setMockModeState(mode)
    if (mode) {
      setPhase('ready')
      return
    }
    const code = takeAuthCodeFromUrl()
    if (!code) {
      setPhase(getTokens() ? 'ready' : 'signedOut')
      return
    }
    let cancelled = false
    setPhase('exchanging')
    completeLogin(code)
      .then(() => {
        if (!cancelled) setPhase('ready')
      })
      .catch((error: unknown) => {
        if (cancelled) return
        setLoginMessage(exchangeErrorMessage(error))
        setPhase('signedOut')
      })
    return () => {
      cancelled = true
    }
  }, [])

  // ── 401(재발급 실패) / 403 은 어느 화면에서 나든 여기서 받는다 ──
  useEffect(
    () =>
      subscribeAdminAuth((event) => {
        if (event === 'forbidden') {
          setPhase('forbidden')
        } else {
          setLoginMessage('로그인이 만료되었습니다. 다시 로그인해주세요.')
          setPhase('signedOut')
        }
      }),
    [],
  )

  // ── 뒤로/앞으로 가기 ──
  useEffect(() => {
    const onPopState = () => setSection(sectionFromPath(window.location.pathname))
    window.addEventListener('popstate', onPopState)
    return () => window.removeEventListener('popstate', onPopState)
  }, [])

  const navigate = useCallback((next: AdminSection) => {
    setSection(next)
    const path = SECTION_PATHS[next]
    if (window.location.pathname !== path) window.history.pushState(null, '', path)
  }, [])

  // ── 대시보드 수치 + 메뉴 배지. 처리 작업 뒤 각 화면이 refresh 를 부른다 ──
  const [overview, setOverview] = useState<AdminOverview | null>(null)
  const [overviewLoading, setOverviewLoading] = useState(false)
  const [overviewError, setOverviewError] = useState<string | null>(null)
  const [overviewUpdatedAt, setOverviewUpdatedAt] = useState<number | null>(null)
  const overviewAbort = useRef<AbortController | null>(null)

  const refreshOverview = useCallback(() => {
    overviewAbort.current?.abort()
    const controller = new AbortController()
    overviewAbort.current = controller
    setOverviewLoading(true)
    fetchOverview(controller.signal)
      .then((data) => {
        setOverview(data)
        setOverviewError(null)
        setOverviewUpdatedAt(Date.now())
      })
      .catch((error: unknown) => {
        if (isCancelledError(error)) return
        setOverviewError(getErrorMessage(error, '대시보드 정보를 불러오지 못했습니다.'))
      })
      .finally(() => {
        if (overviewAbort.current === controller) setOverviewLoading(false)
      })
  }, [])

  useEffect(() => {
    if (phase === 'ready') refreshOverview()
    return () => overviewAbort.current?.abort()
  }, [phase, refreshOverview])

  const handleLogout = useCallback(async () => {
    await logout()
    if (mockMode) {
      clearMockMode()
      setMockMode(null)
      setMockModeState(null)
    }
    setOverview(null)
    setLoginMessage(null)
    setPhase('signedOut')
  }, [mockMode])

  if (phase === 'booting' || phase === 'exchanging') {
    return (
      <View style={styles.center}>
        <Loading label={phase === 'exchanging' ? '로그인하는 중…' : '불러오는 중…'} />
      </View>
    )
  }

  if (phase === 'signedOut') return <LoginScreen message={loginMessage} />
  if (phase === 'forbidden') return <ForbiddenScreen onLogout={handleLogout} />

  const overviewState: OverviewState = {
    data: overview,
    loading: overviewLoading,
    error: overviewError,
    updatedAt: overviewUpdatedAt,
    refresh: refreshOverview,
  }
  const badgeFor = (item: AdminSection): number => {
    if (!overview) return 0
    if (item === 'reports') return overview.reports.pending
    if (item === 'feedback') return overview.feedback.open
    if (item === 'comments') return overview.comments?.flaggedPending ?? 0
    return 0
  }

  const nav = (
    <View style={wide ? styles.sideNav : styles.topNav}>
      {NAV_ITEMS.map((item) => {
        const selected = item.section === section
        const badge = badgeFor(item.section)
        return (
          <Pressable
            key={item.section}
            onPress={() => navigate(item.section)}
            accessibilityRole="link"
            accessibilityState={{ selected }}
            style={[wide ? styles.sideItem : styles.topItem, selected && (wide ? styles.sideItemSelected : styles.topItemSelected)]}
          >
            <Ionicons
              name={item.icon}
              size={wide ? 18 : 16}
              color={wide ? (selected ? COLORS.white : ADMIN_COLORS.sidebarText) : selected ? COLORS.primary : COLORS.textSecondary}
            />
            <Text
              style={[
                wide ? styles.sideItemText : styles.topItemText,
                selected && (wide ? styles.sideItemTextSelected : styles.topItemTextSelected),
              ]}
            >
              {item.label}
            </Text>
            {badge > 0 ? (
              <View style={styles.navBadge}>
                <Text style={styles.navBadgeText}>{badge > 99 ? '99+' : badge}</Text>
              </View>
            ) : null}
          </Pressable>
        )
      })}
    </View>
  )

  const mockBadge = mockMode ? (
    <View style={styles.mockBadge}>
      <Text style={styles.mockBadgeText}>목업 데이터</Text>
    </View>
  ) : null

  const logoutButton = (
    <Pressable onPress={handleLogout} accessibilityRole="button" style={wide ? styles.sideLogout : styles.topLogout}>
      <Ionicons name="log-out-outline" size={16} color={wide ? ADMIN_COLORS.sidebarText : COLORS.textSecondary} />
      <Text style={wide ? styles.sideLogoutText : styles.topLogoutText}>로그아웃</Text>
    </Pressable>
  )

  let content
  if (section === 'reports') content = <ReportsScreen onChanged={refreshOverview} overview={overview} />
  else if (section === 'comments') content = <FlaggedCommentsScreen onChanged={refreshOverview} overview={overview} />
  else if (section === 'users') content = <UsersScreen />
  else if (section === 'feedback') content = <FeedbackScreen onChanged={refreshOverview} overview={overview} />
  else if (section === 'tools') content = <ToolsScreen onChanged={refreshOverview} />
  else content = <DashboardScreen overview={overviewState} onNavigate={navigate} />

  const main = (
    <ScrollView style={styles.main} contentContainerStyle={[styles.mainContent, !wide && styles.mainContentNarrow]}>
      <View style={styles.mainInner}>{content}</View>
    </ScrollView>
  )

  if (wide) {
    return (
      <View style={styles.rootWide}>
        <View style={styles.sidebar}>
          <View style={styles.brand}>
            <Text style={styles.brandTitle}>홍익온</Text>
            <Text style={styles.brandSubtitle}>관리자</Text>
          </View>
          {mockBadge}
          {nav}
          <View style={styles.sidebarSpacer} />
          {logoutButton}
        </View>
        {main}
      </View>
    )
  }

  return (
    <View style={styles.rootNarrow}>
      <View style={styles.topBar}>
        <View style={styles.topBarRow}>
          <Text style={styles.topBrand}>홍익온 관리자</Text>
          {mockBadge}
          <View style={styles.sidebarSpacer} />
          {logoutButton}
        </View>
        {nav}
      </View>
      {main}
    </View>
  )
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: ADMIN_COLORS.pageBg },
  rootWide: { flex: 1, flexDirection: 'row', backgroundColor: ADMIN_COLORS.pageBg },
  rootNarrow: { flex: 1, backgroundColor: ADMIN_COLORS.pageBg },
  sidebar: { width: 220, backgroundColor: ADMIN_COLORS.sidebarBg, paddingVertical: 24, paddingHorizontal: 14, gap: 12 },
  brand: { paddingHorizontal: 10, marginBottom: 8, flexDirection: 'row', alignItems: 'baseline', gap: 6 },
  brandTitle: { fontFamily: FONTS.bold, fontSize: 20, color: COLORS.white },
  brandSubtitle: { fontFamily: FONTS.medium, fontSize: 14, color: ADMIN_COLORS.sidebarText },
  sideNav: { gap: 4 },
  sideItem: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 10, paddingVertical: 10, borderRadius: 8 },
  sideItemSelected: { backgroundColor: 'rgba(255,255,255,0.14)' },
  sideItemText: { flex: 1, fontFamily: FONTS.medium, fontSize: 14, color: ADMIN_COLORS.sidebarText },
  sideItemTextSelected: { color: COLORS.white, fontFamily: FONTS.semibold },
  sidebarSpacer: { flex: 1 },
  sideLogout: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 10, paddingVertical: 10 },
  sideLogoutText: { fontFamily: FONTS.medium, fontSize: 13, color: ADMIN_COLORS.sidebarText },
  navBadge: { minWidth: 20, paddingHorizontal: 6, borderRadius: 10, backgroundColor: COLORS.danger, alignItems: 'center' },
  navBadgeText: { fontFamily: FONTS.bold, fontSize: 11, lineHeight: 20, color: COLORS.white },
  mockBadge: {
    alignSelf: 'flex-start',
    marginHorizontal: 10,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    backgroundColor: ADMIN_COLORS.warningBg,
  },
  mockBadgeText: { fontFamily: FONTS.semibold, fontSize: 11, color: ADMIN_COLORS.warning },
  topBar: { backgroundColor: COLORS.white, borderBottomWidth: 1, borderBottomColor: COLORS.border, paddingTop: 10 },
  topBarRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, gap: 4 },
  topBrand: { fontFamily: FONTS.bold, fontSize: 17, color: COLORS.primary },
  topLogout: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 6, paddingLeft: 8 },
  topLogoutText: { fontFamily: FONTS.medium, fontSize: 13, color: COLORS.textSecondary },
  topNav: { flexDirection: 'row', paddingHorizontal: 8, marginTop: 6 },
  topItem: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 10,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  topItemSelected: { borderBottomColor: COLORS.primary },
  topItemText: { fontFamily: FONTS.medium, fontSize: 13, color: COLORS.textSecondary },
  topItemTextSelected: { fontFamily: FONTS.semibold, color: COLORS.primary },
  main: { flex: 1 },
  mainContent: { padding: 32 },
  mainContentNarrow: { padding: 16 },
  mainInner: { width: '100%', maxWidth: 1080, alignSelf: 'center' },
})
