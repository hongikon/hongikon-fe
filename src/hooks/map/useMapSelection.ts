import { useCallback, useEffect, useRef, useState, type RefObject } from 'react'
import { setOpenReport } from '../../lib/mapIntents'
import type { Building, Facility, Partner, ReportListItem } from '../../types'
import { hasActiveFilter, type PartnerFilter } from '../../utils/partners'

/** 지도 페이지가 보내는, 무언가를 누른 메시지(시트 열고 닫기). */
export type MapTapMessage =
  | { type: 'buildingTap'; name: string }
  | { type: 'partnerTap'; id: string }
  | { type: 'reportTap'; id: number }
  | { type: 'facilityTap'; buildingName?: string | null }
  | { type: 'reportLongPress'; lat: number; lng: number; buildingName?: string | null }
  | { type: 'sheetDismiss' }
  | { type: 'buildingDismiss' }
  | { type: 'partnerDismiss' }

interface Options {
  postToMap: (msg: object) => void
  buildings: readonly Building[]
  partners: readonly Partner[]
  /** 지도에 보이는 제보(누른 제보 찾기, 목록에서 빠진 제보 시트 닫기). 아직 못 받았으면 undefined. */
  reports: readonly ReportListItem[] | undefined
  activeFilter: PartnerFilter
  /** 필터 없이 검색으로만 지도에 올린 업체 id. 그 시트가 닫히면 마커도 거둔다. */
  searchedPartnerIdRef: RefObject<string | null>
  /** 지도를 길게 눌렀다(그 자리 제보 쓰기). 로그인 확인은 부르는 쪽이 한다. */
  onLongPress: (at: { lat: number; lng: number; buildingName: string | null }) => void
  /** 건물 시트 → '건물 안 시설'로 연 시설 시트를 정리한다(11-08). 그렇게 연 시트가 아니면 false. */
  onLeaveBuildingFacility: () => boolean
}

/**
 * 지도에서 고른 것(건물·제휴·제보·학교 시설)과 아래 시트. 시트는 모두 같은 자리(아래)에 겹쳐 그려져 한 번에 하나만 연다.
 * 지도 페이지의 누름 메시지(handleTap)를 받아 시트를 열고 닫고, 시트가 닫히면 페이지의 강조도 거둔다.
 */
