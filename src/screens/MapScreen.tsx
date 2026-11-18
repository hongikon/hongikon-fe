import {
  useState,
  useCallback,
  useRef,
  useMemo,
  useEffect,
  useLayoutEffect,
} from "react";
import { View, StyleSheet, Animated, useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import NaverMapView from "../components/map/NaverMapView";
import type { NaverMapViewHandle } from "../components/map/NaverMapView";
import BuildingSheet from "../components/map/BuildingSheet";
import { nextRouteEndpoint } from "../components/map/RouteEndpointButtons";
import FacilitySheet from "../components/map/FacilitySheet";
import MapFilterChips from "../components/map/MapFilterChips";
import MapActionMenu from "../components/map/MapActionMenu";
import ReportComposerModal from "../components/map/ReportComposerModal";
import InfoSuggestModal from "../components/settings/InfoSuggestModal";
import { useNavigation } from "@react-navigation/native";
import { MAP_TAB_BAR_HIDDEN_STYLE, MAP_TAB_BAR_STYLE } from "../navigation/tabBarStyles";
import type { ReportTarget } from "../components/map/ReportComposerModal";
import ReportSheet from "../components/map/ReportSheet";
import { useAuth } from "../contexts/AuthContext";
import HotReportList from "../components/map/HotReportList";
import RetryableError from "../components/common/RetryableError";
import { promptLogin } from "../utils/reports";
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
import { CAMPUS_CENTER, DEFAULT_ZOOM } from "../constants/map";
import { buildMapHTML } from "../utils/mapHtml";
import { filterPartners, hasActiveFilter, partnersOutsideFocus } from "../utils/partners";
import { CAMPUS_VIEW_BOX, viewBoundsScript } from "../utils/mapBounds";
import { unresolvedFacilities } from "../utils/facilities";
import { kstTodayYmd } from "../utils/exhibitions";
import type { Facility, ReportListItem } from "../types";
import { useCenteredGutter } from "../hooks/useCenteredGutter";
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
import { REPORT_CATEGORY_KEYS, useMapReports } from "../hooks/map/useMapReports";
import { useMapBackHandler } from "../hooks/map/useMapBackHandler";
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
import { useMapPageSync } from "../hooks/map/useMapPageSync";
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
  // react-native-safe-area-context 는 iOS Modal 안에서 top inset 을 0으로 보고하는
  // 알려진 문제가 있어서 (https://github.com/th3rdwave/react-native-safe-area-context/issues/677),
  // Modal 바깥의 화면에서 미리 재서 넘긴다.
  const insets = useSafeAreaInsets();
  // 지도 탭만 탭바를 지도 위에 띄운다(TabNavigator.tsx) — 그만큼 화면 맨
  // 아래에 깔린 버튼·배너가 탭바에 가리지 않게 이 높이만큼 띄워 올린다.
  const tabBarHeight = useBottomTabBarHeight();
  const { height: windowHeight } = useWindowDimensions();
  const navigation = useNavigation();
  // 검색바·필터 칩이 지도 위에 뜨는 오버레이로 바뀌면서(§아래 JSX), 실제
  // 렌더된 높이만큼 지도 위 배너·상단바들을 밀어내야 겹치지 않는다.
  // 칩 줄 수가 상태(피킹 모드·레이어 선택)에 따라 달라 고정값을 못 쓴다.
  const [headerHeight, setHeaderHeight] = useState(0);
  // 시트를 화면 맨 위까지 올리면 검색바·칩을 잠깐 숨긴다(시트 위에 겹쳐 그려지지 않게). useSheetSizing 이 알려 준다.
  const [headerCovered, setHeaderCovered] = useState(false);
  const headerFade = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    Animated.timing(headerFade, { toValue: headerCovered ? 0 : 1, duration: 160, useNativeDriver: false }).start();
  }, [headerCovered, headerFade]);
  const sheetHeaderCtx = useMemo(() => ({ headerHeight, onCoverHeader: setHeaderCovered }), [headerHeight]);
  // 넓은 창(폴드 펼침·가로·웹)에서 지도는 끝까지 깔되, 검색바·칩·배너·하단 시트는
  // 가운데 한 폭(SHEET_MAX_WIDTH)에 모은다. 좁은 화면에선 0 이라 기존 배치 그대로다.
  // 폴드를 접고 펴면 앱이 다시 시작되지 않고 창 크기만 바뀌므로 매 렌더 다시 계산한다.
  const sideGutter = useCenteredGutter();
  const overlayInset = { left: 12 + sideGutter, right: 12 + sideGutter };
  /** 필터 없이 검색으로만 지도에 올린 업체 id. 그 시트가 닫히면 마커도 거둔다(아래 effect). */
  const searchedPartnerIdRef = useRef<string | null>(null);
  /** 지금 지도 이동 범위가 먼 제휴 지점 둘레면 그 지점 id, 캠퍼스 일대면 null(`mapBounds.ts`). */
  const farViewPartnerIdRef = useRef<string | null>(null);
  // 네이버 지도 인증 실패. 실패해도 지도는 빈 화면으로만 남아, 알리지 않으면
  // 사용자가 앱이 멈춘 것으로 오해한다.
  const [mapAuthFailed, setMapAuthFailed] = useState(false);
  /** 아래 탭바(또는 안전 영역) 높이. 경로를 화면에 맞출 때 읽는다(값은 아래 bottomInset 에서 채운다). */
  const bottomInsetRef = useRef(0);
  // 지도를 길게 눌러 잡은 제보 위치. null 이면 작성창이 닫혀 있다.
  const [reportTarget, setReportTarget] = useState<ReportTarget | null>(null);
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
   * "캠퍼스로 돌아가기". 지도를 처음 위치(캠퍼스 중심·기본 줌)로 되돌린다. GPS 는 쓰지 않는다.
   * 이미 배포된 원격 map.html 에도 바로 먹히도록 새 메시지 타입 대신 페이지 전역 `map` 을 직접 움직인다.
   */
  const handleRecenter = useCallback(() => {
    // 먼 제휴 지점을 보던 중이어도 이동 범위를 캠퍼스 일대로 되돌린 뒤 옮긴다(범위가 좁으면 캠퍼스로 못 간다).
    farViewPartnerIdRef.current = null;
    webViewRef.current?.injectJavaScript(viewBoundsScript(CAMPUS_VIEW_BOX));
    webViewRef.current?.injectJavaScript(
      // 진행 중인 '눌러 보기' 확대가 늦게 끝나며 돌아온 화면을 옛 핀 19배로 덮지 않게 먼저 멈춘다(옛 map.html 엔 없어 확인하고 부른다).
      `if (window.map && window.naver) { if (typeof window.cancelFocus === "function") window.cancelFocus(); map.setCenter(new naver.maps.LatLng(${CAMPUS_CENTER.lat}, ${CAMPUS_CENTER.lng})); map.setZoom(${DEFAULT_ZOOM}); } true;`,
    );
  }, []);

  // 이미 지도 탭에 있을 때 하단 '지도' 탭을 다시 누르면 학사모 버튼처럼 캠퍼스로 돌아간다(10-08 요청).
  // tabPress 는 다른 탭에서 넘어올 때도 오지만 그땐 아직 이 화면이 포커스가 아니라 건너뛴다.
  useEffect(() => {
    // 지도는 하단 탭의 화면이라 탭 바가 보내는 tabPress 가 이 화면의 navigation 으로 바로 온다.
    const tabNavigation = navigation as unknown as { addListener: (type: "tabPress", cb: () => void) => () => void };
    return tabNavigation.addListener("tabPress", () => {
      if (navigation.isFocused()) handleRecenter();
    });
  }, [navigation, handleRecenter]);

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
      if (!accessToken) {
        promptLogin("제보를 남기려면 로그인해 주세요.", logout);
        return;
      }
      setSelectedBuilding(null);
      setSelectedPartner(null);
      setSelectedReport(null);
      setSelectedFacilityBuilding(null);
      setReportTarget(at);
    },
    onLeaveBuildingFacility: () => facilityNav.leave(),
  });
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
    onConfirmReport: (center) => setReportTarget({ lat: center.lat, lng: center.lng, buildingName: center.buildingName }),
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
  // 근처 알림 테스트 위치를 바꿀 때 다시 판단하는 데 쓰는 지도 데이터(대상 업체·캠퍼스 건물·긴급 스위치).
  const nearbySourceRef = useRef({ partners: allPartners, campusPoints: buildings, serverEnabled: false });
  nearbySourceRef.current = { partners: allPartners, campusPoints: buildings, serverEnabled: mapData?.nearbyAlertsEnabled === true };
  const nearbyDebug = useNearbyDebugTools(webViewRef, nearbySourceRef);

  // 웹은 이 문서를 처음 한 번만 넣는다(NaverMapView.web). 그때 있는 건물로 굽고, 그 뒤 바뀐 건물은 setBuildings 로 보낸다.
  // 앱(WebView)은 이 값을 쓰지 않고 배포된 map.html(구운 초기 건물)을 불러온다.
  const mapHTML = useMemo(() => buildMapHTML(getMapDataSnapshot()?.buildings ?? []), []);




  const visiblePartners = useMemo(
    () => (hasActiveFilter(activeFilter) ? filterPartners(allPartners, activeFilter) : []),
    [allPartners, activeFilter],
  );

  /** 화면 맞춤 범위 밖이라 눈에 잘 안 띄는 지점 수. 안내 배지에 쓴다. */
  /**
   * 지도 위 안내 줄(캠퍼스 밖 N곳 등)을 탭하거나 X 로 닫은 기록. 문구 단위로 기억해, 숫자가 바뀌는 등
   * 내용이 달라지면 다시 보여 준다. 앱을 다시 켜면 초기화된다.
   */
  const [dismissedNotices, setDismissedNotices] = useState<ReadonlySet<string>>(() => new Set());
  const dismissNotice = useCallback((message: string) => {
    setDismissedNotices((prev) => new Set(prev).add(message));
  }, []);
  /** 지금 필터에 걸렸지만 지도 화면 범위 밖이라 핀이 잘 안 보이는 업체들(구로·강남·성수 등). */
  const offscreenPartners = useMemo(
    () => partnersOutsideFocus(visiblePartners),
    [visiblePartners],
  );
  const offscreenCount = offscreenPartners.length;

  /**
   * 건물명이 지도 데이터의 건물과 안 맞아 좌표를 못 찾은 편의시설 수.
   * 조용히 빠지면 데이터를 넣었는데 지도에 안 뜨는 이유를 알 수 없어 알린다.
   */
  const unresolvedCount = useMemo(
    () =>
      facilityKind === null
        ? 0
        : unresolvedFacilities(facilities, buildings).filter((f) => f.kind === facilityKind).length,
    [facilities, buildings, facilityKind],
  );

  /** 필터는 걸었는데 걸리는 업체가 없는 상태. 빈 지도만 보여주지 않고 알려준다. */
  const isEmptyResult =
    hasActiveFilter(activeFilter) && visiblePartners.length === 0;



  /**
   * 건물·제휴·편의시설·제보 시트를 여는 동안에는 아래 탭 막대를 잠시 숨겨 시트를 화면 맨 아래까지 내린다.
   * 시트를 읽는 중엔 탭을 옮길 일이 거의 없고, 탭바가 시트 아래를 받쳐 지도를 더 가렸다. 닫으면 다시 보인다.
   */
  const sheetOpen =
    selectedBuilding !== null ||
    selectedPartner !== null ||
    selectedReport !== null ||
    (selectedFacilityBuilding !== null && facilityKind !== null);
  /**
   * 길찾기 중(출발·도착 막대가 떠 있는 동안, 11-09 사용자 요청): 다른 탭으로 갈 일이 없고 제휴 검색·칩도 쓸 일이 없어
   * 아래 탭 막대와 위 검색바·칩을 숨긴다. 그 자리를 출발·도착 막대(오른쪽 위 X 로 끝내기)와 아래 경로 카드가 쓴다.
   */
  const routeMode = !pickingLocation && (fromBuilding !== null || fromMyLocation || toBuilding !== null);
  const tabBarHidden = sheetOpen || routeMode;
  // 화면을 그리기 전에(useLayoutEffect) 탭바를 바꾼다. useEffect 면 시트와 탭바가 한 프레임 겹쳐 보여 반짝였다.
  useLayoutEffect(() => {
    navigation.setOptions({ tabBarStyle: tabBarHidden ? MAP_TAB_BAR_HIDDEN_STYLE : MAP_TAB_BAR_STYLE });
  }, [navigation, tabBarHidden]);
  /** 지도 위 아래쪽 버튼·카드의 기준선. 탭바가 숨으면 홈 인디케이터 여백만. */
  const bottomInset = tabBarHidden ? insets.bottom : tabBarHeight;
  bottomInsetRef.current = bottomInset;
  // 탭바를 숨긴 동안 시트는 화면 맨 아래에 붙는다(지도 아래쪽 NAVER 로고 줄까지 덮는다).
  // 홈 인디케이터 여백은 각 시트가 안쪽 아래 여백(useSafeAreaInsets)으로 띄운다.
  const sheetBottom = sheetOpen ? 0 : tabBarHeight;

  const { handleRouteTap, ignoresMapTap } = route;
  const { handleCenterMessage } = picker;
  const handleNearbyCenter = nearbyDebug.handleCenter;
  const handleWebViewMessage = useCallback(
    (event: { nativeEvent: { data: string } }) => {
      try {
        const msg = JSON.parse(event.nativeEvent.data);

        // 지도에서 회색(다른) 경로를 눌렀다(11-09) — 그 길로 바꾼다. 같은 손동작이 지도 탭으로도 들어와 건물 시트가 열렸으면 닫는다.
        if (msg.type === "routeTap" && typeof msg.index === "number") {
          handleRouteTap(msg.index);
          setSelectedBuilding(null);
          postToMap({ type: "selectBuilding", name: null });
          return;
        }
        // 경로를 누른 손동작의 지도 탭, 경로를 보여 주는 동안의 건물 탭은 무시한다.
        if (ignoresMapTap(msg.type, pickingLocation)) {
          postToMap({ type: "selectBuilding", name: null });
          return;
        }

        // 위치 선택 모드 중 지도가 멈출 때마다 온다. 화면 중앙 좌표를 갱신한다.
        if (msg.type === "pickerCenter") {
          handleCenterMessage(msg);
          return;
        }
        // 근처 알림 테스트 위치(개발 도구): 지도 가운데 좌표.
        if (msg.type === "nearbyTestCenter" && typeof msg.lat === "number" && typeof msg.lng === "number") {
          handleNearbyCenter({ lat: msg.lat, lng: msg.lng });
          return;
        }
        if (msg.type === "mapAuthFailure") {
          setMapAuthFailed(true);
          return;
        }
        // 시트 열고 닫기(건물·제휴·제보·시설을 누름).
        handleSelectionTap(msg);
      } catch {}
    },
    [handleRouteTap, ignoresMapTap, handleCenterMessage, handleNearbyCenter, handleSelectionTap, pickingLocation, postToMap, setSelectedBuilding],
  );


  const handleSelectAffiliation = filters.selectAffiliation;

  const handleSelectCategory = filters.selectCategory;

  const handleSearchSelectFacility = useCallback(
    (facility: Facility) => facilityNav.openSheet(facility.kind, facility.buildingName, facility),
    [facilityNav.openSheet],
  );

  const selectedBuildingFacilities = useMemo(
    () => (selectedBuilding ? facilities.filter((f) => f.buildingName === selectedBuilding.name) : []),
    [selectedBuilding, facilities],
  );

  // 먼 지점 시트를 닫았거나(어떤 경로로든) 다른 것을 골랐으면 이동 범위를 캠퍼스로 되돌리고 캠퍼스로 돌아온다.
  useEffect(() => {
    const farId = farViewPartnerIdRef.current;
    if (farId !== null && selectedPartner?.id !== farId) handleRecenter();
  }, [selectedPartner, handleRecenter]);

  const handleClosePartner = useCallback(() => {
    setSelectedPartner(null);
    postToMap({ type: "selectPartner", id: null });
  }, [postToMap]);


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

  const handleSetFrom = useCallback(() => {
    if (selectedBuilding) beginFrom(selectedBuilding);
  }, [selectedBuilding, beginFrom]);

  const handleSetTo = useCallback(() => {
    if (selectedBuilding) beginTo(selectedBuilding);
  }, [selectedBuilding, beginTo]);

  /** 시설 시트의 출발·도착. 그 시설이 있는 건물로 정한다(11-08). 지도 데이터에 그 건물이 없으면 버튼을 그리지 않는다. */
  const facilitySheetBuilding = useMemo(
    () => (selectedFacilityBuilding ? (buildings.find((b) => b.name === selectedFacilityBuilding) ?? null) : null),
    [buildings, selectedFacilityBuilding],
  );

  const handleFacilitySetFrom = useCallback(() => {
    if (facilitySheetBuilding) beginFrom(facilitySheetBuilding);
  }, [facilitySheetBuilding, beginFrom]);

  const handleFacilitySetTo = useCallback(() => {
    if (facilitySheetBuilding) beginTo(facilitySheetBuilding);
  }, [facilitySheetBuilding, beginTo]);

  /** 시트의 출발·도착 버튼 중 다음에 고를 쪽(건물 시트·시설 시트가 함께 쓴다). */
  const routeNext = nextRouteEndpoint(Boolean(fromBuilding || fromMyLocation), Boolean(toBuilding));

  const handleCloseBuilding = useCallback(() => {
    setSelectedBuilding(null);
    // 배너만 닫고 핀은 그대로 둔다. 켜 둔 핀이 배너를 닫을 때마다 사라지면
    // 다시 켜야 해서 번거롭다. 강조 표시만 되돌린다.
    postToMap({ type: "selectBuilding", name: null });
  }, [postToMap]);


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

  /**
   * 제보 등록 성공. 작성창은 닫지 않는다 — 새 제보는 `PENDING`(운영진 검토 대기)이라 지도에는 승인 후에
   * 뜨므로, 작성창이 그 안내를 보여 주고 사용자가 '확인'을 눌러 닫는다(onClose).
   * 레이어가 켜져 있으면 목록은 새로 받아 둔다(그 사이 승인된 다른 제보 반영).
   */
  const handleReportCreated = useCallback(() => {
    if (reportsOn) reportsResource.retry();
  }, [reportsOn, reportsResource.retry]);


  /** 제보는 로그인이 필요하다. 게스트는 위치를 고르고 작성창을 다 채운 뒤가 아니라 시작할 때 묻는다. */
  const handleStartReportPicker = useCallback(() => {
    if (!accessToken) {
      promptLogin("제보를 남기려면 로그인해 주세요.", logout);
      return;
    }
    picker.start("report");
  }, [accessToken, logout, picker.start]);



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
    startReportPicker: handleStartReportPicker,
    openReport,
    showAllReports,
    showNearbyGroup: search.showNearbyGroup,
    selectPartner: search.selectPartner,
    openFacility: (facility) => facilityNav.openSheet(facility.kind, facility.buildingName, facility),
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

  /**
   * 안드로이드 뒤로가기(웹은 Esc)는 위치 고르기·열린 시트부터 닫는다. 시트·고르기는 화면 안 상태라 내비게이션이
   * 모르고, 지도가 첫 탭이라 그냥 두면 앱이 꺼진다. 닫기(X)와 똑같은 처리를 쓴다. 닫을 게 없으면 기본 동작에 맡긴다.
   */
  const closeTopMapLayer = useCallback((): boolean => {
    // 검색·작성·길찾기 창이 떠 있으면 그 창이 먼저 닫혀야 한다(웹 Esc 가 아래 시트까지 닫지 않게).
    if (search.visible || showRoute || reportTarget !== null || infoSuggest.visible) return false;
    if (pickingLocation) {
      handleCancelReportPicker();
      return true;
    }
    if (selectedReport) {
      setSelectedReport(null);
      return true;
    }
    if (selectedPartner) {
      handleClosePartner();
      return true;
    }
    if (selectedFacilityBuilding !== null && facilityKind !== null) {
      // 건물에서 들어간 시설 시트면 '뒤로'는 그 건물 시트로(시트의 '<'와 같다, 11-08).
      if (facilityNav.facilityFrom) facilityNav.backToBuilding();
      else setSelectedFacilityBuilding(null);
      return true;
    }
    if (selectedBuilding) {
      handleCloseBuilding();
      return true;
    }
    return false;
  }, [
    search.visible,
    showRoute,
    reportTarget,
    infoSuggest.visible,
    pickingLocation,
    selectedReport,
    selectedPartner,
    selectedFacilityBuilding,
    facilityKind,
    facilityNav.facilityFrom,
    facilityNav.backToBuilding,
    selectedBuilding,
    handleCancelReportPicker,
    handleClosePartner,
    handleCloseBuilding,
  ]);
  useMapBackHandler(closeTopMapLayer);


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
  /** 아래 길찾기 결과 카드가 떠 있으면 그 위로 올린다. */
  const mapMenuBottom =
    20 + bottomInset + (!pickingLocation && !sheetOpen && (fromBuilding || fromMyLocation) && toBuilding ? routeCardHeight + 8 : 0);
  const mapMenuStyle = useMemo(() => [styles.mapControls, { bottom: mapMenuBottom }], [mapMenuBottom]);
  /** 검색바·칩(headerHeight) 아래부터 접기 버튼(46 + 간격 10) 위까지. */
  const mapMenuMaxItemsHeight = Math.max(160, windowHeight - (20 + tabBarHeight) - 56 - headerHeight - 12);
  const mapMenuReportFilter = useMemo(
    () => ({
      categories: REPORT_CATEGORY_KEYS,
      selected: reportCategories,
      onToggleCategory: handleToggleReportCategory,
      hotOn: hotOnly,
      hotAvailable,
      onToggleHot: handleToggleHot,
    }),
    [reportCategories, handleToggleReportCategory, hotOnly, hotAvailable, handleToggleHot],
  );
  /** '내 위치 켜기': 운영은 처리방침 11-16판 적용일부터. 테스트 앱(개발 도구)은 미리 확인하게 바로 보인다. */
  const canShowMyLocationButton = canLocate() && (nearbyDebug.enabled || kstTodayYmd() >= MY_LOCATION_BUTTON_FROM);

  // ---- 검색·제보·정보 제보 창 ----
  const handleCloseReportComposer = useCallback(() => setReportTarget(null), []);

  // ---- 아래 시트 ----
  /** 시설 시트에 보일 그 건물의 (지금 고른 종류) 시설. */
  const selectedFacilityItems = useMemo(
    () => facilities.filter((f) => f.kind === facilityKind && f.buildingName === selectedFacilityBuilding),
    [facilities, facilityKind, selectedFacilityBuilding],
  );
  /** 검색으로 찾아간 시설이 지금 시트의 것이면 그 줄을 강조한다. */
  const highlightedFacilityId =
    searchedFacility && searchedFacility.kind === facilityKind && searchedFacility.buildingName === selectedFacilityBuilding
      ? searchedFacility.id
      : null;
  const handleCloseReportSheet = useCallback(() => setSelectedReport(null), []);

  // ---- 지도 위 안내 줄 ----
  const handleDismissMapAuthError = useCallback(() => setMapAuthFailed(false), []);
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
  // 위치를 고르는 동안에는 지도 위 안내 줄·카드·메뉴를 모두 숨긴다(고르기 안내 줄·카드와 같은 자리에 겹친다).
  const routeHasFrom = fromBuilding !== null || fromMyLocation;
  /** 검색바·칩. 길찾기 중에는 출발·도착 막대가 그 자리로 올라간다(routeMode). */
  const showSearchAndChips = !pickingLocation && !routeMode;
  /** 길찾기 출발·도착 막대: 한쪽이라도 정했으면. */
  const showRouteStrip = !pickingLocation && (routeHasFrom || toBuilding !== null);
  /** 길찾기 결과 카드: 두 끝을 다 정했고 아래 시트가 닫혀 있으면. */
  const showRouteResultCard = !pickingLocation && !sheetOpen && routeHasFrom && toBuilding !== null;
  /** 오른쪽 아래 지도 메뉴. 시트가 열려 있으면 시트 가장자리로 삐져나와 숨긴다. */
  const showMapMenu = !pickingLocation && !sheetOpen && !nearbyDebug.picking;
  const showOverlayNotices = !pickingLocation;
  const showReportsLoadingNotice = reportsOn && showReportsLoading && reportsResource.errorMessage === null;
  const showReportsError = reportsOn && reportsResource.errorMessage !== null;
  /** HOT 제보 목록: HOT 을 켰고 그 목록을 받았을 때. 제보 시트를 연 동안에는 접어 지도를 덜 가린다. */
  const showHotReportList =
    showOverlayNotices && hotOnly && reportsOn && reportsMatchHot && !reportsEmpty && shownReportData !== undefined && !selectedReport;
  const showNearbyOverlayNote = nearbyDebug.overlayOn && !sheetOpen && !nearbyDebug.picking;

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

          {mapAuthFailed && <MapAuthErrorNotice onDismiss={handleDismissMapAuthError} />}

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
            onReport={handleStartReportPicker}
            onRoute={ROUTE_FINDING_ENABLED ? route.openSearch : undefined}
            onRecenter={handleRecenter}
            onMyLocation={canShowMyLocationButton ? myLocation.toggle : undefined}
            myLocationOn={myLocation.on}
            onToggleNearbyOverlay={nearbyDebug.menuAvailable ? nearbyDebug.toggleOverlay : undefined}
            onPickNearbyTestLocation={nearbyDebug.menuAvailable ? nearbyDebug.startPicking : undefined}
            nearbyOverlayOn={nearbyDebug.overlayOn}
            maxItemsHeight={mapMenuMaxItemsHeight}
            reportFilter={mapMenuReportFilter}
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
                  onSelectAffiliation={handleSelectAffiliation}
                  onSelectCategory={handleSelectCategory}
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
        onSelectFacility={handleSearchSelectFacility}
        autoFocus={!search.nearbyGroup}
        pinned={search.pinnedSection}
      />

      <ReportComposerModal
        target={reportTarget}
        onClose={handleCloseReportComposer}
        onCreated={handleReportCreated}
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
  mapControls: { position: "absolute", right: 12, bottom: 20, gap: 8 },
  // 건물·제휴업체·제보 배너를 얹는 레이어. 얘 자체엔 위치가 없고(화면 전체를 덮기만),
  // 필터 칩 줄과 같은 왼쪽 여백(16)에 맞춘다. 넓은 화면에서 가운데로 몰려 칩과 어긋나지 않게 하고, 너무 넓어지지 않게 폭만 묶는다.
  /** 출발: 남색 테두리 빈 원, 도착: 남색 채운 원(지도 표시와 같음). */
});
