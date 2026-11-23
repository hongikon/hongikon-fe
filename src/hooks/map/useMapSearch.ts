import { useCallback, useMemo, useRef, useState, type RefObject } from 'react'
import type { NaverMapViewHandle } from '../../components/map/NaverMapView'
import { CAMPUS_VIEW_BOX, farPointViewBox, isFarFromCampus, viewBoundsScript } from '../../utils/map/mapBounds'
import { FOCUS_ZOOM } from '../../constants/map'
import type { Partner } from '../../types'
import { toMarker } from '../../utils/map/partner/partnerMarker'
import { searchPinnedSection } from '../../utils/map/searchPinned'

interface Options {
  webViewRef: RefObject<NaverMapViewHandle | null>
  postToMap: (msg: object) => void
  /** 필터 없이 검색으로만 지도에 올린 업체 id. 그 시트가 닫히면 마커도 거둔다(useMapSelection). */
  searchedPartnerIdRef: RefObject<string | null>
  /** 지금 지도 이동 범위가 먼 제휴 지점 둘레면 그 지점 id, 캠퍼스 일대면 null. */
  farViewPartnerIdRef: RefObject<string | null>
  /** 제휴 칩 필터를 모두 푼다. */
  clearPartnerFilter: () => void
  /** 고른 업체의 시트를 연다(다른 시트는 닫는다). */
  openPartnerSheet: (partner: Partner) => void
}

/**
 * 제휴·편의시설 검색 창: 열고 닫기, 맨 위에 모아 보일 업체(안내 줄의 '지도에 안 보이는 곳'·근처 알림), 결과로 업체 고르기.
 */
export function useMapSearch({ webViewRef, postToMap, searchedPartnerIdRef, farViewPartnerIdRef, clearPartnerFilter, ...callbacks }: Options) {
  const callbacksRef = useRef(callbacks)
  callbacksRef.current = callbacks

  const [visible, setVisible] = useState(false)
  /** 안내 줄에서 검색을 열면 그 업체들을 검색 화면 맨 위에 모아 보여 준다. 검색창 버튼으로 열면 null. */
  const [pinned, setPinned] = useState<Partner[] | null>(null)
  /** 근처 제휴 알림(여러 곳)을 눌러 띄운 "지금 계신 곳 근처 제휴" 목록. 검색 창 맨 위에 둔다. */
  const [nearbyGroup, setNearbyGroup] = useState<Partner[] | null>(null)

  /** 검색바로 연 검색 창 — 안내 줄·근처 알림에서 모아 둔 업체 없이 연다. */
  const open = useCallback(() => {
    setPinned(null)
    setNearbyGroup(null)
    setVisible(true)
  }, [])
  const close = useCallback(() => {
    setVisible(false)
    setNearbyGroup(null)
  }, [])
  /** 창만 숨긴다(고른 뒤 다른 시트를 여는 길에서). 모아 둔 업체는 그대로 둔다. */
  const hide = useCallback(() => setVisible(false), [])
  /** '지도에 안 보이는 N곳 · 보기' — 그 업체들을 검색 창 맨 위에 모아 연다. */
  const showPinned = useCallback((partners: Partner[]) => {
    setNearbyGroup(null)
    setPinned(partners)
    setVisible(true)
  }, [])
  /** 근처 제휴 알림(여러 곳) — "지금 계신 곳 근처 제휴" 목록으로 연다. */
  const showNearbyGroup = useCallback((group: Partner[]) => {
    setPinned(null)
    setNearbyGroup(group)
    setVisible(true)
  }, [])

  /** 검색 창 맨 위에 모아 보일 업체: 근처 알림으로 연 곳들, 또는 안내 줄의 '지도에 안 보이는 곳'. */
  const pinnedSection = useMemo(() => searchPinnedSection(nearbyGroup, pinned), [nearbyGroup, pinned])

  /**
   * 검색 결과를 고르면 그 업체만 지도에 올리고 화면 가운데로 가져온다.
   * 칩 필터는 모두 해제한다. 검색 결과가 칩 조건에 안 맞으면
   * 칩은 켜져 있는데 다른 업체가 떠 있는 어긋난 상태가 되기 때문이다.
   */
  const selectPartner = useCallback(
    (partner: Partner) => {
      setVisible(false)
      clearPartnerFilter()
      callbacksRef.current.openPartnerSheet(partner)
      searchedPartnerIdRef.current = partner.id

      // 캠퍼스에서 먼 지점은 검색으로만 찾아간다 — 옮기기 전에 이동 범위를 그 지점 둘레로 바꾼다(캠퍼스 범위로는 못 간다).
      // 시트를 닫거나 다른 것을 고르면 지도 화면이 캠퍼스로 되돌린다.
      if (isFarFromCampus(partner)) {
        farViewPartnerIdRef.current = partner.id
        webViewRef.current?.injectJavaScript(viewBoundsScript(farPointViewBox(partner)))
      } else if (farViewPartnerIdRef.current !== null) {
        farViewPartnerIdRef.current = null
        webViewRef.current?.injectJavaScript(viewBoundsScript(CAMPUS_VIEW_BOX))
      }

      postToMap({ type: 'setPartners', partners: [toMarker(partner)], bounds: null })
      postToMap({ type: 'focusPartner', id: partner.id, zoom: FOCUS_ZOOM })
    },
    [postToMap, clearPartnerFilter, searchedPartnerIdRef, farViewPartnerIdRef, webViewRef],
  )

  return { visible, nearbyGroup, pinnedSection, open, close, hide, showPinned, showNearbyGroup, selectPartner }
}
