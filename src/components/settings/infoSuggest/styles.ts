import { StyleSheet } from 'react-native'
import { COLORS } from '../../../constants/colors'
import { FONTS } from '../../../constants/typography'
import { RADIUS } from '../../../constants/spacing'
import { SELECTED_PILL_BG } from '../../common/Chip'

/** 정보 제보 창의 칸 모양(InfoSuggestModal 에서 옮김). */
export const infoStyles = StyleSheet.create({
  kindRow: { flexDirection: 'row', gap: 8, marginBottom: 20 },
  kindButton: {
    flex: 1,
    height: 44,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // 고른 종류: 회색 알약 + 남색 글자(10-08, 앱 전체 선택 표시와 같게).
  kindButtonActive: { backgroundColor: SELECTED_PILL_BG, borderColor: 'transparent' },
  kindText: { fontFamily: FONTS.semibold, fontSize: 14, color: COLORS.textSecondary },
  kindTextActive: { color: COLORS.primary },
  field: { marginBottom: 20 },
  fieldWithHint: { marginBottom: 6 },
  fieldInvalid: { borderColor: COLORS.danger },
  hint: { fontFamily: FONTS.medium, fontSize: 12.5, color: COLORS.danger, marginBottom: 16 },
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 7, marginBottom: 20 },
  chipWrapWithHint: { marginBottom: 8 },
  chipInvalid: { borderColor: COLORS.danger },
  pickerBlock: { marginBottom: 8 },
  searchField: { marginBottom: 8 },
  buildingRow: { gap: 7, paddingVertical: 2 },
  emptyText: { fontFamily: FONTS.regular, fontSize: 13, color: COLORS.textTertiary, paddingVertical: 7 },
  pickedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: COLORS.primarySoft,
    borderRadius: RADIUS.md,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 8,
  },
  pickedText: { flex: 1, fontFamily: FONTS.medium, fontSize: 13, color: COLORS.textPrimary },
  pickButton: { marginBottom: 8 },
})
