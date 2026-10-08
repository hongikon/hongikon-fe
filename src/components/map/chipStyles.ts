import { StyleSheet, useWindowDimensions } from 'react-native'
import { COLORS } from '../../constants/colors'
import { FONTS } from '../../constants/typography'
import { useCenteredGutter } from '../../hooks/useCenteredGutter'

/**
 * 지도 위 필터 칩 줄이 공유하는 모양.
 *
 * 최상단(편의시설·제휴업체), 편의시설 종류, 제휴 소속·업종까지 칩 줄이 여러
 * 개라, 정의를 한 곳에 두지 않으면 줄마다 높이와 여백이 조금씩 어긋난다.
 * 색으로 구분되는 선택 상태는 줄마다 달라 각 컴포넌트가 따로 얹는다.
 */
export const chipStyles = StyleSheet.create({
  // flexGrow 0 이 없으면 가로 스크롤이 남은 세로 공간을 먹어 지도를 밀어낸다.
  // 칩 줄은 칩 너비만큼만 차지한다(alignSelf flex-start) — 칩 오른쪽 빈 자리를 눌러도 지도가 눌리고 끌린다.
  // 칩이 화면보다 길면 maxWidth 로 화면 너비에서 멈추고 가로로 스크롤된다.
  scroll: { flexGrow: 0, marginBottom: 8, alignSelf: 'flex-start', maxWidth: '100%' },
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

/**
 * 지도 위 시트(건물·제휴업체·제보)의 닫기 버튼. 40×40 터치 영역을 주되 머리줄 높이는 늘리지 않게
 * 바깥 여백을 음수로 당긴다.
 */
export const sheetCloseStyle = { marginVertical: -10, marginRight: -10 } as const

/**
 * 칩 줄 스크롤의 최대 폭(px). `maxWidth: '100%'` 만으로는 칩 너비만큼만 차지하는(alignSelf flex-start) 가로 스크롤이
 * 앱에서 화면 폭에서 멈추지 않아, 넘치는 칩(편의점 뒤·캠자전 뒤)을 넘겨 볼 수 없었다(10-08). 화면 폭에서 지도 화면이
 * 넓은 창에서 양옆에 더 띄우는 만큼(MapScreen 의 sideGutter - 16)을 빼 숫자로 준다.
 */
export function useChipRowScrollStyle() {
  const { width } = useWindowDimensions()
  const gutter = useCenteredGutter()
  return [chipStyles.scroll, { maxWidth: width - 2 * Math.max(0, gutter - 16) }]
}
