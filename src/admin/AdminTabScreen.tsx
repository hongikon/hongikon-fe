import { Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { COLORS } from '../constants/colors'
import { FONTS } from '../constants/typography'
import { layoutStyles } from '../constants/layout'
import { RADIUS, SCREEN_GUTTER, SPACING } from '../constants/spacing'
import { LargeTitleHeader } from '../components/common/ScreenHeader'
import { ADMIN_COLORS, AdminHostProvider, AdminScrollProvider } from './ui'
import DashboardScreen from './screens/DashboardScreen'
import ReportsScreen from './screens/ReportsScreen'
import FlaggedCommentsScreen from './screens/FlaggedCommentsScreen'
import FeedbackScreen from './screens/FeedbackScreen'
import AskFeedbackScreen from './screens/AskFeedbackScreen'
import UsersScreen from './screens/UsersScreen'
import ToolsScreen from './screens/ToolsScreen'
import PartnersScreen from './screens/PartnersScreen'
import FacilitiesScreen from './screens/FacilitiesScreen'
import RoadsScreen from './screens/RoadsScreen'
import ExhibitionsScreen from './screens/ExhibitionsScreen'
import { useAdminTabScreen } from './hooks/shell/useAdminTabScreen'
import { SECTIONS } from './utils/shell/adminTabScreen'

export default function AdminTabScreen() {
  const { tabInset, overview, refresh, section, scrollRef, focus, scrollYRef, scrollHandle, navigate, data, badgeFor, reportFocus, feedbackFocus, usersFocus, commentsFocus, mock } = useAdminTabScreen()
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
  else if (section === 'comments')
    content = (
      <FlaggedCommentsScreen
        key={commentsFocus ? focus?.key : 'comments'}
        onChanged={refresh}
        overview={data}
        focusCommentId={commentsFocus?.commentId ?? null}
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
  else if (section === 'askFeedback') content = <AskFeedbackScreen />
  else if (section === 'partners') content = <PartnersScreen />
  else if (section === 'facilities') content = <FacilitiesScreen />
  else if (section === 'roads') content = <RoadsScreen />
  else if (section === 'exhibitions') content = <ExhibitionsScreen />
  else if (section === 'tools') content = <ToolsScreen onChanged={refresh} />
  else content = <DashboardScreen overview={overview} onNavigate={navigate} />

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
          contentContainerStyle={[styles.content, layoutStyles.readable, tabInset > 0 && { paddingBottom: tabInset + 12 }]}
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
  navBadge: { minWidth: 20, paddingHorizontal: 6, borderRadius: RADIUS.pill, backgroundColor: COLORS.danger, alignItems: 'center' },
  navBadgeSelected: { backgroundColor: COLORS.white },
  navBadgeText: { fontFamily: FONTS.bold, fontSize: 11, lineHeight: 20, color: COLORS.white },
  navBadgeTextSelected: { color: COLORS.primary },
  scroll: { flex: 1, backgroundColor: ADMIN_COLORS.pageBg },
  content: { padding: SCREEN_GUTTER, paddingBottom: SPACING.xxxl },
  mockBadge: {
    marginRight: SPACING.sm,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: RADIUS.sm,
    backgroundColor: ADMIN_COLORS.warningBg,
  },
  mockBadgeText: { fontFamily: FONTS.semibold, fontSize: 11, color: ADMIN_COLORS.warning },
})
