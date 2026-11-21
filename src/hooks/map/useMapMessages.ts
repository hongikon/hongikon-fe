import { useCallback, useRef } from 'react'
import type { MapTapMessage } from './useMapSelection'

interface Options {
  postToMap: (msg: object) => void
  pickingLocation: boolean
  /** 경로 선택(회색 경로 탭)과 지도 탭 무시 판단. */
  handleRouteTap: (index: number) => void
  ignoresMapTap: (type: string, pickingLocation: boolean) => boolean
  /** 위치 고르기 모드의 화면 가운데 좌표. */
  handlePickerCenter: (msg: { lat: number; lng: number; buildingName?: string | null }) => void
  /** 근처 알림 테스트 위치(개발 도구)의 지도 가운데 좌표. */
  handleNearbyCenter: (at: { lat: number; lng: number }) => void
  reportMapAuthFailure: () => void
  /** 건물·제휴·제보·시설을 눌러 시트를 열고 닫는다. */
  handleSelectionTap: (msg: MapTapMessage) => unknown
  clearSelectedBuilding: () => void
}

/**
 * 지도 페이지가 보내는 메시지를 종류별 처리로 나누어 보낸다. 위에 있는 종류가 먼저 처리되고
 * 어느 것에도 안 걸리면 시트 열고 닫기로 간다. 옵션은 ref 로 읽어 반환하는 함수는 늘 같다.
 */
export function useMapMessages(options: Options) {
  const optionsRef = useRef(options)
  optionsRef.current = options
  return useCallback((event: { nativeEvent: { data: string } }) => {
    const o = optionsRef.current
    try {
      const msg = JSON.parse(event.nativeEvent.data)

      // 지도에서 회색(다른) 경로를 눌렀다(11-09) — 그 길로 바꾼다. 같은 손동작이 지도 탭으로도 들어와 건물 시트가 열렸으면 닫는다.
      if (msg.type === 'routeTap' && typeof msg.index === 'number') {
        o.handleRouteTap(msg.index)
        o.clearSelectedBuilding()
        o.postToMap({ type: 'selectBuilding', name: null })
        return
      }
      // 경로를 누른 손동작의 지도 탭, 경로를 보여 주는 동안의 건물 탭은 무시한다.
      if (o.ignoresMapTap(msg.type, o.pickingLocation)) {
        o.postToMap({ type: 'selectBuilding', name: null })
        return
      }

      // 위치 선택 모드 중 지도가 멈출 때마다 온다. 화면 중앙 좌표를 갱신한다.
      if (msg.type === 'pickerCenter') {
        o.handlePickerCenter(msg)
        return
      }
      // 근처 알림 테스트 위치(개발 도구): 지도 가운데 좌표.
      if (msg.type === 'nearbyTestCenter' && typeof msg.lat === 'number' && typeof msg.lng === 'number') {
        o.handleNearbyCenter({ lat: msg.lat, lng: msg.lng })
        return
      }
      if (msg.type === 'mapAuthFailure') {
        o.reportMapAuthFailure()
        return
      }
      // 시트 열고 닫기(건물·제휴·제보·시설을 누름).
      o.handleSelectionTap(msg)
    } catch {}
  }, [])
}
