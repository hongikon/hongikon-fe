import { StyleSheet, View } from 'react-native'
import { layoutStyles } from '../../../constants/layout'
import Chip from '../../common/Chip'
import * as haptics from '../../../lib/haptics'

interface Props<M extends string> {
  modes: readonly M[]
  value: M
  onChange: (mode: M) => void
}

/** [검색 모드 칩] 게시글·학과 중 하나를 고르는 라디오 칩 줄. 다른 모드로 바꿀 때만 가볍게 진동한다. */
export default function SearchModeChips<M extends string>({ modes, value, onChange }: Props<M>) {
  return (
    <View style={[styles.modeRow, layoutStyles.readable]} accessibilityRole="radiogroup">
      {modes.map((m) => {
        const isActive = value === m
        return (
          <Chip
            key={m}
            label={m}
            selected={isActive}
            role="radio"
            onPress={() => {
              if (m !== value) haptics.selection()
              onChange(m)
            }}
          />
        )
      })}
    </View>
  )
}

const styles = StyleSheet.create({
  modeRow: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 4,
  },
})
