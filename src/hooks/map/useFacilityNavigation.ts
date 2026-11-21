import { useCallback, useEffect, useRef, useState } from 'react'
import { FOCUS_ZOOM } from '../../constants/map'
import type { Building, Facility, FacilityKind, MapLayer } from '../../types'

/** 건물 시트에서 시설 시트로 넘어오기 전 상태. 시설 시트의 '<'로 그 건물 시트와 칩으로 돌아간다. */
interface FacilityFrom {
  building: Building
  layer: MapLayer | null
  kind: FacilityKind | null
}

interface Options {
  postToMap: (msg: object) => void
  buildings: readonly Building[]
  /** 지금 칩 상태. 건물 시트에서 시설로 넘어갈 때 기억해 둔다. */
  layer: MapLayer | null
  facilityKind: FacilityKind | null
  setLayer: (layer: MapLayer | null) => void
  applyFacilityKind: (kind: FacilityKind | null) => void
  /** 학교 시설 갈래로 바꿔 그 종류 핀을 켠다. */
  showFacilityKind: (kind: FacilityKind) => void
  /** 지금 고른 건물·시설 시트(useMapSelection). */
  selectedBuilding: Building | null
  selectedFacilityBuilding: string | null
  setSelectedBuilding: (building: Building | null) => void
  setSelectedPartner: (partner: null) => void
  setSelectedReport: (report: null) => void
  setSelectedFacilityBuilding: (name: string | null) => void
  setSearchedFacility: (facility: Facility | null) => void
  /** 검색 창을 숨긴다. */
  hideSearch: () => void
}

/**
 * 학교 시설 시트 열기와, 건물 시트 ↔ 시설 시트 오가기('건물 안 시설' → '<'로 돌아가기·닫으면 들어오기 전 지도로).
 */
