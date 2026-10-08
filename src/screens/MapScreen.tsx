import { useState, useCallback, useRef, useMemo, useEffect, useLayoutEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  FlatList,
  Modal,
  ActivityIndicator,
  Pressable,
  Animated,
  BackHandler,
  Platform,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets, SafeAreaProvider } from "react-native-safe-area-context";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import NaverMapView from "../components/map/NaverMapView";
import type { NaverMapViewHandle } from "../components/map/NaverMapView";
import FloorChips from "../components/map/FloorChips";
import BuildingSheet from "../components/map/BuildingSheet";
import FacilitySheet from "../components/map/FacilitySheet";
import MapFilterChips from "../components/map/MapFilterChips";
import ReportComposerModal from "../components/map/ReportComposerModal";
import InfoSuggestModal from "../components/settings/InfoSuggestModal";
import ReportMegaphoneIcon from "../components/common/ReportMegaphoneIcon";
import type { InfoSuggestLocation } from "../components/settings/InfoSuggestModal";
import { consumeMapIntent, setOpenReport, subscribeMapIntent } from "../lib/mapIntents";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import { MAP_TAB_BAR_HIDDEN_STYLE, MAP_TAB_BAR_STYLE } from "../navigation/tabBarStyles";
import type { ReportTarget } from "../components/map/ReportComposerModal";
import ReportSheet from "../components/map/ReportSheet";
import { useAuth } from "../contexts/AuthContext";
import { getLiveReports } from "../apis/reports";
import { getHotReports, hasCommunityFields } from "../apis/community";
import HotReportList from "../components/map/HotReportList";
import { useApiResource } from "../hooks/useApiResource";
import Button from "../components/common/Button";
import RetryableError from "../components/common/RetryableError";
import { useToast } from "../components/common/Toast";
import { promptLogin, toReportMarkers, visibleReports } from "../utils/reports";
import { parseServerTime } from "../utils/serverTime";
import { useHiddenAuthorKeys, withoutHiddenAuthors } from "../lib/hiddenAuthors";
import PartnerChips from "../components/map/PartnerChips";
import PartnerSheet from "../components/map/PartnerSheet";
import PartnerSearchModal from "../components/map/PartnerSearchModal";
import PartnerNoticeModal from "../components/map/PartnerNoticeModal";
import { Ionicons } from "@expo/vector-icons";
import { COLORS } from "../constants/colors";
import { getMapDataSnapshot, useMapData } from "../lib/mapData";
import {
  partnerCategoryMeta,
  PARTNER_MAP_ICON_COLOR,
} from "../constants/partnerCategories";
import { formatFloor } from "../utils/floors";
import { findRoutes, straightLineFallback } from "../utils/routing";
import type { RouteAlternative } from "../utils/routing";
import { ROUTE_FINDING_ENABLED } from "../constants/route";
import { CAMPUS_CENTER, DEFAULT_ZOOM, FOCUS_ZOOM } from "../constants/map";
import { buildMapHTML, mapBuildingPayload } from "../utils/mapHtml";
import {
  filterPartners,
  hasActiveFilter,
  partnerFocusBounds,
  partnersOutsideFocus,
} from "../utils/partners";
import { CAMPUS_VIEW_BOX, farPointViewBox, pointsBounds, isFarFromCampus, viewBoundsScript } from "../utils/mapBounds";
import type { PartnerFilter } from "../utils/partners";
import { facilityMarkers, unresolvedFacilities } from "../utils/facilities";
import { withExhibitionHints } from "../utils/exhibitions";
import type {
  Building,
  FacilityKind,
  MapLayer,
  Partner,
  PartnerAffiliation,
  PartnerCategory,
  ReportListItem,
} from "../types";
import { FONTS } from "../constants/typography";
import { useCenteredGutter } from "../hooks/useCenteredGutter";
import { RADIUS } from "../constants/spacing";
import { SheetHeaderContext } from "../hooks/useResizableSheet";
import ContentColumn from "../components/common/ContentColumn";

/** 경로 표시에 층을 병기한다. 층을 고르지 않았으면 건물명만. */
/** 제보 레이어가 아직 한 번도 못 받았을 때 쓰는 빈 목록. 렌더마다 새 배열을 만들지 않게 모듈에 둔다. */
const EMPTY_REPORTS: ReportListItem[] = [];

/** 관리 탭 "지도에서 보기"의 검토용 핀. label 은 핀 이름표(제보 제목), detail 은 안내 줄의 작성자·건물·층. */
interface PreviewTarget {
  lat: number;
  lng: number;
  label: string;
  detail: string;
}

function buildingLabel(building: Building, floor: number | null): string {
  return floor === null
    ? building.name
    : `${building.name} ${formatFloor(floor)}`;
}

/** WebView 로 넘길 마커 정보. 배지 색·아이콘을 여기서 정한다. */
function toMarker(partner: Partner) {
  const meta = partnerCategoryMeta(partner.category);
  // mapIcon 으로 아이콘을 덮어쓴 마커(병원 등)는 전용 색을, 아니면 카테고리 색을 쓴다.
  const color = partner.mapIcon
    ? PARTNER_MAP_ICON_COLOR[partner.mapIcon]
    : meta.color;
  return {
    id: partner.id,
    name: partner.name,
    lat: partner.lat,
    lng: partner.lng,
    color,
    iconKey: partner.mapIcon ?? partner.category,
  };
}

