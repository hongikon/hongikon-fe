export interface MapVisibilityState {
  pickingLocation: boolean
  routeMode: boolean
  sheetOpen: boolean
  routeHasFrom: boolean
  hasTo: boolean
  nearbyPicking: boolean
  nearbyOverlayOn: boolean
  reportsOn: boolean
  /** 제보 목록을 받는 중이라 "불러오는 중" 안내를 보일 때. */
  reportsLoading: boolean
  reportsErrored: boolean
  hotOnly: boolean
  reportsMatchHot: boolean
  reportsEmpty: boolean
  /** 지도에 보이는 제보를 받았는지. */
  reportsLoaded: boolean
  reportSheetOpen: boolean
}

/**
 * 화면에 무엇을 보일지. 위치를 고르는 동안에는 지도 위 안내 줄·카드·메뉴를 모두 숨긴다(고르기 안내 줄·카드와 같은 자리에 겹친다).
 */
export function mapVisibility(s: MapVisibilityState) {
  const showOverlayNotices = !s.pickingLocation
  return {
    /** 검색바·칩. 길찾기 중에는 출발·도착 막대가 그 자리로 올라간다(routeMode). */
    showSearchAndChips: !s.pickingLocation && !s.routeMode,
    /** 길찾기 출발·도착 막대: 한쪽이라도 정했으면. */
    showRouteStrip: !s.pickingLocation && (s.routeHasFrom || s.hasTo),
    /** 길찾기 결과 카드: 두 끝을 다 정했고 아래 시트가 닫혀 있으면. */
    showRouteResultCard: !s.pickingLocation && !s.sheetOpen && s.routeHasFrom && s.hasTo,
    /** 오른쪽 아래 지도 메뉴. 시트가 열려 있으면 시트 가장자리로 삐져나와 숨긴다. */
    showMapMenu: !s.pickingLocation && !s.sheetOpen && !s.nearbyPicking,
    showOverlayNotices,
    showReportsLoadingNotice: s.reportsOn && s.reportsLoading && !s.reportsErrored,
    showReportsError: s.reportsOn && s.reportsErrored,
    /** HOT 제보 목록: HOT 을 켰고 그 목록을 받았을 때. 제보 시트를 연 동안에는 접어 지도를 덜 가린다. */
    showHotReportList:
      showOverlayNotices && s.hotOnly && s.reportsOn && s.reportsMatchHot && !s.reportsEmpty && s.reportsLoaded && !s.reportSheetOpen,
    showNearbyOverlayNote: s.nearbyOverlayOn && !s.sheetOpen && !s.nearbyPicking,
  }
}
