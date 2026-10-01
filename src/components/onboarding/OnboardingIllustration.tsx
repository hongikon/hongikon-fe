import { StyleSheet, Text, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { COLORS } from '../../constants/colors'
import { FONTS } from '../../constants/typography'

type IconName = keyof typeof Ionicons.glyphMap

export interface IllustrationBadge {
  icon: IconName
  label: string
}

interface OnboardingIllustrationProps {
  icon: IconName
  /** 가운데 아이콘 주위에 떠 있는 작은 꼬리표. 왼쪽 위, 오른쪽 아래 순서로 놓인다. */
  badges: readonly [IllustrationBadge, IllustrationBadge]
}

/** 온보딩 그림에 쓰는 옅은 브랜드색. 구독 관리 모달의 켜진 종 배경과 같은 톤이다. */
export const ONBOARDING_TINT = '#ECEBF5'
const TINT_SOFT = '#F6F5FB'

/**
 * 온보딩 소개 그림. 새 이미지 자산 없이 Ionicons 로 그린다 —
 * 옅은 원 두 겹 위에 브랜드색 아이콘 타일, 그 둘레에 기능 이름 꼬리표 두 개.
 */
export default function OnboardingIllustration({ icon, badges }: OnboardingIllustrationProps) {
  const [first, second] = badges
  return (
    <View style={styles.root} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <View style={styles.haloOuter} />
      <View style={styles.haloInner} />
      <View style={styles.tile}>
        <Ionicons name={icon} size={46} color={COLORS.white} />
      </View>
      <Badge {...first} style={styles.badgeTopLeft} />
      <Badge {...second} style={styles.badgeBottomRight} />
    </View>
  )
}

function Badge({ icon, label, style }: IllustrationBadge & { style: object }) {
  return (
    <View style={[styles.badge, style]}>
      <View style={styles.badgeIcon}>
        <Ionicons name={icon} size={13} color={COLORS.primary} />
      </View>
      <Text style={styles.badgeText}>{label}</Text>
    </View>
  )
}

const SIZE = 232

const styles = StyleSheet.create({
  root: { width: SIZE, height: SIZE, alignItems: 'center', justifyContent: 'center' },
  haloOuter: {
    position: 'absolute',
    width: SIZE,
    height: SIZE,
    borderRadius: SIZE / 2,
    backgroundColor: TINT_SOFT,
  },
  haloInner: {
    position: 'absolute',
    width: 164,
    height: 164,
    borderRadius: 82,
    backgroundColor: ONBOARDING_TINT,
  },
  tile: {
    width: 96,
    height: 96,
    borderRadius: 30,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: COLORS.primary,
    shadowOpacity: 0.22,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 6,
  },
  badge: {
    position: 'absolute',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingLeft: 5,
    paddingRight: 11,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: COLORS.white,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  badgeIcon: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: ONBOARDING_TINT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: { fontSize: 12, fontFamily: FONTS.semibold, color: COLORS.textPrimary },
  badgeTopLeft: { top: 26, left: -14 },
  badgeBottomRight: { bottom: 30, right: -18 },
})
