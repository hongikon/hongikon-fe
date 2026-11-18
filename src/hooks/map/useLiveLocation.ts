import { useCallback, useEffect, useRef, type Dispatch, type RefObject, type SetStateAction } from 'react'
import type { NaverMapViewHandle } from '../../components/map/NaverMapView'
import { watchLocation, type LivePosition } from '../../lib/nearbyPartners/platform'
import { haversineMeters } from '../../utils/geo'
import { filterAccuracy, filterFix, snapToRoute, type FilterState } from '../../utils/locationFilter'
import { myLocationScript } from '../../utils/myLocationScript'

/** 경로를 다시 계산하는 기준 위치는 이만큼 넘게 움직였을 때만 바꾼다(경로가 자꾸 바뀌지 않게). */
const ROUTE_ORIGIN_MOVE_METERS = 15

type RoutePoints = { isEstimate?: boolean; points: readonly { lat: number; lng: number }[] } | null | undefined

interface Options {
  /** 위치를 읽는 중인지(길찾기 중이거나 '내 위치 켜기', 앱이 화면에 떠 있을 때). 끄면 점을 지운다. */
  active: boolean
  webViewRef: RefObject<NaverMapViewHandle | null>
  /** 지금 고른 경로. 점이 경로에서 20m 안이면 경로선 위에 붙여 그린다(직선 어림 경로는 붙이지 않는다). */
  selectedRouteRef: RefObject<RoutePoints>
  /** 출발이 '내 위치'인지. 그럴 때만 경로 기준 위치(routeOrigin)를 따라 옮긴다. */
  trackRouteOrigin: boolean
  /** 경로 기준 위치를 바꾸는 함수(상태는 경로 계산과 같이 화면이 갖는다). */
  setRouteOrigin: Dispatch<SetStateAction<LivePosition | null>>
}

/**
 * 내 위치(지도 점)와 길찾기 기준 위치.
 *
 * GPS 값이 올 때마다 화면 상태를 바꾸면 지도 화면 전체가 다시 그려져서, 받은 위치는 ref 에만 두고 지도 페이지에 점만
 * 바로 그린다. 화면이 다시 그려지는 것은 경로 기준 위치(routeOrigin)가 15m 넘게 바뀔 때뿐이다.
 * 위치는 휴대폰 안에서만 쓰고 저장하거나 보내지 않는다(처리방침 11-09판).
 */
export function useLiveLocation({ active, webViewRef, selectedRouteRef, trackRouteOrigin, setRouteOrigin }: Options) {
  const filterRef = useRef<FilterState | null>(null)
  const positionRef = useRef<LivePosition | null>(null)
  /** 지도에 그린 점(경로에 붙인 뒤). 지도가 다시 뜨면 이걸 다시 그린다. */
  const shownRef = useRef<LivePosition | null>(null)
  const trackOriginRef = useRef(trackRouteOrigin)
  trackOriginRef.current = trackRouteOrigin

  /** 지금 위치를 (경로에 붙여) 지도에 그린다. 위치가 없으면 점을 지운다. */
  const redraw = useCallback(() => {
    const position = positionRef.current
    const route = selectedRouteRef.current
    const snapped = position && route && !route.isEstimate ? snapToRoute(position, route.points) : null
    const shown = position ? (snapped ? { ...position, ...snapped } : position) : null
    shownRef.current = shown
    webViewRef.current?.injectJavaScript(myLocationScript(shown))
  }, [selectedRouteRef, webViewRef])

  /** 새 위치를 쓴다(GPS 갱신, 또는 '내 위치' 버튼으로 한 번 잰 값). origin 이면 경로 기준 위치도 바로 바꾼다. */
  const setPosition = useCallback(
    (position: LivePosition, { origin = false }: { origin?: boolean } = {}) => {
      positionRef.current = position
      redraw()
      if (origin) {
        setRouteOrigin(position)
      } else if (trackOriginRef.current) {
        setRouteOrigin((prev) =>
          prev && haversineMeters(prev.lat, prev.lng, position.lat, position.lng) < ROUTE_ORIGIN_MOVE_METERS ? prev : position,
        )
      }
    },
    [redraw, setRouteOrigin],
  )

  useEffect(() => {
    if (!active) {
      filterRef.current = null
      positionRef.current = null
      redraw()
      return
    }
    let stop: (() => void) | null = null
    let cancelled = false
    void watchLocation((fix) => {
      const next = filterFix(filterRef.current, { ...fix, at: Date.now() })
      if (!next || next === filterRef.current) return // 오차가 커서 버린 값
      filterRef.current = next
      setPosition({ lat: next.lat, lng: next.lng, accuracy: filterAccuracy(next) })
    }).then((unsubscribe) => {
      if (cancelled) unsubscribe()
      else stop = unsubscribe
    })
    return () => {
      cancelled = true
      stop?.()
    }
  }, [active, redraw, setPosition])

  /** 지도가 다시 떴을 때: 점이 사라지고 가만히 있으면 새 위치가 오지 않으니 마지막 점을 다시 그린다(11-10). */
  const redrawShown = useCallback(() => {
    if (shownRef.current) webViewRef.current?.injectJavaScript(myLocationScript(shownRef.current))
  }, [webViewRef])

  return { setPosition, redraw, redrawShown }
}
