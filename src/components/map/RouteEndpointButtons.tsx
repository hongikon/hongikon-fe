import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { COLORS } from "../../constants/colors";
import { FONTS } from "../../constants/typography";
import { RADIUS } from "../../constants/spacing";

export type RouteNext = "from" | "to" | null;

interface RouteEndpointButtonsProps {
  /** 출발·도착으로 정할 곳의 이름(건물 이름). 읽어 주기 이름에 쓴다. */
  name: string;
  /** 길찾기 중 다음에 고를 쪽. null 이면 길찾기 전이라 출발을 먼저 강조한다. */
  routeNext: RouteNext;
  onSetFrom: () => void;
  onSetTo: () => void;
}

/**
 * 시트 제목 바로 아래의 출발·도착 버튼 줄. 건물 시트와 시설 시트가 함께 쓴다(11-08 — 시설 시트에서도 길찾기를 시작할 수 있게).
 * 메인 컬러만 쓴다(11-03). 지금 고를 차례인 쪽은 남색으로 채우고, 다른 쪽은 옅은 남색 바탕.
 */
export default function RouteEndpointButtons({ name, routeNext, onSetFrom, onSetTo }: RouteEndpointButtonsProps) {
  const next = routeNext ?? "from";
  return (
    <View style={styles.actions}>
      <TouchableOpacity
        style={[styles.action, next === "from" && styles.actionStrong]}
        onPress={onSetFrom}
        accessibilityRole="button"
        accessibilityLabel={`${name}에서 출발`}
      >
        <View style={[styles.dotFrom, next === "from" && styles.dotFromStrong]} />
        <Text style={[styles.text, next === "from" && styles.textStrong]}>출발</Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={[styles.action, next === "to" && styles.actionStrong]}
        onPress={onSetTo}
        accessibilityRole="button"
        accessibilityLabel={`${name}로 도착`}
      >
        <View style={[styles.dotTo, next === "to" && styles.dotToStrong]} />
        <Text style={[styles.text, next === "to" && styles.textStrong]}>도착</Text>
      </TouchableOpacity>
    </View>
  );
}

/** 지금 출발·도착 상태에서 다음에 고를 쪽. 출발을 정했으면 '도착', 도착만 정했으면 '출발', 아니면 null. */
export function nextRouteEndpoint(hasFrom: boolean, hasTo: boolean): RouteNext {
  if (hasFrom && !hasTo) return "to";
  if (hasTo && !hasFrom) return "from";
  return null;
}

const styles = StyleSheet.create({
  actions: { flexDirection: "row", gap: 10, marginTop: 2, marginBottom: 12 },
  action: {
    flex: 1,
    height: 44,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.primarySoft,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  actionStrong: { backgroundColor: COLORS.primary },
  text: { fontSize: 15, color: COLORS.primary, fontFamily: FONTS.semibold },
  textStrong: { color: COLORS.white },
  /** 출발: 빈 원, 도착: 채운 원 — 지도 경로 막대·표시와 같은 모양. */
  dotFrom: { width: 10, height: 10, borderRadius: 5, borderWidth: 2.5, borderColor: COLORS.primary },
  dotFromStrong: { borderColor: COLORS.white },
  dotTo: { width: 10, height: 10, borderRadius: 5, backgroundColor: COLORS.primary },
  dotToStrong: { backgroundColor: COLORS.white },
});
