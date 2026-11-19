import { StyleSheet } from 'react-native'
import { COLORS } from '../../../constants/colors'
import { RADIUS } from '../../../constants/spacing'
import { FONTS } from '../../../constants/typography'

/** 회원 관리 부품들이 함께 쓰는 글자·입력 칸 모양(정지 사유·공식 이름 입력). */
export const moderationStyles = StyleSheet.create({
  meta: { fontFamily: FONTS.regular, fontSize: 12, color: COLORS.textSecondary },
  actionsStart: { flexDirection: 'row', gap: 8, justifyContent: 'flex-start' },
  inputApp: { minHeight: 44, fontSize: 16 },
  input: {
    fontFamily: FONTS.regular,
    fontSize: 14,
    color: COLORS.textPrimary,
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: '#D4D4D8',
    borderRadius: RADIUS.md,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
})
