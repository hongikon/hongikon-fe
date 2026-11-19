import { StyleSheet } from 'react-native'
import { COLORS } from '../../../constants/colors'
import { RADIUS, SPACING } from '../../../constants/spacing'

/** 본문 글씨는 빈 화면 문구(EmptyState message, 14px)와 같은 크기로 맞춘다. 상태·분류 알약은 12px 그대로. */
export const BODY_14 = { fontSize: 14, lineHeight: 20 } as const

/** 내 제보 목록·카드·불러오는 중 틀이 같이 쓰는 모양(MyReportsModal 에서 옮김). */
export const myReportsStyles = StyleSheet.create({
  // 좌우 여백은 머리 카드·설정 탭 묶음 카드와 같은 md.
  list: { paddingHorizontal: SPACING.md, paddingTop: SPACING.sm, paddingBottom: SPACING.xxxl },
  card: {
    backgroundColor: COLORS.cardBg,
    borderRadius: RADIUS.lg,
    padding: SPACING.lg,
    // 다른 떠 있는 카드처럼 테두리는 보이지 않게(10-08). 강조될 때 두께가 바뀌어 글자가 밀리지 않게 자리만 둔다.
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
})
