import { StyleSheet } from 'react-native'
import { COLORS } from '../../../constants/colors'
import { FONTS, TYPE } from '../../../constants/typography'
import { RADIUS, SPACING } from '../../../constants/spacing'

/** 물어보기 탭의 안내·동의 화면이 함께 쓰는 모양. */
export const tabStyles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.background },
  titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginBottom: SPACING.md },
  title: { ...TYPE.title, color: COLORS.textPrimary },
  beta: {
    fontSize: 11,
    fontFamily: FONTS.semibold,
    color: COLORS.primary,
    borderWidth: 1,
    borderColor: COLORS.primary,
    borderRadius: RADIUS.pill,
    paddingHorizontal: 6,
    paddingVertical: 1,
    overflow: 'hidden',
  },
})
