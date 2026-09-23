import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Linking,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { COLORS } from "../../constants/colors";
import type { Building } from "../../types";
import { FONTS } from "../../constants/typography";

interface BuildingSheetProps {
  building: Building;
  onClose: () => void;
  /** false 면 출발/도착 버튼 대신 "다음 업데이트에서 제공" 안내를 보여준다. */
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
  return (
    <View style={styles.sheet}>
      <View style={styles.handle} />

      <View style={styles.header}>
        <View style={styles.titleRow}>
          <View style={[styles.dot, { backgroundColor: building.color }]} />
          <Text style={styles.name}>{building.name}</Text>
        </View>
        <TouchableOpacity
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel="닫기"
        >
          <Ionicons name="close" size={20} color="#ccc" />
        </TouchableOpacity>
      </View>

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
          onPress={() => Linking.openURL(building.link!.url)}
        >
          <Ionicons name="open-outline" size={14} color={COLORS.primary} />
          <Text style={styles.linkText}>{building.link.label}</Text>
        </TouchableOpacity>
      )}

      {routeFindingEnabled ? (
        <View style={styles.actions}>
          <TouchableOpacity style={styles.actionFrom} onPress={onSetFrom}>
            <Ionicons name="location" size={14} color="#10B981" />
            <Text style={styles.actionFromText}>출발</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionTo} onPress={onSetTo}>
            <Ionicons name="flag" size={14} color="#EF4444" />
            <Text style={styles.actionToText}>도착</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <View style={styles.routeComingSoon}>
          <Ionicons name="navigate-outline" size={14} color={COLORS.textSecondary} />
          <Text style={styles.routeComingSoonText}>
            길찾기는 다음 업데이트에서 제공될 예정이에요
          </Text>
        </View>
      )}
    </View>
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
    shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 10,
  },
  handle: {
    width: 36,
    height: 4,
    backgroundColor: "#E0E0E0",
    borderRadius: 2,
    alignSelf: "center",
    marginBottom: 14,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 4,
  },
  titleRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  dot: { width: 10, height: 10, borderRadius: 5 },
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
    backgroundColor: "#F0F0F0",
  },
  facilityChipText: {
    fontSize: 11,
    color: COLORS.textSecondary,
    fontFamily: FONTS.medium,
  },
  hoursRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 6,
    paddingVertical: 10,
    borderTopWidth: 0.5,
    borderTopColor: "#f0f0f0",
    marginBottom: 14,
  },
  hours: { fontFamily: FONTS.regular, fontSize: 12, color: "#666", lineHeight: 20 },
  contactRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 6,
  },
  contact: { fontFamily: FONTS.regular, fontSize: 12, color: "#666" },
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
    height: 42,
    borderRadius: 10,
    backgroundColor: "#EDFAF3",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  actionFromText: { fontSize: 13, color: "#10B981", fontFamily: FONTS.semibold },
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
  actionToText: { fontSize: 13, color: "#EF4444", fontFamily: FONTS.semibold },
  routeComingSoon: {
    height: 42,
    borderRadius: 10,
    backgroundColor: "#F3F4F6",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  routeComingSoonText: {
    fontSize: 13,
    color: COLORS.textSecondary,
    fontFamily: FONTS.medium,
  },
});
