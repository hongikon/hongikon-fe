import { Animated, View, Text, StyleSheet, ScrollView, useWindowDimensions } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { COLORS } from "../../constants/colors";
import { FONTS } from "../../constants/typography";
import { FACILITY_KINDS } from "../../constants/facilityKinds";
import type { Facility, FacilityKind } from "../../types";
import IconButton from "../common/IconButton";
import { sheetCloseStyle } from "./chipStyles";
import { useSwipeDownToDismiss } from "../../hooks/useSwipeDownToDismiss";
import { formatFloor } from "../../utils/floors";

interface FacilitySheetProps {
  kind: FacilityKind;
  buildingName: string;
  /** 이 건물에 있는 같은 종류의 시설(층마다 한 줄). */
  items: readonly Facility[];
  onClose: () => void;
}

/**
 * 편의시설 핀을 눌렀을 때의 배너. 건물 소개가 아니라 "그 시설이 몇 층 어디에 있는지"를 보여 준다.
 * 같은 건물에 여러 층이 있으면 층마다 한 줄. 층이 확인되지 않은 항목은 "층 확인 중"으로 둔다.
 */
export default function FacilitySheet({ kind, buildingName, items, onClose }: FacilitySheetProps) {
  const { translateY, panHandlers } = useSwipeDownToDismiss(onClose);
  const meta = FACILITY_KINDS.find((k) => k.key === kind);
  const color = meta?.color ?? COLORS.primary;
  const sorted = [...items].sort((a, b) => (b.floor ?? -99) - (a.floor ?? -99));
  // 학과사무실처럼 한 건물에 줄이 많은 경우(C동 13곳) 시트가 화면을 덮지 않게 목록만 스크롤한다.
  const { height: windowHeight } = useWindowDimensions();

  return (
    <Animated.View style={[styles.sheet, { transform: [{ translateY }] }]}>
      <View
        style={styles.handle}
        {...panHandlers}
        hitSlop={{ top: 10, bottom: 10, left: 20, right: 20 }}
      />

      <View style={styles.header}>
        <View style={styles.titleRow}>
          <View style={[styles.icon, { backgroundColor: color }]}>
            <Ionicons name={meta?.icon ?? "location"} size={15} color={COLORS.white} />
          </View>
          <View>
            <Text style={styles.name}>{kind}</Text>
            <Text style={styles.building}>{buildingName}</Text>
          </View>
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

      <ScrollView
        style={{ maxHeight: windowHeight * 0.5 }}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={sorted.length > 6}
        bounces={false}
      >
        {sorted.map((item) => (
          <View
            key={item.id}
            style={styles.row}
            accessible
            accessibilityLabel={`${item.floor !== undefined ? formatFloor(item.floor) : "층 확인 중"} ${item.note ?? kind}`}
          >
            <Text style={[styles.floor, item.floor === undefined && styles.floorUnknown]}>
              {item.floor !== undefined ? formatFloor(item.floor) : "층 확인 중"}
            </Text>
            <Text style={styles.note}>{item.note ?? kind}</Text>
          </View>
        ))}
      </ScrollView>
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
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 20,
    paddingBottom: 30,
    paddingTop: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 8,
  },
  handle: {
    width: 36,
    height: 4,
    backgroundColor: COLORS.border,
    borderRadius: 2,
    alignSelf: "center",
    marginBottom: 14,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  titleRow: { flexDirection: "row", alignItems: "center", gap: 10, flexShrink: 1 },
  icon: { width: 30, height: 30, borderRadius: 15, alignItems: "center", justifyContent: "center" },
  name: { fontSize: 17, fontFamily: FONTS.semibold, color: COLORS.textPrimary },
  building: { fontSize: 12, fontFamily: FONTS.regular, color: COLORS.textSecondary, marginTop: 1 },
  list: { gap: 8 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
    backgroundColor: COLORS.background,
  },
  floor: {
    minWidth: 40,
    fontSize: 15,
    fontFamily: FONTS.semibold,
    color: COLORS.textPrimary,
    fontVariant: ["tabular-nums"],
  },
  floorUnknown: { fontSize: 12, color: COLORS.textTertiary },
  note: { flex: 1, fontSize: 14, fontFamily: FONTS.regular, color: COLORS.textPrimary },
});
