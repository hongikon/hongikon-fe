import { useCallback, useEffect, useRef, useState, type RefObject } from 'react'
import { useIsAdmin } from '../../admin/AdminAccess'
import type { NaverMapViewHandle } from '../../components/map/NaverMapView'
import { applyNearbyTestLocation, getNearbyOverlay, nearbyAlertsAvailable } from '../../lib/nearbyPartners/background'
import { SHOW_DEVELOPER_TOOLS, testLocation } from '../../lib/nearbyPartners/debug'
import { nearbyOverlayScript } from '../../utils/nearbyOverlayScript'

type NearbySource = Parameters<typeof applyNearbyTestLocation>[1]
type LatLng = { lat: number; lng: number }

/** 지도 가운데 좌표를 지도 페이지에서 받아 오는 스크립트(답은 'nearbyTestCenter' 메시지로 온다). */
const REQUEST_CENTER_SCRIPT =
  'if (window.map && window.ReactNativeWebView) { var c = map.getCenter(); window.ReactNativeWebView.postMessage(JSON.stringify({ type: "nearbyTestCenter", lat: c.lat(), lng: c.lng() })); } true;'
/** 영역 보기를 켠 동안 다시 그리는 간격. */
const OVERLAY_REFRESH_MS = 4000

const testLabel = (at: LatLng) => `테스트 위치 ${at.lat.toFixed(5)}, ${at.lng.toFixed(5)}`

/**
 * 근처 제휴 알림 개발 도구(개발·현장 테스트 빌드, 운영 앱은 관리자 계정만 — 11-10).
 * - 영역 보기: 등록한 업체 인식 원과 '다시 고르기' 원을 지도에 그리고, 아래 안내 줄에 등록 상태를 적는다.
 * - 테스트 위치: 지도 가운데 십자를 맞춰 '여기로 정하기'를 누르면 그 좌표를 가짜 GPS 로 쓴다(근처 알림 판단만).
 *
 * @param webViewRef 지도 페이지(원 그리기·가운데 좌표 묻기)
 * @param source 테스트 위치를 바꿀 때 다시 판단하는 데 쓰는 지도 데이터(대상 업체·캠퍼스 건물·긴급 스위치). 최신 값을 ref 로 읽는다
 */
export function useNearbyDebugTools(webViewRef: RefObject<NaverMapViewHandle | null>, source: NearbySource) {
  const sourceRef = useRef(source)
  sourceRef.current = source
  const isAdmin = useIsAdmin()
  /** 개발 도구를 보일 수 있는 빌드·계정. 메뉴의 '내 위치 켜기'를 날짜 전에도 보이는 데도 쓴다. */
  const enabled = SHOW_DEVELOPER_TOOLS || isAdmin
  /** 지도 메뉴에 영역 보기·테스트 위치를 둘지(근처 알림을 쓸 수 있는 기기에서만). */
  const menuAvailable = enabled && nearbyAlertsAvailable()

  const [overlayOn, setOverlayOn] = useState(false)
  const [note, setNote] = useState<string | null>(null)
  /** 근처 알림이 아직 등록 전(설정에서 켜지 않음). 안내 줄에 설정으로 가는 버튼을 단다(11-09). */
  const [unregistered, setUnregistered] = useState(false)
  const [picking, setPicking] = useState(false)
  const [label, setLabel] = useState<string | null>(() => {
    const fake = testLocation()
    return fake ? testLabel(fake) : null
  })

  // 영역 보기: 켜 둔 동안 4초마다 다시 그린다. 끄면 지운다.
  useEffect(() => {
    if (!overlayOn) {
      webViewRef.current?.injectJavaScript(nearbyOverlayScript(null))
      return
    }
    let cancelled = false
    let focused = false
    const draw = async () => {
      const overlay = await getNearbyOverlay()
      if (cancelled) return
      // 링크(at=)로 바꾼 테스트 위치도 안내 줄에 보이게 그릴 때마다 다시 읽는다.
      const fake = testLocation()
      setLabel(fake ? testLabel(fake) : null)
      // 처음 그릴 때만 등록한 자리로 옮긴다(그 뒤에는 사용자가 지도를 움직일 수 있게).
      webViewRef.current?.injectJavaScript(nearbyOverlayScript(overlay, { focus: !focused && !!overlay }))
      if (overlay) focused = true
      setUnregistered(!overlay)
      setNote(
        overlay?.error
          ? `등록 실패(원은 계획만 표시): ${overlay.error}\n파란 원: 업체 인식 반경 · 점선: 다시 고르기 원 · 남색 점: 기준 위치`
          : overlay
          ? `등록 ${overlay.regions.length}곳 · 안에 있음 ${overlay.regions.filter((r) => r.inside).length}곳 · 다시 고르기 원 ${overlay.reselectMeters}m\n파란 원: 업체 인식 반경 · 주황: 알림 예약 · 점선: 다시 고르기 원 · 남색 점: 등록한 자리`
          : '아직 등록 전이에요. 근처 제휴 알림을 켜고 앱을 다시 열면 원이 보여요.',
      )
    }
    void draw()
    const id = setInterval(() => void draw(), OVERLAY_REFRESH_MS)
    return () => {
      cancelled = true
      clearInterval(id)
    }
  }, [overlayOn, webViewRef])

  const toggleOverlay = useCallback(() => setOverlayOn((v) => !v), [])
  const startPicking = useCallback(() => setPicking(true), [])
  const cancelPicking = useCallback(() => setPicking(false), [])
  /** '여기로 정하기': 지도 가운데 좌표를 물어본다. 답은 handleCenter 로 온다. */
  const requestCenter = useCallback(() => webViewRef.current?.injectJavaScript(REQUEST_CENTER_SCRIPT), [webViewRef])
  /** 지도 페이지가 알려 준 가운데 좌표를 테스트 위치로 정하고 영역 보기를 켠다. */
  const handleCenter = useCallback(
    (at: LatLng) => {
      setPicking(false)
      setOverlayOn(true)
      setLabel(testLabel(at))
      void applyNearbyTestLocation(at, sourceRef.current)
    },
    [sourceRef],
  )
  /** '실제 위치로': 테스트 위치를 지우고 실제 GPS 로 돌아간다. */
  const resetToRealLocation = useCallback(() => {
    setPicking(false)
    setLabel(null)
    void applyNearbyTestLocation(null, sourceRef.current)
  }, [sourceRef])

  return {
    enabled,
    menuAvailable,
    overlayOn,
    note,
    unregistered,
    label,
    picking,
    toggleOverlay,
    startPicking,
    cancelPicking,
    requestCenter,
    handleCenter,
    resetToRealLocation,
  }
}
