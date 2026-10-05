import { StyleSheet, Text, View } from 'react-native'
import { COLORS } from '../../constants/colors'
import { FONTS } from '../../constants/typography'
import FlameIcon from './FlameIcon'

/** HOT 배지(FINAL.md): 바탕 #05014A, 불꽃 #4C63FF + 흰 안쪽, 글자 흰색 800. 최근 60분 🔥 가 몰린 제보에 붙는다. */
export default function HotBadge({ size = 'md' }: { size?: 'sm' | 'md' }) {
  const small = size === 'sm'
  return (
    <View
      style={[styles.badge, small && styles.badgeSmall]}
      accessible
      accessibilityLabel="HOT 제보, 최근 한 시간 동안 공감이 많이 모였어요"
    >
      <FlameIcon variant="hot" size={small ? 12 : 14} />
      <Text style={[styles.text, small && styles.textSmall]}>HOT</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    height: 24,
    paddingLeft: 7,
    paddingRight: 10,
    borderRadius: 12,
    backgroundColor: COLORS.primary,
  },
  badgeSmall: { height: 20, paddingLeft: 5, paddingRight: 8, borderRadius: 10 },
  // Pretendard ExtraBold 는 앱에 없다 — bold 가 가장 굵다.
  text: { fontFamily: FONTS.bold, fontSize: 12, color: COLORS.white, letterSpacing: 0.2 },
  textSmall: { fontSize: 11 },
})
