import { useCallback, useRef, useMemo } from "react";
import { View, StyleSheet } from "react-native";
import NaverMapView from "../components/map/NaverMapView";
import type { NaverMapViewHandle } from "../components/map/NaverMapView";
import BuildingSheet from "../components/map/BuildingSheet";
import FacilitySheet from "../components/map/FacilitySheet";
import MapFilterChips from "../components/map/MapFilterChips";
import MapActionMenu from "../components/map/MapActionMenu";
import ReportComposerModal from "../components/map/ReportComposerModal";
import InfoSuggestModal from "../components/settings/InfoSuggestModal";
import ReportSheet from "../components/map/ReportSheet";
import { useAuth } from "../contexts/AuthContext";
import HotReportList from "../components/map/HotReportList";
import RetryableError from "../components/common/RetryableError";
import PartnerChips from "../components/map/PartnerChips";
import PartnerSheet from "../components/map/PartnerSheet";
import PartnerSearchModal from "../components/map/PartnerSearchModal";
import PartnerNoticeModal from "../components/map/PartnerNoticeModal";
import NearbyFilterIntro from "../components/map/NearbyFilterIntro";
import LaunchNoticeModal from "../components/common/LaunchNoticeModal";
import { COLORS } from "../constants/colors";
import { getMapDataSnapshot, useMapData } from "../lib/mapData";
import FloorDialSheet from "../components/map/FloorDialSheet";

/** 길찾기 도착을 핀으로 고를 때, 핀 아래 건물이 없으면 이만큼 안의 가장 가까운 건물을 도착으로 쓴다(11-12). */
import { canLocate } from "../lib/nearbyPartners/platform";
import { MY_LOCATION_BUTTON_FROM, ROUTE_FINDING_ENABLED } from "../constants/route";
import { buildMapHTML } from "../utils/mapHtml";
import { kstTodayYmd } from "../utils/exhibitions";
import type { ReportListItem } from "../types";
import RoutePlannerModal from "../components/map/route/RoutePlannerModal";
import MapTopBar from "../components/map/topbar/MapTopBar";
import MapSearchBar from "../components/map/topbar/MapSearchBar";
import FilterChipSection from "../components/map/topbar/FilterChipSection";
import LocationPickerOverlay from "../components/map/picker/LocationPickerOverlay";
import RouteStrip from "../components/map/route/RouteStrip";
import RouteResultCard from "../components/map/route/RouteResultCard";
import MapNoticeStack from "../components/map/notices/MapNoticeStack";
import MapDataStatusNotice from "../components/map/notices/MapDataStatusNotice";
import MapAuthErrorNotice from "../components/map/notices/MapAuthErrorNotice";
import ReportsLoadingNotice from "../components/map/notices/ReportsLoadingNotice";
import AskPlaceCard from "../components/map/notices/AskPlaceCard";
import ReviewPinNotice from "../components/map/notices/ReviewPinNotice";
import DismissibleNotice from "../components/map/notices/DismissibleNotice";
import NearbyTestPicker from "../components/map/nearby/NearbyTestPicker";
import NearbyOverlayNote from "../components/map/nearby/NearbyOverlayNote";
import { useNearbyDebugTools } from "../hooks/map/useNearbyDebugTools";
import MapSheets from "../components/map/sheets/MapSheets";
import { useMapReports } from "../hooks/map/useMapReports";
import { useMapBackHandler } from "../hooks/map/useMapBackHandler";
import { useMapHeader, useMapLayout } from "../hooks/map/useMapLayout";
import { useLocationPicker } from "../hooks/map/useLocationPicker";
import { useRoutePlanner } from "../hooks/map/useRoutePlanner";
import { useMapFilters } from "../hooks/map/useMapFilters";
import { useMapIntents } from "../hooks/map/useMapIntents";
import { useMapPlaceCards } from "../hooks/map/useMapPlaceCards";
import { useMyLocation } from "../hooks/map/useMyLocation";
import { useInfoSuggest } from "../hooks/map/useInfoSuggest";
import { useFacilityNavigation } from "../hooks/map/useFacilityNavigation";
import { useMapSearch } from "../hooks/map/useMapSearch";
import { useMapSelection } from "../hooks/map/useMapSelection";
import { useReportComposer } from "../hooks/map/useReportComposer";
import { useMapNotices } from "../hooks/map/useMapNotices";
import { useSheetActions } from "../hooks/map/useSheetActions";
import { useMapCamera } from "../hooks/map/useMapCamera";
import { useMapMessages } from "../hooks/map/useMapMessages";
import { useMapPageSync } from "../hooks/map/useMapPageSync";
import { mapVisibility } from "../utils/map/visibility";
import { offscreenSummary } from "../utils/map/labels";

