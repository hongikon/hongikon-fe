import type { ComponentProps } from 'react'
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { COLORS } from '../../../constants/colors'
import { RADIUS } from '../../../constants/spacing'
import { FONTS } from '../../../constants/typography'
import type { AdminOverview, AdminSection } from '../../types'
import { ADMIN_COLORS } from '../../ui'
import { navBadgeCount, navBadgeText } from '../../utils/shell/adminSections'

const NAV_ITEMS: { section: AdminSection; label: string; icon: ComponentProps<typeof Ionicons>['name'] }[] = [
  { section: 'dashboard', label: '대시보드', icon: 'speedometer-outline' },
  { section: 'reports', label: '제보 검토', icon: 'flag-outline' },
  { section: 'comments', label: '신고 댓글', icon: 'chatbubbles-outline' },
  { section: 'users', label: '회원', icon: 'people-outline' },
  { section: 'feedback', label: '문의', icon: 'chatbox-ellipses-outline' },
  { section: 'askFeedback', label: '물어보기 피드백', icon: 'thumbs-down-outline' },
  { section: 'partners', label: '제휴업체', icon: 'pricetags-outline' },
  { section: 'facilities', label: '시설 관리', icon: 'business-outline' },
  { section: 'roads', label: '길 관리', icon: 'trail-sign-outline' },
  { section: 'exhibitions', label: '전시', icon: 'easel-outline' },
  { section: 'notices', label: '앱 공지', icon: 'megaphone-outline' },
  { section: 'tools', label: '운영 도구', icon: 'construct-outline' },
]

interface NavProps {
  /** 넓은 화면이면 왼쪽 사이드바, 좁으면 위쪽 가로 메뉴. */
  wide: boolean
  section: AdminSection
  overview: AdminOverview | null
  onNavigate: (section: AdminSection) => void
}

/** 웹 콘솔 메뉴. 좁은 화면은 메뉴가 많아 한 줄에 다 들어가지 않아 가로로 넘긴다. */
export function ConsoleNav({ wide, section, overview, onNavigate }: NavProps) {
  const navItems = NAV_ITEMS.map((item) => {
    const selected = item.section === section
    const badge = navBadgeCount(overview, item.section)
    return (
      <Pressable
        key={item.section}
        onPress={() => onNavigate(item.section)}
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
            <Text style={styles.navBadgeText}>{navBadgeText(badge)}</Text>
          </View>
        ) : null}
      </Pressable>
    )
  })

  return wide ? (
    <View style={styles.sideNav}>{navItems}</View>
  ) : (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.topNav}>
      {navItems}
    </ScrollView>
  )
}

/** 목업 데이터로 보고 있을 때의 표시. */
export function MockBadge() {
  return (
    <View style={styles.mockBadge}>
      <Text style={styles.mockBadgeText}>목업 데이터</Text>
    </View>
  )
}

/** 로그아웃 버튼(사이드바·윗줄 모양). */
export function LogoutButton({ wide, onPress }: { wide: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" style={wide ? styles.sideLogout : styles.topLogout}>
      <Ionicons name="log-out-outline" size={16} color={wide ? ADMIN_COLORS.sidebarText : COLORS.textSecondary} />
      <Text style={wide ? styles.sideLogoutText : styles.topLogoutText}>로그아웃</Text>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  sideNav: { gap: 4 },
  sideItem: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 10, paddingVertical: 10, borderRadius: RADIUS.md },
  sideItemSelected: { backgroundColor: 'rgba(255,255,255,0.14)' },
  sideItemText: { flex: 1, fontFamily: FONTS.medium, fontSize: 14, color: ADMIN_COLORS.sidebarText },
  sideItemTextSelected: { color: COLORS.white, fontFamily: FONTS.semibold },
  sideLogout: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 10, paddingVertical: 10 },
  sideLogoutText: { fontFamily: FONTS.medium, fontSize: 13, color: ADMIN_COLORS.sidebarText },
  navBadge: { minWidth: 20, paddingHorizontal: 6, borderRadius: RADIUS.pill, backgroundColor: COLORS.danger, alignItems: 'center' },
  navBadgeText: { fontFamily: FONTS.bold, fontSize: 11, lineHeight: 20, color: COLORS.white },
  mockBadge: {
    alignSelf: 'flex-start',
    marginHorizontal: 10,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: RADIUS.sm,
    backgroundColor: ADMIN_COLORS.warningBg,
  },
  mockBadgeText: { fontFamily: FONTS.semibold, fontSize: 11, color: ADMIN_COLORS.warning },
  topLogout: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 6, paddingLeft: 8 },
  topLogoutText: { fontFamily: FONTS.medium, fontSize: 13, color: COLORS.textSecondary },
  topNav: { flexDirection: 'row', paddingHorizontal: 8, marginTop: 6 },
  topItem: {
    flexDirection: 'row',
    paddingHorizontal: 10,
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
})
