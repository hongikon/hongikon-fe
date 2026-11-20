import { StyleSheet } from 'react-native'
import { COLORS } from '../../../../constants/colors'
import { RADIUS } from '../../../../constants/spacing'
import { FONTS } from '../../../../constants/typography'

/** 제보 작성창의 여러 구역이 같이 쓰는 글자·안내 상자 모양. */
export const composerStyles = StyleSheet.create({
  sectionLabel: {
    fontFamily: FONTS.semibold,
    fontSize: 13,
    color: COLORS.textPrimary,
    marginTop: 18,
    marginBottom: 8,
  },
  fieldHint: { marginTop: 6, fontFamily: FONTS.regular, fontSize: 12, color: COLORS.danger },
  counter: {
    alignSelf: 'flex-end',
    fontFamily: FONTS.regular,
    fontSize: 12,
    color: COLORS.textTertiary,
    marginTop: 4,
  },
  hint: { fontFamily: FONTS.regular, fontSize: 12, color: COLORS.textSecondary, marginTop: 8 },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 16,
    padding: 12,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.warningSoft,
  },
  errorText: { flex: 1, fontFamily: FONTS.regular, fontSize: 12.5, lineHeight: 18, color: COLORS.warning },
})
