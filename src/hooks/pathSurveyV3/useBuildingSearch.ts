import { useMemo, useState } from 'react'
import { searchBuildings, type BuildingIndex } from '../../utils/pathSurveyV3/buildings'

/** BuildingSearch 의 상태·효과·핸들러. 화면 파일은 이 훅을 불러 그리기만 한다. */
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
