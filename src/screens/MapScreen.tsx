import { useState, useCallback, useRef, useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  FlatList,
  Modal,
  Linking,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import NaverMapView from "../components/map/NaverMapView";
import type { NaverMapViewHandle } from "../components/map/NaverMapView";
import { Ionicons } from "@expo/vector-icons";
import { COLORS } from "../constants/colors";
import { BUILDINGS } from "../constants/buildings";
import type { Building } from "../types";

const NAVER_MAP_CLIENT_ID = process.env.EXPO_PUBLIC_NAVER_MAP_CLIENT_ID ?? "";
const CAMPUS_CENTER = { lat: 37.5508, lng: 126.9237 };

function haversineMeters(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  const R = 6371000;
  const rad = Math.PI / 180;
  const dLat = (lat2 - lat1) * rad;
  const dLng = (lng2 - lng1) * rad;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * rad) * Math.cos(lat2 * rad) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function buildMapHTML(buildings: Building[]): string {
  const buildingJSON = JSON.stringify(
    buildings.map((b) => ({
      name: b.name,
      lat: b.lat,
      lng: b.lng,
      color: b.color,
      boundary: b.boundary ?? null,
    })),
  );

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no">
  <style>
    * { margin:0; padding:0; box-sizing:border-box; }
    html, body, #map { width:100%; height:100%; }
  </style>
</head>
<body>
  <div id="map"></div>
  <script type="text/javascript" src="https://oapi.map.naver.com/openapi/v3/maps.js?ncpKeyId=${NAVER_MAP_CLIENT_ID}"></script>
  <script>
    var container = document.getElementById('map');
    var map = new naver.maps.Map(container, {
      center: new naver.maps.LatLng(${CAMPUS_CENTER.lat}, ${CAMPUS_CENTER.lng}),
      zoom: 17,
    });

    var buildings = ${buildingJSON};
    var routePolyline = null;
    var fromOverlay = null;
    var toOverlay = null;

    function makeRouteMarkerHTML(color, label) {
      return '<div style="width:32px;height:32px;border-radius:50%;background:' + color + ';border:2.5px solid #fff;box-shadow:0 2px 8px rgba(0,0,0,0.3);display:flex;align-items:center;justify-content:center;"><span style="color:#fff;font-size:9px;font-weight:700;">' + label + '</span></div>';
    }

    var H = 0.00022;
    buildings.forEach(function(b) {
      var points = b.boundary && b.boundary.length > 0
        ? b.boundary.map(function(p) { return new naver.maps.LatLng(p[0], p[1]); })
        : [
            new naver.maps.LatLng(b.lat + H, b.lng - H),
            new naver.maps.LatLng(b.lat + H, b.lng + H),
            new naver.maps.LatLng(b.lat - H, b.lng + H),
            new naver.maps.LatLng(b.lat - H, b.lng - H),
          ];
      var polygon = new naver.maps.Polygon({
        map: map,
        paths: points,
        fillColor: b.color,
        fillOpacity: 0.001,
        strokeWeight: 0,
      });
      naver.maps.Event.addListener(polygon, 'click', function() {
        var msg = JSON.stringify({ type: 'buildingTap', name: b.name });
        if (window.ReactNativeWebView) window.ReactNativeWebView.postMessage(msg);
      });
    });

    function handleNativeMessage(data) {
      try {
        var msg = JSON.parse(data);
        if (msg.type === 'showRoute') {
          if (routePolyline) routePolyline.setMap(null);
          if (fromOverlay) fromOverlay.setMap(null);
          if (toOverlay) toOverlay.setMap(null);
          var from = new naver.maps.LatLng(msg.fromLat, msg.fromLng);
          var to = new naver.maps.LatLng(msg.toLat, msg.toLng);
          routePolyline = new naver.maps.Polyline({
            map: map,
            path: [from, to],
            strokeWeight: 4,
            strokeColor: '#3B82F6',
            strokeOpacity: 0.88,
            strokeStyle: 'dash',
          });
          fromOverlay = new naver.maps.Marker({
            position: from,
            icon: {
              content: makeRouteMarkerHTML('#10B981', '출발'),
              anchor: new naver.maps.Point(16, 16),
            },
            map: map,
          });
          toOverlay = new naver.maps.Marker({
            position: to,
            icon: {
              content: makeRouteMarkerHTML('#EF4444', '도착'),
              anchor: new naver.maps.Point(16, 16),
            },
            map: map,
          });
          var swLat = Math.min(msg.fromLat, msg.toLat);
          var swLng = Math.min(msg.fromLng, msg.toLng);
          var neLat = Math.max(msg.fromLat, msg.toLat);
          var neLng = Math.max(msg.fromLng, msg.toLng);
          map.fitBounds(new naver.maps.LatLngBounds(
            new naver.maps.LatLng(swLat, swLng),
            new naver.maps.LatLng(neLat, neLng)
          ));
        }
        if (msg.type === 'clearRoute') {
          if (routePolyline) { routePolyline.setMap(null); routePolyline = null; }
          if (fromOverlay) { fromOverlay.setMap(null); fromOverlay = null; }
          if (toOverlay) { toOverlay.setMap(null); toOverlay = null; }
          map.setCenter(new naver.maps.LatLng(${CAMPUS_CENTER.lat}, ${CAMPUS_CENTER.lng}));
          map.setZoom(17);
        }
      } catch(e) {}
    }

    document.addEventListener('message', function(e) { handleNativeMessage(e.data); });
    window.addEventListener('message', function(e) { handleNativeMessage(e.data); });
  </script>
</body>
</html>`;
}

export default function MapScreen() {
  const webViewRef = useRef<NaverMapViewHandle>(null);
  const [selectedBuilding, setSelectedBuilding] = useState<Building | null>(
    null,
  );
  const [fromBuilding, setFromBuilding] = useState<Building | null>(null);
  const [toBuilding, setToBuilding] = useState<Building | null>(null);
  const [showRoute, setShowRoute] = useState(false);
  const [routeTarget, setRouteTarget] = useState<"from" | "to" | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  const mapHTML = useMemo(() => buildMapHTML(BUILDINGS), []);

  const routeMinutes = useMemo(() => {
    if (!fromBuilding || !toBuilding) return 0;
    const meters = haversineMeters(
      fromBuilding.lat,
      fromBuilding.lng,
      toBuilding.lat,
      toBuilding.lng,
    );
    return Math.max(1, Math.round(meters / 80));
  }, [fromBuilding, toBuilding]);

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
          setSelectedBuilding(building);
        }
      } catch {}
    },
    [],
  );

  const handleSetFrom = useCallback(() => {
    if (!selectedBuilding) return;
    const next = selectedBuilding;
    setFromBuilding(next);
    setSelectedBuilding(null);
    if (toBuilding) {
      postToMap({
        type: "showRoute",
        fromLat: next.lat,
        fromLng: next.lng,
        toLat: toBuilding.lat,
        toLng: toBuilding.lng,
      });
    }
  }, [selectedBuilding, toBuilding, postToMap]);

  const handleSetTo = useCallback(() => {
    if (!selectedBuilding) return;
    const next = selectedBuilding;
    setToBuilding(next);
    setSelectedBuilding(null);
    if (fromBuilding) {
      postToMap({
        type: "showRoute",
        fromLat: fromBuilding.lat,
        fromLng: fromBuilding.lng,
        toLat: next.lat,
        toLng: next.lng,
      });
    }
  }, [selectedBuilding, fromBuilding, postToMap]);

  const handleClearRoute = useCallback(() => {
    setFromBuilding(null);
    setToBuilding(null);
    postToMap({ type: "clearRoute" });
  }, [postToMap]);

  const handleSelectRouteBuilding = useCallback(
    (building: Building) => {
      if (routeTarget === "from") {
        setFromBuilding(building);
        if (toBuilding) {
          postToMap({
            type: "showRoute",
            fromLat: building.lat,
            fromLng: building.lng,
            toLat: toBuilding.lat,
            toLng: toBuilding.lng,
          });
        }
      } else if (routeTarget === "to") {
        setToBuilding(building);
        if (fromBuilding) {
          postToMap({
            type: "showRoute",
            fromLat: fromBuilding.lat,
            fromLng: fromBuilding.lng,
            toLat: building.lat,
            toLng: building.lng,
          });
        }
      }
      setRouteTarget(null);
      setSearchQuery("");
    },
    [routeTarget, fromBuilding, toBuilding, postToMap],
  );

  const handleCloseRoute = useCallback(() => {
    setShowRoute(false);
    setRouteTarget(null);
    setSearchQuery("");
  }, []);

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>캠퍼스</Text>
      </View>

      <TouchableOpacity style={styles.searchBar} activeOpacity={0.7}>
        <Ionicons name="search" size={16} color="#999" />
        <Text style={styles.searchPlaceholder}>건물명, 시설명 검색</Text>
      </TouchableOpacity>

      <View style={styles.mapArea}>
        <NaverMapView
          ref={webViewRef}
          html={mapHTML}
          onMessage={handleWebViewMessage}
        />

        <View style={styles.mapControls}>
          <TouchableOpacity
            style={styles.controlBtn}
            onPress={() => setShowRoute(true)}
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
                  {fromBuilding.name}
                </Text>
              </View>
              <Text style={styles.routeArrow}>→</Text>
              <View style={styles.routeRow}>
                <View
                  style={[styles.routeDot, { backgroundColor: "#EF4444" }]}
                />
                <Text style={styles.routeLabel} numberOfLines={1}>
                  {toBuilding.name}
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
          <View style={styles.bottomSheet}>
            <View style={styles.sheetHandle} />
            <View style={styles.sheetHeader}>
              <View style={styles.sheetTitleRow}>
                <View
                  style={[
                    styles.sheetDot,
                    { backgroundColor: selectedBuilding.color },
                  ]}
                />
                <Text style={styles.sheetName}>{selectedBuilding.name}</Text>
              </View>
              <TouchableOpacity onPress={() => setSelectedBuilding(null)}>
                <Ionicons name="close" size={20} color="#ccc" />
              </TouchableOpacity>
            </View>
            <Text style={styles.sheetType}>
              {selectedBuilding.type} · 지상 {selectedBuilding.floors}층
            </Text>
            {selectedBuilding.description && (
              <Text style={styles.sheetDescription}>
                {selectedBuilding.description}
              </Text>
            )}
            {selectedBuilding.facilities &&
              selectedBuilding.facilities.length > 0 && (
                <View style={styles.sheetFacilities}>
                  {selectedBuilding.facilities.map((facility) => (
                    <View key={facility} style={styles.facilityChip}>
                      <Text style={styles.facilityChipText}>{facility}</Text>
                    </View>
                  ))}
                </View>
              )}
            <View style={styles.sheetHoursRow}>
              <Ionicons name="time-outline" size={13} color={COLORS.primary} />
              <Text style={styles.sheetHours}>{selectedBuilding.hours}</Text>
            </View>
            {selectedBuilding.contact && (
              <View style={styles.sheetContactRow}>
                <Ionicons
                  name="call-outline"
                  size={13}
                  color={COLORS.primary}
                />
                <Text style={styles.sheetContact}>
                  {selectedBuilding.contact}
                </Text>
              </View>
            )}
            {selectedBuilding.link && (
              <TouchableOpacity
                style={styles.sheetLinkBtn}
                onPress={() => Linking.openURL(selectedBuilding.link!.url)}
              >
                <Ionicons
                  name="open-outline"
                  size={14}
                  color={COLORS.primary}
                />
                <Text style={styles.sheetLinkText}>
                  {selectedBuilding.link.label}
                </Text>
              </TouchableOpacity>
            )}
            <View style={styles.sheetActions}>
              <TouchableOpacity
                style={styles.actionFrom}
                onPress={handleSetFrom}
              >
                <Ionicons name="location" size={14} color="#10B981" />
                <Text style={styles.actionFromText}>출발</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.actionTo} onPress={handleSetTo}>
                <Ionicons name="flag" size={14} color="#EF4444" />
                <Text style={styles.actionToText}>도착</Text>
              </TouchableOpacity>
            </View>
          </View>
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
                {fromBuilding ? fromBuilding.name : "출발지 입력"}
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
                {toBuilding ? toBuilding.name : "도착지 입력"}
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
  headerTitle: { fontSize: 20, fontWeight: "700", color: COLORS.textPrimary },
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
  searchPlaceholder: { fontSize: 13, color: "#bbb" },
  mapArea: { flex: 1, position: "relative" },
  webView: { flex: 1 },
  mapControls: { position: "absolute", right: 12, bottom: 20, gap: 8 },
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
  routeLabel: { fontSize: 13, color: COLORS.textPrimary, fontWeight: "500" },
  routeArrow: { fontSize: 12, color: "#ccc" },
  routeTime: { fontSize: 12, color: COLORS.primary, fontWeight: "600" },
  routeCloseBtn: { padding: 2 },
  bottomSheet: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: COLORS.white,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 20,
    paddingBottom: 30,
    paddingTop: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 10,
  },
  sheetHandle: {
    width: 36,
    height: 4,
    backgroundColor: "#E0E0E0",
    borderRadius: 2,
    alignSelf: "center",
    marginBottom: 14,
  },
  sheetHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 4,
  },
  sheetTitleRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  sheetDot: { width: 10, height: 10, borderRadius: 5 },
  sheetName: { fontSize: 17, fontWeight: "600", color: COLORS.textPrimary },
  sheetType: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginBottom: 10,
    paddingLeft: 18,
  },
  sheetDescription: {
    fontSize: 13,
    color: COLORS.textPrimary,
    lineHeight: 19,
    paddingLeft: 18,
    marginBottom: 10,
  },
  sheetFacilities: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    paddingLeft: 18,
    marginBottom: 12,
  },
  facilityChip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
    backgroundColor: "#F0F0F0",
  },
  facilityChipText: {
    fontSize: 11,
    color: COLORS.textSecondary,
    fontWeight: "500",
  },
  sheetContactRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 6,
  },
  sheetContact: { fontSize: 12, color: "#666" },
  sheetLinkBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 8,
    marginBottom: 4,
  },
  sheetLinkText: {
    fontSize: 13,
    color: COLORS.primary,
    fontWeight: "600",
    textDecorationLine: "underline",
  },
  sheetHoursRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 6,
    paddingVertical: 10,
    borderTopWidth: 0.5,
    borderTopColor: "#f0f0f0",
    marginBottom: 14,
  },
  sheetHours: { fontSize: 12, color: "#666", lineHeight: 20 },
  sheetActions: { flexDirection: "row", gap: 10 },
  actionFrom: {
    flex: 1,
    height: 42,
    borderRadius: 10,
    backgroundColor: "#EDFAF3",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  actionFromText: { fontSize: 13, color: "#10B981", fontWeight: "600" },
  actionTo: {
    flex: 1,
    height: 42,
    borderRadius: 10,
    backgroundColor: "#FEF2F2",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  actionToText: { fontSize: 13, color: "#EF4444", fontWeight: "600" },
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
    fontWeight: "600",
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
  inputPlaceholder: { fontSize: 14, color: "#bbb" },
  inputFilled: { fontSize: 14, color: COLORS.textPrimary, fontWeight: "500" },
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
  routeSearchInput: { flex: 1, fontSize: 14, color: COLORS.textPrimary },
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
    fontWeight: "500",
    color: COLORS.textPrimary,
  },
  buildingItemType: { fontSize: 11, color: COLORS.textSecondary, marginTop: 1 },
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
    fontWeight: "500",
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
  routeResultTime: { fontSize: 12, color: COLORS.primary, fontWeight: "500" },
  routeStartBtn: {
    marginTop: 14,
    height: 42,
    backgroundColor: COLORS.primary,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  routeStartText: { fontSize: 14, color: "#fff", fontWeight: "600" },
});
