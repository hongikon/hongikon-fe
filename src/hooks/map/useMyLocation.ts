import { useCallback, useEffect, useRef, useState, type Dispatch, type RefObject, type SetStateAction } from 'react'
import { useIsFocused } from '@react-navigation/native'
import type { RouteAlternative } from '../../apis/routes'
import type { NaverMapViewHandle } from '../../components/map/NaverMapView'
import { SHOW_DEVELOPER_TOOLS as NEARBY_DEBUG_TOOLS } from '../../lib/nearbyPartners/debug'
import { locateOnce, type LivePosition } from '../../lib/nearbyPartners/platform'
import { notify } from '../../utils/common/dialog'
import { CAMPUS_VIEW_BOX, viewBoundsScript } from '../../utils/mapBounds'
import { useAppForeground } from '../common/useAppForeground'
import { useLiveLocation } from './useLiveLocation'

interface Options {
  webViewRef: RefObject<NaverMapViewHandle | null>
  /** 길찾기를 보는 중인지(길찾기 창이 열렸거나 경로가 지도에 있을 때). 이때만 '내 위치 켜기' 없이도 위치를 읽는다. */
  routeActive: boolean
  /** 지금 고른 경로(점을 경로선에 붙인다). */
  selectedRouteRef: RefObject<{ isEstimate?: boolean; points: readonly { lat: number; lng: number }[] } | null | undefined>
  /** 후보 길과 고른 번호. 바뀌면 점을 새 경로선에 다시 붙인다. */
  alternatives: readonly RouteAlternative[]
  selectedIndex: number
  /** 출발이 '내 위치'인지. */
  fromMyLocation: boolean
  setRouteOrigin: Dispatch<SetStateAction<LivePosition | null>>
  /** 출발지를 내 위치로 바꾼다(길찾기 훅). */
  startRouteFromMyLocation: () => void
  /** 지금 지도 이동 범위가 먼 제휴 지점 둘레면 그 지점 id. 내 위치로 옮길 때 캠퍼스 일대로 되돌린다. */
  farViewPartnerIdRef: RefObject<string | null>
}

/**
 * 내 위치: 지도 메뉴의 "내 위치 켜기"(11-06)와 길찾기 출발지 "내 위치". 위치를 읽을지(앱이 떠 있고, 길찾기 중이거나 켜 둔 동안)를
 * 정해 useLiveLocation 에 넘기고, 권한 안내·캠퍼스 밖 안내를 띄운다. 길찾기와 같이 휴대폰 안에서만 쓰고 저장하거나 보내지 않는다.
 */
