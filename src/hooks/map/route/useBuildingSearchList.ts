import { useMemo } from 'react'
import type { Props } from '../../../components/map/route/BuildingSearchList'

/** BuildingSearchList 의 상태·효과·핸들러. 화면 파일은 이 훅을 불러 그리기만 한다. */
export function useBuildingSearchList({ query, buildings }: Pick<Props, 'query' | 'buildings'>) {
  const filtered = useMemo(() => {
    const q = query.trim()
    return q ? buildings.filter((b) => b.name.includes(q)) : buildings
  }, [buildings, query])
  return { filtered }
}