export default function MapScreen() {
  const webViewRef = useRef<NaverMapViewHandle>(null);
  const { accessToken, logout } = useAuth();
  // react-native-safe-area-context 는 iOS Modal 안에서 top inset 을 0으로 보고하는
  // 알려진 문제가 있어서 (https://github.com/th3rdwave/react-native-safe-area-context/issues/677),
  // Modal 바깥의 화면에서 미리 재서 넘긴다.
  const insets = useSafeAreaInsets();
  // 지도 탭만 탭바를 지도 위에 띄운다(TabNavigator.tsx) — 그만큼 화면 맨
  // 아래에 깔린 버튼·배너가 탭바에 가리지 않게 이 높이만큼 띄워 올린다.
  const tabBarHeight = useBottomTabBarHeight();
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
  // 1단(소속) · 2단(업종) 필터. 둘 다 null 이면 지도에 마커를 그리지 않는다.
  const [selectedAffiliation, setSelectedAffiliation] =
    useState<PartnerAffiliation | null>(null);
  const [selectedCategory, setSelectedCategory] =
    useState<PartnerCategory | null>(null);
  const [selectedPartner, setSelectedPartner] = useState<Partner | null>(null);
  /** 관리 탭 "지도에서 보기"로 찍은 검토용 임시 핀. 있으면 지도 위에 안내 줄(닫기)을 띄운다. */
  const [previewTarget, setPreviewTarget] = useState<PreviewTarget | null>(null);
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
  const [fromBuilding, setFromBuilding] = useState<Building | null>(null);
  const [toBuilding, setToBuilding] = useState<Building | null>(null);
  const [fromFloor, setFromFloor] = useState<number | null>(null);
  const [toFloor, setToFloor] = useState<number | null>(null);
  // 최상단 필터. 무엇을 볼지 먼저 고르게 한다. null 이면 하위 칩 줄이 없다.
  const [layer, setLayer] = useState<MapLayer | null>(null);
  const [facilityKind, setFacilityKind] = useState<FacilityKind | null>(null);
  // 지도를 길게 눌러 잡은 제보 위치. null 이면 작성창이 닫혀 있다.
  const [reportTarget, setReportTarget] = useState<ReportTarget | null>(null);
  // 제보 위치 선택 모드. 켜져 있으면 화면 중앙에 고정된 핀 아래로 지도를
  // 움직여 위치를 맞추고, 확인하면 그 좌표로 작성창을 연다.
  const [pickingLocation, setPickingLocation] = useState(false);
  /** 핀을 무엇 때문에 고르는지. 제보(report) 또는 정보 제보(partner, 설정의 정보 제보 창). 확인 버튼 문구와 다음 창이 달라진다. */
  const [pickerPurpose, setPickerPurpose] = useState<"report" | "partner">("report");
  /** 정보 제보 창(제휴·전시·행사 위치). null 이면 닫힘, 위치 없이 열 수도 있다(undefined 와 구분하려고 객체로 둔다). */
  const [partnerSuggest, setPartnerSuggest] = useState<{ location: InfoSuggestLocation | null } | null>(null);
  const [pickerCenter, setPickerCenter] = useState<{
    lat: number;
    lng: number;
    buildingName: string | null;
  } | null>(null);
  // 제보는 서버에서 받아오므로 켰을 때만 부른다. 지도·제휴·편의시설은
  // 정적 데이터라 서버가 죽어도 그대로 동작해야 한다.
  const [reportsOn, setReportsOn] = useState(false);
  /**
   * '🔥 HOT' 칩. 켜면 제보 레이어를 HOT·인기 제보(`GET /reports?sort=hot`, 최근 60분 🔥 순)로만 채우고 위에 짧은 목록을 띄운다.
   * reportsOn 과 함께 켜진다(제보 칩과는 둘 중 하나만 선택돼 보인다).
   */
  const [hotOnly, setHotOnly] = useState(false);
  /** 서버가 🔥 를 아는지(목록 항목에 fireCount 가 오는지). 모르면 HOT 칩을 숨긴다(커뮤니티 기능 배포 전). */
  const [hotAvailable, setHotAvailable] = useState(false);
  // 연결이 끊겨도 마지막으로 받은 제보는 계속 보여주고, 재연결되면 다시 받는다.
  const reportsResource = useApiResource(
    async (signal) =>
      hotOnly
        ? visibleReports(await getHotReports({ accessToken, signal }))
        : // 3일(72시간) 안에 시작할 예정 제보도 받아 따로(속이 빈 배지) 보여 준다. 구버전 서버는 무시하고 진행 중만 준다.
          visibleReports(await getLiveReports({ accessToken, signal, includeUpcoming: true })),
    [accessToken, hotOnly],
    { enabled: reportsOn, fallbackMessage: "제보를 불러오지 못했어요." },
  );
  useEffect(() => {
    if (!hotOnly && hasCommunityFields(reportsResource.data)) setHotAvailable(true);
  }, [reportsResource.data, hotOnly]);
  // 숨긴 사용자(기기 저장)의 제보는 지도에서 뺀다. 숨기는 순간 마커도 다시 그린다.
  const hiddenAuthorKeys = useHiddenAuthorKeys();
  const fetchedReportData = useMemo(
    () =>
      reportsResource.data === undefined
        ? undefined
        : withoutHiddenAuthors(reportsResource.data, hiddenAuthorKeys),
    [reportsResource.data, hiddenAuthorKeys],
  );
  /**
   * 지금 들고 있는 제보 목록이 어느 HOT 상태로 받은 것인지. HOT 을 켜고 끄면 새 목록이 오기 전까지 앞 목록이 남아,
   * HOT 목록에 HOT 이 아닌 제보가 잠깐 끼거나 '제보가 없어요' 안내가 반짝였다. 상태가 맞을 때만 목록·안내를 그린다.
   */
  const hotOnlyRef = useRef(hotOnly);
  hotOnlyRef.current = hotOnly;
  const [reportsDataHotOnly, setReportsDataHotOnly] = useState(hotOnly);
  useEffect(() => {
    setReportsDataHotOnly(hotOnlyRef.current);
  }, [reportsResource.data]);
  const reportsMatchHot = reportsDataHotOnly === hotOnly;
  /**
   * '제보를 불러오는 중…' 줄은 0.4초 넘게 걸릴 때만 띄운다. 금방 오는 경우엔 이 줄이 한 번 반짝이고
   * 바로 'HOT 제보가 없어요' 같은 결과 안내로 바뀌어, 문구가 두 번 뜨는 것처럼 보였다.
   */
  const reportsLoading = reportsResource.loading;
  const [showReportsLoading, setShowReportsLoading] = useState(false);
  useEffect(() => {
    if (!reportsLoading) {
      setShowReportsLoading(false);
      return;
    }
    const timer = setTimeout(() => setShowReportsLoading(true), 400);
    return () => clearTimeout(timer);
  }, [reportsLoading]);
  // HOT 을 켰는데 아직 전체 목록뿐이면, HOT 목록이 오기 전에도 HOT 인 제보만 남긴다(HOT 아닌 마커가 잠깐 남았다 사라지지 않게).
  const shownReportData = useMemo(
    () =>
      fetchedReportData !== undefined && hotOnly && !reportsMatchHot
        ? fetchedReportData.filter((report) => report.hot === true)
        : fetchedReportData,
    [fetchedReportData, hotOnly, reportsMatchHot],
  );
  const reports = shownReportData ?? EMPTY_REPORTS;
  const [selectedReport, setSelectedReport] = useState<ReportListItem | null>(
    null,
  );
  /** 편의시설 핀을 누른 건물. 그 건물의 (지금 고른 종류) 시설이 몇 층 어디에 있는지 보여 준다. */
  const [selectedFacilityBuilding, setSelectedFacilityBuilding] = useState<string | null>(null);
  const [showSearch, setShowSearch] = useState(false);
  /** 안내 줄에서 검색을 열면 그 업체들을 검색 화면 맨 위에 모아 보여 준다. 검색창 버튼으로 열면 null. */
  const [searchPinned, setSearchPinned] = useState<Partner[] | null>(null);
  const [showRoute, setShowRoute] = useState(false);
  const [routeTarget, setRouteTarget] = useState<"from" | "to" | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedRouteIndex, setSelectedRouteIndex] = useState(0);
  /** 길찾기 버튼. 기능이 꺼져 있으면(ROUTE_FINDING_ENABLED) 버튼 자체를 그리지 않는다. */
  const handleOpenRoute = useCallback(() => setShowRoute(true), []);

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

  // 웹은 이 문서를 처음 한 번만 넣는다(NaverMapView.web). 그때 있는 건물로 굽고, 그 뒤 바뀐 건물은 setBuildings 로 보낸다.
  // 앱(WebView)은 이 값을 쓰지 않고 배포된 map.html(구운 초기 건물)을 불러온다.
  const mapHTML = useMemo(() => buildMapHTML(getMapDataSnapshot()?.buildings ?? []), []);

  /**
   * 실측 경로망(routing.ts)에서 대안 경로를 구하고, 아직 그 구간을 못
   * 덮으면(양쪽 다 비어 있으면) 기존 직선거리 추정 하나로 대신한다.
   */
  const routeAlternatives = useMemo<RouteAlternative[]>(() => {
    if (!fromBuilding || !toBuilding) return [];
    const found = findRoutes(
      buildings,
      { building: fromBuilding, floor: fromFloor },
      { building: toBuilding, floor: toFloor },
    );
    if (found.length > 0) return found;
    return [straightLineFallback(fromBuilding, fromFloor, toBuilding, toFloor)];
  }, [buildings, fromBuilding, toBuilding, fromFloor, toFloor]);

  const selectedRoute = routeAlternatives[selectedRouteIndex] ?? null;

  const activeFilter = useMemo<PartnerFilter>(
    () => ({ affiliation: selectedAffiliation, category: selectedCategory }),
    [selectedAffiliation, selectedCategory],
  );

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

  /** 제보 레이어를 켰는데 지금 진행 중인 제보가 하나도 없는 상태. */
  const reportsEmpty =
    reportsOn &&
    reportsMatchHot &&
    reportsResource.data !== undefined &&
    reportsResource.errorMessage === null &&
    reports.length === 0;

  const filteredBuildings = searchQuery.trim()
    ? buildings.filter((b) => b.name.includes(searchQuery.trim()))
    : buildings;

  // 페이지 스크립트가 아직 안 떴으면(웹은 maps.js 를 받은 뒤에 주입한다) 조용히 건너뛴다. 준비되면 resyncMap 이 다시 보낸다.
  const postToMap = useCallback((msg: object) => {
    webViewRef.current?.injectJavaScript(
      `if (typeof window.handleNativeMessage === "function") window.handleNativeMessage(${JSON.stringify(JSON.stringify(msg))});true;`,
    );
  }, []);

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
  // 화면을 그리기 전에(useLayoutEffect) 탭바를 바꾼다. useEffect 면 시트와 탭바가 한 프레임 겹쳐 보여 반짝였다.
  useLayoutEffect(() => {
    navigation.setOptions({ tabBarStyle: sheetOpen ? MAP_TAB_BAR_HIDDEN_STYLE : MAP_TAB_BAR_STYLE });
  }, [navigation, sheetOpen]);
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

  const handleWebViewMessage = useCallback(
    (event: { nativeEvent: { data: string } }) => {
      try {
        const msg = JSON.parse(event.nativeEvent.data);

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
          setSelectedPartner(null);
          setSelectedBuilding(null);
          setSelectedReport(null);
          setSelectedFacilityBuilding(msg.buildingName ?? null);
          return;
        }

        // 제휴·편의시설·제보 시트가 열린 채 건물을 눌렀다. 그 탭은 시트 닫기로만 쓴다(페이지는 건물 선택·이동을 하지 않았다).
        if (msg.type === "sheetDismiss") {
          setSelectedReport(null);
          setSelectedPartner(null);
          setSelectedFacilityBuilding(null);
          return;
        }

        // 지도 빈 곳을 눌렀다. 핀이 사라졌으니 건물 배너도 함께 닫는다.
        if (msg.type === "buildingDismiss") {
          // 지도 빈 곳을 누르면 열린 시트를 모두 내린다(제보 시트 포함).
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

        // 위치 선택 모드 중 지도가 멈출 때마다 온다. 화면 중앙 좌표를 갱신한다.
        if (msg.type === "pickerCenter") {
          setPickerCenter({
            lat: msg.lat,
            lng: msg.lng,
            buildingName: msg.buildingName ?? null,
          });
          return;
        }
      } catch {}
    },
    [reports, accessToken, logout, buildings, allPartners, postToMap, openReport],
  );

  /** 두 단계를 합쳐 지도를 다시 그린다. 어느 칩 줄을 눌렀든 여기로 모인다. */
  const applyFilter = useCallback(
    (filter: PartnerFilter) => {
      setSelectedPartner(null);
      searchedPartnerIdRef.current = null;

      if (!hasActiveFilter(filter)) {
        postToMap({ type: "clearPartners" });
        return;
      }

      setSelectedBuilding(null);
      // 먼 제휴 지점을 보던 중이면 이동 범위를 먼저 캠퍼스로 되돌린다. 좁은 범위에선 아래 맞춤(fitBounds)이 잘리고,
      // ref 를 비워 두지 않으면 아래 effect 가 캠퍼스 기본 줌으로 다시 옮겨 칩 결과 맞춤을 덮는다.
      if (farViewPartnerIdRef.current !== null) {
        farViewPartnerIdRef.current = null;
        webViewRef.current?.injectJavaScript(viewBoundsScript(CAMPUS_VIEW_BOX));
      }
      const partners = filterPartners(allPartners, filter);
      postToMap({
        type: "setPartners",
        partners: partners.map(toMarker),
        bounds: partnerFocusBounds(partners),
      });
    },
    [allPartners, postToMap],
  );

  /** 같은 칩을 다시 누르면 그 단계만 해제한다. */
  const handleSelectAffiliation = useCallback(
    (affiliation: PartnerAffiliation) => {
      const next = selectedAffiliation === affiliation ? null : affiliation;
      setSelectedAffiliation(next);
      applyFilter({ affiliation: next, category: selectedCategory });
    },
    [selectedAffiliation, selectedCategory, applyFilter],
  );

  const handleSelectCategory = useCallback(
    (category: PartnerCategory) => {
      const next = selectedCategory === category ? null : category;
      setSelectedCategory(next);
      applyFilter({ affiliation: selectedAffiliation, category: next });
    },
    [selectedAffiliation, selectedCategory, applyFilter],
  );

  /**
   * 검색 결과를 고르면 그 업체만 지도에 올리고 화면 가운데로 가져온다.
   * 칩 필터는 모두 해제한다. 검색 결과가 칩 조건에 안 맞으면
   * 칩은 켜져 있는데 다른 업체가 떠 있는 어긋난 상태가 되기 때문이다.
   */
  const handleSearchSelect = useCallback(
    (partner: Partner) => {
      setShowSearch(false);
      setSelectedAffiliation(null);
      setSelectedCategory(null);
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
    [postToMap],
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

  /** 대안 경로들을 지도에 올린다. 고른 것을 굵게, 나머지는 옅게 그린다. */
  const drawRoute = useCallback(
    (routes: RouteAlternative[], selectedIndex: number) => {
      postToMap({
        type: "showRoute",
        routes: routes.map((route) => ({ points: route.points })),
        selectedIndex,
      });
    },
    [postToMap],
  );

  // fromBuilding/toBuilding/fromFloor/toFloor 가 바뀌어 routeAlternatives 가
  // 새로 계산될 때마다(둘 다 골랐을 때만 채워진다) 첫 번째 대안으로 다시 그린다.
  useEffect(() => {
    setSelectedRouteIndex(0);
    if (routeAlternatives.length > 0) drawRoute(routeAlternatives, 0);
  }, [routeAlternatives, drawRoute]);

  /** 대안 목록에서 다른 경로를 고르면, 다시 그리지 않고 스타일만 바꾼다. */
  const handleSelectRouteAlternative = useCallback(
    (index: number) => {
      setSelectedRouteIndex(index);
      postToMap({ type: "selectRouteAlternative", index });
    },
    [postToMap],
  );

  /**
   * 출발·도착이 모두 정해지면 길찾기 모달의 결과 카드를 보여준다. 층은 그 카드의
   * 칩 줄(`FloorChips`)에서 고르므로, 지도로 바로 돌아가지 않고 여기서 멈춘다.
   */
  const showRouteResult = useCallback(() => {
    setRouteTarget(null);
    setSearchQuery("");
    setShowRoute(true);
  }, []);

  /** 출발이 확정되면 도착지 선택 화면으로 자동으로 넘어간다. */
  const advanceToDestination = useCallback(() => {
    if (toBuilding) {
      showRouteResult();
      return;
    }
    setSearchQuery("");
    setRouteTarget("to");
    setShowRoute(true);
  }, [toBuilding, showRouteResult]);

  const beginFrom = useCallback(
    (building: Building) => {
      setFromBuilding(building);
      setFromFloor(null);
      setSelectedBuilding(null);
      advanceToDestination();
    },
    [advanceToDestination],
  );

  const beginTo = useCallback(
    (building: Building) => {
      setToBuilding(building);
      setToFloor(null);
      setSelectedBuilding(null);
      if (fromBuilding) {
        showRouteResult();
        return;
      }
      // 도착지부터 고른 경우엔 출발지 입력으로 이어준다.
      setSearchQuery("");
      setRouteTarget("from");
      setShowRoute(true);
    },
    [fromBuilding, showRouteResult],
  );

  const handleSetFrom = useCallback(() => {
    if (selectedBuilding) beginFrom(selectedBuilding);
  }, [selectedBuilding, beginFrom]);

  const handleSetTo = useCallback(() => {
    if (selectedBuilding) beginTo(selectedBuilding);
  }, [selectedBuilding, beginTo]);

  const handleCloseBuilding = useCallback(() => {
    setSelectedBuilding(null);
    // 배너만 닫고 핀은 그대로 둔다. 켜 둔 핀이 배너를 닫을 때마다 사라지면
    // 다시 켜야 해서 번거롭다. 강조 표시만 되돌린다.
    postToMap({ type: "selectBuilding", name: null });
  }, [postToMap]);

  /** 편의시설 핀을 지도에 반영한다. null 이면 모두 지운다. */
  const applyFacilityKind = useCallback(
    (next: FacilityKind | null) => {
      setFacilityKind(next);
      setSelectedFacilityBuilding(null);
      if (next === null) {
        postToMap({ type: "clearFacilities" });
        return;
      }
      const markers = withExhibitionHints(facilityMarkers(facilities, buildings, next), facilities, exhibitions);
      // 제휴 업체 칩처럼 지도를 옮긴다 — 이 종류 시설이 모두 들어오게, 시설들의 중심을 가운데로(10-08 요청).
      postToMap({ type: "setFacilities", markers, bounds: pointsBounds(markers) });
    },
    [facilities, buildings, exhibitions, postToMap],
  );

  /** 같은 칩을 다시 누르면 그 종류만 해제한다. 제휴 칩과 같은 규칙이다. */
  const handleSelectFacilityKind = useCallback(
    (kind: FacilityKind) => {
      applyFacilityKind(facilityKind === kind ? null : kind);
    },
    [facilityKind, applyFacilityKind],
  );

  /**
   * 최상단 칩. 갈래를 바꾸면 반대편 선택과 마커를 모두 정리한다.
   * 안 그러면 칩은 편의 시설인데 지도에는 제휴 마커가 떠 있는 어긋난 상태가 된다.
   */
  const handleSelectLayer = useCallback(
    (next: MapLayer) => {
      setLayer(layer === next ? null : next);
      setSelectedPartner(null);
      setSelectedBuilding(null);
      setSelectedAffiliation(null);
      setSelectedCategory(null);
      postToMap({ type: "clearPartners" });
      applyFacilityKind(null);
      // 이벤트(제보) 칩과도 한 번에 하나만 켠다. 안 그러면 편의시설·제휴로 넘어가도 제보 마커와 시트가 남는다.
      setReportsOn(false);
      setHotOnly(false);
      setSelectedReport(null);
      postToMap({ type: "clearReports" });
    },
    [layer, postToMap, applyFacilityKind],
  );

  /**
   * 지도 페이지가 (다시) 준비됐을 때 지금 화면 상태를 다시 그린다. 첫 로딩이 늦거나 실패해 자동으로
   * 다시 불러오면 페이지가 새로 떠서, 그 사이 보낸 마커 명령이 사라지기 때문이다(NaverMapView 참고).
   */
  const resyncMap = useCallback(() => {
    // 새로 뜬 페이지는 배포된 map.html 에 박힌 초기 위치로 시작해 지금 CAMPUS_CENTER 와 어긋날 수 있다.
    // 학사모(캠퍼스로 돌아가기)와 같은 위치로 먼저 맞춘다. 제휴 필터가 켜져 있으면 아래 bounds 가 덮어쓴다.
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
        bounds: partnerFocusBounds(partners),
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
    // 관리 탭 "지도에서 보기" 핀 — 지도가 뜨기 전에 보낸 명령은 사라지므로 다시 찍는다.
    if (previewTargetRef.current) showPreviewPin(previewTargetRef.current);
    // 지도가 늦게 뜬 사이 공유 링크·알림으로 연 제보가 있으면 그 자리로 다시 옮긴다.
    const opened = selectedReportRef.current;
    if (opened) postToMap({ type: "focusReport", lat: opened.lat, lng: opened.lng });
    // 위치를 고르던 중이면 새 페이지에서도 고르기 모드를 다시 켠다. 이전 페이지가 보낸 중앙 좌표는
    // 버리고 새 페이지가 다시 알려 줄 때까지 확인 버튼을 막는다.
    if (pickingLocation) {
      setPickerCenter(null);
      postToMap({ type: "startLocationPicker", purpose: pickerPurpose });
    }
  }, [mapData, allPartners, facilities, buildings, exhibitions, activeFilter, facilityKind, reportsOn, shownReportData, pickingLocation, pickerPurpose, postToMap, handleRecenter, showPreviewPin, reassertPartnerSelection]);

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
   * 예정 제보가 시작하면 목록을 새로 받아 진행 중 마커로 바꿔 그린다(가장 이른 시작 시각에 한 번).
   * 새로 받은 목록에 또 예정 제보가 있으면 다음 시작 시각으로 다시 맞춰진다.
   */
  const nextUpcomingStart = useMemo(() => {
    const now = Date.now();
    let next = Infinity;
    for (const report of shownReportData ?? EMPTY_REPORTS) {
      const start = parseServerTime(report.startsAt);
      if (start > now && start < next) next = start;
    }
    return Number.isFinite(next) ? next : null;
  }, [shownReportData]);
  const retryReports = reportsResource.retry;
  useEffect(() => {
    if (!reportsOn || nextUpcomingStart === null) return;
    // 서버 시계와 조금 어긋나도 시작한 뒤에 받도록 몇 초 늦춘다. setTimeout 상한(약 24.8일)보다 훨씬 짧다(3일 안).
    const timer = setTimeout(() => retryReports(), Math.max(0, nextUpcomingStart - Date.now()) + 5000);
    return () => clearTimeout(timer);
  }, [reportsOn, nextUpcomingStart, retryReports]);

  /** 제보를 새로 받을 때마다 지도에 올린다. */
  useEffect(() => {
    if (!reportsOn || shownReportData === undefined) return;
    postToMap({
      type: "setReports",
      markers: toReportMarkers(shownReportData),
    });
  }, [reportsOn, shownReportData, postToMap]);

  /** 제보 버튼. 켜면 지금 진행 중인 제보를 받아 오고, 끄면 지도에서 내린다. */
  const handleToggleReports = useCallback(() => {
    // HOT 만 보고 있었으면 '제보'를 눌렀을 때 전체 제보로 바꾼다(끄지 않는다).
    const next = !(reportsOn && !hotOnly);
    setReportsOn(next);
    setHotOnly(false);
    setSelectedReport(null);
    if (!next) {
      postToMap({ type: "clearReports" });
      return;
    }
    // '제보'는 '이벤트' 갈래 안의 하위 칩이다. 갈래(layer)는 그대로 두고 열려 있던 배너만 닫는다 —
    // 예전엔 여기서 layer 까지 비워 '이벤트' 줄이 통째로 사라졌다. 편의시설·제휴 정리는 갈래를 바꿀 때(handleSelectLayer) 한다.
    setSelectedPartner(null);
    setSelectedBuilding(null);
    setSelectedFacilityBuilding(null);
  }, [reportsOn, hotOnly, postToMap]);

  /**
   * 'HOT' 칩. 켜면 HOT·인기 제보만 지도와 위 목록에 보이고, 다시 누르면 전체 제보 보기로 돌아간다('제보' 칩이 켜진 상태).
   * 예전엔 다시 누르면 제보 레이어까지 꺼져 지도가 텅 비었다(10-06). 마커는 지우지 않고 새 목록이 오면 바꿔 그린다 —
   * 미리 지우면 같은 데이터가 다시 올 때 그리기 효과가 돌지 않아 지도가 빈 채로 남을 수 있다.
   */
  const handleToggleHot = useCallback(() => {
    const next = !hotOnly;
    setHotOnly(next);
    setReportsOn(true);
    setSelectedReport(null);
    if (next) {
      setSelectedPartner(null);
      setSelectedBuilding(null);
      setSelectedFacilityBuilding(null);
    }
  }, [hotOnly]);

  /** '이벤트' 갈래를 열면 서버가 🔥 를 아는지 한 번 확인해 HOT 칩을 보일지 정한다(진행 중 제보 목록 한 번). */
  useEffect(() => {
    if (layer !== "이벤트" || hotAvailable) return;
    const controller = new AbortController();
    getLiveReports({ accessToken, signal: controller.signal })
      .then((list) => {
        if (!controller.signal.aborted && hasCommunityFields(list)) setHotAvailable(true);
      })
      .catch(() => {});
    return () => controller.abort();
  }, [layer, hotAvailable, accessToken]);

  /**
   * 제보 목록은 켜 둔 동안 지도 탭에 올 때마다, 그리고 1분마다 새로 받는다. 운영진이 승인한 제보를 반려·숨김하면
   * 서버 목록에서 빠지는데, 예전엔 앱을 백그라운드에 보냈다 와야만 다시 받아서 지도에 계속 남았다.
   */
  const refetchReports = reportsResource.retry;
  useFocusEffect(
    useCallback(() => {
      if (!reportsOn) return;
      refetchReports();
      const timer = setInterval(refetchReports, 60_000);
      return () => clearInterval(timer);
    }, [reportsOn, refetchReports]),
  );

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

  /** 메가폰 버튼. 다른 배너를 모두 닫고 화면 중앙 고정 핀으로 위치를 고르게 한다. */
  const startPicker = useCallback(
    (purpose: "report" | "partner") => {
      setSelectedBuilding(null);
      setSelectedPartner(null);
      setSelectedReport(null);
      setSelectedFacilityBuilding(null);
      setPickerCenter(null);
      setPickerPurpose(purpose);
      setPickingLocation(true);
      postToMap({ type: "startLocationPicker", purpose });
    },
    [postToMap],
  );

  /** 제보는 로그인이 필요하다. 게스트는 위치를 고르고 작성창을 다 채운 뒤가 아니라 시작할 때 묻는다. */
  const handleStartReportPicker = useCallback(() => {
    if (!accessToken) {
      promptLogin("제보를 남기려면 로그인해 주세요.", logout);
      return;
    }
    startPicker("report");
  }, [accessToken, logout, startPicker]);

  /** 위치 고르기 모드를 끈다. 취소 버튼과, 고르는 중에 다른 지도 요청(알림 제보·검토 핀)이 들어올 때 쓴다. */
  const stopPicker = useCallback(() => {
    setPickingLocation(false);
    setPickerCenter(null);
    postToMap({ type: "stopLocationPicker" });
  }, [postToMap]);

  /** 정보 제보 창에서 "지도에서 (다시) 찍기"로 넘어올 때 그 창에 있던 위치. 핀 고르기를 취소하면 되돌린다. */
  const partnerLocationBeforePickRef = useRef<InfoSuggestLocation | null>(null);

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
      stopPicker();
      openReport(null);
      // 제보는 '이벤트' 갈래의 하위 칩이다. 다른 갈래(편의시설·제휴)를 보고 있었으면 그 마커를 거두고 '이벤트'로 옮긴다 —
      // 안 그러면 편의시설 핀과 제보 마커가 섞이고, 제보를 끌 '제보' 칩도 화면에 없다(갈래는 한 번에 하나).
      if (layer !== "이벤트") {
        setLayer("이벤트");
        setSelectedAffiliation(null);
        setSelectedCategory(null);
        postToMap({ type: "clearPartners" });
        applyFacilityKind(null);
      }
      // 레이어가 이미 켜져 있으면 목록도 새로 받아 방금 올라온 제보가 마커로 보이게 한다. 꺼져 있으면 켜는 순간 받는다.
      // HOT 만 보던 중이면 전체 제보로 바꾼다(알림으로 연 제보가 HOT 이 아닐 수 있다).
      setHotOnly(false);
      if (reportsOn) reportsResource.retry();
      else setReportsOn(true);
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
    [accessToken, reportsOn, reportsResource.retry, postToMap, toast, hiddenAuthorKeys, layer, applyFacilityKind, stopPicker, openReport],
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
      partnerLocationBeforePickRef.current = null;
      setPartnerSuggest(null);
      startPicker("partner");
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
    if (intent?.type === "previewLocation") {
      stopPicker();
      setSelectedBuilding(null);
      setSelectedPartner(null);
      setSelectedReport(null);
      setSelectedFacilityBuilding(null);
      const preview = { lat: intent.lat, lng: intent.lng, label: intent.label ?? "제보 위치", detail: intent.detail ?? "" };
      setPreviewTarget(preview);
      // 지도가 아직 안 떴으면(지도 탭 첫 방문) 이 명령은 사라진다 — 준비되면 resyncMap 이 previewTarget 으로 다시 찍는다.
      showPreviewPin(preview);
    }
  }, [startPicker, focusReportFromNotification, handleStartReportPicker, showPreviewPin, stopPicker]);

  useFocusEffect(handleMapIntent);
  // 지도 탭을 떠나면 미리보기 핀을 거둔다. 예전엔 지울 길이 없어 앱을 껐다 켜야 사라졌다.
  useFocusEffect(useCallback(() => () => clearPreview(), [clearPreview]));
  useEffect(() => subscribeMapIntent(handleMapIntent), [handleMapIntent]);

  const handleCancelReportPicker = useCallback(() => {
    stopPicker();
    // 정보 제보 중이었으면 그 창으로 돌아간다(입력해 둔 내용은 창이 되살린다). 안 그러면 쓰던 제보가 사라진다.
    if (pickerPurpose === "partner") {
      setPartnerSuggest({ location: partnerLocationBeforePickRef.current });
    }
  }, [pickerPurpose, stopPicker]);

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
      setSelectedFacilityBuilding(null);
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
    selectedBuilding,
    handleCancelReportPicker,
    handleClosePartner,
    handleCloseBuilding,
  ]);
  useFocusEffect(
    useCallback(() => {
      if (Platform.OS === "android") {
        const sub = BackHandler.addEventListener("hardwareBackPress", closeTopMapLayer);
        return () => sub.remove();
      }
      if (Platform.OS === "web" && typeof window !== "undefined") {
        const onKey = (e: KeyboardEvent) => {
          // 입력 중인 칸의 Esc 나 모달(검색·작성창)이 떠 있을 때는 건드리지 않는다.
          if (e.key !== "Escape" || e.defaultPrevented) return;
          const target = e.target as HTMLElement | null;
          if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable)) return;
          if (closeTopMapLayer()) e.preventDefault();
        };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
      }
      return undefined;
    }, [closeTopMapLayer]),
  );

  /** 확인을 누르면 화면 중앙 좌표로 작성창을 연다. 롱프레스 제보와 같은 작성창을 쓴다. 정보 제보면 정보 제보 창을 연다. */
  const handleConfirmReportPicker = useCallback(() => {
    if (!pickerCenter) return;
    setPickingLocation(false);
    postToMap({ type: "stopLocationPicker" });
    if (pickerPurpose === "partner") {
      setPartnerSuggest({
        location: {
          lat: pickerCenter.lat,
          lng: pickerCenter.lng,
          buildingName: pickerCenter.buildingName,
        },
      });
      return;
    }
    setReportTarget({
      lat: pickerCenter.lat,
      lng: pickerCenter.lng,
      buildingName: pickerCenter.buildingName,
    });
  }, [pickerCenter, pickerPurpose, postToMap]);

  const handleClearRoute = useCallback(() => {
    setFromBuilding(null);
    setToBuilding(null);
    setFromFloor(null);
    setToFloor(null);
    postToMap({ type: "clearRoute" });
  }, [postToMap]);

  const handleSelectRouteBuilding = useCallback(
    (building: Building) => {
      if (routeTarget === "from") beginFrom(building);
      else if (routeTarget === "to") beginTo(building);
    },
    [routeTarget, beginFrom, beginTo],
  );

  const handleCloseRoute = useCallback(() => {
    setShowRoute(false);
    setRouteTarget(null);
    setSearchQuery("");
  }, []);

  return (
    <View style={styles.container}>
      <PartnerNoticeModal />

      <View style={styles.mapArea}>
        {/*
          지도 탭은 탭바가 지도 위에 떠 있다(TabNavigator). 지도 자체는 탭바 위에서 끝나게 해,
          지도 왼쪽 아래 NAVER 로고·저작권 표기가 탭바에 가리지 않게 한다(네이버 지도 API 약관).
          탭바는 불투명이라 그 아래로 지도가 깔릴 필요가 없다.
        */}
        {/* 탭 바가 지도 위에 떠 있는 캡슐이라(FloatingTabBar) 지도는 화면 맨 아래까지 깐다. 캡슐은 가운데에 떠 있어
            지도 아래 양 끝의 NAVER 로고·저작권 표시는 가리지 않는다. */}
        <View style={styles.mapCanvas}>
          <NaverMapView
            ref={webViewRef}
            html={mapHTML}
            onMessage={handleWebViewMessage}
            onReady={resyncMap}
          />
        </View>

        <View
          pointerEvents="box-none"
          style={[
            styles.bannerStack,
            { top: headerHeight + 8 },
            // 넓은 창에선 검색바·시트와 같은 칸에 둔다(10-07 요청). 좁으면 양옆 16.
            sideGutter > 0 && { left: sideGutter, right: sideGutter, maxWidth: undefined },
          ]}
        >
          {/* 지도 데이터(건물·편의시설·제휴업체)가 아직 하나도 없을 때만. 저장본이 있으면 그걸로 그리고 조용히 새로 받는다. */}
          {!mapData && (
            <View style={styles.offscreenNotice} accessibilityRole="alert" accessibilityLiveRegion="polite">
              {mapDataStatus === "error" ? (
                <>
                  <Ionicons name="cloud-offline-outline" size={14} color={COLORS.primary} />
                  <Text style={[styles.offscreenText, styles.mapDataNoticeText]}>지도 정보를 불러오지 못했어요</Text>
                  <TouchableOpacity
                    onPress={reloadMapData}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    accessibilityRole="button"
                    accessibilityLabel="지도 정보 다시 불러오기"
                  >
                    <Text style={styles.mapDataRetryText}>다시 시도</Text>
                  </TouchableOpacity>
                </>
              ) : (
                <>
                  <ActivityIndicator size="small" color={COLORS.primary} />
                  <Text style={[styles.offscreenText, styles.mapDataNoticeText]}>지도 정보를 불러오는 중이에요</Text>
                </>
              )}
            </View>
          )}

          {mapAuthFailed && (
            <View style={styles.mapErrorNotice}>
              <Ionicons name="warning" size={15} color={COLORS.warningIcon} />
              <Text style={styles.mapErrorText}>
                지도를 불러오지 못했어요. 네이버 지도 인증에 실패했어요.
              </Text>
              <TouchableOpacity
                onPress={() => setMapAuthFailed(false)}
                hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                accessibilityRole="button"
                accessibilityLabel="닫기"
              >
                <Ionicons name="close" size={15} color={COLORS.warningIcon} />
              </TouchableOpacity>
            </View>
          )}

          {reportsOn && showReportsLoading && reportsResource.errorMessage === null && (
            <View style={styles.offscreenNotice}>
              <ActivityIndicator size="small" color={COLORS.textSecondary} />
              <Text style={styles.offscreenText}>제보를 불러오는 중…</Text>
            </View>
          )}

          {reportsOn && reportsResource.errorMessage !== null && (
            <RetryableError
              variant="chip"
              message={
                reportsResource.data !== undefined
                  ? "제보를 새로 불러오지 못했어요. 마지막으로 받은 제보를 보여주고 있어요."
                  : reportsResource.errorMessage
              }
              isNetworkError={reportsResource.isNetworkError}
              onRetry={reportsResource.canRetry ? reportsResource.retry : undefined}
              retrying={reportsResource.loading || reportsResource.refreshing}
              onDismiss={reportsResource.clearError}
            />
          )}

          {/* 시트를 연 동안에는 목록을 접어 지도를 덜 가린다(닫으면 다시 보인다). */}
          {/* 위치를 고르는 동안에는 아래 목록·안내 줄을 모두 숨긴다(고르기 안내 줄과 같은 자리에 겹친다). */}
          {!pickingLocation && hotOnly && reportsOn && reportsMatchHot && !reportsEmpty && shownReportData !== undefined && !selectedReport && (
            <HotReportList
              reports={reports}
              selectedId={null}
              onSelect={(report) => {
                openReport(report);
                postToMap({ type: "focusReport", lat: report.lat, lng: report.lng });
              }}
            />
          )}

          {!pickingLocation && previewTarget && (
            <View style={styles.previewNotice}>
              <Ionicons name="eye-outline" size={14} color={COLORS.white} />
              <View style={styles.previewTextWrap}>
                <Text style={styles.previewTitle} numberOfLines={1}>검토 중인 제보 · {previewTarget.label}</Text>
                {previewTarget.detail ? (
                  <Text style={styles.previewDetail} numberOfLines={1}>{previewTarget.detail}</Text>
                ) : null}
              </View>
              <TouchableOpacity
                onPress={clearPreview}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel="검토 위치 핀 닫기"
              >
                <Ionicons name="close" size={18} color={COLORS.white} />
              </TouchableOpacity>
            </View>
          )}

          {!pickingLocation && reportsEmpty && (
            <DismissibleNotice
              message={hotOnly ? "지금은 HOT 제보가 없어요. 제보에 공감을 눌러 응원해 보세요" : "지금은 진행 중인 제보가 없어요"}
              dismissed={dismissedNotices}
              onDismiss={dismissNotice}
            />
          )}

          {!pickingLocation && unresolvedCount > 0 && (
            <DismissibleNotice
              message={`건물을 찾지 못한 편의시설 ${unresolvedCount}곳은 지도에서 빠졌어요`}
              dismissed={dismissedNotices}
              onDismiss={dismissNotice}
            />
          )}

          {!pickingLocation && offscreenCount > 0 && (
            <DismissibleNotice
              message={`지도에 안 보이는 ${offscreenCount}곳 · ${offscreenSummary(offscreenPartners)}`}
              actionLabel="보기"
              onPress={() => {
                setSearchPinned(offscreenPartners);
                setShowSearch(true);
              }}
              dismissed={dismissedNotices}
              onDismiss={dismissNotice}
            />
          )}
        </View>

        {/* 시트가 열려 있으면 오른쪽 아래 버튼(제보하기·캠퍼스로)이 시트 가장자리로 삐져나와 숨긴다. */}
        {!pickingLocation && !sheetOpen && (
          <View style={[styles.mapControls, { bottom: 20 + tabBarHeight }]}>
            <TouchableOpacity
              style={styles.controlBtn}
              onPress={handleStartReportPicker}
              accessibilityRole="button"
              accessibilityLabel="제보하기"
            >
              <ReportMegaphoneIcon size={20} color={COLORS.primary} />
            </TouchableOpacity>
            {ROUTE_FINDING_ENABLED && (
              <TouchableOpacity
                style={styles.controlBtn}
                onPress={handleOpenRoute}
                accessibilityRole="button"
                accessibilityLabel="길찾기"
              >
                <Ionicons name="navigate" size={17} color={COLORS.primary} />
              </TouchableOpacity>
            )}
            <TouchableOpacity
              style={styles.controlBtn}
              onPress={handleRecenter}
              accessibilityRole="button"
              accessibilityLabel="캠퍼스로 돌아가기"
            >
              <Ionicons name="school-outline" size={17} color={COLORS.primary} />
            </TouchableOpacity>
          </View>
        )}

        {pickingLocation && (
          <>
            <View pointerEvents="none" style={styles.pickerMarkerWrap}>
              <View style={styles.pickerCrosshairV} />
              <View style={styles.pickerCrosshairH} />
              <View style={styles.pickerPinAnchor}>
                <View style={styles.pickerPinBubble}>
                  <ReportMegaphoneIcon size={18} color={COLORS.white} />
                </View>
                <View style={styles.pickerPinTail} />
              </View>
              <View style={styles.pickerDot} />
            </View>

            <View style={[styles.pickerTopBar, overlayInset, { top: headerHeight + 8 }]}>
              <Text style={styles.pickerTopText} numberOfLines={2}>
                {pickerPurpose === "partner"
                  ? "지도를 움직여 가게 위치에 핀을 맞춰 주세요"
                  : "지도를 움직여 제보할 위치를 맞춰 주세요"}
              </Text>
              <TouchableOpacity
                onPress={handleCancelReportPicker}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                accessibilityRole="button"
                accessibilityLabel="위치 선택 취소"
              >
                <Ionicons name="close" size={18} color={COLORS.textPrimary} />
              </TouchableOpacity>
            </View>

            {/* 지도 탭은 탭바가 지도 위에 떠 있어(TabNavigator) 그 높이만큼 올려야 가려지지 않는다. */}
            <View style={[styles.pickerBottomBar, overlayInset, { bottom: 20 + tabBarHeight }]}>
              <View style={styles.pickerLocationRow}>
                <Ionicons name="location" size={14} color={COLORS.primary} />
                <Text style={styles.pickerLocationText} numberOfLines={1}>
                  {pickerCenter
                    ? pickerCenter.buildingName
                      ? `${pickerCenter.buildingName} 근처`
                      : `${pickerCenter.lat.toFixed(5)}, ${pickerCenter.lng.toFixed(5)}`
                    : "위치 확인 중..."}
                </Text>
              </View>
              <Button
                label={pickerPurpose === "partner" ? "이 위치로 정보 제보" : "이 위치 제보하기"}
                onPress={handleConfirmReportPicker}
                disabled={!pickerCenter}
              />
            </View>
          </>
        )}

        {!pickingLocation && fromBuilding && toBuilding && (
          <View style={[styles.routeStrip, overlayInset, { top: headerHeight + 8 }]}>
            <View style={styles.routeInfo}>
              <View style={styles.routeRow}>
                <View
                  style={[styles.routeDot, { backgroundColor: COLORS.routeFrom }]}
                />
                <Text style={styles.routeLabel} numberOfLines={1}>
                  {buildingLabel(fromBuilding, fromFloor)}
                </Text>
              </View>
              <Text style={styles.routeArrow}>→</Text>
              <View style={styles.routeRow}>
                <View
                  style={[styles.routeDot, { backgroundColor: COLORS.danger }]}
                />
                <Text style={styles.routeLabel} numberOfLines={1}>
                  {buildingLabel(toBuilding, toFloor)}
                </Text>
              </View>
            </View>
            <TouchableOpacity
              onPress={() => setShowRoute(true)}
              style={styles.routeTimeBtn}
            >
              <Text style={styles.routeTime}>
                도보 {selectedRoute?.minutes ?? 0}분
              </Text>
              {selectedRoute?.isEstimate && (
                <Text style={styles.routeEstimateBadge}>추정</Text>
              )}
            </TouchableOpacity>
            <TouchableOpacity
              onPress={handleClearRoute}
              style={styles.routeCloseBtn}
              accessibilityRole="button"
              accessibilityLabel="경로 지우기"
            >
              <Ionicons name="close" size={16} color={COLORS.textTertiary} />
            </TouchableOpacity>
          </View>
        )}

        {/*
          건물·제휴업체·제보 배너("하단 배너"). 각 배너는 자기 스타일에서 이미
          position:absolute; bottom:0 을 쓰므로, 이 레이어는 화면 전체를 덮어
          (position:absolute, 사방 0) 그 기준선을 그대로 유지해 준다.
        */}
        <SheetHeaderContext.Provider value={sheetHeaderCtx}>
        <View
          pointerEvents="box-none"
          style={[
            styles.bottomSheetLayer,
            { bottom: sheetBottom, left: sideGutter, right: sideGutter },
          ]}
        >
          {selectedBuilding && (
            <BuildingSheet
              key={selectedBuilding.name}
              building={selectedBuilding}
              onClose={handleCloseBuilding}
              routeFindingEnabled={ROUTE_FINDING_ENABLED}
              onSetFrom={handleSetFrom}
              onSetTo={handleSetTo}
            />
          )}

          {selectedPartner && (
            <PartnerSheet key={selectedPartner.id} partner={selectedPartner} onClose={handleClosePartner} />
          )}

          {selectedFacilityBuilding && facilityKind && (
            <FacilitySheet
              key={`${facilityKind}:${selectedFacilityBuilding}`}
              kind={facilityKind}
              buildingName={selectedFacilityBuilding}
              items={facilities.filter(
                (f) => f.kind === facilityKind && f.buildingName === selectedFacilityBuilding,
              )}
              exhibitions={exhibitions}
              onClose={() => setSelectedFacilityBuilding(null)}
            />
          )}

          {selectedReport && (
            // 제보마다 새로 그린다. 시트 안의 🔥·관심·신고 요청 중 상태와 늦게 온 응답·오류·메뉴가 다른 제보로
            // 넘어가지 않게(예전엔 마커만 바꿔 누르면 앞 제보의 응답이 뒤 제보 시트에 덮였다).
            <ReportSheet
              key={selectedReport.id}
              report={selectedReport}
              onClose={() => setSelectedReport(null)}
            />
          )}
        </View>
        </SheetHeaderContext.Provider>
      </View>

      {/*
        검색바·필터 칩을 지도 위에 뜨는 투명 오버레이로 띄운다. mapArea 뒤에
        와야(later sibling) 그 위에 그려진다. pointerEvents="box-none" 이라
        빈 공간(제목 옆, 칩 사이)은 터치가 그대로 지도로 전달되고, 안의
        버튼·칩만 눌린다. onLayout 으로 잰 실제 높이를 배너·상단바 위치
        계산에 쓴다(headerHeight, 위 선언부 주석 참고).
      */}
      <Animated.View
        style={[
          styles.headerOverlay,
          // 제목 줄을 없앤 뒤라, 상태 바에 검색바가 바로 붙지 않게 여백만 조금 남긴다.
          // 검색바·칩은 지도처럼 창 너비를 다 쓴다 — 폴드를 펴거나 웹 창을 늘려도 지도와 같이 늘어난다.
          { paddingTop: insets.top + 8, opacity: headerFade },
        ]}
        pointerEvents={headerCovered ? "none" : "box-none"}
        onLayout={(e) => setHeaderHeight(e.nativeEvent.layout.height)}
      >
        {!pickingLocation && (
          <>
            {/* 넓은 창(웹·태블릿)에선 아래 시트와 같은 너비로 맞춘다(10-07 요청). 좁으면 시트가 화면을 꽉 채우니 16 만 띄운다. */}
            <View style={[styles.searchBarWrap, sideGutter > 0 && { paddingHorizontal: sideGutter }]}>
              <TouchableOpacity
                style={styles.searchBar}
                activeOpacity={0.7}
                onPress={() => {
                  setSearchPinned(null);
                  setShowSearch(true);
                }}
                accessibilityRole="button"
                accessibilityLabel="제휴 업체 검색"
              >
                <Ionicons name="search" size={18} color={COLORS.textTertiary} />
                <Text style={styles.searchPlaceholder}>제휴 업체 검색</Text>
              </TouchableOpacity>
            </View>

            {/* 칩도 검색바와 같은 왼쪽 끝에서 시작한다(10-07 요청). 칩 줄 안쪽 여백 16 을 빼고 띄운다. */}
            <View style={sideGutter > 16 ? { paddingHorizontal: sideGutter - 16 } : null} pointerEvents="box-none">
            <MapFilterChips
              layer={layer}
              facilityKind={facilityKind}
              reportsOn={reportsOn && !hotOnly}
              hotOn={hotOnly}
              hotAvailable={hotAvailable}
              onSelectLayer={handleSelectLayer}
              onSelectFacilityKind={handleSelectFacilityKind}
              onToggleReports={handleToggleReports}
              onToggleHot={handleToggleHot}
            />

            {layer === "제휴업체" && (
              <PartnerChips
                affiliation={selectedAffiliation}
                category={selectedCategory}
                onSelectAffiliation={handleSelectAffiliation}
                onSelectCategory={handleSelectCategory}
              />
            )}
            </View>
          </>
        )}
      </Animated.View>

      <Modal visible={showRoute} animationType="slide" onRequestClose={handleCloseRoute}>
        {/* Modal 은 별도 화면으로 떠서 바깥 SafeAreaProvider 의 inset 이 맞지 않는다(노치·홈 인디케이터와 겹침). */}
        <SafeAreaProvider>
        <SafeAreaView style={styles.routeModal} edges={["top"]}>
          <ContentColumn>
          <View style={styles.routeModalHeader}>
            <TouchableOpacity
              onPress={handleCloseRoute}
              accessibilityRole="button"
              accessibilityLabel="뒤로 가기"
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons
                name="arrow-back"
                size={22}
                color={COLORS.textPrimary}
              />
            </TouchableOpacity>
            <Text style={styles.routeModalTitle}>길찾기</Text>
            <View style={{ width: 22 }} />
          </View>

          <View style={styles.routeInputs}>
            <TouchableOpacity
              style={[
                styles.routeInputRow,
                routeTarget === "from" && styles.routeInputActive,
              ]}
              onPress={() => {
                setRouteTarget("from");
                setSearchQuery("");
              }}
            >
              <View style={[styles.inputDot, { backgroundColor: COLORS.routeFrom }]} />
              <Text
                style={
                  fromBuilding ? styles.inputFilled : styles.inputPlaceholder
                }
              >
                {fromBuilding
                  ? buildingLabel(fromBuilding, fromFloor)
                  : "출발지 입력"}
              </Text>
            </TouchableOpacity>
            <View style={styles.inputDivider} />
            <TouchableOpacity
              style={[
                styles.routeInputRow,
                routeTarget === "to" && styles.routeInputActive,
              ]}
              onPress={() => {
                setRouteTarget("to");
                setSearchQuery("");
              }}
            >
              <View style={[styles.inputDot, { backgroundColor: COLORS.danger }]} />
              <Text
                style={
                  toBuilding ? styles.inputFilled : styles.inputPlaceholder
                }
              >
                {toBuilding ? buildingLabel(toBuilding, toFloor) : "도착지 입력"}
              </Text>
            </TouchableOpacity>
          </View>

          {routeTarget && (
            <View style={styles.routeSearch}>
              <View style={styles.routeSearchBar}>
                <Ionicons name="search" size={18} color={COLORS.textTertiary} />
                <TextInput
                  style={styles.routeSearchInput}
                  placeholder="건물 검색"
                  placeholderTextColor={COLORS.textPlaceholder}
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                  autoFocus
                />
              </View>
              <FlatList
                data={filteredBuildings}
                keyExtractor={(item) => item.name}
                renderItem={({ item }) => (
                  <TouchableOpacity
                    style={styles.buildingItem}
                    onPress={() => handleSelectRouteBuilding(item)}
                  >
                    {/* 건물별 색 대신 앱 메인 컬러로 통일(buildingItemDot). */}
                    <View style={styles.buildingItemDot} />
                    <View style={styles.buildingItemInfo}>
                      <Text style={styles.buildingItemName}>{item.name}</Text>
                      <Text style={styles.buildingItemType}>{item.type}</Text>
                    </View>
                    <Ionicons name="chevron-forward" size={16} color={COLORS.chevron} />
                  </TouchableOpacity>
                )}
                contentContainerStyle={styles.buildingList}
              />
            </View>
          )}

          {!routeTarget && fromBuilding && toBuilding && (
            <View style={styles.routeResultCard}>
              <View style={styles.routeResultRow}>
                <View
                  style={[styles.routeDot, { backgroundColor: COLORS.routeFrom }]}
                />
                <Text style={styles.routeResultName}>{fromBuilding.name}</Text>
              </View>
              <FloorChips
                label="출발 층"
                building={fromBuilding}
                floor={fromFloor}
                accent={COLORS.routeFrom}
                onChange={setFromFloor}
              />
              <View style={[styles.routeResultRow, styles.routeResultRowSpaced]}>
                <View
                  style={[styles.routeDot, { backgroundColor: COLORS.danger }]}
                />
                <Text style={styles.routeResultName}>{toBuilding.name}</Text>
              </View>
              <FloorChips
                label="도착 층"
                building={toBuilding}
                floor={toFloor}
                accent={COLORS.danger}
                onChange={setToFloor}
              />

              <View style={styles.routeAltList}>
                {routeAlternatives.map((route, index) => (
                  <TouchableOpacity
                    key={index}
                    style={[
                      styles.routeAltRow,
                      index === selectedRouteIndex && styles.routeAltRowSelected,
                    ]}
                    onPress={() => handleSelectRouteAlternative(index)}
                  >
                    <View style={styles.routeAltHeader}>
                      <Text style={styles.routeAltLabel}>경로 {index + 1}</Text>
                      <Text style={styles.routeAltTime}>
                        도보 약 {route.minutes}분 · {route.distanceMeters}m
                      </Text>
                    </View>
                    {route.isEstimate && (
                      <Text style={styles.routeAltEstimate}>
                        실측 경로 준비 중 · 직선 거리 기준
                      </Text>
                    )}
                  </TouchableOpacity>
                ))}
              </View>

              <TouchableOpacity
                style={styles.routeStartBtn}
                onPress={handleCloseRoute}
              >
                <Text style={styles.routeStartText}>경로 보기</Text>
              </TouchableOpacity>
            </View>
          )}
          </ContentColumn>
        </SafeAreaView>
        </SafeAreaProvider>
      </Modal>

      <PartnerSearchModal
        visible={showSearch}
        topInset={insets.top}
        onClose={() => setShowSearch(false)}
        onSelect={handleSearchSelect}
        pinned={
          searchPinned && searchPinned.length > 0
            ? {
                title: `지도에 안 보이는 ${searchPinned.length}곳`,
                hint: "캠퍼스에서 멀어 지도에는 핀이 안 보여요. 누르면 그 주변으로 이동해요.",
                partners: searchPinned,
              }
            : undefined
        }
      />

      <ReportComposerModal
        target={reportTarget}
        onClose={() => setReportTarget(null)}
        onCreated={handleReportCreated}
      />

      <InfoSuggestModal
        visible={partnerSuggest !== null}
        location={partnerSuggest?.location ?? null}
        onClose={() => setPartnerSuggest(null)}
        onPickOnMap={() => {
          partnerLocationBeforePickRef.current = partnerSuggest?.location ?? null;
          setPartnerSuggest(null);
          startPicker("partner");
        }}
      />
    </View>
  );
}