export function useMyLocation({
  webViewRef,
  routeActive,
  selectedRouteRef,
  alternatives,
  selectedIndex,
  fromMyLocation,
  setRouteOrigin,
  startRouteFromMyLocation,
  farViewPartnerIdRef,
}: Options) {
  const startRouteFromMyLocationRef = useRef(startRouteFromMyLocation)
  startRouteFromMyLocationRef.current = startRouteFromMyLocation

  // 테스트 앱(현장 테스트·개발 빌드)은 근처 알림을 실제 위치로 확인하려고 지도에 내 위치를 늘 보여 준다(11-03 운영진 요청).
  // 운영 앱은 길찾기를 볼 때만 위치를 읽는다(처리방침 11-09판).
  // 앱이 화면에 떠 있을 때만 읽는다 — 내리면 바로 멈춰 위치 표시(다이나믹 아일랜드)가 남지 않게(11-03).
  const appForeground = useAppForeground()
  // 테스트 앱은 켠 채로 시작한다(11-03 운영진 요청). 다만 '내 위치 끄기'를 누르면 정말 끈다 — 전에는 테스트 앱이면
  // 메뉴와 상관없이 늘 위치를 읽어 끄기가 먹지 않았다(11-09 버그). 직접 끈 뒤에는 지도 탭에 돌아와도 다시 켜지 않는다.
  const [on, setOn] = useState(NEARBY_DEBUG_TOOLS)
  const userOffRef = useRef(false)
  const mapFocused = useIsFocused()
  useEffect(() => {
    if (!mapFocused) setOn(false)
    else if (NEARBY_DEBUG_TOOLS && !userOffRef.current) setOn(true)
  }, [mapFocused])
  const active = appForeground && (routeActive || (on && mapFocused))
  // 내 위치 점: GPS 값마다 지도에 점만 그리고 화면은 다시 그리지 않는다(useLiveLocation).
  const liveLocation = useLiveLocation({
    active,
    webViewRef,
    selectedRouteRef,
    trackRouteOrigin: fromMyLocation,
    setRouteOrigin,
  })
  // 고른 경로가 바뀌면 점을 새 경로선에 다시 붙인다.
  const redrawLiveLocation = liveLocation.redraw
  useEffect(() => {
    redrawLiveLocation()
  }, [alternatives, selectedIndex, redrawLiveLocation])

  const { setPosition } = liveLocation

  /** 출발지 "내 위치". 이때 처음으로 "앱 사용 중" 위치 권한을 묻는다. */
  const selectForRoute = useCallback(async () => {
    const located = await locateOnce('route')
    if (located.status === 'declined') return
    if (located.status === 'ok') {
      const first = { lat: located.lat, lng: located.lng, accuracy: located.accuracy }
      setPosition(first, { origin: true })
      startRouteFromMyLocationRef.current()
      return
    }
    if (located.status === 'denied') {
      notify('위치를 쓸 수 없어요', "휴대폰 설정에서 홍익온의 위치 권한을 '앱을 사용하는 동안'으로 바꾸면 내 위치에서 출발할 수 있어요.")
    } else if (located.status === 'servicesOff') {
      notify('위치 서비스가 꺼져 있어요', '휴대폰 설정에서 위치 서비스를 켜 주세요.')
    } else {
      notify('내 위치를 찾지 못했어요', '잠시 뒤 다시 해 보거나 건물을 골라 주세요.')
    }
  }, [setPosition])

  /**
   * 지도 메뉴 "내 위치 켜기". 처음 누를 때 "앱 사용 중" 위치 권한을 묻고, 켜져 있으면 끈다. 지도는 캠퍼스 일대만 움직일 수 있어
   * 그 밖이면 켜지 않는다. 캠퍼스 안일 때만 지도를 내 위치로 옮긴다(지도 그림 요청으로 드러나는 범위가 처음 화면과 같다).
   * 켜 둔 동안 지도 화면에서만 위치를 읽어 점을 보여 주고, 다시 누르거나 지도 탭을 떠나면 끈다(처리방침 "지도에서 '내 위치 켜기'를 누를 때").
   */
  const toggle = useCallback(async () => {
    if (on) {
      userOffRef.current = true
      setOn(false)
      return
    }
    userOffRef.current = false
    const located = await locateOnce('myLocation')
    if (located.status === 'declined') return
    if (located.status !== 'ok') {
      if (located.status === 'denied') {
        notify('위치를 쓸 수 없어요', "휴대폰 설정에서 홍익온의 위치 권한을 '앱을 사용하는 동안'으로 바꾸면 지도에서 내 위치를 볼 수 있어요.")
      } else if (located.status === 'servicesOff') {
        notify('위치 서비스가 꺼져 있어요', '휴대폰 설정에서 위치 서비스를 켜 주세요.')
      } else {
        notify('내 위치를 찾지 못했어요', '잠시 뒤 다시 해 보세요.')
      }
      return
    }
    const { south, north, west, east } = CAMPUS_VIEW_BOX
    if (located.lat < south || located.lat > north || located.lng < west || located.lng > east) {
      notify('지도 범위 밖에 있어요', '학교 근처에 오면 지도에서 내 위치를 볼 수 있어요.')
      return
    }
    setPosition({ lat: located.lat, lng: located.lng, accuracy: located.accuracy })
    setOn(true)
    farViewPartnerIdRef.current = null
    webViewRef.current?.injectJavaScript(viewBoundsScript(CAMPUS_VIEW_BOX))
    webViewRef.current?.injectJavaScript(
      `if (window.map && window.naver) { if (typeof window.cancelFocus === "function") window.cancelFocus(); map.panTo(new naver.maps.LatLng(${located.lat}, ${located.lng})); } true;`,
    )
  }, [on, setPosition, farViewPartnerIdRef, webViewRef])

  return { on, toggle, selectForRoute, redrawShown: liveLocation.redrawShown }
}
