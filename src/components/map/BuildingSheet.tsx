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
import type { Building } from "../../types";
import { FONTS } from "../../constants/typography";
import IconButton from "../common/IconButton";
import { sheetCloseStyle } from "./chipStyles";
import { useSheetSizing } from "../../hooks/useResizableSheet";
import { openExternalUrl } from "../../utils/openExternalUrl";
import { RADIUS } from "../../constants/spacing";

interface BuildingSheetProps {
  building: Building;
  onClose: () => void;
  /** false 면 출발/도착 버튼을 그리지 않는다(출시 전 기능 안내도 띄우지 않는다 — 심사 2.1). */
  routeFindingEnabled: boolean;
  onSetFrom: () => void;
  onSetTo: () => void;
}

/**
 * 건물 정보 배너. 확인된 값이 있는 줄만 보여준다.
 * (floors / description / facilities / hours / contact / link)
 */
export default function BuildingSheet({
  building,
  onClose,
  routeFindingEnabled,
  onSetFrom,
  onSetTo,
}: BuildingSheetProps) {
  // 손잡이(회색 줄)로 머리줄만 → 작게 → 보통 → 화면 위 끝까지 크기 조절(useSheetSizing). 내용이 짧아 보통은 내용 높이에서 멈춘다.
  const { translateY, bodyHeight, panHandlers, onChromeLayout, onContentSizeChange } = useSheetSizing(onClose, {
    smallRatio: 0.22,
    midRatio: 0.5,
  });
  // 시트는 화면 맨 아래에 붙으므로 홈 인디케이터 높이만큼 안쪽 아래 여백을 더 준다.
  const insets = useSafeAreaInsets();
  return (
    <Animated.View style={[styles.sheet, { paddingBottom: 30 + insets.bottom, transform: [{ translateY }] }]}>
      <View onLayout={onChromeLayout}>
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

      <Animated.ScrollView style={{ height: bodyHeight }} onContentSizeChange={onContentSizeChange} bounces={false}>
      <Text style={styles.type}>
        {building.floors === undefined
          ? building.type
          : `${building.type} · 지상 ${building.floors}층`}
      </Text>

      {building.description && (
        <Text style={styles.description}>{building.description}</Text>
      )}

      {building.facilities && building.facilities.length > 0 && (
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
      </Animated.ScrollView>
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
