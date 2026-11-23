import { useMemo, useState } from 'react'
import { toReportMarkers } from '../../utils/map/report/reports'
import { TIMES, REPORTS } from '../../utils/debug/tempChangesPreviewScreen'

/** ReportPinsSection 의 상태·효과·핸들러. 화면 파일은 이 훅을 불러 그리기만 한다. */
export function useReportPinsSection() {
  const [timeIndex, setTimeIndex] = useState(2)
  const now = TIMES[timeIndex].ms
  const markers = useMemo(() => toReportMarkers(REPORTS, now), [now])
  return { timeIndex, setTimeIndex, now, markers }
}
