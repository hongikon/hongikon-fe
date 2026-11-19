import { StyleSheet } from 'react-native'
import { COLORS } from '../../../constants/colors'
import { FONTS } from '../../../constants/typography'

/** 학과 트리의 하위 줄(학과·학부 묶음)이 함께 쓰는 모양. */
export const treeRowStyles = StyleSheet.create({
  treeChild: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    minHeight: 46,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: COLORS.divider,
    gap: 7,
  },
  treeChildPrefix: { fontFamily: FONTS.regular, fontSize: 13, color: COLORS.iconMuted, width: 14 },
})
