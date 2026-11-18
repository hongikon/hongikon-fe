import { useCallback, useMemo, useRef, useState, type RefObject } from 'react'
import type { NaverMapViewHandle } from '../../components/map/NaverMapView'
import type { Building, Exhibition, Facility, FacilityKind, MapLayer, Partner, PartnerAffiliation, PartnerCategory } from '../../types'
import { withExhibitionHints } from '../../utils/exhibitions'
import { facilityMarkers } from '../../utils/facilities'
import { CAMPUS_VIEW_BOX, viewBoundsScript } from '../../utils/mapBounds'
import { toMarker } from '../../utils/partnerMarker'
import { filterPartners, hasActiveFilter, type PartnerFilter } from '../../utils/partners'

interface Options {
  webViewRef: RefObject<NaverMapViewHandle | null>
  postToMap: (msg: object) => void
  partners: readonly Partner[]
  facilities: readonly Facility[]
  buildings: readonly Building[]
  exhibitions: readonly Exhibition[]
  /** 필터 없이 검색으로만 지도에 올린 업체 id(칩을 고르면 비운다). */
  searchedPartnerIdRef: RefObject<string | null>
  /** 먼 제휴 지점 둘레로 이동 범위를 좁혀 둔 업체 id(칩을 고르면 캠퍼스로 되돌린다). */
  farViewPartnerIdRef: RefObject<string | null>
  /** 제휴 칩을 바꿨을 때(제휴 시트를 닫는 등). active: 걸린 칩이 남아 있는지. */
  onPartnerFilterChange?: (active: boolean) => void
  /** 시설 종류가 바뀌었을 때(시설 시트·검색 강조를 닫는 등). */
  onFacilityKindChange?: () => void
  /** 맨 위 갈래를 바꿨을 때(열린 시트를 닫는 등). */
  onLayerChange?: () => void
}

/**
 * 지도 칩 거르기: 맨 위 갈래(제휴 업체 / 학교 시설), 제휴 2단(소속·업종), 학교 시설 종류. 칩을 눌러도 카메라는 옮기지 않는다
 * (10-09 요청 — 네이버·카카오 지도처럼 보던 자리를 지킨다). 같은 칩을 다시 누르면 그 단계만 해제한다.
 */
