import { Platform, StyleSheet, View, type GestureResponderHandlers } from 'react-native'
import { COLORS } from '../../constants/colors'

/**
 * 바텀시트 손잡이(회색 줄). 줄 자체는 4px 라 손가락·마우스로 맞히기 어려워, 줄 둘레의 넓은 칸 전체를 잡는 곳으로 둔다
 * (웹 View 에는 hitSlop 이 먹지 않는다). 위로 끌면 커지고 아래로 끌면 작아지며, 누르기만 하면 한 단계 커진다.
 * 레이아웃은 예전 줄(위 여백 없음·아래 gap)과 같은 자리를 차지한다 — 늘어난 칸은 음수 margin 으로 시트 위 여백에 겹친다.
 */
export default function SheetHandle({ panHandlers, gap = 14 }: { panHandlers: GestureResponderHandlers; gap?: number }) {
  return (
    <View
      {...panHandlers}
      accessibilityRole="adjustable"
      accessibilityLabel="시트 크기 조절"
      style={[styles.hit, { paddingBottom: gap, marginBottom: 0 }]}
    >
      <View style={styles.bar} />
    </View>
  )
}

const styles = StyleSheet.create({
  hit: {
    alignSelf: 'center',
    width: 160,
    marginTop: -12,
    paddingTop: 12,
    alignItems: 'center',
    ...(Platform.OS === 'web' ? ({ cursor: 'grab', touchAction: 'none', userSelect: 'none' } as object) : null),
  },
  bar: { width: 40, height: 5, borderRadius: 3, backgroundColor: COLORS.border },
})
