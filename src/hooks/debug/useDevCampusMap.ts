import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useWindowDimensions } from 'react-native'
import type { NaverMapViewHandle } from '../../components/map/NaverMapView'
import { buildMapHTML } from '../../utils/map/mapHtml'
import { facilityMarkers } from '../../utils/map/facilities'
import { FACILITY_KINDS } from '../../constants/facilityKinds'
import type { Building, FacilityKind } from '../../types'
import type { CampusPreviewData } from '../../debug/campusPreview'

/** DevCampusMap 의 상태·효과·핸들러. 화면 파일은 이 훅을 불러 그리기만 한다. */
export function useDevCampusMap({ data }: Pick<{ data: CampusPreviewData; path: string }, 'data'>) {
  const { buildings: BUILDINGS, facilities: FACILITIES, extras: EXTRAS, center: CENTER, officeDetails: OFFICE_DETAILS } = data
  const webViewRef = useRef<NaverMapViewHandle>(null)
  const mapHTML = useMemo(() => buildMapHTML(BUILDINGS), [BUILDINGS])
  const { width } = useWindowDimensions()
  const wide = width >= 900
  const [kind, setKind] = useState<FacilityKind | null>(null)
  const [selectedBuilding, setSelectedBuilding] = useState<Building | null>(null)
  const [facilityBuilding, setFacilityBuilding] = useState<string | null>(null)
  // 건물 시트에서 넘어온 시설 시트면 돌아갈 건물과 넘어오기 전 칩(앱의 지도 화면과 같은 동작).
  const [from, setFrom] = useState<{ building: Building; kind: FacilityKind | null } | null>(null)

  const post = useCallback((msg: object) => {
    webViewRef.current?.injectJavaScript(
      `if (typeof window.handleNativeMessage === "function") window.handleNativeMessage(${JSON.stringify(JSON.stringify(msg))});true;`,
    )
  }, [])

  const kinds = useMemo(
    () => FACILITY_KINDS.filter((k) => FACILITIES.some((f) => f.kind === k.key)),
    [FACILITIES],
  )

  const showKind = useCallback(
    (next: FacilityKind | null) => {
      setKind(next)
      if (next === null) post({ type: 'clearFacilities' })
      else post({ type: 'setFacilities', markers: facilityMarkers(FACILITIES, BUILDINGS, next), bounds: null })
    },
    [post, FACILITIES, BUILDINGS],
  )

  // 지도 페이지가 (다시) 준비되면 그 학교로 옮기고 지금 상태를 다시 그린다. 지도 페이지는 홍익대 범위로 묶여 있어 그 제한을 푼다.
  const onReady = useCallback(() => {
    webViewRef.current?.injectJavaScript(`(function(){
      if (typeof map === 'undefined' || !window.naver) return;
      map.setOptions({ minZoom: 10, maxBounds: null });
      map.setCenter(new naver.maps.LatLng(${CENTER.lat}, ${CENTER.lng})); map.setZoom(17);
    })(); true;`)
    if (kind) post({ type: 'setFacilities', markers: facilityMarkers(FACILITIES, BUILDINGS, kind), bounds: null })
  }, [kind, post, CENTER, FACILITIES, BUILDINGS])

  useEffect(() => {
    if (typeof document !== 'undefined') document.title = `${data.name} 시설 미리보기 | 홍익온`
  }, [data.name])

  const sheetOpen = facilityBuilding !== null
  useEffect(() => {
    post({ type: 'sheetOpen', open: sheetOpen })
  }, [sheetOpen, post])

  const onMessage = useCallback((event: { nativeEvent: { data: string } }) => {
    let msg: { type?: string; name?: string; buildingName?: string }
    try {
      msg = JSON.parse(event.nativeEvent.data)
    } catch {
      return
    }
    if (msg.type === 'buildingTap') {
      const b = BUILDINGS.find((x) => x.name === msg.name) ?? null
      setFacilityBuilding(null)
      setFrom(null)
      setSelectedBuilding(b)
    } else if (msg.type === 'facilityTap') {
      setSelectedBuilding(null)
      setFrom(null)
      setFacilityBuilding(msg.buildingName ?? null)
    } else if (msg.type === 'buildingDismiss' || msg.type === 'sheetDismiss') {
      setSelectedBuilding(null)
      setFacilityBuilding(null)
      setFrom(null)
    }
  }, [BUILDINGS])

  const openFromBuilding = (k: FacilityKind) => {
    if (!selectedBuilding) return
    setFrom({ building: selectedBuilding, kind })
    showKind(k)
    setFacilityBuilding(selectedBuilding.name)
    setSelectedBuilding(null)
    webViewRef.current?.injectJavaScript(
      `(function(){ if (typeof map === 'undefined') return; map.setZoom(19); map.setCenter(new naver.maps.LatLng(${selectedBuilding.lat}, ${selectedBuilding.lng})); })(); true;`,
    )
  }

  const backToBuilding = () => {
    if (!from) return
    showKind(from.kind)
    setFacilityBuilding(null)
    setSelectedBuilding(from.building)
    post({ type: 'selectBuilding', name: from.building.name })
    setFrom(null)
  }

  const closeBuilding = () => {
    setSelectedBuilding(null)
    post({ type: 'selectBuilding', name: null })
  }

  const buildingFacilities = selectedBuilding ? FACILITIES.filter((f) => f.buildingName === selectedBuilding.name) : []
  return {
    BUILDINGS,
    FACILITIES,
    EXTRAS,
    OFFICE_DETAILS,
    webViewRef,
    mapHTML,
    wide,
    kind,
    selectedBuilding,
    setSelectedBuilding,
    facilityBuilding,
    setFacilityBuilding,
    from,
    setFrom,
    kinds,
    showKind,
    onReady,
    onMessage,
    openFromBuilding,
    backToBuilding,
    closeBuilding,
    buildingFacilities,
  }
}
