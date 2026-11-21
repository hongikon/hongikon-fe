import { useCallback, useRef, useMemo } from 'react'
import type { NaverMapViewHandle } from '../../components/map/NaverMapView'
import { useAuth } from '../../contexts/AuthContext'
import { getMapDataSnapshot, useMapData } from '../../lib/mapData'
import { canLocate } from '../../lib/nearbyPartners/platform'
import { MY_LOCATION_BUTTON_FROM } from '../../constants/route'
import { buildMapHTML } from '../../utils/map/mapHtml'
import { kstTodayYmd } from '../../utils/map/exhibitions'
import type { ReportListItem } from '../../types'
import { useNearbyDebugTools } from './useNearbyDebugTools'
import { useMapReports } from './useMapReports'
import { useMapBackHandler } from './useMapBackHandler'
import { useMapHeader, useMapLayout } from './useMapLayout'
import { useLocationPicker } from './useLocationPicker'
import { useRoutePlanner } from './useRoutePlanner'
import { useMapFilters } from './useMapFilters'
import { useMapIntents } from './useMapIntents'
import { useMapPlaceCards } from './useMapPlaceCards'
import { useMyLocation } from './useMyLocation'
import { useInfoSuggest } from './useInfoSuggest'
import { useFacilityNavigation } from './useFacilityNavigation'
import { useMapSearch } from './useMapSearch'
import { useMapSelection } from './useMapSelection'
import { useReportComposer } from './useReportComposer'
import { useMapNotices } from './useMapNotices'
import { useSheetActions } from './useSheetActions'
import { useMapCamera } from './useMapCamera'
import { useMapMessages } from './useMapMessages'
import { useMapPageSync } from './useMapPageSync'
import { mapVisibility } from '../../utils/map/visibility'

