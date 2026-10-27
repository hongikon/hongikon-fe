import { useSafeAreaInsets } from "react-native-safe-area-context";
import SheetHandle from "./SheetHandle";
import {
  Animated,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { COLORS } from "../../constants/colors";
import type { Building, Facility, FacilityKind } from "../../types";
import { FACILITY_KINDS, facilityKindLabel } from "../../constants/facilityKinds";
import { formatFloor } from "../../utils/floors";
import { KindIcon } from "./ChipIcon";
import { FONTS } from "../../constants/typography";
import IconButton from "../common/IconButton";
import { sheetCloseStyle } from "./chipStyles";
import { useSheetSizing } from "../../hooks/useResizableSheet";
import { openExternalUrl } from "../../utils/openExternalUrl";
import { RADIUS } from "../../constants/spacing";
import SheetScrollBody, { SheetTouchable } from "./SheetScrollBody";

interface BuildingSheetProps {
  building: Building;
  /** 이 건물에 등록된 편의시설(지도 데이터). 종류별로 한 줄씩 보여 준다. */
  facilities: readonly Facility[];
  /** 종류 줄을 누르면 그 종류의 시설 시트(층·위치 목록)를 연다. */
  onOpenFacility: (kind: FacilityKind) => void;
  onClose: () => void;
  /** false 면 출발/도착 버튼을 그리지 않는다(출시 전 기능 안내도 띄우지 않는다 — 심사 2.1). */
  routeFindingEnabled: boolean;
  onSetFrom: () => void;
  onSetTo: () => void;
}

/** 서버가 건물 종류를 아직 모를 때 넣어 둔 값. 사용자에게는 보이지 않게 한다. */
const UNKNOWN_TYPE = "확인 필요";
/** 종류 줄에 층을 이만큼까지만 적고 나머지는 '외'로 줄인다(홍문관 행정 부서처럼 층이 많은 경우). */
const MAX_FLOORS_SHOWN = 4;

interface KindRow {
  kind: FacilityKind;
  count: number;
  floors: number[];
}

/** 이 건물의 편의시설을 칩 순서(FACILITY_KINDS)대로 종류별로 묶는다. */
function groupByKind(facilities: readonly Facility[]): KindRow[] {
  return FACILITY_KINDS.flatMap(({ key }) => {
    const items = facilities.filter((f) => f.kind === key);
    if (items.length === 0) return [];
    const floors = [...new Set(items.flatMap((f) => (f.floor === undefined ? [] : [f.floor])))].sort((a, b) => a - b);
    return [{ kind: key, count: items.length, floors }];
  });
}

function floorSummary(floors: number[]): string | null {
  if (floors.length === 0) return null;
  const shown = floors.slice(0, MAX_FLOORS_SHOWN).map(formatFloor).join(" · ");
  return floors.length > MAX_FLOORS_SHOWN ? `${shown} 외` : shown;
}

/**
 * 건물 정보 배너. 확인된 값이 있는 줄만 보여준다.
 * (종류·층수 / description / 건물 안 시설 / hours / contact / link)
 * '건물 안 시설'은 지도 데이터의 편의시설을 종류별로 묶어 보여 주고, 누르면 그 시설 시트로 간다(10-14 요청).
 */
export default function BuildingSheet({
  building,
  facilities,
  onOpenFacility,
  onClose,
  routeFindingEnabled,
  onSetFrom,
  onSetTo,
}: BuildingSheetProps) {
  // 손잡이(회색 줄)로 작게 → 보통 → 화면 위 끝까지 크기 조절(useSheetSizing).
  const { translateY, bodyHeight, panHandlers, chromeHandlers, onChromeLayout, onContentSizeChange, bodyGesture } = useSheetSizing(onClose, {
    smallRatio: 0.22,
  });
  // 시트는 화면 맨 아래에 붙으므로 홈 인디케이터 높이만큼 안쪽 아래 여백을 더 준다.
  const insets = useSafeAreaInsets();
  const kindRows = groupByKind(facilities);
  const type = building.type && building.type !== UNKNOWN_TYPE ? building.type : null;
  const typeLine = [
    type,
    building.floors !== undefined ? `지상 ${building.floors}층` : null,
    building.basementFloors ? `지하 ${building.basementFloors}층` : null,
  ]
    .filter(Boolean)
    .join(" · ");
  return (
    <Animated.View style={[styles.sheet, { paddingBottom: 30 + insets.bottom, transform: [{ translateY }] }]}>
      <View onLayout={onChromeLayout} {...chromeHandlers}>
      <SheetHandle panHandlers={panHandlers} />

      <View style={styles.header}>
        <View style={styles.titleRow}>
          {/* 건물별 색 대신 앱 메인 컬러 하나로 통일한다(지도 핀과 같음). */}
          <View style={styles.dot} />
          <Text style={styles.name}>{building.name}</Text>
        </View>
        <IconButton
          icon="close"
          size={20}
          color={COLORS.textTertiary}
          onPress={onClose}
          accessibilityLabel="닫기"
          style={sheetCloseStyle}
        />
      </View>
      </View>

      <SheetScrollBody sheetGesture={bodyGesture} onContentSizeChange={onContentSizeChange} style={{ height: bodyHeight }} bounces={false}>
      {typeLine !== "" && <Text style={styles.type}>{typeLine}</Text>}

      {building.description && (
        <Text style={styles.description}>{building.description}</Text>
      )}

      {kindRows.length > 0 && (
        <View style={styles.kindSection}>
          <Text style={styles.sectionTitle}>건물 안 시설</Text>
          {kindRows.map((row) => {
            const meta = FACILITY_KINDS.find((k) => k.key === row.kind)!;
            const label = facilityKindLabel(row.kind);
            const floors = floorSummary(row.floors);
            return (
              <SheetTouchable
                key={row.kind}
                style={styles.kindRow}
                onPress={() => onOpenFacility(row.kind)}
                accessibilityRole="button"
                accessibilityLabel={`${label} ${row.count}곳${floors ? `, ${floors}` : ""}`}
              >
                <View style={styles.kindIcon}>
                  <KindIcon name={meta.icon} size={15} color={meta.color} />
                </View>
                <Text style={styles.kindLabel}>{label}</Text>
                {row.count > 1 && <Text style={styles.kindCount}>{row.count}곳</Text>}
                <Text style={styles.kindFloors} numberOfLines={1}>
                  {floors ?? ""}
                </Text>
                <Ionicons name="chevron-forward" size={14} color={COLORS.textTertiary} />
              </SheetTouchable>
            );
          })}
        </View>
      )}

      {kindRows.length === 0 && building.facilities && building.facilities.length > 0 && (
        <View style={styles.facilities}>
          {building.facilities.map((facility) => (
            <View key={facility} style={styles.facilityChip}>
              <Text style={styles.facilityChipText}>{facility}</Text>
            </View>
          ))}
        </View>
      )}

      {building.hours && (
        <View style={styles.hoursRow}>
          <Ionicons name="time-outline" size={13} color={COLORS.primary} />
          <Text style={styles.hours}>{building.hours}</Text>
        </View>
      )}

      {building.contact && (
        <View style={styles.contactRow}>
          <Ionicons name="call-outline" size={13} color={COLORS.primary} />
          <Text style={styles.contact}>{building.contact}</Text>
        </View>
      )}

      {building.link && (
        <TouchableOpacity
          style={styles.linkBtn}
          onPress={() => openExternalUrl(building.link!.url)}
          accessibilityRole="link"
        >
          <Ionicons name="open-outline" size={14} color={COLORS.primary} />
          <Text style={styles.linkText}>{building.link.label}</Text>
        </TouchableOpacity>
      )}

      {routeFindingEnabled && (
        <View style={styles.actions}>
          <TouchableOpacity style={styles.actionFrom} onPress={onSetFrom} accessibilityRole="button">
            <Ionicons name="location" size={14} color={COLORS.routeFrom} />
            <Text style={styles.actionFromText}>출발</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionTo} onPress={onSetTo} accessibilityRole="button">
            <Ionicons name="flag" size={14} color={COLORS.danger} />
            <Text style={styles.actionToText}>도착</Text>
          </TouchableOpacity>
        </View>
      )}
      </SheetScrollBody>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  sheet: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: COLORS.white,
    borderTopLeftRadius: RADIUS.sheet,
    borderTopRightRadius: RADIUS.sheet,
    paddingHorizontal: 20,
    paddingBottom: 30,
    paddingTop: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 10,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 4,
  },
  titleRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  dot: { width: 10, height: 10, borderRadius: 5, backgroundColor: COLORS.primary },
  name: { fontSize: 17, fontFamily: FONTS.semibold, color: COLORS.textPrimary },
  type: { fontFamily: FONTS.regular,
    fontSize: 12,
    color: COLORS.textSecondary,
    marginBottom: 10,
    paddingLeft: 18,
  },
  description: { fontFamily: FONTS.regular,
    fontSize: 13,
    color: COLORS.textPrimary,
    lineHeight: 19,
    paddingLeft: 18,
    marginBottom: 10,
  },
  facilities: {
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
    backgroundColor: COLORS.fill,
  },
  facilityChipText: {
    fontSize: 12,
    color: COLORS.textSecondary,
    fontFamily: FONTS.medium,
  },
  kindSection: { paddingLeft: 18, marginBottom: 10 },
  sectionTitle: {
    fontSize: 12,
    fontFamily: FONTS.semibold,
    color: COLORS.textSecondary,
    marginBottom: 4,
  },
  kindRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    minHeight: 40,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: COLORS.border,
  },
  kindIcon: { width: 20, alignItems: "center" },
  kindLabel: { fontSize: 14, fontFamily: FONTS.medium, color: COLORS.textPrimary },
  kindCount: { fontSize: 12, fontFamily: FONTS.regular, color: COLORS.textSecondary },
  kindFloors: {
    flex: 1,
    textAlign: "right",
    fontSize: 12,
    fontFamily: FONTS.regular,
    color: COLORS.textSecondary,
  },
  hoursRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 6,
    paddingVertical: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: COLORS.border,
    marginBottom: 14,
  },
  hours: { fontFamily: FONTS.regular, fontSize: 13, color: COLORS.textSecondary, lineHeight: 20 },
  contactRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 6,
  },
  contact: { fontFamily: FONTS.regular, fontSize: 13, color: COLORS.textSecondary },
  linkBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 8,
    marginBottom: 4,
  },
  linkText: {
    fontSize: 13,
    color: COLORS.primary,
    fontFamily: FONTS.semibold,
    textDecorationLine: "underline",
  },
  actions: { flexDirection: "row", gap: 10 },
  actionFrom: {
    flex: 1,
    height: 44,
    borderRadius: 12,
    backgroundColor: COLORS.successSoft,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  actionFromText: { fontSize: 14, color: COLORS.success, fontFamily: FONTS.semibold },
  actionTo: {
    flex: 1,
    height: 44,
    borderRadius: 12,
    backgroundColor: COLORS.dangerSoft,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  actionToText: { fontSize: 14, color: COLORS.danger, fontFamily: FONTS.semibold },
});
