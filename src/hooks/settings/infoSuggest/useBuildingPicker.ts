import { useMemo, useState } from 'react'
import { useMapData } from '../../../lib/mapData'
import { filterBuildingNames } from '../../../utils/settings/infoSuggest'

/** BuildingPicker 의 상태·효과·핸들러. 화면 파일은 이 훅을 불러 그리기만 한다. */
export function useBuildingPicker({ value }: Pick<{
  value: string | null
  onChange: (name: string | null) => void
  invalid?: boolean
}, 'value'>) {
  const [query, setQuery] = useState('')
  // 건물 목록은 지도 데이터에서 온다. 아직 못 받았으면 칩이 비고, 검색창 아래 안내가 뜬다.
  const { buildings, data } = useMapData()
  const names = useMemo(
    () => filterBuildingNames(buildings.map((building) => building.name), query, value),
    [buildings, query, value],
  )
  return { query, setQuery, data, names }
}
