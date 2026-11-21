import { useCallback, useEffect, useRef, type Dispatch, type RefObject, type SetStateAction } from 'react'
import type { NaverMapViewHandle } from '../../components/map/NaverMapView'
import { FOCUS_ZOOM } from '../../constants/map'
import type { MapData } from '../../apis/mapData'
import type { Building, Exhibition, Facility, FacilityKind, Partner, ReportListItem } from '../../types'
import { farPointViewBox, isFarFromCampus, viewBoundsScript } from '../../utils/mapBounds'
import { mapBuildingPayload } from '../../utils/mapHtml'
import { overlayMarkerMessages } from '../../utils/map/mapSync'
import { toReportMarkers } from '../../utils/reports'
import { toMarker } from '../../utils/partnerMarker'
import { hasActiveFilter, type PartnerFilter } from '../../utils/partners'

interface Options {
  webViewRef: RefObject<NaverMapViewHandle | null>
  postToMap: (msg: object) => void
  /** 지도 데이터 원본. 새로 오면 페이지를 다시 그린다. 아직 없으면 null. */
  mapData: MapData | null
  partners: readonly Partner[]
  buildings: readonly Building[]
  facilities: readonly Facility[]
  exhibitions: readonly Exhibition[]
  activeFilter: PartnerFilter
  facilityKind: FacilityKind | null
  reportsOn: boolean
  /** 지도에 보이는 제보. 아직 못 받았으면 undefined. */
  reports: readonly ReportListItem[] | undefined
  routeDrawn: boolean
  routeDrawnRef: RefObject<boolean>
  selectedBuildingRef: RefObject<Building | null>
  selectedPartnerRef: RefObject<Partner | null>
  selectedReportRef: RefObject<ReportListItem | null>
  selectedFacilityBuildingRef: RefObject<string | null>
  searchedPartnerIdRef: RefObject<string | null>
  /** 먼 제휴 지점 둘레로 이동 범위를 좁혀 둔 업체 id. */
  farViewPartnerIdRef: RefObject<string | null>
  setSelectedBuilding: Dispatch<SetStateAction<Building | null>>
  setSelectedPartner: Dispatch<SetStateAction<Partner | null>>
  /** 캠퍼스로 카메라를 되돌린다(학사모와 같은 동작). */
  recenter: () => void
  /** 마커를 새로 받으면 풀리는 업체 선택을 목록에 있을 때 다시 건다. */
  reassertPartnerSelection: (partnersOnPage: readonly Partner[]) => void
  /** 내 위치 점을 다시 그린다. */
  redrawMyLocation: () => void
  /** 관리 탭 "지도에서 보기" 핀을 다시 찍는다. */
  repinPreview: () => void
  /** 위치 고르기 모드를 새 페이지에서 다시 켠다. */
  resyncPicker: () => void
}

/**
 * 지도 페이지와 앱 상태 맞추기. 페이지가 (다시) 준비되면 resync 로 지금 화면 상태를 다시 그리고, 경로 흐림 여부와
 * 지도 데이터 갱신도 페이지에 반영한다. 자주 바뀌는 입력은 모두 ref 로 읽어 resync 는 늘 같은 함수다.
 */
