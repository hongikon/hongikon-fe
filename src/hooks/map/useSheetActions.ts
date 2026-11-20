import { useCallback, useMemo, useRef } from 'react'
import { nextRouteEndpoint } from '../../components/map/route/RouteEndpointButtons'
import type { Building, Facility, FacilityKind, ReportListItem } from '../../types'
import { reportRouteBuilding } from '../../utils/map/routePinBuilding'

interface Options {
  postToMap: (msg: object) => void
  buildings: readonly Building[]
  facilities: readonly Facility[]
  facilityKind: FacilityKind | null
  selectedBuilding: Building | null
  selectedFacilityBuilding: string | null
  /** 열린 제보 시트의 제보. 그 제보로 가는 출발·도착 버튼에 쓴다. */
  selectedReport: ReportListItem | null
  searchedFacility: Facility | null
  fromBuilding: Building | null
  fromMyLocation: boolean
  toBuilding: Building | null
  setSelectedBuilding: (building: Building | null) => void
  setSelectedPartner: (partner: null) => void
  setSelectedReport: (report: null) => void
  beginFrom: (building: Building) => void
  beginTo: (building: Building) => void
}

/**
 * 아래 시트(건물·제휴·시설·제보)에 넘기는 값과 버튼 처리: 각 시트가 보일 데이터, 출발·도착 버튼, 닫기.
 * 길찾기 쪽 함수(beginFrom/To)는 ref 로 읽어 호출하는 쪽이 고정하지 않아도 된다.
 */
export function useSheetActions(options: Options) {
  const latestRef = useRef(options)
  latestRef.current = options
  const { postToMap, buildings, facilities, facilityKind, selectedBuilding, selectedFacilityBuilding, searchedFacility } = options
  const { fromBuilding, fromMyLocation, toBuilding, setSelectedPartner, setSelectedReport } = options

  /** 건물 시트에 보일 그 건물의 시설. */
  const selectedBuildingFacilities = useMemo(
    () => (selectedBuilding ? facilities.filter((f) => f.buildingName === selectedBuilding.name) : []),
    [selectedBuilding, facilities],
  )
  /** 시설 시트에 보일 그 건물의 (지금 고른 종류) 시설. */
  const selectedFacilityItems = useMemo(
    () => facilities.filter((f) => f.kind === facilityKind && f.buildingName === selectedFacilityBuilding),
    [facilities, facilityKind, selectedFacilityBuilding],
  )
  /** 검색으로 찾아간 시설이 지금 시트의 것이면 그 줄을 강조한다. */
  const highlightedFacilityId =
    searchedFacility && searchedFacility.kind === facilityKind && searchedFacility.buildingName === selectedFacilityBuilding
      ? searchedFacility.id
      : null

  const handleSetFrom = useCallback(() => {
    const { selectedBuilding: building, beginFrom } = latestRef.current
    if (building) beginFrom(building)
  }, [])

  const handleSetTo = useCallback(() => {
    const { selectedBuilding: building, beginTo } = latestRef.current
    if (building) beginTo(building)
  }, [])

  /** 시설 시트의 출발·도착. 그 시설이 있는 건물로 정한다(11-08). 지도 데이터에 그 건물이 없으면 버튼을 그리지 않는다. */
  const facilitySheetBuilding = useMemo(
    () => (selectedFacilityBuilding ? (buildings.find((b) => b.name === selectedFacilityBuilding) ?? null) : null),
    [buildings, selectedFacilityBuilding],
  )

  const handleFacilitySetFrom = useCallback(() => {
    if (facilitySheetBuilding) latestRef.current.beginFrom(facilitySheetBuilding)
  }, [facilitySheetBuilding])

  const handleFacilitySetTo = useCallback(() => {
    if (facilitySheetBuilding) latestRef.current.beginTo(facilitySheetBuilding)
  }, [facilitySheetBuilding])

  /**
   * 제보 시트의 출발·도착. 제보가 있는 건물, 없으면 제보 위치에서 가까운(150m 안) 건물로 정한다 — 길은 서버가 건물끼리만
   * 계산한다. 그런 건물이 없으면 버튼을 그리지 않는다.
   */
  const selectedReport = options.selectedReport
  const reportSheetBuilding = useMemo(
    () => (selectedReport ? reportRouteBuilding(selectedReport, buildings) : null),
    [selectedReport, buildings],
  )

  const handleReportSetFrom = useCallback(() => {
    if (reportSheetBuilding) latestRef.current.beginFrom(reportSheetBuilding)
  }, [reportSheetBuilding])

  const handleReportSetTo = useCallback(() => {
    if (reportSheetBuilding) latestRef.current.beginTo(reportSheetBuilding)
  }, [reportSheetBuilding])

  /** 시트의 출발·도착 버튼 중 다음에 고를 쪽(건물 시트·시설 시트가 함께 쓴다). */
  const routeNext = nextRouteEndpoint(Boolean(fromBuilding || fromMyLocation), Boolean(toBuilding))

  const handleCloseBuilding = useCallback(() => {
    latestRef.current.setSelectedBuilding(null)
    // 배너만 닫고 핀은 그대로 둔다. 켜 둔 핀이 배너를 닫을 때마다 사라지면
    // 다시 켜야 해서 번거롭다. 강조 표시만 되돌린다.
    postToMap({ type: 'selectBuilding', name: null })
  }, [postToMap])

  const handleClosePartner = useCallback(() => {
    setSelectedPartner(null)
    postToMap({ type: 'selectPartner', id: null })
  }, [postToMap, setSelectedPartner])

  const handleCloseReportSheet = useCallback(() => setSelectedReport(null), [setSelectedReport])

  return {
    selectedBuildingFacilities,
    selectedFacilityItems,
    highlightedFacilityId,
    facilitySheetBuilding,
    routeNext,
    handleSetFrom,
    handleSetTo,
    handleFacilitySetFrom,
    handleFacilitySetTo,
    reportSheetBuilding,
    handleReportSetFrom,
    handleReportSetTo,
    handleCloseBuilding,
    handleClosePartner,
    handleCloseReportSheet,
  }
}
