import { StyleSheet } from 'react-native'
import { COLORS } from '../../constants/colors'
import { FONTS } from '../../constants/typography'

export const ADMIN_COLORS = {
  ...COLORS,
  pageBg: '#F5F6F8',
  sidebarBg: '#05014A',
  sidebarText: '#C9C8E6',
  success: '#15803D',
  successBg: '#DCFCE7',
  warning: '#B45309',
  warningBg: '#FEF3C7',
  dangerBg: '#FEE2E2',
  neutralBg: '#F1F5F9',
  neutralText: '#475569',
  infoBg: '#E0E7FF',
  kakao: '#FEE500',
} as const

export type Tone = 'neutral' | 'success' | 'warning' | 'danger' | 'info'

export const adminText = StyleSheet.create({
  body: { fontFamily: FONTS.regular, fontSize: 14, color: COLORS.textPrimary, lineHeight: 21 },
  muted: { fontFamily: FONTS.regular, fontSize: 13, color: COLORS.textSecondary },
  strong: { fontFamily: FONTS.semibold, fontSize: 14, color: COLORS.textPrimary },
})