export function useMapPageSync(options: Options) {
  const latestRef = useRef(options)
  latestRef.current = options
  const { postToMap, routeDrawn, mapData } = options

  /**
   * 지도 페이지가 (다시) 준비됐을 때 지금 화면 상태를 다시 그린다. 첫 로딩이 늦거나 실패해 자동으로
   * 다시 불러오면 페이지가 새로 떠서, 그 사이 보낸 마커 명령이 사라지기 때문이다(NaverMapView 참고).
   */
  const resync = useCallback(() => {
    const o = latestRef.current
    const { postToMap } = o
    // 새로 뜬 페이지는 배포된 map.html 에 박힌 초기 위치로 시작해 지금 CAMPUS_CENTER 와 어긋날 수 있다.
    // 학사모(캠퍼스로 돌아가기)와 같은 위치로 먼저 맞춘다.
    o.recenter()
    // 새 페이지는 시트가 닫힌 줄 안다. 열려 있으면 다시 알린다(건물 탭을 시트 닫기로만 쓰게).
    postToMap({
      type: 'sheetOpen',
      open: !!(o.selectedReportRef.current || o.selectedPartnerRef.current || o.selectedFacilityBuildingRef.current),
    })
    // 고른 건물은 setBuildings 보다 먼저 알려 준다 — setBuildings 가 그 이름을 지키며 핀을 그린다.
    if (o.selectedBuildingRef.current) postToMap({ type: 'selectBuilding', name: o.selectedBuildingRef.current.name })
    // 지도 데이터가 있으면 새 페이지의 건물(구운 초기값)을 지금 데이터로 바꾼다. 없으면 구운 건물을 그대로 둔다.
    if (o.mapData) postToMap({ type: 'setBuildings', buildings: mapBuildingPayload(o.mapData.buildings) })
    // 먼 제휴 지점을 보던 중에 페이지가 다시 떴으면 그 지점 범위로 다시 옮긴다.
    const farPartner = o.selectedPartnerRef.current
    if (farPartner && isFarFromCampus(farPartner)) {
      o.farViewPartnerIdRef.current = farPartner.id
      o.webViewRef.current?.injectJavaScript(viewBoundsScript(farPointViewBox(farPartner)))
      postToMap({ type: 'setPartners', partners: [toMarker(farPartner)], bounds: null })
      postToMap({ type: 'focusPartner', id: farPartner.id, zoom: FOCUS_ZOOM })
    } else if (farPartner && !hasActiveFilter(o.activeFilter) && o.searchedPartnerIdRef.current === farPartner.id) {
      // 캠퍼스 근처 업체를 검색해 보던 중이었으면 그 마커를 다시 올린다(필터가 없어 아래에서 다시 그려지지 않는다).
      postToMap({ type: 'setPartners', partners: [toMarker(farPartner)], bounds: null })
      o.reassertPartnerSelection([farPartner])
      // 위 recenter 가 캠퍼스로 옮겼으니 먼 지점처럼 그 업체로 다시 가져온다(마커를 올린 뒤라야 찾는다).
      postToMap({ type: 'focusPartner', id: farPartner.id, zoom: FOCUS_ZOOM })
    }
    const { filteredPartners, partnersMessage, facilitiesMessage } = overlayMarkerMessages({
      partners: o.partners,
      buildings: o.buildings,
      facilities: o.facilities,
      exhibitions: o.exhibitions,
      activeFilter: o.activeFilter,
      facilityKind: o.facilityKind,
    })
    if (partnersMessage && filteredPartners) {
      postToMap(partnersMessage)
      o.reassertPartnerSelection(filteredPartners)
    }
    if (facilitiesMessage) postToMap(facilitiesMessage)
    if (o.reportsOn && o.reports !== undefined) postToMap({ type: 'setReports', markers: toReportMarkers(o.reports) })
    // 내 위치 점도 다시 그린다 — 지도가 다시 뜨면 점이 사라지고, 가만히 있으면 새 위치가 오지 않아 다시 그려지지 않았다(11-10).
    o.redrawMyLocation()
    // 새 페이지는 경로 흐림(칩 핀)을 모른다. 경로가 그려진 중이면 다시 켠다.
    if (o.routeDrawnRef.current) postToMap({ type: 'setRouteFocus', on: true })
    // 관리 탭 "지도에서 보기" 핀 — 지도가 뜨기 전에 보낸 명령은 사라지므로 다시 찍는다.
    o.repinPreview()
    // 지도가 늦게 뜬 사이 공유 링크·알림으로 연 제보가 있으면 그 자리로 다시 옮긴다.
    const opened = o.selectedReportRef.current
    if (opened) postToMap({ type: 'focusReport', lat: opened.lat, lng: opened.lng })
    // 위치를 고르던 중이면 새 페이지에서도 고르기 모드를 다시 켠다. 이전 페이지가 보낸 중앙 좌표는
    // 버리고 새 페이지가 다시 알려 줄 때까지 확인 버튼을 막는다.
    o.resyncPicker()
  }, [])

  // 경로가 그려진 동안 칩 핀을 흐리게, 길찾기를 끝내면 되돌린다(11-08).
  useEffect(() => {
    postToMap({ type: 'setRouteFocus', on: routeDrawn })
  }, [routeDrawn, postToMap])

  /**
   * 지도 데이터가 새로 오면(저장본 → 서버 최신, 관리자 수정 반영) 지도 페이지의 건물과, 켜 둔 제휴·편의시설 마커를
   * 다시 그린다. 카메라는 옮기지 않는다(bounds 없음) — 보던 자리를 잃지 않게.
   */
  const mapDataSyncedRef = useRef<typeof mapData>(null)
  useEffect(() => {
    if (!mapData || mapDataSyncedRef.current === mapData) return
    mapDataSyncedRef.current = mapData
    const o = latestRef.current
    postToMap({ type: 'setBuildings', buildings: mapBuildingPayload(mapData.buildings) })
    const { filteredPartners, partnersMessage, facilitiesMessage } = overlayMarkerMessages({
      partners: mapData.partners,
      buildings: mapData.buildings,
      facilities: mapData.facilities,
      exhibitions: mapData.exhibitions,
      activeFilter: o.activeFilter,
      facilityKind: o.facilityKind,
    })
    if (partnersMessage && filteredPartners) {
      postToMap(partnersMessage)
      o.reassertPartnerSelection(filteredPartners)
    }
    if (facilitiesMessage) postToMap(facilitiesMessage)
    // 고른 건물·업체 배너는 새 데이터의 같은 항목으로 바꾼다(없어졌으면 닫는다).
    o.setSelectedBuilding((prev) => (prev ? mapData.buildings.find((b) => b.name === prev.name) ?? null : prev))
    o.setSelectedPartner((prev) => (prev ? mapData.partners.find((p) => p.id === prev.id) ?? null : prev))
    // 지도 데이터가 바뀔 때만 돈다. 필터 상태가 바뀌는 경우는 각 핸들러가 이미 다시 그린다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mapData, postToMap])

  return resync
}