/** 업체 이름 두 곳까지 보여 주고 나머지는 "외 N곳" 으로 줄인다. */
function offscreenSummary(partners: readonly Partner[]): string {
  const names = partners.slice(0, 2).map((partner) => partner.name);
  const rest = partners.length - names.length;
  return rest > 0 ? `${names.join(", ")} 외 ${rest}곳` : names.join(", ");
}

/**
 * 지도 위 안내 줄. 끝의 X 를 누르면 닫힌다. `onPress` 가 없으면 줄 어디를 눌러도 닫히고,
 * 있으면(예: 지도에 안 보이는 업체 보기) 줄을 누를 때 그 동작을 한다. 이미 닫은 문구면 그리지 않는다.
 */
function DismissibleNotice({
  message,
  actionLabel,
  onPress,
  dismissed,
  onDismiss,
}: {
  message: string;
  /** `onPress` 가 있을 때 문구 끝에 붙는 행동 이름(예: '보기'). */
  actionLabel?: string;
  onPress?: () => void;
  dismissed: ReadonlySet<string>;
  onDismiss: (message: string) => void;
}) {
  if (dismissed.has(message)) return null;
  const dismiss = () => onDismiss(message);
  return (
    <Pressable
      onPress={onPress ?? dismiss}
      style={({ pressed }) => [styles.offscreenNotice, pressed && styles.noticePressed]}
      accessibilityRole="button"
      accessibilityLabel={onPress ? `${message}. ${actionLabel ?? "열기"}` : `${message}. 탭하면 닫혀요`}
    >
      <Ionicons name="information-circle" size={13} color={COLORS.textSecondary} />
      <Text style={[styles.offscreenText, styles.noticeText]} numberOfLines={1}>
        {message}
      </Text>
      {onPress && actionLabel && <Text style={styles.noticeAction}>{actionLabel}</Text>}
      <Pressable
        onPress={dismiss}
        hitSlop={{ top: 10, bottom: 10, left: 8, right: 10 }}
        accessibilityRole="button"
        accessibilityLabel="안내 닫기"
      >
        <Ionicons name="close" size={14} color={COLORS.textSecondary} />
      </Pressable>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.white },
  // 지도 위에 뜨는 투명 오버레이. 빈 공간은 지도 터치를 그대로 통과시킨다
  // (JSX 의 pointerEvents="box-none" 참고).
  headerOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
  },
  // 검색바 좌우에 지도가 비치는 여백이 남지 않도록, 알약 모양은 이 흰
  // 배경 안쪽 padding 으로만 띄운다(margin 이면 그 여백엔 배경이 없다).
  // 흰 배경을 깔지 않는다 — 검색바 알약 자체(아래 searchBar)만 흰색이고,
  // 양옆은 지도가 그대로 비쳐야 네이버맵처럼 떠 있는 느낌이 난다.
  searchBarWrap: {
    paddingHorizontal: 16,
    paddingBottom: 10,
  },
  searchBar: {
    height: 44,
    borderRadius: RADIUS.floating,
    backgroundColor: COLORS.white,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    gap: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 2,
  },
  searchPlaceholder: { fontFamily: FONTS.regular, fontSize: 14, color: COLORS.textPlaceholder },
  mapArea: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0 },
  // 실제 지도가 그려지는 칸. 탭바가 떠 있는 캡슐이라 화면 전체를 덮는다(JSX 주석 참고).
  // 위치 고르기 중앙 핀(pickerMarkerWrap)도 같은 칸 전체 기준이어야 map.getCenter() 와 겹친다.
  mapCanvas: { flex: 1 },
  mapControls: { position: "absolute", right: 12, bottom: 20, gap: 8 },
  // 건물·제휴업체·제보 배너를 얹는 레이어. 얘 자체엔 위치가 없고(화면 전체를 덮기만),
  // 배너 각각이 자기 스타일에서 position:absolute; bottom:0 으로 자리를 잡는다.
  bottomSheetLayer: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0 },
  pickerMarkerWrap: {
    position: "absolute",
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    alignItems: "center",
    justifyContent: "center",
  },
  pickerCrosshairV: {
    position: "absolute",
    width: 1,
    height: 22,
    backgroundColor: COLORS.danger,
    opacity: 0.5,
  },
  pickerCrosshairH: {
    position: "absolute",
    width: 22,
    height: 1,
    backgroundColor: COLORS.danger,
    opacity: 0.5,
  },
  pickerDot: {
    position: "absolute",
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: COLORS.danger,
    borderWidth: 1.5,
    borderColor: COLORS.white,
  },
  pickerPinAnchor: {
    position: "absolute",
    alignItems: "center",
    transform: [{ translateY: -25 }],
  },
  pickerPinBubble: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: COLORS.primary,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: COLORS.white,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 4,
  },
  pickerPinTail: {
    width: 2,
    height: 9,
    backgroundColor: COLORS.primary,
    marginTop: -1,
  },
  pickerTopBar: {
    position: "absolute",
    top: 8,
    left: 12,
    right: 12,
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.floating,
    paddingHorizontal: 14,
    paddingVertical: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  pickerTopText: {
    flex: 1,
    fontFamily: FONTS.medium,
    fontSize: 13,
    color: COLORS.textPrimary,
    lineHeight: 18,
  },
  pickerBottomBar: {
    position: "absolute",
    left: 12,
    right: 12,
    bottom: 20,
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.floating,
    padding: 12,
    gap: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 4,
  },
  pickerLocationRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 4,
  },
  pickerLocationText: {
    flex: 1,
    fontFamily: FONTS.regular,
    fontSize: 12.5,
    color: COLORS.textPrimary,
  },
  // 오른쪽 아래 둥근 버튼(제보하기·캠퍼스로): 하단 탭 바 캡슐과 같은 맑은 유리(10-08). 웹은 흐림 + 위 가장자리 흰 반사광,
  // 네이티브는 흐림이 없어 조금 덜 투명하게.
  controlBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Platform.OS === "web" ? "rgba(255,255,255,0.06)" : "rgba(255,255,255,0.8)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.7)",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 4,
    ...(Platform.OS === "web"
      ? {
          backdropFilter: "blur(2px) saturate(160%)",
          boxShadow: "inset 0 0.5px 0 rgba(255,255,255,0.7), 0 2px 8px rgba(0,0,0,0.06)",
        }
      : null),
  },
  // 필터 칩 줄과 같은 왼쪽 여백(16)에 맞춘다. 넓은 화면에서 가운데로 몰려 칩과 어긋나지 않게 하고, 너무 넓어지지 않게 폭만 묶는다.
  bannerStack: {
    position: "absolute",
    top: 8,
    left: 16,
    right: 16,
    maxWidth: 560,
    gap: 6,
  },
  mapErrorNotice: {
    backgroundColor: COLORS.warningSoft,
    borderRadius: RADIUS.floating,
    paddingHorizontal: 11,
    paddingVertical: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  mapErrorText: {
    flex: 1,
    fontSize: 12,
    color: COLORS.warning,
  },
  offscreenNotice: {
    backgroundColor: "rgba(255,255,255,0.95)",
    borderRadius: RADIUS.floating,
    paddingHorizontal: 11,
    paddingVertical: 7,
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 5,
    elevation: 3,
  },
  offscreenText: { fontSize: 12, color: COLORS.textSecondary, fontFamily: FONTS.medium },
  // 문구가 남는 폭을 다 써서 X(와 보기)를 줄 오른쪽 끝에 붙인다.
  noticeText: { flex: 1 },
  noticeAction: { fontSize: 12, color: COLORS.primary, fontFamily: FONTS.bold, textDecorationLine: "underline" },
  noticePressed: { opacity: 0.6 },
  mapDataNoticeText: { flex: 1, color: COLORS.primary },
  mapDataRetryText: { fontSize: 12, color: COLORS.primary, fontFamily: FONTS.bold, textDecorationLine: "underline" },
  previewNotice: {
    backgroundColor: COLORS.primary,
    borderRadius: RADIUS.floating,
    paddingLeft: 12,
    paddingRight: 10,
    paddingVertical: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    alignSelf: "stretch",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.15,
    shadowRadius: 5,
    elevation: 3,
  },
  previewTextWrap: { flex: 1 },
  previewTitle: { fontSize: 13, color: COLORS.white, fontFamily: FONTS.semibold },
  previewDetail: { fontSize: 12, color: "rgba(255,255,255,0.8)", fontFamily: FONTS.regular, marginTop: 1 },
  routeStrip: {
    position: "absolute",
    top: 8,
    left: 12,
    right: 12,
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.floating,
    paddingHorizontal: 14,
    paddingVertical: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  routeInfo: { flex: 1, flexDirection: "row", alignItems: "center", gap: 6 },
  routeRow: { flexDirection: "row", alignItems: "center", gap: 4 },
  routeDot: { width: 8, height: 8, borderRadius: 4 },
  routeLabel: { fontSize: 13, color: COLORS.textPrimary, fontFamily: FONTS.medium },
  routeArrow: { fontFamily: FONTS.regular, fontSize: 12, color: COLORS.textTertiary },
  routeTimeBtn: { flexDirection: "row", alignItems: "center", gap: 4 },
  routeTime: { fontSize: 12, color: COLORS.primary, fontFamily: FONTS.semibold },
  routeEstimateBadge: {
    fontSize: 9,
    color: COLORS.textSecondary,
    fontFamily: FONTS.medium,
    backgroundColor: COLORS.fill,
    borderRadius: 4,
    paddingHorizontal: 4,
    paddingVertical: 1,
  },
  routeCloseBtn: { padding: 2 },
  routeModal: { flex: 1, backgroundColor: COLORS.white },
  routeModalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 0.5,
    borderBottomColor: COLORS.border,
  },
  routeModalTitle: {
    fontSize: 16,
    fontFamily: FONTS.semibold,
    color: COLORS.textPrimary,
  },
  routeInputs: {
    marginHorizontal: 16,
    marginTop: 16,
    backgroundColor: COLORS.fill,
    borderRadius: 14,
    overflow: "hidden",
  },
  routeInputRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 14,
    gap: 10,
  },
  routeInputActive: { backgroundColor: COLORS.primarySoft },
  inputDot: { width: 10, height: 10, borderRadius: 5 },
  inputPlaceholder: { fontFamily: FONTS.regular, fontSize: 14, color: COLORS.textPlaceholder },
  inputFilled: { fontSize: 14, color: COLORS.textPrimary, fontFamily: FONTS.medium },
  inputDivider: {
    height: 0.5,
    backgroundColor: COLORS.border,
    marginHorizontal: 14,
  },
  routeSearch: { flex: 1, marginTop: 12 },
  routeSearchBar: {
    marginHorizontal: 16,
    height: 38,
    borderRadius: 10,
    backgroundColor: COLORS.fill,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    gap: 8,
    marginBottom: 8,
  },
  routeSearchInput: { fontFamily: FONTS.regular, flex: 1, minWidth: 0, fontSize: 14, color: COLORS.textPrimary },
  buildingList: { paddingHorizontal: 16 },
  buildingItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    borderBottomWidth: 0.5,
    borderBottomColor: COLORS.border,
    gap: 10,
  },
  buildingItemDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: COLORS.primary },
  buildingItemInfo: { flex: 1 },
  buildingItemName: {
    fontSize: 14,
    fontFamily: FONTS.medium,
    color: COLORS.textPrimary,
  },
  buildingItemType: { fontFamily: FONTS.regular, fontSize: 11, color: COLORS.textSecondary, marginTop: 1 },
  routeResultCard: {
    marginHorizontal: 16,
    marginTop: 20,
    backgroundColor: COLORS.fill,
    borderRadius: 14,
    padding: 16,
  },
  routeResultRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  routeResultRowSpaced: { marginTop: 14 },
  routeResultName: {
    fontSize: 14,
    fontFamily: FONTS.medium,
    color: COLORS.textPrimary,
  },
  routeAltList: { marginTop: 12, gap: 8 },
  routeAltRow: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: COLORS.white,
  },
  routeAltRowSelected: {
    borderColor: COLORS.primary,
    backgroundColor: COLORS.primarySoft,
  },
  routeAltHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  routeAltLabel: {
    fontSize: 13,
    fontFamily: FONTS.semibold,
    color: COLORS.textPrimary,
  },
  routeAltTime: { fontSize: 12, color: COLORS.primary, fontFamily: FONTS.medium },
  routeAltEstimate: {
    marginTop: 4,
    fontSize: 11,
    color: COLORS.textSecondary,
    fontFamily: FONTS.regular,
  },
  routeStartBtn: {
    marginTop: 14,
    height: 42,
    backgroundColor: COLORS.primary,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  routeStartText: { fontSize: 14, color: COLORS.white, fontFamily: FONTS.semibold },
});
