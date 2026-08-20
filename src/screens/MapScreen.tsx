import { useState, useCallback, useRef, useMemo } from "react";
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
import { SafeAreaView } from "react-native-safe-area-context";
import NaverMapView from "../components/map/NaverMapView";
import type { NaverMapViewHandle } from "../components/map/NaverMapView";
import FloorPickerModal from "../components/map/FloorPickerModal";
import type { FloorTarget } from "../components/map/FloorPickerModal";
import BuildingSheet from "../components/map/BuildingSheet";
import MapFilterChips from "../components/map/MapFilterChips";
import ReportComposerModal from "../components/map/ReportComposerModal";
import type { ReportTarget } from "../components/map/ReportComposerModal";
import ReportSheet from "../components/map/ReportSheet";
import { useAuth } from "../contexts/AuthContext";
import { getLiveReports } from "../lib/reportsApi";
import { toReportMarkers, visibleReports } from "../utils/reports";
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
import { WALKING_METERS_PER_MINUTE } from "../constants/route";
import {
  formatFloor,
  hasFloorData,
  floorTransitSeconds,
  resolveEntrancePoint,
} from "../utils/floors";
import { haversineMeters } from "../utils/geo";
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

/** 경로 표시에 층을 병기한다. 층을 고르지 않았으면 건물명만. */
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
  const { accessToken } = useAuth();
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
  // 층 다이얼을 띄울 대상. 건물에 층 정보가 있을 때만 채워진다.
  const [pendingFloor, setPendingFloor] = useState<{
    building: Building;
    target: FloorTarget;
  } | null>(null);
  // 최상단 필터. 무엇을 볼지 먼저 고르게 한다. null 이면 하위 칩 줄이 없다.
  const [layer, setLayer] = useState<MapLayer | null>(null);
  const [facilityKind, setFacilityKind] = useState<FacilityKind | null>(null);
  // 지도를 길게 눌러 잡은 제보 위치. null 이면 작성창이 닫혀 있다.
  const [reportTarget, setReportTarget] = useState<ReportTarget | null>(null);
  // 제보는 서버에서 받아오므로 켰을 때만 부른다. 지도·제휴·편의시설은
  // 정적 데이터라 서버가 죽어도 그대로 동작해야 한다.
  const [reportsOn, setReportsOn] = useState(false);
  const [reports, setReports] = useState<ReportListItem[]>([]);
  const [reportsLoading, setReportsLoading] = useState(false);
  const [reportsError, setReportsError] = useState<string | null>(null);
  const [selectedReport, setSelectedReport] = useState<ReportListItem | null>(
    null,
  );
  const [showSearch, setShowSearch] = useState(false);
  const [showRoute, setShowRoute] = useState(false);
  const [routeTarget, setRouteTarget] = useState<"from" | "to" | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  const mapHTML = useMemo(() => buildMapHTML(BUILDINGS), []);

  // 도보 시간 = 출입구 간 직선거리 + 선택한 층을 오르내리는 시간.
  // 건물에 층별 출입구가 등록돼 있으면 고른 층에 맞는 문에서 거리를 잰다.
  const routeMinutes = useMemo(() => {
    if (!fromBuilding || !toBuilding) return 0;
    const fromPoint = resolveEntrancePoint(fromBuilding, fromFloor);
    const toPoint = resolveEntrancePoint(toBuilding, toFloor);
    const meters = haversineMeters(
      fromPoint.lat,
      fromPoint.lng,
      toPoint.lat,
      toPoint.lng,
    );
    const walkSeconds = (meters / WALKING_METERS_PER_MINUTE) * 60;
    const totalSeconds = walkSeconds + floorTransitSeconds(fromFloor, toFloor);
    return Math.max(1, Math.round(totalSeconds / 60));
  }, [fromBuilding, toBuilding, fromFloor, toFloor]);

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
    reportsOn && !reportsLoading && reportsError === null && reports.length === 0;

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
      } catch {}
    },
    [reports],
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

  /**
   * 층별 출입구가 등록된 건물이면 고른 층에 맞는 문에서 경로를 잇는다.
   * 층을 방금 고른 쪽은 상태 갱신이 아직 반영되기 전이라 인자로 직접 받는다
   * (같은 틱에서 setFromFloor 직후 호출되므로 fromFloor 상태를 읽으면 이전 값이 잡힌다).
   */
  const drawRoute = useCallback(
    (from: Building, fromFloorArg: number | null, to: Building, toFloorArg: number | null) => {
      const fromPoint = resolveEntrancePoint(from, fromFloorArg);
      const toPoint = resolveEntrancePoint(to, toFloorArg);
      postToMap({
        type: "showRoute",
        fromLat: fromPoint.lat,
        fromLng: fromPoint.lng,
        toLat: toPoint.lat,
        toLng: toPoint.lng,
      });
    },
    [postToMap],
  );

  /** 출발이 확정되면 도착지 선택 화면으로 자동으로 넘어간다. */
  const advanceToDestination = useCallback(
    (from: Building, floor: number | null) => {
      if (toBuilding) {
        drawRoute(from, floor, toBuilding, toFloor);
        setShowRoute(false);
        setRouteTarget(null);
        return;
      }
      setSearchQuery("");
      setRouteTarget("to");
      setShowRoute(true);
    },
    [toBuilding, toFloor, drawRoute],
  );

  const finishDestination = useCallback(
    (to: Building, floor: number | null) => {
      if (fromBuilding) drawRoute(fromBuilding, fromFloor, to, floor);
      setShowRoute(false);
      setRouteTarget(null);
      setSearchQuery("");
    },
    [fromBuilding, fromFloor, drawRoute],
  );

  /** 층 정보가 있는 건물이면 다이얼을 먼저 띄우고, 없으면 곧장 다음 단계로. */
  const beginFrom = useCallback(
    (building: Building) => {
      setFromBuilding(building);
      setFromFloor(null);
      setSelectedBuilding(null);
      if (hasFloorData(building)) {
        // 모달 중첩을 피한다. 층 선택이 끝나면 도착지 단계에서 다시 연다.
        setShowRoute(false);
        setPendingFloor({ building, target: "from" });
        return;
      }
      advanceToDestination(building, null);
    },
    [advanceToDestination],
  );

  const beginTo = useCallback(
    (building: Building) => {
      setToBuilding(building);
      setToFloor(null);
      setSelectedBuilding(null);
      if (hasFloorData(building)) {
        setShowRoute(false);
        setPendingFloor({ building, target: "to" });
        return;
      }
      finishDestination(building, null);
    },
    [finishDestination],
  );

  const handleFloorConfirm = useCallback(
    (floor: number) => {
      if (!pendingFloor) return;
      const { building, target } = pendingFloor;
      setPendingFloor(null);
      if (target === "from") {
        setFromFloor(floor);
        advanceToDestination(building, floor);
        return;
      }
      setToFloor(floor);
      finishDestination(building, floor);
    },
    [pendingFloor, advanceToDestination, finishDestination],
  );

  const handleFloorCancel = useCallback(() => setPendingFloor(null), []);

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

  /** 살아있는 제보를 받아 지도에 올린다. */
  const loadReports = useCallback(async () => {
    setReportsLoading(true);
    setReportsError(null);
    try {
      const list = await getLiveReports({ accessToken });
      const visible = visibleReports(list);
      setReports(visible);
      postToMap({ type: "setReports", markers: toReportMarkers(visible) });
    } catch (caught) {
      setReports([]);
      postToMap({ type: "clearReports" });
      setReportsError(
        caught instanceof Error
          ? caught.message
          : "제보를 불러오지 못했습니다.",
      );
    } finally {
      setReportsLoading(false);
    }
  }, [accessToken, postToMap]);

  /** 제보 버튼. 켜면 지금 진행 중인 제보를 받아 오고, 끄면 지도에서 내린다. */
  const handleToggleReports = useCallback(() => {
    const next = !reportsOn;
    setReportsOn(next);
    setSelectedReport(null);

    if (next) {
      void loadReports();
      return;
    }
    setReports([]);
    setReportsError(null);
    postToMap({ type: "clearReports" });
  }, [reportsOn, loadReports, postToMap]);

  /**
   * 제보 등록 성공. 작성창을 닫는다.
   *
   * 새 제보는 만들자마자 `ACTIVE` 라(임시 로컬 저장소라 검토 절차가 없다) 제보
   * 레이어가 켜져 있으면 목록을 다시 불러 바로 지도에 반영한다.
   */
  const handleReportCreated = useCallback(() => {
    setReportTarget(null);
    if (reportsOn) void loadReports();
  }, [reportsOn, loadReports]);

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
    <SafeAreaView style={styles.container} edges={["top"]}>
      <PartnerNoticeModal />

      <View style={styles.header}>
        <Text style={styles.headerTitle}>캠퍼스</Text>
      </View>

      <TouchableOpacity
        style={styles.searchBar}
        activeOpacity={0.7}
        onPress={() => setShowSearch(true)}
        accessibilityRole="button"
        accessibilityLabel="제휴 업체 검색"
      >
        <Ionicons name="search" size={16} color="#999" />
        <Text style={styles.searchPlaceholder}>제휴 업체 검색</Text>
      </TouchableOpacity>

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

      <View style={styles.mapArea}>
        <NaverMapView
          ref={webViewRef}
          html={mapHTML}
          onMessage={handleWebViewMessage}
        />

        <View style={styles.bannerStack}>
          {mapAuthFailed && (
            <View style={styles.mapErrorNotice}>
              <Ionicons name="warning" size={15} color="#B45309" />
              <Text style={styles.mapErrorText}>
                지도를 불러오지 못했어요. 네이버 지도 인증에 실패했습니다.
              </Text>
              <TouchableOpacity
                onPress={() => setMapAuthFailed(false)}
                hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                accessibilityRole="button"
                accessibilityLabel="닫기"
              >
                <Ionicons name="close" size={15} color="#B45309" />
              </TouchableOpacity>
            </View>
          )}

          {reportsError !== null && (
            <View style={styles.mapErrorNotice}>
              <Ionicons name="warning" size={15} color="#B45309" />
              <Text style={styles.mapErrorText}>{reportsError}</Text>
              <TouchableOpacity
                onPress={() => setReportsError(null)}
                hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                accessibilityRole="button"
                accessibilityLabel="닫기"
              >
                <Ionicons name="close" size={15} color="#B45309" />
              </TouchableOpacity>
            </View>
          )}

          {reportsEmpty && (
            <View style={styles.offscreenNotice}>
              <Ionicons name="information-circle" size={13} color="#6B7280" />
              <Text style={styles.offscreenText}>지금은 진행 중인 제보가 없어요</Text>
            </View>
          )}

          {unresolvedCount > 0 && (
            <View style={styles.offscreenNotice}>
              <Ionicons name="information-circle" size={13} color="#6B7280" />
              <Text style={styles.offscreenText}>
                건물을 찾지 못한 편의시설 {unresolvedCount}곳은 지도에서 빠졌어요
              </Text>
            </View>
          )}

          {offscreenCount > 0 && (
            <View style={styles.offscreenNotice}>
              <Ionicons name="information-circle" size={13} color="#6B7280" />
              <Text style={styles.offscreenText}>
                캠퍼스 밖 {offscreenCount}곳은 지도를 줌아웃하면 보여요
              </Text>
            </View>
          )}
        </View>

        <View style={styles.mapControls}>
          <TouchableOpacity
            style={[styles.controlBtn, reportsOn && styles.controlBtnActive]}
            onPress={handleToggleReports}
            accessibilityRole="button"
            accessibilityLabel={reportsOn ? "제보 숨기기" : "제보 보기"}
            accessibilityState={{ selected: reportsOn }}
          >
            {reportsLoading ? (
              <ActivityIndicator
                size="small"
                color={reportsOn ? COLORS.white : COLORS.primary}
              />
            ) : (
              <Ionicons
                name="megaphone"
                size={17}
                color={reportsOn ? COLORS.white : COLORS.primary}
              />
            )}
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.controlBtn}
            onPress={() => setShowRoute(true)}
            accessibilityRole="button"
            accessibilityLabel="길찾기"
          >
            <Ionicons name="navigate" size={17} color={COLORS.primary} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.controlBtn}>
            <Ionicons name="locate-outline" size={17} color={COLORS.primary} />
          </TouchableOpacity>
        </View>

        {fromBuilding && toBuilding && (
          <View style={styles.routeStrip}>
            <View style={styles.routeInfo}>
              <View style={styles.routeRow}>
                <View
                  style={[styles.routeDot, { backgroundColor: "#10B981" }]}
                />
                <Text style={styles.routeLabel} numberOfLines={1}>
                  {buildingLabel(fromBuilding, fromFloor)}
                </Text>
              </View>
              <Text style={styles.routeArrow}>→</Text>
              <View style={styles.routeRow}>
                <View
                  style={[styles.routeDot, { backgroundColor: "#EF4444" }]}
                />
                <Text style={styles.routeLabel} numberOfLines={1}>
                  {buildingLabel(toBuilding, toFloor)}
                </Text>
              </View>
            </View>
            <Text style={styles.routeTime}>도보 {routeMinutes}분</Text>
            <TouchableOpacity
              onPress={handleClearRoute}
              style={styles.routeCloseBtn}
            >
              <Ionicons name="close" size={16} color="#999" />
            </TouchableOpacity>
          </View>
        )}

        {selectedBuilding && (
          <BuildingSheet
            building={selectedBuilding}
            onClose={handleCloseBuilding}
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

      <Modal visible={showRoute} animationType="slide">
        <SafeAreaView style={styles.routeModal} edges={["top"]}>
          <View style={styles.routeModalHeader}>
            <TouchableOpacity onPress={handleCloseRoute}>
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
              <View style={[styles.inputDot, { backgroundColor: "#10B981" }]} />
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
              <View style={[styles.inputDot, { backgroundColor: "#EF4444" }]} />
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
                <Ionicons name="search" size={16} color="#999" />
                <TextInput
                  style={styles.routeSearchInput}
                  placeholder="건물 검색"
                  placeholderTextColor="#bbb"
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
                    <Ionicons name="chevron-forward" size={14} color="#ddd" />
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
                  style={[styles.routeDot, { backgroundColor: "#10B981" }]}
                />
                <Text style={styles.routeResultName}>{fromBuilding.name}</Text>
              </View>
              <View style={styles.routeResultDivider}>
                <View style={styles.routeResultLine} />
                <Text style={styles.routeResultTime}>
                  도보 약 {routeMinutes}분
                </Text>
              </View>
              <View style={styles.routeResultRow}>
                <View
                  style={[styles.routeDot, { backgroundColor: "#EF4444" }]}
                />
                <Text style={styles.routeResultName}>{toBuilding.name}</Text>
              </View>
              <TouchableOpacity
                style={styles.routeStartBtn}
                onPress={handleCloseRoute}
              >
                <Text style={styles.routeStartText}>경로 보기</Text>
              </TouchableOpacity>
            </View>
          )}
        </SafeAreaView>
      </Modal>

      <PartnerSearchModal
        visible={showSearch}
        onClose={() => setShowSearch(false)}
        onSelect={handleSearchSelect}
      />

      <ReportComposerModal
        target={reportTarget}
        onClose={() => setReportTarget(null)}
        onCreated={handleReportCreated}
      />

      {pendingFloor && (
        <FloorPickerModal
          building={pendingFloor.building}
          target={pendingFloor.target}
          onConfirm={handleFloorConfirm}
          onCancel={handleFloorCancel}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.white },
  header: {
    paddingHorizontal: 16,
    paddingTop: 4,
    paddingBottom: 8,
    backgroundColor: COLORS.white,
  },
  headerTitle: { fontSize: 20, fontFamily: FONTS.bold, color: COLORS.textPrimary },
  searchBar: {
    marginHorizontal: 16,
    marginBottom: 10,
    height: 40,
    borderRadius: 12,
    backgroundColor: "#F0F0F0",
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    gap: 8,
  },
  searchPlaceholder: { fontFamily: FONTS.regular, fontSize: 13, color: "#bbb" },
  mapArea: { flex: 1, position: "relative" },
  mapControls: { position: "absolute", right: 12, bottom: 20, gap: 8 },
  controlBtnActive: { backgroundColor: COLORS.primary },
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
    backgroundColor: "#FEF3C7",
    borderRadius: 10,
    paddingHorizontal: 11,
    paddingVertical: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  mapErrorText: {
    flex: 1,
    fontSize: 12,
    color: "#92400E",
  },
  offscreenNotice: {
    backgroundColor: "rgba(255,255,255,0.95)",
    borderRadius: 10,
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
  offscreenText: { fontSize: 11.5, color: "#6B7280", fontFamily: FONTS.medium },
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
  routeArrow: { fontFamily: FONTS.regular, fontSize: 12, color: "#ccc" },
  routeTime: { fontSize: 12, color: COLORS.primary, fontFamily: FONTS.semibold },
  routeCloseBtn: { padding: 2 },
  routeModal: { flex: 1, backgroundColor: COLORS.white },
  routeModalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 0.5,
    borderBottomColor: "#eee",
  },
  routeModalTitle: {
    fontSize: 16,
    fontFamily: FONTS.semibold,
    color: COLORS.textPrimary,
  },
  routeInputs: {
    marginHorizontal: 16,
    marginTop: 16,
    backgroundColor: "#F7F7F7",
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
  routeInputActive: { backgroundColor: "#EEF0FA" },
  inputDot: { width: 10, height: 10, borderRadius: 5 },
  inputPlaceholder: { fontFamily: FONTS.regular, fontSize: 14, color: "#bbb" },
  inputFilled: { fontSize: 14, color: COLORS.textPrimary, fontFamily: FONTS.medium },
  inputDivider: {
    height: 0.5,
    backgroundColor: "#E8E8E8",
    marginHorizontal: 14,
  },
  routeSearch: { flex: 1, marginTop: 12 },
  routeSearchBar: {
    marginHorizontal: 16,
    height: 38,
    borderRadius: 10,
    backgroundColor: "#F0F0F0",
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
    borderBottomColor: "#f4f4f4",
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
    backgroundColor: "#F7F7F7",
    borderRadius: 14,
    padding: 16,
  },
  routeResultRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  routeResultName: {
    fontSize: 14,
    fontFamily: FONTS.medium,
    color: COLORS.textPrimary,
  },
  routeResultDivider: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 8,
    paddingLeft: 3,
  },
  routeResultLine: {
    width: 2,
    height: 20,
    backgroundColor: "#ddd",
    borderRadius: 1,
  },
  routeResultTime: { fontSize: 12, color: COLORS.primary, fontFamily: FONTS.medium },
  routeStartBtn: {
    marginTop: 14,
    height: 42,
    backgroundColor: COLORS.primary,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  routeStartText: { fontSize: 14, color: "#fff", fontFamily: FONTS.semibold },
});
