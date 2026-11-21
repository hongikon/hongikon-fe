import { useState } from 'react'
import { isDesktopPointer } from '../../utils/map/chipRow'
import type { ChipRowProps } from '../../components/map/ChipRow'

/** ChipRow 의 상태·효과·핸들러. 화면 파일은 이 훅을 불러 그리기만 한다. */
export function useChipRow() {
  const [expanded, setExpanded] = useState(false)
  /** 접힌 줄에서 칩을 줄바꿈으로 늘어놓았을 때의 높이. 한 줄(칩 높이)보다 크면 넘친다. */
  const [wrappedHeight, setWrappedHeight] = useState(0)

  // 화면 동안 바뀌지 않는 값이라 처음 한 번만 잰다.
  const [desktop] = useState(isDesktopPointer)
  return { expanded, setExpanded, wrappedHeight, setWrappedHeight, desktop }
}
