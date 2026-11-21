import { useMemo } from 'react'
import { VISIBLE_FACILITY_KINDS } from '../../constants/facilityKinds'
import { facilityCount } from '../../utils/map/facilities'
import { useMapData } from '../../lib/mapData'
import { useChipRowScrollStyle } from '../../components/map/chipStyles'
import type { MapFilterChipsProps } from '../../components/map/MapFilterChips'

/** MapFilterChips 의 상태·효과·핸들러. 화면 파일은 이 훅을 불러 그리기만 한다. */
export function useMapFilterChips() {
  const rowScroll = useChipRowScrollStyle()
  // 아직 데이터가 하나도 없는 종류(정수기·학생처 등)는 칩을 숨긴다. 눌러도 빈 지도와 "0곳"만 보였다.
  // 지도 데이터를 아직 못 받았으면 칩 대신 안내 한 줄만 둔다(지도 위 안내와 같은 상태).
  const { facilities, data } = useMapData()
  const facilityCounts = useMemo(
    () =>
      VISIBLE_FACILITY_KINDS.map((meta) => ({ meta, count: facilityCount(facilities, meta.key) })).filter(
        ({ count }) => count > 0,
      ),
    [facilities],
  )
  return { rowScroll, data, facilityCounts }
}
