import { memo } from 'react'
import { StyleSheet, Text, View } from 'react-native'
import Svg, { Path } from 'react-native-svg'
import { COLORS } from '../../constants/colors'
import { FONTS } from '../../constants/typography'

/** 인증 표시(톱니 원 + 체크). 시스템 아이콘·이모지 대신 자체 경로로 그린다. viewBox 24. */
const SEAL =
  'M12 1.8l2.3 1.7 2.8-.4 1.1 2.6 2.6 1.1-.4 2.8 1.7 2.3-1.7 2.3.4 2.8-2.6 1.1-1.1 2.6-2.8-.4L12 22.2l-2.3-1.7-2.8.4-1.1-2.6-2.6-1.1.4-2.8L1.8 12l1.7-2.3-.4-2.8 2.6-1.1 1.1-2.6 2.8.4z'
const CHECK = 'M8.2 12.3l2.6 2.6 5-5.2'

/**
 * 운영진이 인증한 공식 계정(학생회 등) 배지. 제보 시트·댓글의 작성자 이름 옆에 붙는다.
 * 서버가 `authorOfficial: true` 를 줄 때만 쓴다 — 일반 회원은 닉네임에 '학생회'·'공식'을 쓸 수 없어 흉내 낼 수 없다.
 */
function OfficialBadge({ size = 'small' }: { size?: 'small' | 'medium' }) {
  const icon = size === 'medium' ? 14 : 12
  return (
    <View
      style={[styles.badge, size === 'medium' && styles.badgeMedium]}
      accessibilityRole="text"
      accessibilityLabel="운영진이 인증한 공식 계정"
    >
      <Svg width={icon} height={icon} viewBox="0 0 24 24" accessibilityElementsHidden importantForAccessibility="no">
        <Path d={SEAL} fill={COLORS.white} />
        <Path d={CHECK} fill="none" stroke={COLORS.primary} strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" />
      </Svg>
      <Text style={[styles.text, size === 'medium' && styles.textMedium]}>공식</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingLeft: 4,
    paddingRight: 6,
    paddingVertical: 2,
    borderRadius: 999,
    backgroundColor: COLORS.primary,
    alignSelf: 'center',
  },
  badgeMedium: { paddingLeft: 5, paddingRight: 8, paddingVertical: 3 },
  text: { fontFamily: FONTS.semibold, fontSize: 10.5, color: COLORS.white },
  textMedium: { fontSize: 12 },
})

export default memo(OfficialBadge)