export function useMapFilters({
  webViewRef,
  postToMap,
  partners,
  facilities,
  buildings,
  exhibitions,
  searchedPartnerIdRef,
  farViewPartnerIdRef,
  ...callbacks
}: Options) {
  const callbacksRef = useRef(callbacks)
  callbacksRef.current = callbacks

  // 최상단 갈래. null 이면 하위 칩 줄이 없다. 제보는 이 갈래와 따로 켜고 끈다(10-27).
  const [layer, setLayer] = useState<MapLayer | null>(null)
  const [facilityKind, setFacilityKind] = useState<FacilityKind | null>(null)
  // 1단(소속) · 2단(업종). 둘 다 null 이면 지도에 제휴 마커를 그리지 않는다.
  const [selectedAffiliation, setSelectedAffiliation] = useState<PartnerAffiliation | null>(null)
  const [selectedCategory, setSelectedCategory] = useState<PartnerCategory | null>(null)
  const activeFilter = useMemo<PartnerFilter>(
    () => ({ affiliation: selectedAffiliation, category: selectedCategory }),
    [selectedAffiliation, selectedCategory],
  )

  /** 두 단계를 합쳐 제휴 마커를 다시 그린다. 어느 칩 줄을 눌렀든 여기로 모인다. */
  const applyFilter = useCallback(
    (filter: PartnerFilter) => {
      searchedPartnerIdRef.current = null
      const active = hasActiveFilter(filter)
      callbacksRef.current.onPartnerFilterChange?.(active)
      if (!active) {
        postToMap({ type: 'clearPartners' })
        return
      }
      // 먼 제휴 지점을 보던 중이면 이동 범위를 먼저 캠퍼스로 되돌린다. 좁은 범위에 갇혀 칩 결과를 둘러볼 수 없다.
      if (farViewPartnerIdRef.current !== null) {
        farViewPartnerIdRef.current = null
        webViewRef.current?.injectJavaScript(viewBoundsScript(CAMPUS_VIEW_BOX))
      }
      postToMap({ type: 'setPartners', partners: filterPartners(partners, filter).map(toMarker), bounds: null })
    },
    [partners, postToMap, searchedPartnerIdRef, farViewPartnerIdRef, webViewRef],
  )

  const selectAffiliation = useCallback(
    (affiliation: PartnerAffiliation) => {
      const next = selectedAffiliation === affiliation ? null : affiliation
      setSelectedAffiliation(next)
      applyFilter({ affiliation: next, category: selectedCategory })
    },
    [selectedAffiliation, selectedCategory, applyFilter],
  )
  const selectCategory = useCallback(
    (category: PartnerCategory) => {
      const next = selectedCategory === category ? null : category
      setSelectedCategory(next)
      applyFilter({ affiliation: selectedAffiliation, category: next })
    },
    [selectedAffiliation, selectedCategory, applyFilter],
  )
  /** 제휴 칩을 모두 푼다(마커는 그대로 — 부르는 쪽이 새로 그린다). */
  const clearPartnerFilter = useCallback(() => {
    setSelectedAffiliation(null)
    setSelectedCategory(null)
  }, [])

  /** 학교 시설 종류 핀을 지도에 올린다. null 이면 모두 지운다. */
  const applyFacilityKind = useCallback(
    (next: FacilityKind | null) => {
      setFacilityKind(next)
      callbacksRef.current.onFacilityKindChange?.()
      if (next === null) {
        postToMap({ type: 'clearFacilities' })
        return
      }
      const markers = withExhibitionHints(facilityMarkers(facilities, buildings, next), facilities, exhibitions)
      postToMap({ type: 'setFacilities', markers, bounds: null })
    },
    [facilities, buildings, exhibitions, postToMap],
  )
  const selectFacilityKind = useCallback(
    (kind: FacilityKind) => applyFacilityKind(facilityKind === kind ? null : kind),
    [facilityKind, applyFacilityKind],
  )

  /**
   * 맨 위 갈래. 바꾸면 반대편 선택과 마커를 모두 정리한다. 안 그러면 칩은 학교 시설인데 지도에는 제휴 마커가 떠 있는
   * 어긋난 상태가 된다.
   */
  const selectLayer = useCallback(
    (next: MapLayer) => {
      setLayer(layer === next ? null : next)
      callbacksRef.current.onLayerChange?.()
      setSelectedAffiliation(null)
      setSelectedCategory(null)
      postToMap({ type: 'clearPartners' })
      applyFacilityKind(null)
    },
    [layer, postToMap, applyFacilityKind],
  )

  /**
   * 검색·건물 시트에서 시설을 골랐을 때: 학교 시설 갈래로 바꾸고 그 종류 핀을 켠다(제휴 칩·마커는 지운다).
   * 갈래 전환과 같은 정리지만 시설 시트는 부르는 쪽이 바로 연다.
   */
  const showFacilityKind = useCallback(
    (kind: FacilityKind) => {
      setLayer('편의시설')
      setSelectedAffiliation(null)
      setSelectedCategory(null)
      postToMap({ type: 'clearPartners' })
      setFacilityKind(kind)
      const markers = withExhibitionHints(facilityMarkers(facilities, buildings, kind), facilities, exhibitions)
      postToMap({ type: 'setFacilities', markers, bounds: null })
    },
    [facilities, buildings, exhibitions, postToMap],
  )

  return {
    layer,
    setLayer,
    facilityKind,
    selectedAffiliation,
    selectedCategory,
    activeFilter,
    selectAffiliation,
    selectCategory,
    clearPartnerFilter,
    applyFacilityKind,
    selectFacilityKind,
    selectLayer,
    showFacilityKind,
  }
}
