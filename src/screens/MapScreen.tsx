import { useState, useCallback, useRef, useMemo, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  FlatList,
  Modal,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets, SafeAreaProvider } from "react-native-safe-area-context";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import NaverMapView from "../components/map/NaverMapView";
import type { NaverMapViewHandle } from "../components/map/NaverMapView";
import FloorChips from "../components/map/FloorChips";
import BuildingSheet from "../components/map/BuildingSheet";
import MapFilterChips from "../components/map/MapFilterChips";
import ReportComposerModal from "../components/map/ReportComposerModal";
import PartnerSuggestModal from "../components/settings/PartnerSuggestModal";
import type { PartnerSuggestLocation } from "../components/settings/PartnerSuggestModal";
import { consumeMapIntent, subscribeMapIntent } from "../lib/mapIntents";
import { useFocusEffect } from "@react-navigation/native";
import type { ReportTarget } from "../components/map/ReportComposerModal";
import ReportSheet from "../components/map/ReportSheet";
import { useAuth } from "../contexts/AuthContext";
import { getLiveReports } from "../apis/reports";
import { useApiResource } from "../hooks/useApiResource";
import Button from "../components/common/Button";
import RetryableError from "../components/common/RetryableError";
import { useToast } from "../components/common/Toast";
import { promptLogin, toReportMarkers, visibleReports } from "../utils/reports";
import { useHiddenAuthorKeys, withoutHiddenAuthors } from "../lib/hiddenAuthors";
import PartnerChips from "../components/map/PartnerChips";
import PartnerSheet from "../components/map/PartnerSheet";
import PartnerSearchModal from "../components/map/PartnerSearchModal";
import PartnerNoticeModal from "../components/map/PartnerNoticeModal";
import { Ionicons } from "@expo/vector-icons";
import { COLORS } from "../constants/colors";
import { BUILDINGS } from "../constants/buildings";
import { PARTNERS } from "../constants/partners";
import {
  partnerCategoryMeta,
  PARTNER_MAP_ICON_COLOR,
} from "../constants/partnerCategories";
import { formatFloor } from "../utils/floors";
import { findRoutes, straightLineFallback } from "../utils/routing";
import type { RouteAlternative } from "../utils/routing";
import { ROUTE_FINDING_ENABLED } from "../constants/route";
import { CAMPUS_CENTER, DEFAULT_ZOOM } from "../constants/map";
import { buildMapHTML } from "../utils/mapHtml";
import {
  filterPartners,
  hasActiveFilter,
  partnerFocusBounds,
  partnersOutsideFocus,
} from "../utils/partners";
import type { PartnerFilter } from "../utils/partners";
import { facilityMarkers, unresolvedFacilities } from "../utils/facilities";
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
import ContentColumn from "../components/common/ContentColumn";

