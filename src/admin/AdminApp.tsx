import { ScrollView, StyleSheet, Text, View } from 'react-native'
import { COLORS } from '../constants/colors'
import { FONTS } from '../constants/typography'
import { ConsoleNav, LogoutButton, MockBadge } from './components/shell/ConsoleNav'
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
import { useAdminApp } from './hooks/shell/useAdminApp'

export type { OverviewState } from './types'

export default function AdminApp() {
  const { wide, phase, mockMode, loginMessage, section, navigate, overview, overviewState, refreshOverview, handleLogout } = useAdminApp()

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
