import { useState, type ReactNode } from 'react'
import { Platform, Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native'
import { COLORS } from '../../constants/colors'
import { layoutStyles } from '../../constants/layout'
import { RADIUS, SPACING } from '../../constants/spacing'
import { TYPE } from '../../constants/typography'
import { GlassLensBase, GlassLensBubble, useGlassLens } from './GlassLens'

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
 * 카드 안의 세그먼트 탭: 살짝 들어간 회색 유리 칸 안에 칸이 나란히 있고, 고른 칸 위로 회색 유리 알약(손잡이) 하나가
 * 미끄러져 간다(10-07). 움직이는 동안 손잡이가 살짝 늘어났다 돌아온다.
 * 동작 줄이기가 켜져 있으면 미끄러지지 않고 바로 옮긴다.
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
  const [trackWidth, setTrackWidth] = useState(0)
  const index = Math.max(0, tabs.indexOf(value))
  const segmentWidth = trackWidth > 0 ? (trackWidth - SEGMENT_PAD * 2 - SEGMENT_GAP * (tabs.length - 1)) / tabs.length : 0
  const offset = index * (segmentWidth + SEGMENT_GAP)

  // 고른 칸 뒤 회색 알약. 누르거나 옮기는 동안 투명한 유리 방울로 부풀어 미끄러져 간다(GlassLens, 하단 탭 바와 같다).
  const lens = useGlassLens(offset, segmentWidth > 0)

  return (
    <View
      style={styles.track}
      accessibilityRole="tablist"
      onLayout={(e) => setTrackWidth(e.nativeEvent.layout.width)}
    >
      {segmentWidth > 0 && <GlassLensBase lens={lens} style={[styles.thumb, { width: segmentWidth }]} />}
      {tabs.map((tab) => {
        const active = tab === value
        return (
          <Pressable
            key={tab}
            onPress={() => onChange(tab)}
            onPressIn={() => lens.setPressed(true)}
            onPressOut={() => lens.setPressed(false)}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            aria-selected={active}
            // 폭을 재기 전(첫 프레임)엔 손잡이가 없으니 고른 칸을 직접 칠해 둔다.
            style={[styles.segment, active && segmentWidth <= 0 && styles.segmentActive]}
          >
            <Text style={[styles.segmentText, active && styles.segmentTextActive]}>{tab}</Text>
          </Pressable>
        )
      })}
      {segmentWidth > 0 && <GlassLensBubble lens={lens} style={[styles.thumb, { width: segmentWidth }]} />}
    </View>
  )
}

const SEGMENT_PAD = SPACING.xs
const SEGMENT_GAP = SPACING.xs

const styles = StyleSheet.create({
  outer: { paddingHorizontal: SPACING.md, paddingTop: SPACING.sm, paddingBottom: SPACING.xs },
  card: {
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.sheet,
    paddingTop: SPACING.lg,
    paddingBottom: SPACING.md + 2,
    // 좌우 16 — 아래 목록·설정 카드의 안쪽 여백(16)과 같아 제목·버튼이 아래 글자와 세로로 줄이 맞는다(10-08, 예전 왼쪽 20).
    paddingHorizontal: SPACING.lg,
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
    gap: SEGMENT_GAP,
    padding: SEGMENT_PAD,
    borderRadius: RADIUS.floating,
    // 살짝 들어간 유리 칸(10-07): 옅은 회색 + 웹은 가는 테두리 고리·안쪽 위 그림자. 테두리는 그림자로 그려 칸 크기를 바꾸지 않는다.
    backgroundColor: 'rgba(118,118,128,0.06)',
    ...(Platform.OS === 'web'
      ? ({ boxShadow: 'inset 0 0 0 0.5px rgba(0,0,0,0.08), inset 0 1px 2px rgba(0,0,0,0.06)' } as ViewStyle)
      : null),
  },
  segment: { flex: 1, height: 40, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  // 고른 칸: 옅은 회색 알약(10-08 — 하단 탭 바 렌즈와 같다). 고른 칸은 글자를 남색으로 바꿔 알리고 바탕은 회색빛만 둔다.
  // 폭을 재기 전 첫 프레임에만 칸을 직접 칠한다(그 뒤로는 GlassLens 가 그린다).
  segmentActive: { backgroundColor: 'rgba(118,118,128,0.14)' },
  thumb: {
    position: 'absolute',
    top: SEGMENT_PAD,
    left: SEGMENT_PAD,
    height: 40,
    borderRadius: 18,
  },
  segmentText: { ...TYPE.body, fontSize: 14, color: COLORS.textSecondary },
  segmentTextActive: { fontFamily: TYPE.screenTitle.fontFamily, color: COLORS.primary },
})