/** 경로 표시에 층을 병기한다. 층을 고르지 않았으면 건물명만. */
/** 제보 레이어가 아직 한 번도 못 받았을 때 쓰는 빈 목록. 렌더마다 새 배열을 만들지 않게 모듈에 둔다. */
const EMPTY_REPORTS: ReportListItem[] = [];

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
  // 검색바·필터 칩이 지도 위에 뜨는 오버레이로 바뀌면서(§아래 JSX), 실제
  // 렌더된 높이만큼 지도 위 배너·상단바들을 밀어내야 겹치지 않는다.
  // 칩 줄 수가 상태(피킹 모드·레이어 선택)에 따라 달라 고정값을 못 쓴다.
  const [headerHeight, setHeaderHeight] = useState(0);
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
  /** 핀을 무엇 때문에 고르는지. 제보(report) 또는 제휴 제보(partner). 확인 버튼 문구와 다음 창이 달라진다. */
  const [pickerPurpose, setPickerPurpose] = useState<"report" | "partner">("report");
  /** 제휴 제보 창. null 이면 닫힘, 위치 없이 열 수도 있다(undefined 와 구분하려고 객체로 둔다). */
  const [partnerSuggest, setPartnerSuggest] = useState<{ location: PartnerSuggestLocation | null } | null>(null);
  const [pickerCenter, setPickerCenter] = useState<{
    lat: number;
    lng: number;
    buildingName: string | null;
  } | null>(null);
  // 제보는 서버에서 받아오므로 켰을 때만 부른다. 지도·제휴·편의시설은
  // 정적 데이터라 서버가 죽어도 그대로 동작해야 한다.
  const [reportsOn, setReportsOn] = useState(false);
  // 연결이 끊겨도 마지막으로 받은 제보는 계속 보여주고, 재연결되면 다시 받는다.
  const reportsResource = useApiResource(
    async (signal) =>
      visibleReports(await getLiveReports({ accessToken, signal })),
    [accessToken],
    { enabled: reportsOn, fallbackMessage: "제보를 불러오지 못했어요." },
  );
  // 숨긴 사용자(기기 저장)의 제보는 지도에서 뺀다. 숨기는 순간 마커도 다시 그린다.
  const hiddenAuthorKeys = useHiddenAuthorKeys();
  const shownReportData = useMemo(
    () =>
      reportsResource.data === undefined
        ? undefined
        : withoutHiddenAuthors(reportsResource.data, hiddenAuthorKeys),
    [reportsResource.data, hiddenAuthorKeys],
  );
  const reports = shownReportData ?? EMPTY_REPORTS;
  const [selectedReport, setSelectedReport] = useState<ReportListItem | null>(
    null,
  );
  const [showSearch, setShowSearch] = useState(false);
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
    webViewRef.current?.injectJavaScript(
      `if (window.map && window.naver) { map.setCenter(new naver.maps.LatLng(${CAMPUS_CENTER.lat}, ${CAMPUS_CENTER.lng})); map.setZoom(${DEFAULT_ZOOM}); } true;`,
    );
  }, []);

  const mapHTML = useMemo(() => buildMapHTML(BUILDINGS), []);

  /**
   * 실측 경로망(routing.ts)에서 대안 경로를 구하고, 아직 그 구간을 못
   * 덮으면(양쪽 다 비어 있으면) 기존 직선거리 추정 하나로 대신한다.
   */
  const routeAlternatives = useMemo<RouteAlternative[]>(() => {
    if (!fromBuilding || !toBuilding) return [];
    const found = findRoutes(
      { building: fromBuilding, floor: fromFloor },
      { building: toBuilding, floor: toFloor },
    );
    if (found.length > 0) return found;
    return [straightLineFallback(fromBuilding, fromFloor, toBuilding, toFloor)];
  }, [fromBuilding, toBuilding, fromFloor, toFloor]);

  const selectedRoute = routeAlternatives[selectedRouteIndex] ?? null;

  const activeFilter = useMemo<PartnerFilter>(
    () => ({ affiliation: selectedAffiliation, category: selectedCategory }),
    [selectedAffiliation, selectedCategory],
  );

  const visiblePartners = useMemo(
    () => (hasActiveFilter(activeFilter) ? filterPartners(activeFilter) : []),
    [activeFilter],
  );

  /** 화면 맞춤 범위 밖이라 눈에 잘 안 띄는 지점 수. 안내 배지에 쓴다. */
  const offscreenCount = useMemo(
    () => partnersOutsideFocus(visiblePartners).length,
    [visiblePartners],
  );

  /**
   * 건물명이 `BUILDINGS` 와 안 맞아 좌표를 못 찾은 편의시설 수.
   * 조용히 빠지면 데이터를 넣었는데 지도에 안 뜨는 이유를 알 수 없어 알린다.
   */
  const unresolvedCount = useMemo(
    () =>
      facilityKind === null
        ? 0
        : unresolvedFacilities().filter((f) => f.kind === facilityKind).length,
    [facilityKind],
  );

  /** 필터는 걸었는데 걸리는 업체가 없는 상태. 빈 지도만 보여주지 않고 알려준다. */
  const isEmptyResult =
    hasActiveFilter(activeFilter) && visiblePartners.length === 0;

  /** 제보 레이어를 켰는데 지금 진행 중인 제보가 하나도 없는 상태. */
  const reportsEmpty =
    reportsOn &&
    reportsResource.data !== undefined &&
    reportsResource.errorMessage === null &&
    reports.length === 0;

  const filteredBuildings = searchQuery.trim()
    ? BUILDINGS.filter((b) => b.name.includes(searchQuery.trim()))
    : BUILDINGS;

  const postToMap = useCallback((msg: object) => {
    webViewRef.current?.injectJavaScript(
      `handleNativeMessage(${JSON.stringify(JSON.stringify(msg))});true;`,
    );
  }, []);

  const handleWebViewMessage = useCallback(
    (event: { nativeEvent: { data: string } }) => {
      try {
        const msg = JSON.parse(event.nativeEvent.data);

        if (msg.type === "buildingTap") {
          const building = BUILDINGS.find((b) => b.name === msg.name) ?? null;
          setSelectedPartner(null);
          setSelectedBuilding(building);
          return;
        }

        if (msg.type === "partnerTap") {
          const partner = PARTNERS.find((p) => p.id === msg.id) ?? null;
          setSelectedBuilding(null);
          setSelectedPartner(partner);
          return;
        }

        if (msg.type === "reportTap") {
          const found = reports.find((r) => r.id === msg.id) ?? null;
          setSelectedBuilding(null);
          setSelectedPartner(null);
          setSelectedReport(found);
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
          setReportTarget({
            lat: msg.lat,
            lng: msg.lng,
            buildingName: msg.buildingName ?? null,
          });
          return;
        }

        // 편의시설 전용 배너는 아직 없다. 그 시설이 있는 건물 배너를 대신 띄운다.
        if (msg.type === "facilityTap") {
          const building =
            BUILDINGS.find((b) => b.name === msg.buildingName) ?? null;
          setSelectedPartner(null);
          setSelectedBuilding(building);
          return;
        }

        // 지도 빈 곳을 눌렀다. 핀이 사라졌으니 건물 배너도 함께 닫는다.
        if (msg.type === "buildingDismiss") {
          setSelectedBuilding(null);
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
    [reports, accessToken, logout],
  );

  /** 두 단계를 합쳐 지도를 다시 그린다. 어느 칩 줄을 눌렀든 여기로 모인다. */
  const applyFilter = useCallback(
    (filter: PartnerFilter) => {
      setSelectedPartner(null);

      if (!hasActiveFilter(filter)) {
        postToMap({ type: "clearPartners" });
        return;
      }

      setSelectedBuilding(null);
      const partners = filterPartners(filter);
      postToMap({
        type: "setPartners",
        partners: partners.map(toMarker),
        bounds: partnerFocusBounds(partners),
      });
    },
    [postToMap],
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
      setSelectedPartner(partner);

      postToMap({
        type: "setPartners",
        partners: [toMarker(partner)],
        bounds: null,
      });
      postToMap({ type: "focusPartner", id: partner.id, zoom: 18 });
    },
    [postToMap],
  );

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
      if (next === null) {
        postToMap({ type: "clearFacilities" });
        return;
      }
      postToMap({ type: "setFacilities", markers: facilityMarkers(next) });
    },
    [postToMap],
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
    },
    [layer, postToMap, applyFacilityKind],
  );

  /**
   * 지도 페이지가 (다시) 준비됐을 때 지금 화면 상태를 다시 그린다. 첫 로딩이 늦거나 실패해 자동으로
   * 다시 불러오면 페이지가 새로 떠서, 그 사이 보낸 마커 명령이 사라지기 때문이다(NaverMapView 참고).
   */
  const resyncMap = useCallback(() => {
    if (hasActiveFilter(activeFilter)) {
      const partners = filterPartners(activeFilter);
      postToMap({
        type: "setPartners",
        partners: partners.map(toMarker),
        bounds: partnerFocusBounds(partners),
      });
    }
    if (facilityKind !== null) {
      postToMap({ type: "setFacilities", markers: facilityMarkers(facilityKind) });
    }
    if (reportsOn && shownReportData !== undefined) {
      postToMap({ type: "setReports", markers: toReportMarkers(shownReportData) });
    }
    // 위치를 고르던 중이면 새 페이지에서도 고르기 모드를 다시 켠다. 이전 페이지가 보낸 중앙 좌표는
    // 버리고 새 페이지가 다시 알려 줄 때까지 확인 버튼을 막는다.
    if (pickingLocation) {
      setPickerCenter(null);
      postToMap({ type: "startLocationPicker", purpose: pickerPurpose });
    }
  }, [activeFilter, facilityKind, reportsOn, shownReportData, pickingLocation, pickerPurpose, postToMap]);

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
    const next = !reportsOn;
    setReportsOn(next);
    setSelectedReport(null);
    if (!next) postToMap({ type: "clearReports" });
  }, [reportsOn, postToMap]);

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

  /** 제휴 제보 창에서 "지도에서 (다시) 찍기"로 넘어올 때 그 창에 있던 위치. 핀 고르기를 취소하면 되돌린다. */
  const partnerLocationBeforePickRef = useRef<PartnerSuggestLocation | null>(null);

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
      setSelectedBuilding(null);
      setSelectedPartner(null);
      setSelectedReport(null);
      // 레이어가 이미 켜져 있으면 목록도 새로 받아 방금 올라온 제보가 마커로 보이게 한다. 꺼져 있으면 켜는 순간 받는다.
      if (reportsOn) reportsResource.retry();
      else setReportsOn(true);
      try {
        const live = visibleReports(await getLiveReports({ accessToken }));
        if (request !== focusRequestRef.current) return;
        const found = live.find(
          (r) => r.id === reportId && !(r.authorKey && hiddenAuthorKeys.has(r.authorKey)),
        );
        if (!found) {
          toast.show({ message: "이 제보는 지금 지도에 없어요. 이미 끝났거나 내려갔어요.", tone: "info" });
          return;
        }
        setSelectedReport(found);
        postToMap({ type: "focusReport", lat: found.lat, lng: found.lng });
      } catch {
        if (request !== focusRequestRef.current) return;
        toast.show({ message: "제보를 불러오지 못했어요. 잠시 뒤 다시 시도해 주세요.", tone: "info" });
      }
    },
    [accessToken, reportsOn, reportsResource.retry, postToMap, toast, hiddenAuthorKeys],
  );

  /**
   * 다른 화면에서 넘어온 지도 요청(`lib/mapIntents.ts`). 지도 탭에 올 때(또는 이미 떠 있으면 즉시) 처리한다.
   * - 설정의 제휴 제보 창 "지도에서 위치 찍기" → 핀 고르기
   * - 제보 알림 탭 → 그 제보 포커스
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
    }
  }, [startPicker, focusReportFromNotification]);

  useFocusEffect(handleMapIntent);
  useEffect(() => subscribeMapIntent(handleMapIntent), [handleMapIntent]);

  const handleCancelReportPicker = useCallback(() => {
    setPickingLocation(false);
    setPickerCenter(null);
    postToMap({ type: "stopLocationPicker" });
    // 제휴 제보 중이었으면 그 창으로 돌아간다(입력해 둔 내용은 창이 되살린다). 안 그러면 쓰던 제보가 사라진다.
    if (pickerPurpose === "partner") {
      setPartnerSuggest({ location: partnerLocationBeforePickRef.current });
    }
  }, [pickerPurpose, postToMap]);

  /** 확인을 누르면 화면 중앙 좌표로 작성창을 연다. 롱프레스 제보와 같은 작성창을 쓴다. 제휴 제보면 제휴 제보 창을 연다. */
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
        <View style={[styles.mapCanvas, { marginBottom: tabBarHeight }]}>
          <NaverMapView
            ref={webViewRef}
            html={mapHTML}
            onMessage={handleWebViewMessage}
            onReady={resyncMap}
          />
        </View>

        <View
          pointerEvents="box-none"
          style={[styles.bannerStack, overlayInset, { top: headerHeight + 8 }]}
        >
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

          {reportsOn && reportsResource.loading && reportsResource.errorMessage === null && (
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

          {reportsEmpty && (
            <View style={styles.offscreenNotice}>
              <Ionicons name="information-circle" size={13} color={COLORS.textSecondary} />
              <Text style={styles.offscreenText}>지금은 진행 중인 제보가 없어요</Text>
            </View>
          )}

          {unresolvedCount > 0 && (
            <View style={styles.offscreenNotice}>
              <Ionicons name="information-circle" size={13} color={COLORS.textSecondary} />
              <Text style={styles.offscreenText}>
                건물을 찾지 못한 편의시설 {unresolvedCount}곳은 지도에서 빠졌어요
              </Text>
            </View>
          )}

          {offscreenCount > 0 && (
            <View style={styles.offscreenNotice}>
              <Ionicons name="information-circle" size={13} color={COLORS.textSecondary} />
              <Text style={styles.offscreenText}>
                캠퍼스 밖 {offscreenCount}곳은 지도를 줌아웃하면 보여요
              </Text>
            </View>
          )}
        </View>

        {!pickingLocation && (
          <View style={[styles.mapControls, { bottom: 20 + tabBarHeight }]}>
            <TouchableOpacity
              style={styles.controlBtn}
              onPress={handleStartReportPicker}
              accessibilityRole="button"
              accessibilityLabel="제보하기"
            >
              <Ionicons name="megaphone" size={17} color={COLORS.primary} />
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
            <View pointerEvents="none" style={[styles.pickerMarkerWrap, { bottom: tabBarHeight }]}>
              <View style={styles.pickerCrosshairV} />
              <View style={styles.pickerCrosshairH} />
              <View style={styles.pickerPinAnchor}>
                <View style={styles.pickerPinBubble}>
                  <Ionicons name="megaphone" size={15} color={COLORS.white} />
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
                label={pickerPurpose === "partner" ? "이 위치로 제휴 제보" : "이 위치 제보하기"}
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
        <View
          pointerEvents="box-none"
          style={[
            styles.bottomSheetLayer,
            { bottom: tabBarHeight, left: sideGutter, right: sideGutter },
          ]}
        >
          {selectedBuilding && (
            <BuildingSheet
              building={selectedBuilding}
              onClose={handleCloseBuilding}
              routeFindingEnabled={ROUTE_FINDING_ENABLED}
              onSetFrom={handleSetFrom}
              onSetTo={handleSetTo}
            />
          )}

          {selectedPartner && (
            <PartnerSheet partner={selectedPartner} onClose={handleClosePartner} />
          )}

          {selectedReport && (
            <ReportSheet
              report={selectedReport}
              onClose={() => setSelectedReport(null)}
            />
          )}
        </View>
      </View>

      {/*
        검색바·필터 칩을 지도 위에 뜨는 투명 오버레이로 띄운다. mapArea 뒤에
        와야(later sibling) 그 위에 그려진다. pointerEvents="box-none" 이라
        빈 공간(제목 옆, 칩 사이)은 터치가 그대로 지도로 전달되고, 안의
        버튼·칩만 눌린다. onLayout 으로 잰 실제 높이를 배너·상단바 위치
        계산에 쓴다(headerHeight, 위 선언부 주석 참고).
      */}
      <View
        style={[
          styles.headerOverlay,
          // 제목 줄을 없앤 뒤라, 상태 바에 검색바가 바로 붙지 않게 여백만 조금 남긴다.
          // 검색바·칩은 지도처럼 창 너비를 다 쓴다 — 폴드를 펴거나 웹 창을 늘려도 지도와 같이 늘어난다.
          { paddingTop: insets.top + 8 },
        ]}
        pointerEvents="box-none"
        onLayout={(e) => setHeaderHeight(e.nativeEvent.layout.height)}
      >
        {!pickingLocation && (
          <>
            <View style={styles.searchBarWrap}>
              <TouchableOpacity
                style={styles.searchBar}
                activeOpacity={0.7}
                onPress={() => setShowSearch(true)}
                accessibilityRole="button"
                accessibilityLabel="제휴 업체 검색"
              >
                <Ionicons name="search" size={18} color={COLORS.textTertiary} />
                <Text style={styles.searchPlaceholder}>제휴 업체 검색</Text>
              </TouchableOpacity>
            </View>

            <MapFilterChips
              layer={layer}
              facilityKind={facilityKind}
              reportsOn={reportsOn}
              onSelectLayer={handleSelectLayer}
              onSelectFacilityKind={handleSelectFacilityKind}
              onToggleReports={handleToggleReports}
            />

            {layer === "제휴업체" && (
              <PartnerChips
                affiliation={selectedAffiliation}
                category={selectedCategory}
                onSelectAffiliation={handleSelectAffiliation}
                onSelectCategory={handleSelectCategory}
              />
            )}
          </>
        )}
      </View>

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
                    <View
                      style={[
                        styles.buildingItemDot,
                        { backgroundColor: item.color },
                      ]}
                    />
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
      />

      <ReportComposerModal
        target={reportTarget}
        onClose={() => setReportTarget(null)}
        onCreated={handleReportCreated}
      />

      <PartnerSuggestModal
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
    borderRadius: 12,
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
  // 실제 지도가 그려지는 칸. 탭바 높이만큼 아래를 비운다(JSX 주석 참고). 위치 고르기 중앙 핀도 같은 칸 기준이다.
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
    borderRadius: 12,
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
    borderRadius: 14,
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
  controlBtn: {
    width: 40,
    height: 40,
    backgroundColor: COLORS.white,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 6,
    elevation: 4,
  },
  bannerStack: {
    position: "absolute",
    top: 8,
    left: 12,
    right: 12,
    gap: 6,
  },
  mapErrorNotice: {
    backgroundColor: COLORS.warningSoft,
    borderRadius: 12,
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
    borderRadius: 12,
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
  routeStrip: {
    position: "absolute",
    top: 8,
    left: 12,
    right: 12,
    backgroundColor: COLORS.white,
    borderRadius: 12,
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
  routeSearchInput: { fontFamily: FONTS.regular, flex: 1, fontSize: 14, color: COLORS.textPrimary },
  buildingList: { paddingHorizontal: 16 },
  buildingItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    borderBottomWidth: 0.5,
    borderBottomColor: COLORS.border,
    gap: 10,
  },
  buildingItemDot: { width: 10, height: 10, borderRadius: 5 },
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
