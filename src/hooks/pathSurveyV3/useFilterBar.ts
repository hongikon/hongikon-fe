import { useMemo } from 'react'
import type { BuildingIndex } from '../../utils/pathSurveyV3/buildings'
import type { SurveyNodeV3 } from '../../utils/pathSurveyV3/types'
import type { ChangeCounts } from '../../utils/pathSurveyV3/changes'
import { type MapFilter } from '../../screens/pathSurveyV3/mapState'

/** State, effects and handlers of FilterBar. The screen file only renders. */
export function useFilterBar({ nodes, index, filter, onChange }: Pick<{
  nodes: readonly SurveyNodeV3[]
  index: BuildingIndex
  filter: MapFilter
  onChange: (next: MapFilter) => void
  onlyFilter: boolean
  onToggleOnlyFilter: () => void
  showChanges: boolean
  onToggleShowChanges: () => void
  /** Counts since the last save while "show changes" is on. null: no save to compare with. undefined: off. */
  changeCounts: ChangeCounts | null | undefined
}, 'nodes' | 'index' | 'filter' | 'onChange'>) {
  const levelsByBuilding = useMemo(() => {
    const map = new Map<string, Set<number>>()
    for (const node of nodes) {
      if (node.scope !== 'indoor') continue
      for (const level of node.levels ?? []) {
        if (!map.has(level.building)) map.set(level.building, new Set())
        map.get(level.building)!.add(level.floor)
      }
    }
    return map
  }, [nodes])

  const selected = filter.selections.map((selection) => selection.building)
  // Keep codes from older survey data accessible even if absent from the current server list.
  const unknownBuildings = [...levelsByBuilding.keys()].filter((code) => !index.byCode.has(code))

  const toggleBuilding = (building: string) => {
    onChange({
      selections: selected.includes(building)
        ? filter.selections.filter((selection) => selection.building !== building)
        : [...filter.selections, { building, floor: null }],
    })
  }

  const setFloor = (building: string, floor: number | null) => {
    onChange({ selections: filter.selections.map((selection) => (selection.building === building ? { building, floor } : selection)) })
  }
  return { levelsByBuilding, selected, unknownBuildings, toggleBuilding, setFloor }
}
