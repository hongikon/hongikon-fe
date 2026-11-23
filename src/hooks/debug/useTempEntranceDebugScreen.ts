import { useMemo, useRef, useState } from 'react'
import type { NaverMapViewHandle } from '../../components/map/NaverMapView'
import { buildMapHTML } from '../../utils/map/mapHtml'
import { useMapData } from '../../lib/mapData'
import type { Props } from '../../screens/TempEntranceDebugScreen'

/** TempEntranceDebugScreen 의 상태·효과·핸들러. 화면 파일은 이 훅을 불러 그리기만 한다. */
export function useTempEntranceDebugScreen({ mode }: Pick<Props, 'mode'>) {
  const webViewRef = useRef<NaverMapViewHandle>(null)
  const [authFailed, setAuthFailed] = useState(false)
  // 디버그 오버레이는 건물(출입구)을 문서에 구워 넣는다. 지도 데이터를 받은 뒤에 지도를 띄운다.
  const { buildings, data, status, reload } = useMapData()
  const mapHTML = useMemo(() => buildMapHTML(buildings, mode), [buildings, mode])
  return { webViewRef, authFailed, setAuthFailed, data, status, reload, mapHTML }
}
