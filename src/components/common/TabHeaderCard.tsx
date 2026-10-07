import type { ReactNode } from 'react'
import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native'
import { COLORS } from '../../constants/colors'
import { layoutStyles } from '../../constants/layout'
import { RADIUS, SPACING } from '../../constants/spacing'
import { TYPE } from '../../constants/typography'

/**
 * 탭 화면(소식·설정) 맨 위의 둥근 흰 카드(10-07 A안). 회색 바탕 위에 떠 있고, 제목 줄 아래에 세그먼트 탭 같은 것을 담는다.
 * 모서리는 바텀시트·하단 탭 캡슐과 같은 곡률(RADIUS.sheet)이다. 바깥 여백은 목록 카드와 같은 12.
 */
export default function TabHeaderCard({
  title,
  right,
  children,
  style,
}: {
  title: string
  right?: ReactNode
  children?: ReactNode
  style?: StyleProp<ViewStyle>
}) {
  return (
    <View style={[styles.outer, layoutStyles.readable, style]}>
      <View style={styles.card}>
        <View style={styles.titleRow}>
          <Text style={styles.title} accessibilityRole="header">
            {title}
          </Text>
          {right}
        </View>
        {children}
      </View>
    </View>
  )
}

/** 카드 오른쪽 위 동그란 아이콘 버튼 자리(회색 원). 안의 아이콘은 부르는 쪽이 넣는다. */
export function HeaderCircleButton({
  onPress,
  accessibilityLabel,
  children,
}: {
  onPress: () => void
  accessibilityLabel: string
  children: ReactNode
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      style={({ pressed }) => [styles.circle, pressed && styles.circlePressed]}
    >
      {children}
    </Pressable>
  )
}

/**
 * 카드 안의 세그먼트 탭: 회색 알약 칸 안에 칸이 나란히 있고, 고른 칸만 남색으로 채운다(바깥 큰 칩 안의 작은 칩).
 * react-native-web 0.21 은 accessibilityState 를 DOM 에 옮기지 않아 웹은 aria-selected 를 따로 준다.
 */
export function SegmentedTabs<T extends string>({
  tabs,
  value,
  onChange,
}: {
  tabs: readonly T[]
  value: T
  onChange: (tab: T) => void
}) {
  return (
    <View style={styles.track} accessibilityRole="tablist">
      {tabs.map((tab) => {
        const active = tab === value
        return (
          <Pressable
            key={tab}
            onPress={() => onChange(tab)}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            aria-selected={active}
            style={[styles.segment, active && styles.segmentActive]}
          >
            <Text style={[styles.segmentText, active && styles.segmentTextActive]}>{tab}</Text>
          </Pressable>
        )
      })}
    </View>
  )
}

const styles = StyleSheet.create({
  outer: { paddingHorizontal: SPACING.md, paddingTop: SPACING.sm, paddingBottom: SPACING.xs },
  card: {
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.sheet,
    paddingTop: SPACING.lg,
    paddingBottom: SPACING.md + 2,
    paddingLeft: SPACING.xl,
    paddingRight: SPACING.lg,
    gap: SPACING.md + 2,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 18,
    elevation: 2,
  },
  titleRow: { minHeight: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { ...TYPE.screenTitle, fontSize: 24, color: COLORS.textPrimary },
  circle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: COLORS.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  circlePressed: { opacity: 0.6 },
  track: {
    flexDirection: 'row',
    gap: SPACING.xs,
    padding: SPACING.xs,
    borderRadius: RADIUS.floating,
    backgroundColor: COLORS.background,
  },
  segment: { flex: 1, height: 40, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  segmentActive: { backgroundColor: COLORS.primary },
  segmentText: { ...TYPE.body, fontSize: 14, color: COLORS.textSecondary },
  segmentTextActive: { fontFamily: TYPE.screenTitle.fontFamily, color: COLORS.white },
})