export function useMapSelection({
  postToMap,
  buildings,
  partners,
  reports,
  activeFilter,
  searchedPartnerIdRef,
  ...callbacks
}: Options) {
  const callbacksRef = useRef(callbacks)
  callbacksRef.current = callbacks

  const [selectedBuilding, setSelectedBuilding] = useState<Building | null>(null)
  const [selectedPartner, setSelectedPartner] = useState<Partner | null>(null)
  const [selectedReport, setSelectedReport] = useState<ReportListItem | null>(null)
  /** 편의시설 핀을 누른 건물. 그 건물의 (지금 고른 종류) 시설이 몇 층 어디에 있는지 보여 준다. */
  const [selectedFacilityBuilding, setSelectedFacilityBuilding] = useState<string | null>(null)
  /** 검색으로 찾아간 편의시설. 그 시설 시트에서 해당 줄을 강조한다. 핀을 직접 누르거나 칩을 바꾸면 지운다. */
  const [searchedFacility, setSearchedFacility] = useState<Facility | null>(null)

  const selectedBuildingRef = useRef(selectedBuilding)
  selectedBuildingRef.current = selectedBuilding
  const selectedPartnerRef = useRef(selectedPartner)
  selectedPartnerRef.current = selectedPartner
  const selectedReportRef = useRef(selectedReport)
  selectedReportRef.current = selectedReport
  const selectedFacilityBuildingRef = useRef(selectedFacilityBuilding)
  selectedFacilityBuildingRef.current = selectedFacilityBuilding
  /** 제보를 연 시각. 같은 손동작으로 뒤따르는 건물 탭을 거른다. */
  const reportOpenedAtRef = useRef(0)

  /**
   * 건물 시트가 닫히면 지도 페이지의 건물 강조도 거둔다. 앱 쪽 상태만 비우면 페이지에는 전에 누른 건물 핀이 선택된 채 남아,
   * 다른 제보를 보는 중에도 그 건물이 눌린 것처럼 보였다.
   */
  const prevBuildingRef = useRef<Building | null>(null)
  useEffect(() => {
    const prev = prevBuildingRef.current
    prevBuildingRef.current = selectedBuilding
    if (prev !== null && selectedBuilding === null) postToMap({ type: 'selectBuilding', name: null })
  }, [selectedBuilding, postToMap])

  /**
   * 업체 시트가 닫히면 페이지의 업체 강조도 거둔다. 필터 없이 검색으로만 올린 마커였으면 시트와 함께 마커도 내린다 —
   * 안 그러면 시트 없이 핀 하나만 지도에 남는다. 필터가 켜져 있으면 마커는 그대로 둔다.
   */
  const prevPartnerRef = useRef<Partner | null>(null)
  useEffect(() => {
    const prev = prevPartnerRef.current
    prevPartnerRef.current = selectedPartner
    if (prev === null || selectedPartner !== null) return
    if (!hasActiveFilter(activeFilter) && searchedPartnerIdRef.current !== null) {
      searchedPartnerIdRef.current = null
      postToMap({ type: 'clearPartners' })
      return
    }
    postToMap({ type: 'selectPartner', id: null })
  }, [selectedPartner, activeFilter, postToMap, searchedPartnerIdRef])

  /**
   * 제휴·편의시설·제보 시트가 열려 있는지 페이지에 알린다. 열린 채 건물을 누르면 페이지가 건물로 날아가 확대하지 않고
   * 시트 닫기로만 쓰게 한다(sheetDismiss).
   */
  const otherSheetOpen = selectedReport !== null || selectedPartner !== null || selectedFacilityBuilding !== null
  useEffect(() => {
    postToMap({ type: 'sheetOpen', open: otherSheetOpen })
  }, [otherSheetOpen, postToMap])

  /**
   * 제보 시트가 열려 있는 동안엔 건물 핀이 지도에 남지 않게 한다. 다음 프레임에도 한 번 더 보내 페이지가 뒤늦게 켠 핀까지 지운다.
   * 지금 열린 제보는 알려 둔다 — 게스트가 로그인 안내로 떠났다 돌아오면 이 제보를 다시 띄운다(lib/mapIntents).
   */
  const selectedReportId = selectedReport?.id ?? null
  useEffect(() => {
    setOpenReport(selectedReportId)
  }, [selectedReportId])
  useEffect(() => {
    if (selectedReportId === null) return
    reportOpenedAtRef.current = Date.now()
    postToMap({ type: 'selectBuilding', name: null })
    const timer = setTimeout(() => postToMap({ type: 'selectBuilding', name: null }), 120)
    return () => clearTimeout(timer)
  }, [selectedReportId, postToMap])

  /** 열린 제보가 지도 목록에서 빠지면(반려·숨김·끝남) 시트를 닫는다. 목록을 새로 받은 뒤에만 비교한다. */
  useEffect(() => {
    const current = selectedReportRef.current
    if (!current || reports === undefined) return
    if (!reports.some((r) => r.id === current.id)) setSelectedReport(null)
  }, [reports])

  /** 지도 페이지가 마커를 새로 받으면(setPartners) 선택이 풀린다. 고른 업체가 그 목록에 아직 있으면 다시 강조한다. */
  const reassertPartnerSelection = useCallback(
    (partnersOnPage: readonly Partner[]) => {
      const current = selectedPartnerRef.current
      if (current && partnersOnPage.some((p) => p.id === current.id)) postToMap({ type: 'selectPartner', id: current.id })
    },
    [postToMap],
  )

  /** 제보 시트를 연다. 건물·업체·편의시설 시트는 닫는다. */
  const openReport = useCallback((report: ReportListItem | null) => {
    setSelectedBuilding(null)
    setSelectedFacilityBuilding(null)
    setSelectedPartner(null)
    setSelectedReport(report)
    // 같은 손동작으로 바로 뒤따르는 건물 탭이 렌더 전에 와도 '방금 제보를 열었다'를 알 수 있게 바로 적어 둔다.
    if (report) {
      selectedReportRef.current = report
      reportOpenedAtRef.current = Date.now()
    }
  }, [])

  /** 시트를 모두 닫는다(건물·제휴·제보·시설). */
  const closeSheets = useCallback(() => {
    setSelectedBuilding(null)
    setSelectedPartner(null)
    setSelectedReport(null)
    setSelectedFacilityBuilding(null)
  }, [])

  /** 지도 페이지의 누름 메시지. 처리했으면 true. */
  const handleTap = useCallback(
    (msg: MapTapMessage): boolean => {
      switch (msg.type) {
        case 'buildingTap': {
          // 제보를 연 바로 그 손동작이 건물 탭으로도 들어온 것 — 제보 시트는 두고 건물 핀만 거둔다.
          if (selectedReportRef.current && Date.now() - reportOpenedAtRef.current < 400) {
            postToMap({ type: 'selectBuilding', name: null })
            return true
          }
          // 제보·제휴·편의시설 시트가 열린 채 지도를 누르면 그 탭은 '시트 닫기'로만 쓴다. 건물을 보려면 한 번 더 누른다.
          if (selectedReportRef.current || selectedPartnerRef.current || selectedFacilityBuildingRef.current) {
            setSelectedReport(null)
            setSelectedPartner(null)
            setSelectedFacilityBuilding(null)
            postToMap({ type: 'selectBuilding', name: null })
            return true
          }
          const building = buildings.find((b) => b.name === msg.name) ?? null
          setSelectedPartner(null)
          setSelectedFacilityBuilding(null)
          setSelectedReport(null)
          setSelectedBuilding(building)
          // 앱 데이터에 없는 건물이면 시트가 안 뜬다. 페이지에 핀만 남지 않게 강조도 거둔다.
          if (!building) postToMap({ type: 'selectBuilding', name: null })
          return true
        }
        case 'partnerTap': {
          const partner = partners.find((p) => p.id === msg.id) ?? null
          setSelectedBuilding(null)
          setSelectedFacilityBuilding(null)
          setSelectedReport(null)
          setSelectedPartner(partner)
          if (!partner) postToMap({ type: 'selectPartner', id: null })
          return true
        }
        case 'reportTap':
          openReport(reports?.find((r) => r.id === msg.id) ?? null)
          return true
        // 지도를 길게 누르면 그 자리에 제보를 남기는 작성창이 열린다(좌표는 원본, 건물명은 참고용).
        case 'reportLongPress':
          callbacksRef.current.onLongPress({ lat: msg.lat, lng: msg.lng, buildingName: msg.buildingName ?? null })
          return true
        // 학교 시설 핀: 그 시설이 몇 층 어디에 있는지 보여 준다(FacilitySheet).
        case 'facilityTap':
          setSearchedFacility(null)
          setSelectedPartner(null)
          setSelectedBuilding(null)
          setSelectedReport(null)
          setSelectedFacilityBuilding(msg.buildingName ?? null)
          return true
        // 제휴·편의시설·제보 시트가 열린 채 건물을 눌렀다. 그 탭은 시트 닫기로만 쓴다.
        case 'sheetDismiss':
          // 건물에서 들어간 시설 시트면 그 시설 핀까지 거둬 들어오기 전 지도로 돌아간다(11-08).
          callbacksRef.current.onLeaveBuildingFacility()
          setSelectedReport(null)
          setSelectedPartner(null)
          setSelectedFacilityBuilding(null)
          return true
        // 지도 빈 곳을 눌렀다. 열린 시트를 모두 내린다(제보 시트 포함).
        case 'buildingDismiss':
          callbacksRef.current.onLeaveBuildingFacility()
          setSelectedBuilding(null)
          setSelectedFacilityBuilding(null)
          setSelectedReport(null)
          return true
        case 'partnerDismiss':
          setSelectedPartner(null)
          return true
        default:
          return false
      }
    },
    [buildings, partners, reports, postToMap, openReport],
  )

  return {
    selectedBuilding,
    setSelectedBuilding,
    selectedPartner,
    setSelectedPartner,
    selectedReport,
    setSelectedReport,
    selectedFacilityBuilding,
    setSelectedFacilityBuilding,
    searchedFacility,
    setSearchedFacility,
    selectedBuildingRef,
    selectedPartnerRef,
    selectedReportRef,
    selectedFacilityBuildingRef,
    openReport,
    closeSheets,
    reassertPartnerSelection,
    handleTap,
  }
}
