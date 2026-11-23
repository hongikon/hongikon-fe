import { useEffect, useMemo, useState } from 'react'
import { type WheelItem } from '../../utils/common/wheelPicker'
import { buildFloorOptions } from '../../utils/common/floors'
import type { Building } from '../../types'
import type { FloorDialSheetProps } from '../../components/map/FloorDialSheet'

/** SheetBody 의 상태·효과·핸들러. 화면 파일은 이 훅을 불러 그리기만 한다. */
export function useSheetBody({ building, initialFloor }: Pick<FloorDialSheetProps & { building: Building }, 'building' | 'initialFloor'>) {
  const items = useMemo<WheelItem<number>[]>(
    () => [...buildFloorOptions(building)].reverse().map((option) => ({ value: option.value, label: option.label })),
    [building],
  )
  const fallback = items.some((item) => item.value === 1) ? 1 : (items[items.length - 1]?.value ?? 1)
  const start = initialFloor !== null && items.some((item) => item.value === initialFloor) ? initialFloor : fallback
  const [floor, setFloor] = useState(start)
  useEffect(() => setFloor(start), [start])
  return { items, floor, setFloor }
}
