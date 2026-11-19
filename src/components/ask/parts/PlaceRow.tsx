import { StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { COLORS } from "../../../constants/colors";
import { FONTS } from "../../../constants/typography";
import type { Facility } from "../../../types";
import { facilityPlaceLine } from "../../../utils/ask/places";

/** 찾아갈 부서 위치(건물·층). /dev/ask 는 지도와 떨어진 화면이라 글로만 보여 준다. 지도 데이터에 없으면 그리지 않는다. */
export default function PlaceRow({ facilities, facilityId }: { facilities: readonly Facility[]; facilityId: string }) {
  const line = facilityPlaceLine(facilities, facilityId);
  if (line === null) return null;
  return (
    <View style={styles.placeRow}>
      <Ionicons name="location" size={14} color={COLORS.primary} />
      <Text style={styles.placeText}>{line}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  placeRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  placeText: { flex: 1, fontSize: 13, lineHeight: 18, fontFamily: FONTS.medium, color: COLORS.textPrimary },
});