/** 경로 표시에 층을 병기한다. 층을 고르지 않았으면 건물명만. */

export default function MapScreen() {
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


  const floorDialSheet = (
    <FloorDialSheet
      building={route.floorDial?.building ?? null}
      role={route.floorDial?.role ?? "출발"}
      initialFloor={route.floorDialInitial}
      onCancel={route.cancelFloorDial}
      onConfirm={route.confirmFloorDial}
    />
  );

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

  return (
    <View style={styles.container}>
      <PartnerNoticeModal />
      {/* 업데이트 후 '제휴 업체'를 처음 누르면 근처 제휴 알림을 한 번 소개한다(11-12). */}
      <NearbyFilterIntro active={layer === "제휴업체"} />
      <LaunchNoticeModal />

      <View style={styles.mapArea}>
        {/* [지도] 탭 바가 지도 위에 떠 있는 캡슐이라(FloatingTabBar) 지도는 화면 맨 아래까지 깐다. 캡슐은 가운데에 떠 있어
            지도 아래 양 끝의 NAVER 로고·저작권 표시는 가리지 않는다(네이버 지도 API 약관). */}
        <View style={styles.mapCanvas}>
          <NaverMapView
            ref={webViewRef}
            html={mapHTML}
            onMessage={handleWebViewMessage}
            onReady={resyncMap}
          />
        </View>

        {/* [지도 위 안내 줄] 검색바·칩 아래에 쌓인다. */}
        <MapNoticeStack top={headerHeight + 8} side={sideGutter}>
          {!mapData && <MapDataStatusNotice failed={mapDataStatus === "error"} onRetry={reloadMapData} />}

          {mapAuthFailed && <MapAuthErrorNotice onDismiss={dismissMapAuthError} />}

          {showReportsLoadingNotice && <ReportsLoadingNotice />}

          {showReportsError && (
            <RetryableError
              variant="chip"
              message={
                reportsResource.data !== undefined
                  ? "제보를 새로 불러오지 못했어요. 마지막으로 받은 제보를 보여주고 있어요."
                  : (reportsResource.errorMessage ?? "")
              }
              isNetworkError={reportsResource.isNetworkError}
              onRetry={reportsResource.canRetry ? reportsResource.retry : undefined}
              retrying={reportsResource.loading || reportsResource.refreshing}
              onDismiss={reportsResource.clearError}
            />
          )}

          {showHotReportList && (
            <HotReportList reports={reports} selectedId={null} onSelect={handleSelectHotReport} />
          )}

          {showOverlayNotices && preview.askCard && (
            <AskPlaceCard title={preview.askCard.title} summary={preview.askCard.summary} onBack={preview.backToAsk} onClose={preview.closeAskCard} />
          )}

          {showOverlayNotices && preview.previewTarget && (
            <ReviewPinNotice label={preview.previewTarget.label} detail={preview.previewTarget.detail} onClose={preview.clearPreview} />
          )}

          {showOverlayNotices && unresolvedCount > 0 && (
            <DismissibleNotice
              message={`건물을 찾지 못한 편의시설 ${unresolvedCount}곳은 지도에서 빠졌어요`}
              dismissed={dismissedNotices}
              onDismiss={dismissNotice}
            />
          )}

          {showOverlayNotices && offscreenCount > 0 && (
            <DismissibleNotice
              message={`지도에 안 보이는 ${offscreenCount}곳 · ${offscreenSummary(offscreenPartners)}`}
              actionLabel="보기"
              onPress={handleShowOffscreenPartners}
              dismissed={dismissedNotices}
              onDismiss={dismissNotice}
            />
          )}
        </MapNoticeStack>

        {/* [근처 알림 개발 도구] 테스트 위치 고르기·영역 보기 안내 */}
        {nearbyDebug.picking && (
          <NearbyTestPicker
            bottom={16 + bottomInset}
            onConfirm={nearbyDebug.requestCenter}
            onUseRealLocation={nearbyDebug.resetToRealLocation}
            onCancel={nearbyDebug.cancelPicking}
          />
        )}
        {showNearbyOverlayNote && nearbyDebug.note && (
          <NearbyOverlayNote
            note={nearbyDebug.note}
            testLabel={nearbyDebug.label}
            unregistered={nearbyDebug.unregistered}
            bottom={84 + bottomInset}
          />
        )}
        {/* [지도 메뉴] 오른쪽 아래(제보 보기·내 위치·캠퍼스로·길찾기·제보하기) */}
        {showMapMenu && (
          <MapActionMenu
            style={mapMenuStyle}
            onReport={reportComposer.handleStartPicker}
            onRoute={ROUTE_FINDING_ENABLED ? route.openSearch : undefined}
            onRecenter={handleRecenter}
            onMyLocation={canShowMyLocationButton ? myLocation.toggle : undefined}
            myLocationOn={myLocation.on}
            onToggleNearbyOverlay={nearbyDebug.menuAvailable ? nearbyDebug.toggleOverlay : undefined}
            onPickNearbyTestLocation={nearbyDebug.menuAvailable ? nearbyDebug.startPicking : undefined}
            nearbyOverlayOn={nearbyDebug.overlayOn}
            maxItemsHeight={mapMenuMaxItemsHeight}
            reportFilter={menuFilter}
          />
        )}

        {/* [위치 고르기] 제보·정보 제보·길찾기 도착을 지도 가운데 핀으로 */}
        {pickingLocation && (
          <LocationPickerOverlay
            purpose={picker.purpose}
            center={picker.center}
            routeBuildingName={picker.routeTarget?.name ?? null}
            top={headerHeight + 8}
            bottom={20 + bottomInset}
            side={sideGutter}
            onCancel={handleCancelReportPicker}
            onConfirm={handleConfirmReportPicker}
          />
        )}

        {/* [길찾기] 위 출발·도착 막대, 아래 결과 카드 */}
        {showRouteStrip && (
          <RouteStrip
            fromLabel={routeFromLabel}
            toLabel={routeToLabel}
            fromIsBuilding={fromBuilding !== null}
            toIsBuilding={toBuilding !== null}
            canSwap={fromBuilding !== null && toBuilding !== null && !fromMyLocation}
            onPressEndpoint={handleRouteEndpointPress}
            onSearch={route.openSearch}
            onSwap={handleSwapRoute}
            onClose={handleClearRoute}
            top={headerHeight + 8}
            side={sideGutter}
            onHeight={handleRouteStripHeight}
          />
        )}

        {showRouteResultCard && (
          <RouteResultCard
            routes={routeAlternatives}
            selectedIndex={selectedRouteIndex}
            onSelect={route.selectAlternative}
            onClose={handleClearRoute}
            bottom={8 + bottomInset}
            side={sideGutter}
            onHeight={route.setCardHeight}
          />
        )}

        {/* [아래 시트] 고른 건물·제휴·시설·제보 */}
        <MapSheets headerContext={sheetHeaderCtx} bottom={sheetBottom} side={sideGutter}>
          {selectedBuilding && (
            <BuildingSheet
              key={selectedBuilding.name}
              building={selectedBuilding}
              facilities={selectedBuildingFacilities}
              onOpenFacility={facilityNav.openFromBuilding}
              onClose={handleCloseBuilding}
              routeFindingEnabled={ROUTE_FINDING_ENABLED}
              onSetFrom={handleSetFrom}
              onSetTo={handleSetTo}
              routeNext={routeNext}
            />
          )}

          {selectedPartner && (
            <PartnerSheet
              key={selectedPartner.id}
              partner={selectedPartner}
              onClose={handleClosePartner}
              onSuggestEdit={infoSuggest.suggestPartnerEdit}
            />
          )}

          {selectedFacilityBuilding && facilityKind && (
            <FacilitySheet
              key={`${facilityKind}:${selectedFacilityBuilding}`}
              kind={facilityKind}
              buildingName={selectedFacilityBuilding}
              items={selectedFacilityItems}
              exhibitions={exhibitions}
              highlightId={highlightedFacilityId}
              onClose={facilityNav.closeSheet}
              onBack={facilityNav.facilityFrom ? facilityNav.backToBuilding : undefined}
              backLabel={facilityNav.facilityFrom ? `${facilityNav.facilityFrom.building.name}로 돌아가기` : undefined}
              onSetFrom={ROUTE_FINDING_ENABLED && facilitySheetBuilding ? handleFacilitySetFrom : undefined}
              onSetTo={ROUTE_FINDING_ENABLED && facilitySheetBuilding ? handleFacilitySetTo : undefined}
              routeNext={routeNext}
            />
          )}

          {selectedReport && (
            // 제보마다 새로 그린다. 시트 안의 🔥·관심·신고 요청 중 상태와 늦게 온 응답·오류·메뉴가 다른 제보로
            // 넘어가지 않게(예전엔 마커만 바꿔 누르면 앞 제보의 응답이 뒤 제보 시트에 덮였다).
            <ReportSheet key={selectedReport.id} report={selectedReport} onClose={handleCloseReportSheet} onChanged={refetchReports} />
          )}
        </MapSheets>
      </View>

      {/* [위 막대] 검색바·칩. mapArea 뒤에 와야(later sibling) 지도 위에 그려진다. 빈 곳 터치는 지도로 간다. */}
      <MapTopBar topInset={insets.top} opacity={headerFade} covered={headerCovered} onHeight={setHeaderHeight}>
        {showSearchAndChips && (
          <>
            <MapSearchBar sideGutter={sideGutter} onPress={search.open} />
            <FilterChipSection sideGutter={sideGutter}>
              <MapFilterChips
                layer={layer}
                facilityKind={facilityKind}
                onSelectLayer={handleSelectLayer}
                onSelectFacilityKind={handleSelectFacilityKind}
              />
              {layer === "제휴업체" && (
                <PartnerChips
                  affiliation={selectedAffiliation}
                  category={selectedCategory}
                  onSelectAffiliation={filters.selectAffiliation}
                  onSelectCategory={filters.selectCategory}
                />
              )}
            </FilterChipSection>
          </>
        )}
      </MapTopBar>

      {/* [창] 층 다이얼·길찾기 창·검색 창·제보 쓰기·정보 제보 */}
      {!showRoute && floorDialSheet}
      <RoutePlannerModal
        visible={showRoute}
        onClose={handleCloseRoute}
        overlay={showRoute ? floorDialSheet : null}
        target={routeTarget}
        fromLabel={routeFromLabel}
        toLabel={routeToLabel}
        onChangeTarget={handleChangeRouteTarget}
        query={searchQuery}
        onChangeQuery={setSearchQuery}
        buildings={buildings}
        onSelectBuilding={handleSelectRouteBuilding}
        onPickDestinationOnMap={handlePickRouteDestinationOnMap}
        onSelectMyLocation={canLocate() ? handleSelectMyLocationPress : undefined}
      />

      <PartnerSearchModal
        visible={search.visible}
        topInset={insets.top}
        onClose={search.close}
        onSelect={search.selectPartner}
        onSelectFacility={facilityNav.openFacility}
        autoFocus={!search.nearbyGroup}
        pinned={search.pinnedSection}
      />

      <ReportComposerModal
        target={reportTarget}
        onClose={reportComposer.close}
        onCreated={reportComposer.handleCreated}
      />

      <InfoSuggestModal
        visible={infoSuggest.visible}
        location={infoSuggest.state?.location ?? null}
        prefill={infoSuggest.state?.prefill ?? null}
        onClose={infoSuggest.close}
        onPickOnMap={infoSuggest.pickOnMap}
      />
    </View>
  );
}


const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.white },
  // 검색바 좌우에 지도가 비치는 여백이 남지 않도록, 알약 모양은 이 흰
  // 배경 안쪽 padding 으로만 띄운다(margin 이면 그 여백엔 배경이 없다).
  // 흰 배경을 깔지 않는다 — 검색바 알약 자체(아래 searchBar)만 흰색이고,
  mapArea: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0 },
  // 실제 지도가 그려지는 칸. 탭바가 떠 있는 캡슐이라 화면 전체를 덮는다(JSX 주석 참고).
  // 위치 고르기 중앙 핀(pickerMarkerWrap)도 같은 칸 전체 기준이어야 map.getCenter() 와 겹친다.
  mapCanvas: { flex: 1 },
  // 건물·제휴업체·제보 배너를 얹는 레이어. 얘 자체엔 위치가 없고(화면 전체를 덮기만),
  // 필터 칩 줄과 같은 왼쪽 여백(16)에 맞춘다. 넓은 화면에서 가운데로 몰려 칩과 어긋나지 않게 하고, 너무 넓어지지 않게 폭만 묶는다.
  /** 출발: 남색 테두리 빈 원, 도착: 남색 채운 원(지도 표시와 같음). */
});
