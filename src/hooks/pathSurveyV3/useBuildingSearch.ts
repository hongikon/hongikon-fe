import { useMemo, useState } from 'react'
import { searchBuildings, type BuildingIndex } from '../../utils/pathSurveyV3/buildings'

/** State, effects and handlers of BuildingSearch. The screen file only renders. */
export function useBuildingSearch({ index, exclude = [] }: Pick<{
  index: BuildingIndex
  onPick: (code: string) => void
  exclude?: readonly string[]
  selected?: string | readonly string[] | null
}, 'index' | 'exclude'>) {
  const [query, setQuery] = useState('')
  const results = useMemo(() => searchBuildings(index, query).filter((b) => !exclude.includes(b.code)), [index, query, exclude])
  return { query, setQuery, results }
}
