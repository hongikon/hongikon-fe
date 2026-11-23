import { useState } from 'react'
import { sortHot } from '../../../apis/community'
import { useMapData } from '../../../lib/mapData'
import { EXPANDED, COLLAPSED } from '../../../utils/map/report/hotReportList'
import type { HotReportListProps } from '../../../components/map/report/HotReportList'

/** HotReportList 의 상태·효과·핸들러. 화면 파일은 이 훅을 불러 그리기만 한다. */
export function useHotReportList({ reports }: Pick<HotReportListProps, 'reports'>) {
  // 장소 문구(가까운 건물)는 지도 데이터의 건물로 찾는다. 아직 없으면 좌표 대신 학교 이름이 나온다.
  const { buildings } = useMapData()
  const [expanded, setExpanded] = useState(false)
  // 목록이 지도를 가린다는 의견(10-06) — 머리줄의 접기로 작은 'HOT 목록' 단추만 남기고, 누르면 다시 편다.
  const [folded, setFolded] = useState(false)
  const sorted = sortHot(reports)
  const shown = sorted.slice(0, expanded ? EXPANDED : COLLAPSED)
  const more = Math.min(sorted.length, EXPANDED) - shown.length
  return { buildings, expanded, setExpanded, folded, setFolded, sorted, shown, more }
}