/** MapScreen 의 상태·효과·핸들러. 화면 파일은 이 훅을 불러 그리기만 한다. */
export function useMapScreen() {
  const webViewRef = useRef<NaverMapViewHandle>(null);
  // 페이지 스크립트가 아직 안 떴으면(웹은 maps.js 를 받은 뒤에 주입한다) 조용히 건너뛴다. 준비되면 resyncMap 이 다시 보낸다.
  const postToMap = useCallback((msg: object) => {
    webViewRef.current?.injectJavaScript(
      `if (typeof window.handleNativeMessage === "function") window.handleNativeMessage(${JSON.stringify(JSON.stringify(msg))});true;`,
    );
  }, []);
  const { accessToken, logout } = useAuth();
  // 위 검색바·칩 막대 높이(길찾기가 읽는다). 배치 값은 길찾기 뒤의 useMapLayout 에서.
  const { headerHeight, setHeaderHeight, headerCovered, headerFade, sheetHeaderCtx } = useMapHeader();
  /** 필터 없이 검색으로만 지도에 올린 업체 id. 그 시트가 닫히면 마커도 거둔다(아래 effect). */
  const searchedPartnerIdRef = useRef<string | null>(null);
  /** 지금 지도 이동 범위가 먼 제휴 지점 둘레면 그 지점 id, 캠퍼스 일대면 null(`mapBounds.ts`). */
  const farViewPartnerIdRef = useRef<string | null>(null);
  /** 아래 탭바(또는 안전 영역) 높이. 경로를 화면에 맞출 때 읽는다(값은 useMapLayout 이 채운다). */
  const bottomInsetRef = useRef(0);
  // 제보 레이어(목록 받기·HOT·종류·마커). HOT·종류를 바꾸면 열린 시트를 닫는다.
  const {
    reportsOn,
    hotOnly,
    hotAvailable,
    reportCategories,
    resource: reportsResource,
    hiddenAuthorKeys,
    shown: shownReportData,
    reports,
    matchesHot: reportsMatchHot,
    showLoading: showReportsLoading,
    empty: reportsEmpty,
    toggleHot: handleToggleHot,
    toggleCategory: handleToggleReportCategory,
    showAll: showAllReports,
    refetch: refetchReports,
    menuFilter,
  } = useMapReports({
    accessToken,
    postToMap,
    onToggleHot: (next) => {
      setSelectedReport(null);
      if (next) {
        setSelectedPartner(null);
        setSelectedBuilding(null);
        setSelectedFacilityBuilding(null);
      }
    },
    onCategoriesChange: () => setSelectedReport(null),
  });
  /**
   * 지도 데이터(건물·편의시설·제휴업체). 앱 시작 때 받기 시작해 기기에 저장해 둔다(`lib/mapData.ts`).
   * 아직 없으면 빈 배열이고, 지도 위에 "불러오는 중"/"다시 시도" 안내가 뜬다.
   */
  const {
    buildings,
    facilities,
    partners: allPartners,
    exhibitions,
    data: mapData,
    status: mapDataStatus,
    reload: reloadMapData,
  } = useMapData();
  // 지도 칩 거르기(갈래·제휴 소속/업종·학교 시설 종류). 칩을 바꾸면 열린 시트를 닫는다(길찾기 한쪽만 정한 동안 건물 시트는 남긴다).
  const filters = useMapFilters({
    webViewRef,
    postToMap,
    partners: allPartners,
    facilities,
    buildings,
    exhibitions,
    searchedPartnerIdRef,
    farViewPartnerIdRef,
    onPartnerFilterChange: (active) => {
      setSelectedPartner(null);
      if (active && !routePicking) setSelectedBuilding(null);
    },
    onFacilityKindChange: () => {
      setSelectedFacilityBuilding(null);
      setSearchedFacility(null);
    },
    onLayerChange: () => {
      setSelectedPartner(null);
      if (!routePicking) setSelectedBuilding(null);
      // 제보는 갈래와 따로 켜고 끈다(10-27, 메뉴의 '제보 보기'). 열려 있던 제보 시트만 닫는다.
      setSelectedReport(null);
    },
  });
  const { layer, setLayer, facilityKind, selectedAffiliation, selectedCategory, activeFilter, applyFacilityKind } = filters;
  // 고른 건물·제휴·제보·학교 시설과 아래 시트(열고 닫기·지도 강조 거두기). 시트는 한 번에 하나만 연다.
  const {
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
    reassertPartnerSelection,
    handleTap: handleSelectionTap,
  } = useMapSelection({
    postToMap,
    buildings,
    partners: allPartners,
    reports: shownReportData,
    activeFilter,
    searchedPartnerIdRef,
    onLongPress: (at) => {
      // 제보 등록은 로그인이 필요하다. 게스트가 작성창을 다 채운 뒤에야 막히지 않게 여기서 먼저 묻는다.
      if (!requireLogin()) return;
      setSelectedBuilding(null);
      setSelectedPartner(null);
      setSelectedReport(null);
      setSelectedFacilityBuilding(null);
      reportComposer.open(at);
    },
    onLeaveBuildingFacility: () => facilityNav.leave(),
  });
  // 캠퍼스로 돌아가기(학사모 버튼·지도 탭 다시 누르기·먼 지점 시트 닫기).
  const { recenter: handleRecenter } = useMapCamera({ webViewRef, farViewPartnerIdRef, selectedPartner });
  // 제보 작성창(길게 누른 자리·핀으로 고른 자리)과 로그인 확인.
  const reportComposer = useReportComposer({
    accessToken,
    logout,
    reportsOn,
    retryReports: reportsResource.retry,
    startPicker: () => picker.start("report"),
  });
  const { reportTarget, requireLogin } = reportComposer;
  // 지도 위에 얹는 검토용 임시 핀과 물어보기 설명 카드.
  const preview = useMapPlaceCards({
    webViewRef,
    postToMap,
    placeSheetOpen: selectedBuilding !== null || selectedPartner !== null || selectedFacilityBuilding !== null,
  });
  // 제휴·편의시설 검색 창(열기·닫기·맨 위 업체 묶음·결과로 업체 고르기).
  const search = useMapSearch({
    webViewRef,
    postToMap,
    searchedPartnerIdRef,
    farViewPartnerIdRef,
    clearPartnerFilter: filters.clearPartnerFilter,
    openPartnerSheet: (partner) => {
      setSelectedBuilding(null);
      setSelectedReport(null);
      setSelectedFacilityBuilding(null);
      setSelectedPartner(partner);
    },
  });
  // 정보 제보 창(제휴·전시·행사 위치)과 제휴 시트의 '정보 수정'.
  const infoSuggest = useInfoSuggest({
    selectedPartnerRef,
    closePartnerSheet: () => handleClosePartner(),
    startPartnerLocationPick: (before) => picker.start("partner", { partnerLocationBefore: before }),
  });
  // 학교 시설 시트 열기와 건물 시트 ↔ 시설 시트 오가기.
  const facilityNav = useFacilityNavigation({
    postToMap,
    buildings,
    layer,
    facilityKind,
    setLayer,
    applyFacilityKind,
    showFacilityKind: filters.showFacilityKind,
    selectedBuilding,
    selectedFacilityBuilding,
    setSelectedBuilding,
    setSelectedPartner,
    setSelectedReport,
    setSelectedFacilityBuilding,
    setSearchedFacility,
    hideSearch: search.hide,
  });
  // 지도 가운데 핀으로 위치 고르기(제보·정보 제보·길찾기 도착).
  const picker = useLocationPicker({
    postToMap,
    buildings,
    onStart: () => {
      setSelectedBuilding(null);
      setSelectedPartner(null);
      setSelectedReport(null);
      setSelectedFacilityBuilding(null);
    },
    onConfirmReport: (center) => reportComposer.open({ lat: center.lat, lng: center.lng, buildingName: center.buildingName }),
    onConfirmPartner: (center) =>
      infoSuggest.open({ lat: center.lat, lng: center.lng, buildingName: center.buildingName }),
    // 층 정보가 있는 건물이면 검색으로 고를 때처럼 층 다이얼이 뜬다.
    onConfirmRouteTo: (building) => beginTo(building),
    onCancelPartner: (previous) => infoSuggest.open(previous),
  });
  const pickingLocation = picker.picking;
  // 길찾기(출발·도착·층·후보 길). 출발·도착을 정하면 열린 건물·시설 시트를 닫는다.
  const route = useRoutePlanner({
    webViewRef,
    postToMap,
    buildings,
    headerHeight,
    bottomInsetRef,
    facilityKind,
    facilities,
    onCommitEndpoint: () => {
      setSelectedBuilding(null);
      setSelectedFacilityBuilding(null);
      // 제보 시트의 출발·도착으로 정했을 때도 시트를 닫아 경로가 가려지지 않게 한다(11-20 사용자).
      setSelectedReport(null);
    },
  });
  const {
    fromBuilding,
    toBuilding,
    fromFloor,
    toFloor,
    fromMyLocation,
    picking: routePicking,
    drawn: routeDrawn,
    drawnRef: routeDrawnRef,
    alternatives: routeAlternatives,
    selectedIndex: selectedRouteIndex,
    showSearch: showRoute,
    searchTarget: routeTarget,
    searchQuery,
    setSearchQuery,
    beginFrom,
    beginTo,
    cardHeight: routeCardHeight,
  } = route;
  // 아래 시트에 넘기는 값(시설 목록·출발·도착 버튼)과 시트 닫기.
  const {
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
  } = useSheetActions({
    postToMap,
    buildings,
    facilities,
    facilityKind,
    selectedBuilding,
    selectedFacilityBuilding,
    selectedReport,
    searchedFacility,
    fromBuilding,
    fromMyLocation,
    toBuilding,
    setSelectedBuilding,
    setSelectedPartner,
    setSelectedReport,
    beginFrom,
    beginTo,
  });
  // 근처 알림 개발 도구. 테스트 위치를 바꿀 때 다시 판단하는 데 쓰는 지도 데이터(대상 업체·캠퍼스 건물·긴급 스위치)를 넘긴다.
  const nearbyDebug = useNearbyDebugTools(webViewRef, {
    partners: allPartners,
    campusPoints: buildings,
    serverEnabled: mapData?.nearbyAlertsEnabled === true,
  });

  // 웹은 이 문서를 처음 한 번만 넣는다(NaverMapView.web). 그때 있는 건물로 굽고, 그 뒤 바뀐 건물은 setBuildings 로 보낸다.
  // 앱(WebView)은 이 값을 쓰지 않고 배포된 map.html(구운 초기 건물)을 불러온다.
  const mapHTML = useMemo(() => buildMapHTML(getMapDataSnapshot()?.buildings ?? []), []);




  // 지도 위 안내 줄 상태(네이버 지도 인증 실패·닫은 안내·안 보이는 업체 수).
  const { offscreenPartners, unresolvedCount, mapAuthFailed, reportMapAuthFailure, dismissMapAuthError, dismissedNotices, dismissNotice } =
    useMapNotices({ partners: allPartners, activeFilter, facilities, buildings, facilityKind });
  const offscreenCount = offscreenPartners.length;

  const { insets, sideGutter, sheetOpen, routeMode, bottomInset, sheetBottom, mapMenuStyle, mapMenuMaxItemsHeight } = useMapLayout({
    bottomInsetRef,
    selectedBuilding,
    selectedPartner,
    selectedReport,
    selectedFacilityBuilding,
    facilityKind,
    pickingLocation,
    fromBuilding,
    fromMyLocation,
    toBuilding,
    headerHeight,
    routeCardHeight,
  });

  // 지도 페이지가 보내는 메시지(경로 탭·위치 고르기·근처 테스트·인증 실패·시트 열고 닫기)를 나눠 처리한다.
  const handleWebViewMessage = useMapMessages({
    postToMap,
    pickingLocation,
    handleRouteTap: route.handleRouteTap,
    ignoresMapTap: route.ignoresMapTap,
    handlePickerCenter: picker.handleCenterMessage,
    handleNearbyCenter: nearbyDebug.handleCenter,
    reportMapAuthFailure,
    handleSelectionTap,
    clearSelectedBuilding: () => setSelectedBuilding(null),
  });

  // 길찾기를 보는 동안(길찾기 창이 열렸거나 경로가 지도에 있을 때)만 위치를 계속 읽는다. 권한이 이미 있을 때만 — 권한 창은
  // 출발지 "내 위치"를 고를 때만 뜬다. 나가면 멈추고 지도 점을 지운다.
  const routeActive = showRoute || ((fromBuilding !== null || fromMyLocation) && toBuilding !== null);
  const myLocation = useMyLocation({
    webViewRef,
    routeActive,
    selectedRouteRef: route.selectedRouteRef,
    alternatives: routeAlternatives,
    selectedIndex: selectedRouteIndex,
    fromMyLocation,
    setRouteOrigin: route.setRouteOrigin,
    startRouteFromMyLocation: route.startFromMyLocation,
    farViewPartnerIdRef,
  });

  const closeRouteSearch = route.closeSearch;

  const handleSelectFacilityKind = filters.selectFacilityKind;

  const handleSelectLayer = filters.selectLayer;

  // 지도 페이지와 앱 상태 맞추기: 페이지가 (다시) 준비되면 화면 상태를 다시 그리고, 경로 흐림·지도 데이터 갱신도 반영한다.
  const resyncMap = useMapPageSync({
    webViewRef,
    postToMap,
    // 그릴 데이터
    mapData,
    partners: allPartners,
    buildings,
    facilities,
    exhibitions,
    activeFilter,
    facilityKind,
    reportsOn,
    reports: shownReportData,
    // 경로
    routeDrawn,
    routeDrawnRef,
    // 고른 것
    selectedBuildingRef,
    selectedPartnerRef,
    selectedReportRef,
    selectedFacilityBuildingRef,
    searchedPartnerIdRef,
    farViewPartnerIdRef,
    setSelectedBuilding,
    setSelectedPartner,
    // 다시 맞출 부수 효과
    recenter: handleRecenter,
    reassertPartnerSelection,
    redrawMyLocation: myLocation.redrawShown,
    repinPreview: preview.repin,
    resyncPicker: picker.resync,
  });

  // 다른 화면에서 넘어온 지도 요청(제보 알림·물어보기·관리 탭 미리보기·정보 제보 위치 찍기 등).
  useMapIntents({
    accessToken,
    postToMap,
    buildings,
    facilities,
    partners: allPartners,
    hiddenAuthorKeys,
    stopPicker: picker.stop,
    startPartnerLocationPick: () => {
      infoSuggest.close();
      picker.start("partner", { partnerLocationBefore: null });
    },
    startReportPicker: reportComposer.handleStartPicker,
    openReport,
    showAllReports,
    showNearbyGroup: search.showNearbyGroup,
    selectPartner: search.selectPartner,
    openFacility: facilityNav.openFacility,
    openBuilding: (building) => {
      search.hide();
      setSelectedPartner(null);
      setSelectedFacilityBuilding(null);
      setSelectedReport(null);
      setSelectedBuilding(building);
    },
    setAskCard: preview.setAskCard,
    clearPreview: preview.clearPreview,
    showPreview: (target) => {
      setSelectedBuilding(null);
      setSelectedPartner(null);
      setSelectedReport(null);
      setSelectedFacilityBuilding(null);
      preview.showPreview(target);
    },
    startRouteTo: ({ building, floor, from }) => {
      search.hide();
      setSelectedPartner(null);
      setSelectedReport(null);
      route.commitTo(building, floor);
      if (from) route.commitFrom(from, null);
      else void myLocation.selectForRoute();
    },
  });

  const handleCancelReportPicker = picker.cancel;

  // 안드로이드 뒤로가기(웹은 Esc): 열린 창·위치 고르기·시트를 위에서부터 하나씩 닫는다.
  useMapBackHandler({
    windowOpen: search.visible || showRoute || reportTarget !== null || infoSuggest.visible,
    pickingLocation,
    cancelPicker: handleCancelReportPicker,
    selectedReport,
    selectedPartner,
    selectedBuilding,
    selectedFacilityBuilding,
    facilityKind,
    facilityFrom: facilityNav.facilityFrom,
    closeReportSheet: handleCloseReportSheet,
    closePartnerSheet: handleClosePartner,
    closeBuildingSheet: handleCloseBuilding,
    closeFacilitySheet: () => setSelectedFacilityBuilding(null),
    backToBuilding: facilityNav.backToBuilding,
  });


  /** 도착 검색 창의 "지도에서 핀으로 고르기". 검색 창을 닫고 화면 가운데 핀으로 도착 건물을 고르게 한다. */
  const handlePickRouteDestinationOnMap = useCallback(() => {
    closeRouteSearch();
    picker.start("routeTo");
  }, [closeRouteSearch, picker.start]);

  /** 확인을 누르면 화면 중앙 좌표로 작성창을 연다. 롱프레스 제보와 같은 작성창을 쓴다. 정보 제보면 정보 제보 창을 연다. */
  const handleConfirmReportPicker = picker.confirm;

  const handleSwapRoute = route.swap;

  const handleClearRoute = route.clear;

  const handleSelectRouteBuilding = route.selectSearchBuilding;

  const handleRouteEndpointPress = route.pressEndpoint;
  const handleRouteStripHeight = route.onStripHeight;
  // ---- 지도 메뉴(오른쪽 아래) ----
  /** '내 위치 켜기': 운영은 처리방침 11-16판 적용일부터. 테스트 앱(개발 도구)은 미리 확인하게 바로 보인다. */
  const canShowMyLocationButton = canLocate() && (nearbyDebug.enabled || kstTodayYmd() >= MY_LOCATION_BUTTON_FROM);

  // ---- 검색·제보·정보 제보 창 ----
  // ---- 아래 시트 ----

  // ---- 지도 위 안내 줄 ----
  /** 'HOT' 목록에서 제보를 고르면 그 제보 시트를 열고 지도를 그 자리로. */
  const handleSelectHotReport = useCallback(
    (report: ReportListItem) => {
      openReport(report);
      postToMap({ type: "focusReport", lat: report.lat, lng: report.lng });
    },
    [openReport, postToMap],
  );
  /** '지도에 안 보이는 N곳 · 보기' — 그 업체들을 검색 창 맨 위에 모아 연다. */
  const handleShowOffscreenPartners = useCallback(() => search.showPinned(offscreenPartners), [search.showPinned, offscreenPartners]);

  const handleSelectMyLocationPress = useCallback(() => void myLocation.selectForRoute(), [myLocation.selectForRoute]);
  const handleChangeRouteTarget = route.changeSearchTarget;
  const routeFromLabel = route.fromLabel;
  const routeToLabel = route.toLabel;

  const handleCloseRoute = route.closeSearch;

  // ---- 화면에 무엇을 보일지 ----
  const routeHasFrom = fromBuilding !== null || fromMyLocation;
  const {
    showSearchAndChips,
    showRouteStrip,
    showRouteResultCard,
    showMapMenu,
    showOverlayNotices,
    showReportsLoadingNotice,
    showReportsError,
    showHotReportList,
    showNearbyOverlayNote,
  } = mapVisibility({
    pickingLocation,
    routeMode,
    sheetOpen,
    routeHasFrom,
    hasTo: toBuilding !== null,
    nearbyPicking: nearbyDebug.picking,
    nearbyOverlayOn: nearbyDebug.overlayOn,
    reportsOn,
    reportsLoading: showReportsLoading,
    reportsErrored: reportsResource.errorMessage !== null,
    hotOnly,
    reportsMatchHot,
    reportsEmpty,
    reportsLoaded: shownReportData !== undefined,
    reportSheetOpen: selectedReport !== null,
  });
  return {
    webViewRef,
    headerHeight,
    setHeaderHeight,
    headerCovered,
    headerFade,
    sheetHeaderCtx,
    reportsResource,
    reports,
    refetchReports,
    menuFilter,
    buildings,
    exhibitions,
    mapData,
    mapDataStatus,
    reloadMapData,
    filters,
    layer,
    facilityKind,
    selectedAffiliation,
    selectedCategory,
    selectedBuilding,
    selectedPartner,
    selectedReport,
    selectedFacilityBuilding,
    handleRecenter,
    reportComposer,
    reportTarget,
    preview,
    search,
    infoSuggest,
    facilityNav,
    picker,
    pickingLocation,
    route,
    fromBuilding,
    toBuilding,
    fromMyLocation,
    routeAlternatives,
    selectedRouteIndex,
    showRoute,
    routeTarget,
    searchQuery,
    setSearchQuery,
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
    nearbyDebug,
    mapHTML,
    offscreenPartners,
    unresolvedCount,
    mapAuthFailed,
    dismissMapAuthError,
    dismissedNotices,
    dismissNotice,
    offscreenCount,
    insets,
    sideGutter,
    bottomInset,
    sheetBottom,
    mapMenuStyle,
    mapMenuMaxItemsHeight,
    handleWebViewMessage,
    myLocation,
    handleSelectFacilityKind,
    handleSelectLayer,
    resyncMap,
    handleCancelReportPicker,
    handlePickRouteDestinationOnMap,
    handleConfirmReportPicker,
    handleSwapRoute,
    handleClearRoute,
    handleSelectRouteBuilding,
    handleRouteEndpointPress,
    handleRouteStripHeight,
    canShowMyLocationButton,
    handleSelectHotReport,
    handleShowOffscreenPartners,
    handleSelectMyLocationPress,
    handleChangeRouteTarget,
    routeFromLabel,
    routeToLabel,
    handleCloseRoute,
    showSearchAndChips,
    showRouteStrip,
    showRouteResultCard,
    showMapMenu,
    showOverlayNotices,
    showReportsLoadingNotice,
    showReportsError,
    showHotReportList,
    showNearbyOverlayNote,
  }
}
