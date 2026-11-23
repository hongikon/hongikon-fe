import { useCallback, useEffect, useState } from 'react'
import { readNearbyLog, type NearbyLogLine } from '../../../lib/nearbyPartners/debugLog'

/** NearbyDecisionLog 의 상태·효과·핸들러. 화면 파일은 이 훅을 불러 그리기만 한다. */
export function useNearbyDecisionLog({ visible }: Pick<{ visible: boolean }, 'visible'>) {
  const [lines, setLines] = useState<NearbyLogLine[]>([])
  const [expanded, setExpanded] = useState(false)
  const reload = useCallback(() => {
    void readNearbyLog().then(setLines)
  }, [])
  useEffect(() => {
    if (visible) reload()
  }, [visible, reload])
  const shown = expanded ? lines : lines.slice(0, 30)
  return { lines, setExpanded, reload, shown }
}
