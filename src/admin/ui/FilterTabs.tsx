import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { COLORS } from '../../constants/colors'
import { RADIUS } from '../../constants/spacing'
import { FONTS } from '../../constants/typography'
import { useAdminHost } from './host'
import { ADMIN_COLORS } from './theme'

interface TabOption<T extends string> {
  value: T
  label: string
  count?: number
}

/** 상태 필터 탭. 좁은 화면에서는 줄바꿈된다. */
export function FilterTabs<T extends string>({
  options,
  value,
  onChange,
}: {
  options: readonly TabOption<T>[]
  value: T
  onChange: (value: T) => void
}) {
  const app = useAdminHost() === 'app'
  const items = options.map((option) => {
        const selected = option.value === value
        return (
          <Pressable
            key={option.value}
            onPress={() => onChange(option.value)}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            hitSlop={app ? 4 : undefined}
            style={[styles.tab, app && styles.tabApp, selected && styles.tabSelected]}
          >
            <Text style={[styles.tabText, selected && styles.tabTextSelected]}>{option.label}</Text>
            {option.count !== undefined && option.count > 0 ? (
              <View style={[styles.tabCount, selected && styles.tabCountSelected]}>
                <Text style={[styles.tabCountText, selected && styles.tabCountTextSelected]}>{option.count}</Text>
              </View>
            ) : null}
          </Pressable>
        )
      })
  if (app) {
    // 폰에서는 줄바꿈 대신 가로로 넘긴다(필터가 두 줄이 되면 목록이 그만큼 밀린다).
    return (
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.tabsScroll}
        contentContainerStyle={styles.tabsScrollContent}
        accessibilityRole="tablist"
      >
        {items}
      </ScrollView>
    )
  }
  return (
    <View style={styles.tabs} accessibilityRole="tablist">
      {items}
    </View>
  )
}

const styles = StyleSheet.create({
  tabs: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 16 },
  tab: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: RADIUS.pill,
    borderWidth: 1,
    borderColor: '#D4D4D8',
    backgroundColor: COLORS.white,
  },
  tabApp: { minHeight: 36, paddingHorizontal: 14 },
  tabsScroll: { flexGrow: 0, marginBottom: 12, marginHorizontal: -16 },
  tabsScrollContent: { gap: 6, paddingHorizontal: 16 },
  tabSelected: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  tabText: { fontFamily: FONTS.medium, fontSize: 13, color: COLORS.textPrimary },
  tabTextSelected: { color: COLORS.white },
  tabCount: { minWidth: 18, paddingHorizontal: 5, borderRadius: RADIUS.pill, backgroundColor: ADMIN_COLORS.dangerBg, alignItems: 'center' },
  tabCountSelected: { backgroundColor: COLORS.white },
  tabCountText: { fontFamily: FONTS.bold, fontSize: 11, color: COLORS.danger, lineHeight: 18 },
  tabCountTextSelected: { color: COLORS.primary },
})
