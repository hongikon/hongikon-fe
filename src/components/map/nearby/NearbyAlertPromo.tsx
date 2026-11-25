import { Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { COLORS } from "../../../constants/colors";
import { FONTS } from "../../../constants/typography";
import { RADIUS } from "../../../constants/spacing";
import { useNearbyAlertPromo } from '../../../hooks/map/nearby/useNearbyAlertPromo'

/**
 * 제휴 시트 아래 한 줄: "제휴 가게에 있을 때 혜택을 알려 드릴까요?" → 설정 > 근처 제휴 알림 창(10-31).
 * 근처 알림을 쓸 수 있는 빌드·로그인·아직 안 켬일 때만, 닫으면 다시 띄우지 않는다(조르지 않게). 첫 실행 안내에는 넣지 않는다.
 */
export default function NearbyAlertPromo() {
  const { show, setShow, dismiss, open } = useNearbyAlertPromo()

  if (!show) return null;

  return (
    <View style={styles.box}>
      <Pressable style={styles.main} onPress={open} accessibilityRole="button" accessibilityLabel="제휴 가게에 있을 때 알림 받기 설정">
        <Ionicons name="navigate-outline" size={16} color={COLORS.primary} />
        <Text style={styles.text}>제휴 가게에 있을 때 혜택을 알려 드릴까요?</Text>
        <Text style={styles.link}>설정하기</Text>
      </Pressable>
      <Pressable onPress={dismiss} hitSlop={10} accessibilityRole="button" accessibilityLabel="이 안내 닫기">
        <Ionicons name="close" size={16} color={COLORS.textTertiary} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.primarySoft,
  },
  main: { flex: 1, flexDirection: "row", alignItems: "center", gap: 6 },
  text: { flex: 1, fontSize: 13, lineHeight: 18, fontFamily: FONTS.medium, color: COLORS.textPrimary },
  link: { fontSize: 13, fontFamily: FONTS.semibold, color: COLORS.primary },
});