export function useFacilityNavigation(options: Options) {
  const optionsRef = useRef(options)
  optionsRef.current = options
  const { postToMap, buildings, layer, facilityKind, selectedBuilding, selectedFacilityBuilding } = options

  /**
   * 건물 시트에서 넘어온 시설 시트면 그 건물과 넘어오기 전 칩 상태를 기억한다. 시설 시트의 '<'로 그 건물 시트에 돌아간다(10-15 요청 —
   * 문헌관 → 프린터를 누르면 프린터 칩이 켜지며 시설 시트로 바뀌어, 문헌관 정보로 돌아갈 길이 없었다).
   */
  const [facilityFrom, setFacilityFrom] = useState<FacilityFrom | null>(null)

  /**
   * 검색이나 건물 시트에서 편의시설(교무처·프린터 등)을 골랐다. 편의시설 갈래로 바꿔 그 종류 핀을 켜고, 그 건물(실측 좌표가 있으면
   * 그 지점)로 카메라를 옮긴 뒤 시설 시트를 연다. 칩을 누를 때와 달리 카메라를 옮긴다 — 어디 있는지 찾으러 온 것이므로.
   * `facility` 가 있으면(검색) 시트에서 그 줄을 강조한다.
   */
  const openSheet = useCallback(
    (kind: FacilityKind, buildingName: string, facility: Facility | null) => {
      const o = optionsRef.current
      o.hideSearch()
      // 갈래 전환과 같은 정리: 학교 시설 갈래로 바꿔 그 종류 핀을 켜고, 제휴·제보 선택과 마커를 지운다.
      o.setSelectedPartner(null)
      o.setSelectedBuilding(null)
      // 제보는 갈래와 따로라 끄지 않는다(10-27). 열려 있던 제보 시트만 닫는다.
      o.setSelectedReport(null)
      o.showFacilityKind(kind)
      const building = o.buildings.find((b) => b.name === buildingName)
      const lat = facility?.lat ?? building?.lat
      const lng = facility?.lng ?? building?.lng
      // 핀을 직접 누를 때와 같은 배율·자리(FOCUS_ZOOM, 시트 위 가운데)로 간다. 전에는 ±70m 범위 맞춤(fitBounds)이라
      // 화면 크기에 따라 한두 단계 덜 확대돼, 직접 누를 때(19)와 배율이 달랐다(10-14). 'focusReport' 는 이름과 달리
      // 좌표로 가는 일반 이동이다 — 배포된 지도 페이지에 이미 있는 메시지라 페이지를 다시 올리지 않아도 된다.
      // 검색으로 찾아왔을 때만 확대한다. 건물 시트에서 '건물 안 시설'을 누른 것은 핀을 누를 때처럼 지금 배율로 가운데만 옮긴다(10-27).
      if (lat !== undefined && lng !== undefined) {
        o.postToMap({ type: 'focusReport', lat, lng, ...(facility ? { zoom: FOCUS_ZOOM } : {}) })
      }
      o.setSelectedFacilityBuilding(buildingName)
      o.setSearchedFacility(facility)
    },
    [],
  )

  /** 건물 시트의 '건물 안 시설' 줄을 눌렀다. 검색과 같은 길로 그 종류 핀을 켜고 이 건물의 시설 시트를 연다(강조할 줄은 없음). */
  const openFromBuilding = useCallback(
    (kind: FacilityKind) => {
      if (!selectedBuilding) return
      const from = { building: selectedBuilding, layer, kind: facilityKind }
      openSheet(kind, selectedBuilding.name, null)
      setFacilityFrom(from)
    },
    [selectedBuilding, layer, facilityKind, openSheet],
  )

  // 시설 시트가 닫히거나 다른 건물·검색으로 바뀌면 돌아갈 곳을 잊는다.
  useEffect(() => {
    if (facilityFrom && selectedFacilityBuilding !== facilityFrom.building.name) setFacilityFrom(null)
  }, [facilityFrom, selectedFacilityBuilding])

  /** 시설 시트의 '<': 넘어오기 전 칩으로 되돌리고 그 건물 시트로 돌아간다. */
  const backToBuilding = useCallback(() => {
    const from = facilityFrom
    if (!from) return
    const o = optionsRef.current
    setFacilityFrom(null)
    o.setSearchedFacility(null)
    // 넘어오기 전 칩으로 되돌린다(같은 종류면 그대로 두고 시트만 닫는다). 제휴·제보에서 왔으면 그 갈래 칩만 다시 보인다.
    if (from.kind !== facilityKind) o.applyFacilityKind(from.kind)
    else o.setSelectedFacilityBuilding(null)
    o.setLayer(from.layer)
    o.setSelectedBuilding(from.building)
    postToMap({ type: 'selectBuilding', name: from.building.name })
  }, [facilityFrom, facilityKind, postToMap])

  /**
   * 건물 시트에서 '건물 안 시설'(예: 스터디룸)로 들어간 시설 시트를 지도 빈 곳이나 X 로 닫았다(11-08 요청).
   * 사용자는 그 건물을 보던 중이었지 캠퍼스 전체의 스터디룸을 보려던 게 아니므로, 그 때문에 켜진 칩·핀을 거두고
   * 들어오기 전 지도(보통 아무것도 고르지 않은 지도)로 돌아간다. 칩을 직접 눌러 켠 핀은 지금처럼 남는다.
   * 그렇게 연 시트가 아니면 false.
   */
  const leave = useCallback((): boolean => {
    const from = facilityFrom
    if (!from) return false
    const o = optionsRef.current
    setFacilityFrom(null)
    o.setSearchedFacility(null)
    // 같은 종류 칩을 이미 켜 두고 들어왔으면 그 핀은 남기고 시트만 닫는다.
    if (from.kind !== facilityKind) o.applyFacilityKind(from.kind)
    else o.setSelectedFacilityBuilding(null)
    o.setLayer(from.layer)
    return true
  }, [facilityFrom, facilityKind])

  /** 시설 시트 닫기: 건물 시트에서 들어왔으면 그 건물 시트로 돌아가고, 아니면 닫는다. */
  const closeSheet = useCallback(() => {
    if (!leave()) optionsRef.current.setSelectedFacilityBuilding(null)
  }, [leave])

  /** 검색 결과·물어보기에서 고른 시설 줄로 시설 시트를 연다. */
  const openFacility = useCallback((facility: Facility) => openSheet(facility.kind, facility.buildingName, facility), [openSheet])

  return { facilityFrom, openSheet, openFacility, openFromBuilding, backToBuilding, leave, closeSheet }
}
