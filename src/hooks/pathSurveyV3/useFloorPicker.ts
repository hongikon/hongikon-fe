import { useMemo, useState } from 'react'
import { floorOptions, type BuildingIndex } from '../../utils/pathSurveyV3/buildings'
import { filterFloors, floorsOutsideBuilding, parseFloorInput } from '../../utils/pathSurveyV3/levels'

/** FloorPicker 의 상태·효과·핸들러. 화면 파일은 이 훅을 불러 그리기만 한다. */
export function useFloorPicker({ index, building, selected, used = [], single = false, onToggle, onSetMany }: Pick<{
  index: BuildingIndex
  building: string
  selected: readonly number[]
  used?: readonly number[]
  single?: boolean
  onToggle: (floor: number) => void
  /** Check or uncheck everything shown at once. Not offered when only one floor is allowed. */
  onSetMany?: (floors: number[], on: boolean) => void
}, 'index' | 'building' | 'selected' | 'used' | 'single' | 'onToggle' | 'onSetMany'>) {
  const [query, setQuery] = useState('')
  const [more, setMore] = useState(false)
  const options = useMemo(() => floorOptions(index.byCode.get(building), used), [index, building, used])
  const all = useMemo(() => [...new Set([...options.main, ...(more ? options.more : []), ...selected])].sort((x, y) => x - y), [options, more, selected])
  const input = useMemo(() => parseFloorInput(query, { includeL: options.main.includes(0) || selected.includes(0) }), [query, options, selected])
  // One typed floor also searches, including behind "more". A range or a list leaves the chips as they are.
  const shown = query.trim() && !input.isList ? filterFloors([...new Set([...all, ...options.more])].sort((x, y) => x - y), query) : all
  const typed = !input.isList && input.floors.length === 1 ? input.floors[0] : null
  const tooMany = single && input.floors.length > 1
  const outside = floorsOutsideBuilding(index.byCode.get(building), selected)

  /** Typed floors are added to what is already selected. */
  const addTyped = () => {
    if (input.floors.length === 0 || tooMany) return
    if (single) {
      if (!selected.includes(input.floors[0])) onToggle(input.floors[0])
    } else if (onSetMany) onSetMany(input.floors, true)
    else input.floors.filter((floor) => !selected.includes(floor)).forEach(onToggle)
    setQuery('')
  }
  return { query, setQuery, more, setMore, options, input, shown, typed, tooMany, outside, addTyped }
}
