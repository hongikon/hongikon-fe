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
import type { InfoSuggestLocation, InfoSuggestPrefill } from "../components/settings/InfoSuggestModal";
import { consumeMapIntent, setOpenReport, subscribeMapIntent } from "../lib/mapIntents";
import { useFocusEffect, useIsFocused, useNavigation } from "@react-navigation/native";
import { MAP_TAB_BAR_HIDDEN_STYLE, MAP_TAB_BAR_STYLE } from "../navigation/tabBarStyles";
import type { ReportTarget } from "../components/map/ReportComposerModal";
import ReportSheet from "../components/map/ReportSheet";
import { useAuth } from "../contexts/AuthContext";
import { getLiveReports } from "../apis/reports";
import HotReportList from "../components/map/HotReportList";
import RetryableError from "../components/common/RetryableError";
import { useToast } from "../components/common/Toast";
import { promptLogin, toReportMarkers, visibleReports } from "../utils/reports";
import PartnerChips from "../components/map/PartnerChips";
import PartnerSheet from "../components/map/PartnerSheet";
import PartnerSearchModal from "../components/map/PartnerSearchModal";
import PartnerNoticeModal from "../components/map/PartnerNoticeModal";
import NearbyFilterIntro from "../components/map/NearbyFilterIntro";
import LaunchNoticeModal from "../components/common/LaunchNoticeModal";
import { COLORS } from "../constants/colors";
import { getMapDataSnapshot, useMapData } from "../lib/mapData";
import { toMarker } from "../utils/partnerMarker";
import FloorDialSheet from "../components/map/FloorDialSheet";
import { type RouteAlternative } from "../apis/routes";

/** 길찾기 도착을 핀으로 고를 때, 핀 아래 건물이 없으면 이만큼 안의 가장 가까운 건물을 도착으로 쓴다(11-12). */
import { canLocate, locateOnce } from "../lib/nearbyPartners/platform";
import { notify } from "../utils/dialog";
import { MY_LOCATION_BUTTON_FROM, ROUTE_FINDING_ENABLED } from "../constants/route";
import { CAMPUS_CENTER, DEFAULT_ZOOM, FOCUS_ZOOM } from "../constants/map";
import { buildMapHTML, mapBuildingPayload } from "../utils/mapHtml";
import { filterPartners, hasActiveFilter, partnersOutsideFocus } from "../utils/partners";
import { CAMPUS_VIEW_BOX, farPointViewBox, isFarFromCampus, viewBoundsScript } from "../utils/mapBounds";
import { facilityMarkers, unresolvedFacilities } from "../utils/facilities";
import { kstTodayYmd, withExhibitionHints } from "../utils/exhibitions";
import type {
  Building,
  Facility,
  FacilityKind,
  MapLayer,
  Partner,
  ReportListItem,
} from "../types";
import { useCenteredGutter } from "../hooks/useCenteredGutter";
import { SHOW_DEVELOPER_TOOLS as NEARBY_DEBUG_TOOLS } from "../lib/nearbyPartners/debug";
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
import { useLiveLocation } from "../hooks/map/useLiveLocation";
import { REPORT_CATEGORY_KEYS, useMapReports } from "../hooks/map/useMapReports";
import { useMapBackHandler } from "../hooks/map/useMapBackHandler";
import { useAppForeground } from "../hooks/useAppForeground";
import { useLocationPicker } from "../hooks/map/useLocationPicker";
import { useRoutePlanner } from "../hooks/map/useRoutePlanner";
import { useMapFilters } from "../hooks/map/useMapFilters";
import { offscreenSummary } from "../utils/map/labels";

/** 경로 표시에 층을 병기한다. 층을 고르지 않았으면 건물명만. */

