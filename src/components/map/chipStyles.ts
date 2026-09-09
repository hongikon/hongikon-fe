import { StyleSheet } from 'react-native'
import { COLORS } from '../../constants/colors'
import { FONTS } from '../../constants/typography'

/**
 * 지도 위 필터 칩 줄이 공유하는 모양.
 *
 * 최상단(편의시설·제휴업체), 편의시설 종류, 제휴 소속·업종까지 칩 줄이 여러
 * 개라, 정의를 한 곳에 두지 않으면 줄마다 높이와 여백이 조금씩 어긋난다.
 * 색으로 구분되는 선택 상태는 줄마다 달라 각 컴포넌트가 따로 얹는다.
 */
export const chipStyles = StyleSheet.create({
  // flexGrow 0 이 없으면 가로 스크롤이 남은 세로 공간을 먹어 지도를 밀어낸다.
  scroll: { flexGrow: 0, marginBottom: 8 },
  row: { paddingHorizontal: 16, gap: 7 },
  chip: {
    height: 32,
    paddingHorizontal: 11,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.chipBorder,
    backgroundColor: COLORS.white,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  // 해당 조건에 대상이 없는 칩. 눌리기는 하되 먼저 눈에 띄지는 않게 둔다.
  chipEmpty: { opacity: 0.45 },
  label: { fontSize: 12.5, fontFamily: FONTS.semibold, color: COLORS.chipText },
  labelActive: { color: COLORS.white },
})
