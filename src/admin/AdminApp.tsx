import { useCallback, useEffect, useState } from 'react'
import { ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native'
import { getErrorMessage, isNetworkError, ApiError } from '../apis/client'
import { COLORS } from '../constants/colors'
import { FONTS } from '../constants/typography'
import { completeLogin, logout, setMockMode, subscribeAdminAuth } from './api'
import { clearMockMode, getTokens, resolveMockMode, type MockMode } from './session'
import { ConsoleNav, LogoutButton, MockBadge } from './components/shell/ConsoleNav'
import { useConsoleOverview } from './hooks/useConsoleOverview'
import { useSectionRoute } from './hooks/useSectionRoute'
import { ADMIN_COLORS, Loading } from './ui'
import LoginScreen from './screens/LoginScreen'
import ForbiddenScreen from './screens/ForbiddenScreen'
import DashboardScreen from './screens/DashboardScreen'
import ReportsScreen from './screens/ReportsScreen'
import FlaggedCommentsScreen from './screens/FlaggedCommentsScreen'
import FeedbackScreen from './screens/FeedbackScreen'
import AskFeedbackScreen from './screens/AskFeedbackScreen'
import UsersScreen from './screens/UsersScreen'
import ToolsScreen from './screens/ToolsScreen'
import PartnersScreen from './screens/PartnersScreen'
import FacilitiesScreen from './screens/FacilitiesScreen'
import ExhibitionsScreen from './screens/ExhibitionsScreen'
import NoticesScreen from './screens/NoticesScreen'
import { RADIUS } from '../constants/spacing'

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

/** 이 너비부터 왼쪽 사이드바, 그보다 좁으면 위쪽 가로 메뉴. */
const WIDE_BREAKPOINT = 860

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
  const { section, navigate } = useSectionRoute()

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

  // ── 대시보드 수치 + 메뉴 배지. 처리 작업 뒤 각 화면이 refresh 를 부른다 ──
  const { overview, setOverview, overviewState, refreshOverview } = useConsoleOverview(phase === 'ready')

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

  // 좁은 화면은 메뉴가 많아 한 줄에 다 들어가지 않아 가로로 넘긴다.
  const nav = <ConsoleNav wide={wide} section={section} overview={overview} onNavigate={navigate} />
  const mockBadge = mockMode ? <MockBadge /> : null
  const logoutButton = <LogoutButton wide={wide} onPress={handleLogout} />

  let content
  if (section === 'reports') content = <ReportsScreen onChanged={refreshOverview} overview={overview} />
  else if (section === 'comments') content = <FlaggedCommentsScreen onChanged={refreshOverview} overview={overview} />
  else if (section === 'users') content = <UsersScreen />
  else if (section === 'feedback') content = <FeedbackScreen onChanged={refreshOverview} overview={overview} />
  else if (section === 'askFeedback') content = <AskFeedbackScreen />
  else if (section === 'partners') content = <PartnersScreen />
  else if (section === 'facilities') content = <FacilitiesScreen />
  else if (section === 'exhibitions') content = <ExhibitionsScreen />
  else if (section === 'notices') content = <NoticesScreen />
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
  sidebarSpacer: { flex: 1 },
  topBar: { backgroundColor: COLORS.white, borderBottomWidth: 1, borderBottomColor: COLORS.border, paddingTop: 10 },
  topBarRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, gap: 4 },
  topBrand: { fontFamily: FONTS.bold, fontSize: 17, color: COLORS.primary },
  main: { flex: 1 },
  mainContent: { padding: 32 },
  mainContentNarrow: { padding: 16 },
  mainInner: { width: '100%', maxWidth: 1080, alignSelf: 'center' },
})
