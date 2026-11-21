import { memo, type ReactNode } from 'react'
import { View } from 'react-native'

/** 칩 줄 안쪽 여백. 칩도 검색바와 같은 왼쪽 끝에서 시작하도록 넓은 창에서는 이만큼 빼고 띄운다. */
const CHIP_ROW_INSET = 16

/** 검색바 아래 칩 줄 묶음(갈래 칩 · 그 아래 하위 칩). 넓은 창에서 검색바와 왼쪽 끝을 맞춘다. */
function FilterChipSection({ sideGutter, children }: { sideGutter: number; children: ReactNode }) {
  return (
    <View
      style={sideGutter > CHIP_ROW_INSET ? { paddingHorizontal: sideGutter - CHIP_ROW_INSET } : null}
      pointerEvents="box-none"
    >
      {children}
    </View>
  )
}

export default memo(FilterChipSection)