/** 관리 탭 "지도에서 보기"의 검토용 핀. label 은 핀 이름표(제보 제목), detail 은 안내 줄의 작성자·건물·층. */
interface PreviewTarget {
  lat: number;
  lng: number;
  label: string;
  detail: string;
}


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
  const [selectedBuilding, setSelectedBuilding] = useState<Building | null>(
    null,
  );
  const [selectedPartner, setSelectedPartner] = useState<Partner | null>(null);
  /** 관리 탭 "지도에서 보기"로 찍은 검토용 임시 핀. 있으면 지도 위에 안내 줄(닫기)을 띄운다. */
  const [previewTarget, setPreviewTarget] = useState<PreviewTarget | null>(null);
  /** 물어보기 "지도에서 보기"로 온 곳의 짧은 설명 카드(지도 위). 닫거나 그 곳 시트를 닫으면 사라진다(11-07). */
  const [askCard, setAskCard] = useState<{ title: string; summary: string } | null>(null);
  const previewTargetRef = useRef(previewTarget);
  previewTargetRef.current = previewTarget;
  const selectedPartnerRef = useRef(selectedPartner);
  selectedPartnerRef.current = selectedPartner;
  const selectedBuildingRef = useRef(selectedBuilding);
  selectedBuildingRef.current = selectedBuilding;
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
  /** 정보 제보 창(제휴·전시·행사 위치). null 이면 닫힘, 위치 없이 열 수도 있다(undefined 와 구분하려고 객체로 둔다). */
  const [partnerSuggest, setPartnerSuggest] = useState<{ location: InfoSuggestLocation | null; prefill?: InfoSuggestPrefill } | null>(null);
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
  const [selectedReport, setSelectedReport] = useState<ReportListItem | null>(
    null,
  );
  /** 편의시설 핀을 누른 건물. 그 건물의 (지금 고른 종류) 시설이 몇 층 어디에 있는지 보여 준다. */
  const [selectedFacilityBuilding, setSelectedFacilityBuilding] = useState<string | null>(null);
  /** 검색으로 찾아간 편의시설. 그 시설 시트에서 해당 줄을 강조한다. 핀을 직접 누르거나 칩을 바꾸면 지운다. */
  const [searchedFacility, setSearchedFacility] = useState<Facility | null>(null);
  const [showSearch, setShowSearch] = useState(false);
  /** 안내 줄에서 검색을 열면 그 업체들을 검색 화면 맨 위에 모아 보여 준다. 검색창 버튼으로 열면 null. */
  const [searchPinned, setSearchPinned] = useState<Partner[] | null>(null);
  /** 근처 제휴 알림(여러 곳)을 눌러 띄운 "지금 계신 곳 근처 제휴" 목록. 검색 창 맨 위에 둔다. */
  const [nearbyGroup, setNearbyGroup] = useState<Partner[] | null>(null);

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
      setPartnerSuggest({ location: { lat: center.lat, lng: center.lng, buildingName: center.buildingName } }),
    // 층 정보가 있는 건물이면 검색으로 고를 때처럼 층 다이얼이 뜬다.
    onConfirmRouteTo: (building) => beginTo(building),
    onCancelPartner: (previous) => setPartnerSuggest({ location: previous }),
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
  /** 물어보기 "여기서 가는 길"(routeTo 지도 요청)이 출발을 내 위치로 잡을 때 쓴다 — 요청 처리기가 이 함수보다 위에 있어 ref 로 잇는다. */
  const selectMyLocationRef = useRef<(() => Promise<void>) | null>(null);
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
   * 건물 배너가 닫히면(제보·제휴·편의시설을 누르거나 HOT 목록·링크로 제보를 열어서) 지도 페이지의 건물 강조도 거둔다.
   * 앱 쪽 상태만 비우면 페이지에는 전에 누른 건물 핀(예: 인문사회관 A동)이 선택된 채 남아, 다른 제보를 보는 중에도
   * 그 건물이 눌린 것처럼 보였다. 기존 `selectBuilding` 메시지라 이미 배포된 map.html 에도 먹힌다.
   */
  const prevSelectedBuildingRef = useRef<Building | null>(null);
  useEffect(() => {
    const prev = prevSelectedBuildingRef.current;
    prevSelectedBuildingRef.current = selectedBuilding;
    if (prev !== null && selectedBuilding === null) postToMap({ type: "selectBuilding", name: null });
  }, [selectedBuilding, postToMap]);

  /**
   * 업체 시트가 닫히면(제보·편의시설·건물을 누르거나, 칩·제보 위치 고르기·알림 등 어떤 경로로든) 페이지의 업체 강조도 거둔다.
   * 필터 없이 검색으로만 올린 마커였으면 시트와 함께 마커도 내린다 — 안 그러면 시트 없이 핀 하나만 지도에 남는다.
   * 필터가 켜져 있으면 마커는 그대로 둔다. 모두 기존 메시지라 이미 배포된 map.html 에도 먹힌다.
   */
  const prevSelectedPartnerRef = useRef<Partner | null>(null);
  useEffect(() => {
    const prev = prevSelectedPartnerRef.current;
    prevSelectedPartnerRef.current = selectedPartner;
    if (prev === null || selectedPartner !== null) return;
    if (!hasActiveFilter(activeFilter) && searchedPartnerIdRef.current !== null) {
      searchedPartnerIdRef.current = null;
      postToMap({ type: "clearPartners" });
      return;
    }
    postToMap({ type: "selectPartner", id: null });
  }, [selectedPartner, activeFilter, postToMap]);

  /**
   * 제휴·편의시설·제보 시트가 열려 있는지 페이지에 알린다. 열린 채 건물을 누르면 페이지가 건물로 날아가 확대하지 않고
   * 시트 닫기로만 쓰게 한다(sheetDismiss). 옛 map.html 은 이 메시지를 모르니 무시한다.
   */
  const otherSheetOpen = selectedReport !== null || selectedPartner !== null || selectedFacilityBuilding !== null;
  useEffect(() => {
    postToMap({ type: "sheetOpen", open: otherSheetOpen });
  }, [otherSheetOpen, postToMap]);

  /** 지도 페이지가 마커를 새로 받으면(setPartners) 선택이 풀린다. 고른 업체가 그 목록에 아직 있으면 다시 강조한다. */
  const reassertPartnerSelection = useCallback(
    (partnersOnPage: Partner[]) => {
      const current = selectedPartnerRef.current;
      if (current && partnersOnPage.some((p) => p.id === current.id)) {
        postToMap({ type: "selectPartner", id: current.id });
      }
    },
    [postToMap],
  );

  /** 제보 시트를 연다. 배너는 모두 같은 자리(아래)에 겹쳐 그려지므로 건물·업체·편의시설 배너는 닫는다. */
  const openReport = useCallback((report: ReportListItem | null) => {
    setSelectedBuilding(null);
    setSelectedFacilityBuilding(null);
    setSelectedPartner(null);
    setSelectedReport(report);
    // 같은 손동작으로 바로 뒤따르는 건물 탭(buildingTap)이 렌더 전에 와도 '방금 제보를 열었다'를 알 수 있게 바로 적어 둔다.
    if (report) {
      selectedReportRef.current = report;
      reportOpenedAtRef.current = Date.now();
    }
  }, []);

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

  /**
   * 제보 시트가 열려 있는 동안엔 건물 핀이 지도에 남지 않게 한다. 제보 마커(또는 그 이름표)를 누른 손동작이 지도 탭으로도
   * 넘어가 아래 건물(강당 S동 등) 핀이 같이 켜지는 경우가 있었다. 제보가 열리거나 바뀔 때마다 건물 강조를 거둔다.
   * 다음 프레임에도 한 번 더 보내, 같은 손동작으로 페이지가 뒤늦게 켠 핀까지 지운다(배포된 map.html 도 아는 메시지).
   */
  const selectedReportId = selectedReport?.id ?? null;
  const reportOpenedAtRef = useRef(0);
  // 지금 열린 제보를 알려 둔다 — 게스트가 로그인 안내로 떠났다 돌아오면 이 제보를 다시 띄운다(lib/mapIntents).
  useEffect(() => {
    setOpenReport(selectedReportId);
  }, [selectedReportId]);
  useEffect(() => {
    if (selectedReportId === null) return;
    reportOpenedAtRef.current = Date.now();
    postToMap({ type: "selectBuilding", name: null });
    const timer = setTimeout(() => postToMap({ type: "selectBuilding", name: null }), 120);
    return () => clearTimeout(timer);
  }, [selectedReportId, postToMap]);

  const showPreviewPin = useCallback(
    (preview: PreviewTarget) => {
      // focusReport 는 예전 지도 페이지도 알아듣는다(가운데로만). previewPin 은 새 페이지에서 핀까지 찍는다.
      postToMap({ type: "focusReport", lat: preview.lat, lng: preview.lng, zoom: FOCUS_ZOOM });
      postToMap({ type: "previewPin", lat: preview.lat, lng: preview.lng, label: preview.label });
    },
    [postToMap],
  );

  /** 미리보기 핀과 안내 줄을 거둔다. 핀은 배포된 원격 map.html 에도 먹히게 페이지 전역을 직접 지운다. */
  const clearPreview = useCallback(() => {
    if (previewTargetRef.current === null) return;
    setPreviewTarget(null);
    webViewRef.current?.injectJavaScript(
      "if (window.__previewPin) { window.__previewPin.setMap(null); window.__previewPin = null; } true;",
    );
  }, []);

  /**
   * 건물 시트 → '건물 안 시설'로 연 시설 시트를 정리한다(11-08). 아래 handleLeaveBuildingFacility 가 채운다 —
   * 지도 메시지 처리기가 그보다 위에 있어 ref 로 부른다. 그렇게 연 시트가 아니면 false.
   */
  const leaveBuildingFacilityRef = useRef<() => boolean>(() => false);
  /** 지도에서 경로를 누른 시각과, 메시지 처리기(위)에서 부를 경로 고르기(아래에서 채운다). */
  const routeTapAtRef = useRef(0);
  /** 출발·도착이 다 정해져 경로를 보여 주는 중인지(아래에서 채운다). 이때는 지도 탭으로 건물을 고르지 않는다. */
  const routeShownRef = useRef(false);
  routeShownRef.current = !pickingLocation && (fromBuilding !== null || fromMyLocation) && toBuilding !== null;
  const routeAlternativesRef = useRef<RouteAlternative[]>([]);
  const handleSelectRouteAlternativeRef = useRef<(index: number) => void>(() => {});

  const handleWebViewMessage = useCallback(
    (event: { nativeEvent: { data: string } }) => {
      try {
        const msg = JSON.parse(event.nativeEvent.data);

        // 지도에서 회색(다른) 경로를 눌렀다(11-09) — 그 길로 바꾼다. 같은 손동작이 지도 탭으로도 들어와 건물 시트가 열렸으면 닫는다.
        if (msg.type === "routeTap" && typeof msg.index === "number") {
          routeTapAtRef.current = Date.now();
          if (msg.index >= 0 && msg.index < routeAlternativesRef.current.length) handleSelectRouteAlternativeRef.current(msg.index);
          setSelectedBuilding(null);
          postToMap({ type: "selectBuilding", name: null });
          return;
        }
        // 경로를 누른 바로 그 손동작의 지도 탭은 무시한다. 경로를 보여 주는 동안에는 지도 탭 자체로 건물을 고르지 않는다(11-12) —
        // 길(선)을 누른 탭이 경로 선이 아닌 건물 위로 들어와 건물 배너가 경로 카드를 가렸다.
        if (
          ((msg.type === "buildingTap" || msg.type === "buildingDismiss") && Date.now() - routeTapAtRef.current < 500) ||
          (msg.type === "buildingTap" && routeShownRef.current)
        ) {
          postToMap({ type: "selectBuilding", name: null });
          return;
        }

        if (msg.type === "buildingTap") {
          // 제보를 연 바로 그 손동작이 건물 탭으로도 들어온 것 — 제보 시트는 두고 건물 핀만 거둔다.
          if (selectedReportRef.current && Date.now() - reportOpenedAtRef.current < 400) {
            postToMap({ type: "selectBuilding", name: null });
            return;
          }
          // 제보·제휴·편의시설 시트가 열린 채 지도를 누르면 그 탭은 '시트 닫기'로만 쓴다. 바로 건물 배너까지
          // 열면 시트가 내려가지 않고 엉뚱한 건물이 눌린 것처럼 보였다. 건물을 보려면 한 번 더 누른다.
          if (selectedReportRef.current || selectedPartnerRef.current || selectedFacilityBuildingRef.current) {
            setSelectedReport(null);
            setSelectedPartner(null);
            setSelectedFacilityBuilding(null);
            postToMap({ type: "selectBuilding", name: null });
            return;
          }
          const building = buildings.find((b) => b.name === msg.name) ?? null;
          setSelectedPartner(null);
          setSelectedFacilityBuilding(null);
          // 배너는 모두 같은 자리(아래)에 겹쳐 그려진다. 제보 시트를 닫지 않으면 새 건물 배너가 그 밑에 가려진다.
          setSelectedReport(null);
          setSelectedBuilding(building);
          // 앱 데이터에 없는 건물이면 배너가 안 뜬다. 페이지에 핀만 남지 않게 강조도 거둔다.
          if (!building) postToMap({ type: "selectBuilding", name: null });
          return;
        }

        if (msg.type === "partnerTap") {
          const partner = allPartners.find((p) => p.id === msg.id) ?? null;
          setSelectedBuilding(null);
          setSelectedFacilityBuilding(null);
          setSelectedReport(null);
          setSelectedPartner(partner);
          // 앱 데이터에 없는 업체면 시트가 안 뜬다. 페이지에 강조만 남지 않게 거둔다.
          if (!partner) postToMap({ type: "selectPartner", id: null });
          return;
        }

        if (msg.type === "reportTap") {
          openReport(reports.find((r) => r.id === msg.id) ?? null);
          return;
        }

        // 지도를 길게 누르면 그 자리에 제보를 남기는 작성창이 열린다.
        // 좌표는 건물로 스냅되지 않은 원본이고, 근처 건물명은 참고용이다.
        if (msg.type === "reportLongPress") {
          // 제보 등록은 로그인이 필요하다. 게스트가 작성창을 다 채운 뒤에야 막히지 않게 여기서 먼저 묻는다.
          if (!accessToken) {
            promptLogin("제보를 남기려면 로그인해 주세요.", logout);
            return;
          }
          setSelectedBuilding(null);
          setSelectedPartner(null);
          setSelectedReport(null);
          setSelectedFacilityBuilding(null);
          setReportTarget({
            lat: msg.lat,
            lng: msg.lng,
            buildingName: msg.buildingName ?? null,
          });
          return;
        }

        // 편의시설 핀: 건물 소개가 아니라 그 시설이 몇 층 어디에 있는지 보여 준다(FacilitySheet).
        if (msg.type === "facilityTap") {
          setSearchedFacility(null);
          setSelectedPartner(null);
          setSelectedBuilding(null);
          setSelectedReport(null);
          setSelectedFacilityBuilding(msg.buildingName ?? null);
          return;
        }

        // 제휴·편의시설·제보 시트가 열린 채 건물을 눌렀다. 그 탭은 시트 닫기로만 쓴다(페이지는 건물 선택·이동을 하지 않았다).
        if (msg.type === "sheetDismiss") {
          // 건물에서 들어간 시설 시트면 그 시설 핀까지 거둬 들어오기 전 지도로 돌아간다(11-08).
          leaveBuildingFacilityRef.current();
          setSelectedReport(null);
          setSelectedPartner(null);
          setSelectedFacilityBuilding(null);
          return;
        }

        // 지도 빈 곳을 눌렀다. 핀이 사라졌으니 건물 배너도 함께 닫는다.
        if (msg.type === "buildingDismiss") {
          // 지도 빈 곳을 누르면 열린 시트를 모두 내린다(제보 시트 포함).
          // 건물에서 들어간 시설 시트면 그 시설 핀까지 거둬 들어오기 전 지도로 돌아간다(11-08).
          leaveBuildingFacilityRef.current();
          setSelectedBuilding(null);
          setSelectedFacilityBuilding(null);
          setSelectedReport(null);
          return;
        }

        if (msg.type === "partnerDismiss") {
          setSelectedPartner(null);
          return;
        }

        if (msg.type === "mapAuthFailure") {
          setMapAuthFailed(true);
        }

        // 근처 알림 테스트 위치(개발 도구): 지도 가운데 좌표.
        if (msg.type === "nearbyTestCenter" && typeof msg.lat === "number" && typeof msg.lng === "number") {
          nearbyDebug.handleCenter({ lat: msg.lat, lng: msg.lng });
          return;
        }

        // 위치 선택 모드 중 지도가 멈출 때마다 온다. 화면 중앙 좌표를 갱신한다.
        if (msg.type === "pickerCenter") {
          picker.handleCenterMessage(msg);
          return;
        }
      } catch {}
    },
    [reports, accessToken, logout, buildings, allPartners, postToMap, openReport],
  );


  const handleSelectAffiliation = filters.selectAffiliation;

  const handleSelectCategory = filters.selectCategory;

  /**
   * 검색 결과를 고르면 그 업체만 지도에 올리고 화면 가운데로 가져온다.
   * 칩 필터는 모두 해제한다. 검색 결과가 칩 조건에 안 맞으면
   * 칩은 켜져 있는데 다른 업체가 떠 있는 어긋난 상태가 되기 때문이다.
   */
  const handleSearchSelect = useCallback(
    (partner: Partner) => {
      setShowSearch(false);
      filters.clearPartnerFilter();
      setSelectedBuilding(null);
      setSelectedReport(null);
      setSelectedFacilityBuilding(null);
      setSelectedPartner(partner);
      searchedPartnerIdRef.current = partner.id;

      // 캠퍼스에서 먼 지점은 검색으로만 찾아간다 — 옮기기 전에 이동 범위를 그 지점 둘레로 바꾼다(캠퍼스 범위로는 못 간다).
      // 시트를 닫거나 다른 것을 고르면 아래 effect 가 캠퍼스로 되돌린다.
      if (isFarFromCampus(partner)) {
        farViewPartnerIdRef.current = partner.id;
        webViewRef.current?.injectJavaScript(viewBoundsScript(farPointViewBox(partner)));
      } else if (farViewPartnerIdRef.current !== null) {
        farViewPartnerIdRef.current = null;
        webViewRef.current?.injectJavaScript(viewBoundsScript(CAMPUS_VIEW_BOX));
      }

      postToMap({
        type: "setPartners",
        partners: [toMarker(partner)],
        bounds: null,
      });
      postToMap({ type: "focusPartner", id: partner.id, zoom: FOCUS_ZOOM });
    },
    [postToMap, filters.clearPartnerFilter],
  );

  /**
   * 검색이나 건물 시트에서 편의시설(교무처·프린터 등)을 골랐다. 편의시설 갈래로 바꿔 그 종류 핀을 켜고, 그 건물(실측 좌표가 있으면
   * 그 지점)로 카메라를 옮긴 뒤 시설 시트를 연다. 칩을 누를 때와 달리 카메라를 옮긴다 — 어디 있는지 찾으러 온 것이므로.
   * `facility` 가 있으면(검색) 시트에서 그 줄을 강조한다.
   */
  const openFacilitySheet = useCallback(
    (kind: FacilityKind, buildingName: string, facility: Facility | null) => {
      setShowSearch(false);
      // 갈래 전환과 같은 정리: 학교 시설 갈래로 바꿔 그 종류 핀을 켜고, 제휴·제보 선택과 마커를 지운다.
      setSelectedPartner(null);
      setSelectedBuilding(null);
      // 제보는 갈래와 따로라 끄지 않는다(10-27). 열려 있던 제보 시트만 닫는다.
      setSelectedReport(null);
      filters.showFacilityKind(kind);
      const building = buildings.find((b) => b.name === buildingName);
      const lat = facility?.lat ?? building?.lat;
      const lng = facility?.lng ?? building?.lng;
      // 핀을 직접 누를 때와 같은 배율·자리(FOCUS_ZOOM, 시트 위 가운데)로 간다. 전에는 ±70m 범위 맞춤(fitBounds)이라
      // 화면 크기에 따라 한두 단계 덜 확대돼, 직접 누를 때(19)와 배율이 달랐다(10-14). 'focusReport' 는 이름과 달리
      // 좌표로 가는 일반 이동이다 — 배포된 지도 페이지에 이미 있는 메시지라 페이지를 다시 올리지 않아도 된다.
      // 검색으로 찾아왔을 때만 확대한다. 건물 시트에서 '건물 안 시설'을 누른 것은 핀을 누를 때처럼 지금 배율로 가운데만 옮긴다(10-27).
      if (lat !== undefined && lng !== undefined)
        postToMap({ type: "focusReport", lat, lng, ...(facility ? { zoom: FOCUS_ZOOM } : {}) });
      setSelectedFacilityBuilding(buildingName);
      setSearchedFacility(facility);
    },
    [buildings, postToMap, filters.showFacilityKind],
  );

  const handleSearchSelectFacility = useCallback(
    (facility: Facility) => openFacilitySheet(facility.kind, facility.buildingName, facility),
    [openFacilitySheet],
  );

  /** 건물 시트의 '건물 안 시설' 줄을 눌렀다. 검색과 같은 길로 그 종류 핀을 켜고 이 건물의 시설 시트를 연다(강조할 줄은 없음). */
  /**
   * 건물 시트에서 넘어온 시설 시트면 그 건물과 넘어오기 전 칩 상태를 기억한다. 시설 시트의 '<'로 그 건물 시트에 돌아간다(10-15 요청 —
   * 문헌관 → 프린터를 누르면 프린터 칩이 켜지며 시설 시트로 바뀌어, 문헌관 정보로 돌아갈 길이 없었다).
   */
  const [facilityFrom, setFacilityFrom] = useState<{ building: Building; layer: MapLayer | null; kind: FacilityKind | null } | null>(null);

  const handleOpenBuildingFacility = useCallback(
    (kind: FacilityKind) => {
      if (!selectedBuilding) return;
      const from = { building: selectedBuilding, layer, kind: facilityKind };
      openFacilitySheet(kind, selectedBuilding.name, null);
      setFacilityFrom(from);
    },
    [selectedBuilding, layer, facilityKind, openFacilitySheet],
  );

  // 시설 시트가 닫히거나 다른 건물·검색으로 바뀌면 돌아갈 곳을 잊는다.
  useEffect(() => {
    if (facilityFrom && selectedFacilityBuilding !== facilityFrom.building.name) setFacilityFrom(null);
  }, [facilityFrom, selectedFacilityBuilding]);


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
  // 테스트 앱(현장 테스트·개발 빌드)은 근처 알림을 실제 위치로 확인하려고 지도에 내 위치를 늘 보여 준다(11-03 운영진 요청).
  // 운영 앱은 길찾기를 볼 때만 위치를 읽는다(처리방침 11-09판).
  // 앱이 화면에 떠 있을 때만 읽는다 — 내리면 바로 멈춰 위치 표시(다이나믹 아일랜드)가 남지 않게(11-03).
  const appForeground = useAppForeground();
  /**
   * 지도 메뉴의 "내 위치 켜기"(11-06). 켜 둔 동안 지도 화면에서만 위치를 읽어 점을 보여 주고, 다시 누르거나 지도 탭을 떠나면
   * 끈다. 길찾기와 같이 휴대폰 안에서만 쓰고 저장하거나 보내지 않는다(처리방침 "지도에서 '내 위치 켜기'를 누를 때").
   */
  // 테스트 앱은 켠 채로 시작한다(11-03 운영진 요청). 다만 '내 위치 끄기'를 누르면 정말 끈다 — 전에는 테스트 앱이면
  // 메뉴와 상관없이 늘 위치를 읽어 끄기가 먹지 않았다(11-09 버그). 직접 끈 뒤에는 지도 탭에 돌아와도 다시 켜지 않는다.
  const [myLocationOn, setMyLocationOn] = useState(NEARBY_DEBUG_TOOLS);
  const myLocationUserOffRef = useRef(false);
  const mapFocused = useIsFocused();
  useEffect(() => {
    if (!mapFocused) setMyLocationOn(false);
    else if (NEARBY_DEBUG_TOOLS && !myLocationUserOffRef.current) setMyLocationOn(true);
  }, [mapFocused]);
  const locationActive = appForeground && (routeActive || (myLocationOn && mapFocused));
  // 내 위치 점: GPS 값마다 지도에 점만 그리고 화면은 다시 그리지 않는다(useLiveLocation).
  const liveLocation = useLiveLocation({
    active: locationActive,
    webViewRef,
    selectedRouteRef: route.selectedRouteRef,
    trackRouteOrigin: fromMyLocation,
    setRouteOrigin: route.setRouteOrigin,
  });
  // 고른 경로가 바뀌면 점을 새 경로선에 다시 붙인다.
  const redrawLiveLocation = liveLocation.redraw;
  useEffect(() => {
    redrawLiveLocation();
  }, [routeAlternatives, selectedRouteIndex, redrawLiveLocation]);


  handleSelectRouteAlternativeRef.current = route.selectAlternative;
  routeAlternativesRef.current = routeAlternatives;
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


  const handleBackToBuilding = useCallback(() => {
    const from = facilityFrom;
    if (!from) return;
    setFacilityFrom(null);
    setSearchedFacility(null);
    // 넘어오기 전 칩으로 되돌린다(같은 종류면 그대로 두고 시트만 닫는다). 제휴·제보에서 왔으면 그 갈래 칩만 다시 보인다.
    if (from.kind !== facilityKind) applyFacilityKind(from.kind);
    else setSelectedFacilityBuilding(null);
    setLayer(from.layer);
    setSelectedBuilding(from.building);
    postToMap({ type: "selectBuilding", name: from.building.name });
  }, [facilityFrom, facilityKind, applyFacilityKind, postToMap]);

  /**
   * 건물 시트에서 '건물 안 시설'(예: 스터디룸)로 들어간 시설 시트를 지도 빈 곳이나 X 로 닫았다(11-08 요청).
   * 사용자는 그 건물을 보던 중이었지 캠퍼스 전체의 스터디룸을 보려던 게 아니므로, 그 때문에 켜진 칩·핀을 거두고
   * 들어오기 전 지도(보통 아무것도 고르지 않은 지도)로 돌아간다. 칩을 직접 눌러 켠 핀은 지금처럼 남는다.
   */
  const handleLeaveBuildingFacility = useCallback((): boolean => {
    const from = facilityFrom;
    if (!from) return false;
    setFacilityFrom(null);
    setSearchedFacility(null);
    // 같은 종류 칩을 이미 켜 두고 들어왔으면 그 핀은 남기고 시트만 닫는다.
    if (from.kind !== facilityKind) applyFacilityKind(from.kind);
    else setSelectedFacilityBuilding(null);
    setLayer(from.layer);
    return true;
  }, [facilityFrom, facilityKind, applyFacilityKind]);
  leaveBuildingFacilityRef.current = handleLeaveBuildingFacility;

  const handleSelectFacilityKind = filters.selectFacilityKind;

  const handleSelectLayer = filters.selectLayer;

  /**
   * 지도 페이지가 (다시) 준비됐을 때 지금 화면 상태를 다시 그린다. 첫 로딩이 늦거나 실패해 자동으로
   * 다시 불러오면 페이지가 새로 떠서, 그 사이 보낸 마커 명령이 사라지기 때문이다(NaverMapView 참고).
   */
  const resyncMap = useCallback(() => {
    // 새로 뜬 페이지는 배포된 map.html 에 박힌 초기 위치로 시작해 지금 CAMPUS_CENTER 와 어긋날 수 있다.
    // 학사모(캠퍼스로 돌아가기)와 같은 위치로 먼저 맞춘다.
    handleRecenter();
    // 새 페이지는 시트가 닫힌 줄 안다. 열려 있으면 다시 알린다(건물 탭을 시트 닫기로만 쓰게).
    postToMap({
      type: "sheetOpen",
      open: !!(selectedReportRef.current || selectedPartnerRef.current || selectedFacilityBuildingRef.current),
    });
    // 고른 건물은 setBuildings 보다 먼저 알려 준다 — setBuildings 가 그 이름을 지키며 핀을 그린다.
    if (selectedBuildingRef.current) postToMap({ type: "selectBuilding", name: selectedBuildingRef.current.name });
    // 지도 데이터가 있으면 새 페이지의 건물(구운 초기값)을 지금 데이터로 바꾼다. 없으면 구운 건물을 그대로 둔다.
    if (mapData) postToMap({ type: "setBuildings", buildings: mapBuildingPayload(mapData.buildings) });
    // 먼 제휴 지점을 보던 중에 페이지가 다시 떴으면 그 지점 범위로 다시 옮긴다.
    const farPartner = selectedPartnerRef.current;
    if (farPartner && isFarFromCampus(farPartner)) {
      farViewPartnerIdRef.current = farPartner.id;
      webViewRef.current?.injectJavaScript(viewBoundsScript(farPointViewBox(farPartner)));
      postToMap({ type: "setPartners", partners: [toMarker(farPartner)], bounds: null });
      postToMap({ type: "focusPartner", id: farPartner.id, zoom: FOCUS_ZOOM });
    } else if (farPartner && !hasActiveFilter(activeFilter) && searchedPartnerIdRef.current === farPartner.id) {
      // 캠퍼스 근처 업체를 검색해 보던 중이었으면 그 마커를 다시 올린다(필터가 없어 아래에서 다시 그려지지 않는다).
      postToMap({ type: "setPartners", partners: [toMarker(farPartner)], bounds: null });
      reassertPartnerSelection([farPartner]);
      // 위 handleRecenter 가 캠퍼스로 옮겼으니 먼 지점처럼 그 업체로 다시 가져온다(마커를 올린 뒤라야 찾는다).
      postToMap({ type: "focusPartner", id: farPartner.id, zoom: FOCUS_ZOOM });
    }
    if (hasActiveFilter(activeFilter)) {
      const partners = filterPartners(allPartners, activeFilter);
      postToMap({
        type: "setPartners",
        partners: partners.map(toMarker),
        bounds: null,
      });
      reassertPartnerSelection(partners);
    }
    if (facilityKind !== null) {
      postToMap({
        type: "setFacilities",
        markers: withExhibitionHints(facilityMarkers(facilities, buildings, facilityKind), facilities, exhibitions),
      });
    }
    if (reportsOn && shownReportData !== undefined) {
      postToMap({ type: "setReports", markers: toReportMarkers(shownReportData) });
    }
    // 내 위치 점도 다시 그린다 — 지도가 다시 뜨면 점이 사라지고, 가만히 있으면 새 위치가 오지 않아 다시 그려지지 않았다(11-10).
    liveLocation.redrawShown();
    // 새 페이지는 경로 흐림(칩 핀)을 모른다. 경로가 그려진 중이면 다시 켠다.
    if (routeDrawnRef.current) postToMap({ type: "setRouteFocus", on: true });
    // 관리 탭 "지도에서 보기" 핀 — 지도가 뜨기 전에 보낸 명령은 사라지므로 다시 찍는다.
    if (previewTargetRef.current) showPreviewPin(previewTargetRef.current);
    // 지도가 늦게 뜬 사이 공유 링크·알림으로 연 제보가 있으면 그 자리로 다시 옮긴다.
    const opened = selectedReportRef.current;
    if (opened) postToMap({ type: "focusReport", lat: opened.lat, lng: opened.lng });
    // 위치를 고르던 중이면 새 페이지에서도 고르기 모드를 다시 켠다. 이전 페이지가 보낸 중앙 좌표는
    // 버리고 새 페이지가 다시 알려 줄 때까지 확인 버튼을 막는다.
    picker.resync();
  }, [mapData, allPartners, facilities, buildings, exhibitions, activeFilter, facilityKind, reportsOn, shownReportData, picker.resync, postToMap, handleRecenter, showPreviewPin, reassertPartnerSelection]);

  // 경로가 그려진 동안 칩 핀을 흐리게, 길찾기를 끝내면 되돌린다(11-08).
  useEffect(() => {
    postToMap({ type: "setRouteFocus", on: routeDrawn });
  }, [routeDrawn, postToMap]);

  /**
   * 지도 데이터가 새로 오면(저장본 → 서버 최신, 관리자 수정 반영) 지도 페이지의 건물과, 켜 둔 제휴·편의시설 마커를
   * 다시 그린다. 카메라는 옮기지 않는다(bounds 없음) — 보던 자리를 잃지 않게.
   */
  const mapDataSyncedRef = useRef<typeof mapData>(null);
  useEffect(() => {
    if (!mapData || mapDataSyncedRef.current === mapData) return;
    mapDataSyncedRef.current = mapData;
    postToMap({ type: "setBuildings", buildings: mapBuildingPayload(mapData.buildings) });
    if (hasActiveFilter(activeFilter)) {
      const partners = filterPartners(mapData.partners, activeFilter);
      postToMap({ type: "setPartners", partners: partners.map(toMarker), bounds: null });
      reassertPartnerSelection(partners);
    }
    if (facilityKind !== null) {
      postToMap({
        type: "setFacilities",
        markers: withExhibitionHints(
          facilityMarkers(mapData.facilities, mapData.buildings, facilityKind),
          mapData.facilities,
          mapData.exhibitions,
        ),
      });
    }
    // 고른 건물·업체 배너는 새 데이터의 같은 항목으로 바꾼다(없어졌으면 닫는다).
    setSelectedBuilding((prev) => (prev ? mapData.buildings.find((b) => b.name === prev.name) ?? null : prev));
    setSelectedPartner((prev) => (prev ? mapData.partners.find((p) => p.id === prev.id) ?? null : prev));
    // 지도 데이터가 바뀔 때만 돈다. 필터 상태가 바뀌는 경우는 각 핸들러가 이미 다시 그린다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mapData, postToMap]);


  /**
   * 열어 둔 제보가 새 목록에서 빠졌으면(반려·숨김·종료) 시트도 닫는다.
   * 목록이 새로 왔을 때만 본다 — 시트를 연 순간에 보면 알림 탭(focusReportFromNotification)이 따로 받아 연
   * 방금 승인된 제보가, 아직 도착하지 않은 레이어 새 목록 대신 이전 목록과 비교돼 바로 닫힌다.
   */
  const selectedReportRef = useRef(selectedReport);
  selectedReportRef.current = selectedReport;
  const selectedFacilityBuildingRef = useRef(selectedFacilityBuilding);
  selectedFacilityBuildingRef.current = selectedFacilityBuilding;
  useEffect(() => {
    const current = selectedReportRef.current;
    if (!current || shownReportData === undefined) return;
    if (!shownReportData.some((r) => r.id === current.id)) {
      setSelectedReport(null);
    }
  }, [shownReportData]);

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



  const toast = useToast();
  /** 알림발 제보 포커스 요청 순번. 연달아 탭했을 때 늦게 도착한 이전 요청 결과를 버린다. */
  const focusRequestRef = useRef(0);

  /**
   * 제보 알림(승인·새 제보)을 탭해 들어온 경우. 제보 레이어를 켜고, 진행 중 제보를 새로 받아 그 제보를 찾아
   * 시트를 띄우고 지도 가운데로 옮긴다. 레이어 목록은 승인 전에 받아 둔 것일 수 있어 따로 새로 받는다.
   * 이미 끝났거나 숨겨져 목록에 없으면 안내만 띄운다(지도는 그대로 쓸 수 있다).
   */
  const focusReportFromNotification = useCallback(
    async (reportId: number) => {
      const request = ++focusRequestRef.current;
      // 위치를 고르던 중이면 그 모드부터 끈다 — 안 그러면 지도가 탭을 막은 채 제보 시트만 뜬다.
      picker.stop();
      openReport(null);
      // 제보는 갈래(제휴·학교 시설)와 따로라 보던 칩은 그대로 둔다(10-27).
      // 레이어가 이미 켜져 있으면 목록도 새로 받아 방금 올라온 제보가 마커로 보이게 한다. 꺼져 있으면 켜는 순간 받는다.
      // HOT 만 보던 중이면 전체 제보로 바꾼다(알림으로 연 제보가 HOT 이 아닐 수 있다). 종류도 같은 까닭으로 전부 켠다.
      showAllReports();
      try {
        const live = visibleReports(await getLiveReports({ accessToken, includeUpcoming: true }));
        if (request !== focusRequestRef.current) return;
        const found = live.find(
          (r) => r.id === reportId && !(r.authorKey && hiddenAuthorKeys.has(r.authorKey)),
        );
        if (!found) {
          // 예정 제보는 3일 안에 시작할 때만 목록에 온다 — 그보다 먼 예정 제보도 여기로 온다.
          toast.show({ message: "이 제보는 지금 지도에 없어요. 아직 시작 전이거나 이미 끝났어요.", tone: "info" });
          return;
        }
        // 기다리는 사이 다른 배너를 열었을 수 있어 여기서 다시 닫고 연다.
        openReport(found);
        postToMap({ type: "focusReport", lat: found.lat, lng: found.lng });
      } catch {
        if (request !== focusRequestRef.current) return;
        toast.show({ message: "제보를 불러오지 못했어요. 잠시 뒤 다시 시도해 주세요.", tone: "info" });
      }
    },
    [accessToken, reportsOn, reportsResource.retry, postToMap, toast, hiddenAuthorKeys, picker.stop, openReport],
  );

  /**
   * 다른 화면에서 넘어온 지도 요청(`lib/mapIntents.ts`). 지도 탭에 올 때(또는 이미 떠 있으면 즉시) 처리한다.
   * - 설정의 정보 제보 창 "지도에서 위치 찍기" → 핀 고르기
   * - 제보 알림 탭·내 제보 내역의 표시 중 제보 → 그 제보 포커스
   * - 내 제보 내역의 "지도로 가서 제보하기" → 제보 위치 고르기
   */
  const handleMapIntent = useCallback(() => {
    const intent = consumeMapIntent();
    if (intent?.type === "pickPartnerLocation") {
      setPartnerSuggest(null);
      picker.start("partner", { partnerLocationBefore: null });
      return;
    }
    if (intent?.type === "focusReport") {
      void focusReportFromNotification(intent.reportId);
      return;
    }
    if (intent?.type === "startReport") {
      handleStartReportPicker();
      return;
    }
    if (intent?.type === "nearbyGroup") {
      // 근처에 제휴가 여러 곳 겹친 알림 → 그 곳들만 목록으로(알림을 만든 순서: 앞세운 곳, 그다음 가까운 순). 하나만 남으면 바로 시트.
      const group = intent.partnerIds.flatMap((id) => allPartners.filter((p) => p.id === id));
      if (group.length === 1) handleSearchSelect(group[0]);
      else if (group.length > 1) {
        setSearchPinned(null);
        setNearbyGroup(group);
        setShowSearch(true);
      }
      return;
    }
    if (intent?.type === "focusPartner") {
      // 근처 제휴 알림 → 검색에서 고른 것과 같게(그 업체만 올리고 가운데로, 시트 열기). 지도 데이터에서 빠진 업체면 지도만 연다.
      const partner = allPartners.find((p) => p.id === intent.partnerId);
      if (partner) handleSearchSelect(partner);
      return;
    }
    if (intent?.type === "focusPlace") {
      // 물어보기 답의 "지도에서 보기"(11-07). 앱 지도 데이터에 있는 곳만 — 없으면 지도만 연다(카드도 없음).
      picker.stop();
      clearPreview();
      const split = intent.target.indexOf(":");
      const kind = intent.target.slice(0, split);
      const id = intent.target.slice(split + 1);
      let title: string | null = null;
      if (kind === "partner") {
        const partner = allPartners.find((p) => p.id === id);
        if (partner) {
          handleSearchSelect(partner);
          title = partner.name;
        }
      } else if (kind === "facility") {
        const facility = facilities.find((f) => f.id === id);
        if (facility) {
          openFacilitySheet(facility.kind, facility.buildingName, facility);
          title = [facility.note, facility.buildingName].filter(Boolean).join(" · ");
        }
      } else if (kind === "building") {
        const building = buildings.find((b) => b.code === id);
        if (building) {
          // 지도에서 건물을 누를 때와 같은 정리(다른 시트를 닫고 건물 배너), 그 건물로 옮겨 확대.
          setShowSearch(false);
          setSelectedPartner(null);
          setSelectedFacilityBuilding(null);
          setSelectedReport(null);
          setSelectedBuilding(building);
          postToMap({ type: "selectBuilding", name: building.name });
          postToMap({ type: "focusReport", lat: building.lat, lng: building.lng, zoom: FOCUS_ZOOM });
          title = building.name;
        }
      }
      setAskCard(title ? { title: intent.title || title, summary: intent.summary ?? "" } : null);
      return;
    }
    if (intent?.type === "routeTo") {
      // 물어보기 답의 길찾기 버튼(11-09). 도착 = 그 건물(시설이면 그 건물·층). 출발 = 질문의 출발 건물(11-15 '제4공학관에서 홍문관'),
      // 없으면 내 위치(권한·위치를 못 쓰면 출발은 비워 둬 고르게 한다).
      picker.stop();
      clearPreview();
      setAskCard(null);
      const split = intent.target.indexOf(":");
      const kind = intent.target.slice(0, split);
      const id = intent.target.slice(split + 1);
      const facility = kind === "facility" ? facilities.find((f) => f.id === id) : undefined;
      const building = kind === "building"
        ? buildings.find((b) => b.code === id)
        : facility ? buildings.find((b) => b.name === facility.buildingName) : undefined;
      if (!building || !ROUTE_FINDING_ENABLED) return;
      setShowSearch(false);
      setSelectedPartner(null);
      setSelectedReport(null);
      route.commitTo(building, typeof facility?.floor === "number" ? facility.floor : null);
      const fromBuilding = intent.from?.startsWith("building:")
        ? buildings.find((b) => b.code === intent.from!.slice("building:".length))
        : undefined;
      if (fromBuilding && fromBuilding.code !== building.code) route.commitFrom(fromBuilding, null);
      else void selectMyLocationRef.current?.();
      return;
    }
    if (intent?.type === "previewLocation") {
      picker.stop();
      setSelectedBuilding(null);
      setSelectedPartner(null);
      setSelectedReport(null);
      setSelectedFacilityBuilding(null);
      const preview = { lat: intent.lat, lng: intent.lng, label: intent.label ?? "제보 위치", detail: intent.detail ?? "" };
      setPreviewTarget(preview);
      // 지도가 아직 안 떴으면(지도 탭 첫 방문) 이 명령은 사라진다 — 준비되면 resyncMap 이 previewTarget 으로 다시 찍는다.
      showPreviewPin(preview);
    }
  }, [picker.start, focusReportFromNotification, handleStartReportPicker, showPreviewPin, picker.stop, allPartners, handleSearchSelect,
    clearPreview, facilities, buildings, openFacilitySheet, postToMap, route.commitTo, route.commitFrom]);

  // 그 곳의 시트를 닫으면(지도를 누르거나 아래로 내림) 설명 카드도 거둔다.
  useEffect(() => {
    if (askCard && !selectedBuilding && !selectedPartner && !selectedFacilityBuilding) setAskCard(null);
  }, [askCard, selectedBuilding, selectedPartner, selectedFacilityBuilding]);

  useFocusEffect(handleMapIntent);
  // 지도 탭을 떠나면 미리보기 핀을 거둔다. 예전엔 지울 길이 없어 앱을 껐다 켜야 사라졌다.
  useFocusEffect(useCallback(() => () => clearPreview(), [clearPreview]));
  useEffect(() => subscribeMapIntent(handleMapIntent), [handleMapIntent]);

  const handleCancelReportPicker = picker.cancel;

  /**
   * 안드로이드 뒤로가기(웹은 Esc)는 위치 고르기·열린 시트부터 닫는다. 시트·고르기는 화면 안 상태라 내비게이션이
   * 모르고, 지도가 첫 탭이라 그냥 두면 앱이 꺼진다. 닫기(X)와 똑같은 처리를 쓴다. 닫을 게 없으면 기본 동작에 맡긴다.
   */
  const closeTopMapLayer = useCallback((): boolean => {
    // 검색·작성·길찾기 창이 떠 있으면 그 창이 먼저 닫혀야 한다(웹 Esc 가 아래 시트까지 닫지 않게).
    if (showSearch || showRoute || reportTarget !== null || partnerSuggest !== null) return false;
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
      if (facilityFrom) handleBackToBuilding();
      else setSelectedFacilityBuilding(null);
      return true;
    }
    if (selectedBuilding) {
      handleCloseBuilding();
      return true;
    }
    return false;
  }, [
    showSearch,
    showRoute,
    reportTarget,
    partnerSuggest,
    pickingLocation,
    selectedReport,
    selectedPartner,
    selectedFacilityBuilding,
    facilityKind,
    facilityFrom,
    handleBackToBuilding,
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

  /** 출발지 "내 위치". 이때 처음으로 "앱 사용 중" 위치 권한을 묻는다. */
  const handleSelectMyLocation = useCallback(async () => {
    const located = await locateOnce("route");
    if (located.status === "declined") return;
    if (located.status === "ok") {
      const first = { lat: located.lat, lng: located.lng, accuracy: located.accuracy };
      liveLocation.setPosition(first, { origin: true });
      route.startFromMyLocation();
      return;
    }
    if (located.status === "denied") {
      notify("위치를 쓸 수 없어요", "휴대폰 설정에서 홍익온의 위치 권한을 '앱을 사용하는 동안'으로 바꾸면 내 위치에서 출발할 수 있어요.");
    } else if (located.status === "servicesOff") {
      notify("위치 서비스가 꺼져 있어요", "휴대폰 설정에서 위치 서비스를 켜 주세요.");
    } else {
      notify("내 위치를 찾지 못했어요", "잠시 뒤 다시 해 보거나 건물을 골라 주세요.");
    }
  }, [closeRouteSearch]);
  selectMyLocationRef.current = handleSelectMyLocation;

  /**
   * 지도 메뉴 "내 위치 켜기". 처음 누를 때 "앱 사용 중" 위치 권한을 묻고, 켜져 있으면 끈다. 지도는 캠퍼스 일대만 움직일 수 있어
   * 그 밖이면 켜지 않는다. 캠퍼스 안일 때만 지도를 내 위치로 옮긴다(지도 그림 요청으로 드러나는 범위가 처음 화면과 같다).
   */
  const handleToggleMyLocation = useCallback(async () => {
    if (myLocationOn) {
      myLocationUserOffRef.current = true;
      setMyLocationOn(false);
      return;
    }
    myLocationUserOffRef.current = false;
    const located = await locateOnce("myLocation");
    if (located.status === "declined") return;
    if (located.status !== "ok") {
      if (located.status === "denied") {
        notify("위치를 쓸 수 없어요", "휴대폰 설정에서 홍익온의 위치 권한을 '앱을 사용하는 동안'으로 바꾸면 지도에서 내 위치를 볼 수 있어요.");
      } else if (located.status === "servicesOff") {
        notify("위치 서비스가 꺼져 있어요", "휴대폰 설정에서 위치 서비스를 켜 주세요.");
      } else {
        notify("내 위치를 찾지 못했어요", "잠시 뒤 다시 해 보세요.");
      }
      return;
    }
    const { south, north, west, east } = CAMPUS_VIEW_BOX;
    if (located.lat < south || located.lat > north || located.lng < west || located.lng > east) {
      notify("지도 범위 밖에 있어요", "학교 근처에 오면 지도에서 내 위치를 볼 수 있어요.");
      return;
    }
    liveLocation.setPosition({ lat: located.lat, lng: located.lng, accuracy: located.accuracy });
    setMyLocationOn(true);
    farViewPartnerIdRef.current = null;
    webViewRef.current?.injectJavaScript(viewBoundsScript(CAMPUS_VIEW_BOX));
    webViewRef.current?.injectJavaScript(
      `if (window.map && window.naver) { if (typeof window.cancelFocus === "function") window.cancelFocus(); map.panTo(new naver.maps.LatLng(${located.lat}, ${located.lng})); } true;`,
    );
  }, [myLocationOn]);

  const handleSwapRoute = route.swap;

  const handleClearRoute = route.clear;

  const handleSelectRouteBuilding = route.selectSearchBuilding;

  /** 검색바로 연 검색 창 — 안내 줄·근처 알림에서 모아 둔 업체 없이 연다. */
  const handleOpenSearch = useCallback(() => {
    setSearchPinned(null);
    setNearbyGroup(null);
    setShowSearch(true);
  }, []);
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
  const handleCloseSearch = useCallback(() => {
    setShowSearch(false);
    setNearbyGroup(null);
  }, []);
  /** 검색 창 맨 위에 모아 보일 업체: 근처 알림으로 연 곳들, 또는 안내 줄의 '지도에 안 보이는 곳'. */
  const searchPinnedSection = useMemo(
    () =>
      nearbyGroup && nearbyGroup.length > 0
        ? {
            title: "지금 계신 곳 근처 제휴",
            hint: "알림을 보낸 순간 함께 잡힌 곳이에요. 가까운 순으로, 누르면 그 가게 혜택을 볼 수 있어요.",
            partners: nearbyGroup,
          }
        : searchPinned && searchPinned.length > 0
        ? {
            title: `지도에 안 보이는 ${searchPinned.length}곳`,
            hint: "캠퍼스에서 멀어 지도에는 핀이 안 보여요. 누르면 그 주변으로 이동해요.",
            partners: searchPinned,
          }
        : undefined,
    [nearbyGroup, searchPinned],
  );
  const handleCloseReportComposer = useCallback(() => setReportTarget(null), []);
  const handleCloseInfoSuggest = useCallback(() => setPartnerSuggest(null), []);
  /** 정보 제보 창의 '지도에서 위치 고르기': 창을 닫고 핀 고르기로. 취소하면 전 위치로 돌아가게 기억해 둔다. */
  const partnerSuggestRef = useRef(partnerSuggest);
  partnerSuggestRef.current = partnerSuggest;
  const handleInfoSuggestPickOnMap = useCallback(() => {
    setPartnerSuggest(null);
    picker.start("partner", { partnerLocationBefore: partnerSuggestRef.current?.location ?? null });
  }, [picker.start]);

  // ---- 아래 시트 ----
  /** 제휴 시트의 '정보 수정': 그 가게로 정보 제보 창을 '정보 수정'으로 연다(이름·주소·소속·위치를 채워서). 시트는 닫는다. */
  const handleSuggestPartnerEdit = useCallback(() => {
    const partner = selectedPartnerRef.current;
    if (!partner) return;
    handleClosePartner();
    setPartnerSuggest({
      location: { lat: partner.lat, lng: partner.lng, buildingName: null },
      prefill: {
        type: "partner",
        kind: "fix",
        name: partner.name,
        address: partner.address ?? "",
        affiliation: partner.affiliations?.[0] ?? null,
      },
    });
  }, [handleClosePartner]);
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
  /** 시설 시트 닫기: 건물 시트에서 들어왔으면 그 건물 시트로 돌아가고, 아니면 닫는다. */
  const handleCloseFacilitySheet = useCallback(() => {
    if (!handleLeaveBuildingFacility()) setSelectedFacilityBuilding(null);
  }, [handleLeaveBuildingFacility]);
  const handleCloseReportSheet = useCallback(() => setSelectedReport(null), []);

  // ---- 지도 위 안내 줄 ----
  const handleDismissMapAuthError = useCallback(() => setMapAuthFailed(false), []);
  const handleAskCardClose = useCallback(() => setAskCard(null), []);
  const handleAskCardBack = useCallback(() => {
    setAskCard(null);
    navigation.navigate("Ask" as never);
  }, [navigation]);
  /** 'HOT' 목록에서 제보를 고르면 그 제보 시트를 열고 지도를 그 자리로. */
  const handleSelectHotReport = useCallback(
    (report: ReportListItem) => {
      openReport(report);
      postToMap({ type: "focusReport", lat: report.lat, lng: report.lng });
    },
    [openReport, postToMap],
  );
  /** '지도에 안 보이는 N곳 · 보기' — 그 업체들을 검색 창 맨 위에 모아 연다. */
  const handleShowOffscreenPartners = useCallback(() => {
    setNearbyGroup(null);
    setSearchPinned(offscreenPartners);
    setShowSearch(true);
  }, [offscreenPartners]);

  const handleSelectMyLocationPress = useCallback(() => void handleSelectMyLocation(), [handleSelectMyLocation]);
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

          {showOverlayNotices && askCard && (
            <AskPlaceCard title={askCard.title} summary={askCard.summary} onBack={handleAskCardBack} onClose={handleAskCardClose} />
          )}

          {showOverlayNotices && previewTarget && (
            <ReviewPinNotice label={previewTarget.label} detail={previewTarget.detail} onClose={clearPreview} />
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
            onMyLocation={canShowMyLocationButton ? handleToggleMyLocation : undefined}
            myLocationOn={myLocationOn}
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
              onOpenFacility={handleOpenBuildingFacility}
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
              onSuggestEdit={handleSuggestPartnerEdit}
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
              onClose={handleCloseFacilitySheet}
              onBack={facilityFrom ? handleBackToBuilding : undefined}
              backLabel={facilityFrom ? `${facilityFrom.building.name}로 돌아가기` : undefined}
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
            <MapSearchBar sideGutter={sideGutter} onPress={handleOpenSearch} />
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
        visible={showSearch}
        topInset={insets.top}
        onClose={handleCloseSearch}
        onSelect={handleSearchSelect}
        onSelectFacility={handleSearchSelectFacility}
        autoFocus={!nearbyGroup}
        pinned={searchPinnedSection}
      />

      <ReportComposerModal
        target={reportTarget}
        onClose={handleCloseReportComposer}
        onCreated={handleReportCreated}
      />

      <InfoSuggestModal
        visible={partnerSuggest !== null}
        location={partnerSuggest?.location ?? null}
        prefill={partnerSuggest?.prefill ?? null}
        onClose={handleCloseInfoSuggest}
        onPickOnMap={handleInfoSuggestPickOnMap}
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
