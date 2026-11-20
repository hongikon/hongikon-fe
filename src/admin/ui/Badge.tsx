import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native'
import { COLORS } from '../../constants/colors'
import { RADIUS } from '../../constants/spacing'
import { FONTS } from '../../constants/typography'
import { ADMIN_COLORS, type Tone } from './theme'

const TONE_STYLE: Record<Tone, { bg: string; text: string }> = {
  neutral: { bg: ADMIN_COLORS.neutralBg, text: ADMIN_COLORS.neutralText },
  success: { bg: ADMIN_COLORS.successBg, text: ADMIN_COLORS.success },
  warning: { bg: ADMIN_COLORS.warningBg, text: ADMIN_COLORS.warning },
  danger: { bg: ADMIN_COLORS.dangerBg, text: COLORS.danger },
  info: { bg: ADMIN_COLORS.infoBg, text: COLORS.primary },
}

export function Badge({ label, tone = 'neutral', style }: { label: string; tone?: Tone; style?: StyleProp<ViewStyle> }) {
  const colors = TONE_STYLE[tone]
  return (
    <View style={[styles.badge, { backgroundColor: colors.bg }, style]}>
      <Text style={[styles.badgeText, { color: colors.text }]}>{label}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: RADIUS.pill, alignSelf: 'flex-start' },
  badgeText: { fontFamily: FONTS.semibold, fontSize: 12 },
})
