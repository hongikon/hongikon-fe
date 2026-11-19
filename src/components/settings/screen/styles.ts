import { StyleSheet } from 'react-native'
import { COLORS } from '../../../constants/colors'
import { FONTS } from '../../../constants/typography'
import { RADIUS, SPACING } from '../../../constants/spacing'

/** 설정 화면 묶음 카드들이 같이 쓰는 모양(SettingsScreen 에서 옮김). */
export const settingsStyles = StyleSheet.create({
  // 묶음마다 둥근 카드(10-07 A안 — 머리 카드·하단 탭 캡슐과 같은 곡률 계열).
  section: {
    backgroundColor: COLORS.white,
    marginHorizontal: SPACING.md,
    marginTop: SPACING.sm,
    borderRadius: RADIUS.lg,
    overflow: 'hidden',
  },
  // 펼친 묶음의 내용(머리 줄 아래). 옅은 바탕으로 머리 줄과 구분한다.
  // 아래 여백은 두지 않는다 — 마지막 흰 줄이 카드 아래 끝까지 닿아야 아래 모서리도 위(머리 줄)와 같은 곡률로 보인다
  // (11-08: 아래에 옅은 바탕 4pt 가 남아 '설정 초기화' 아래 모서리가 덜 둥글어 보였다).
  groupBody: { backgroundColor: COLORS.background, paddingTop: SPACING.xs },
  subHeader: { fontFamily: FONTS.semibold, fontSize: 15, lineHeight: 21, color: COLORS.textSecondary, paddingHorizontal: SPACING.lg, paddingTop: SPACING.lg, paddingBottom: SPACING.xs },
  subBlock: { backgroundColor: COLORS.white, marginTop: SPACING.xs },
  dimmed: { opacity: 0.45 },
})
