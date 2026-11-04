import { useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Ionicons } from "@expo/vector-icons";
import { COLORS } from "../../constants/colors";
import { FONTS } from "../../constants/typography";
import { RADIUS } from "../../constants/spacing";
import { useAuth } from "../../contexts/AuthContext";
import { getNearbySettings, nearbyAlertsAvailable } from "../../lib/nearbyPartners/background";
import { requestSettingsIntent } from "../../lib/settingsIntents";
import { navigationRef } from "../../navigation/navigationRef";

const DISMISSED_KEY = "hongikon_nearby_promo_dismissed_v1";

/**
 * 제휴 시트 아래 한 줄: "제휴 가게에 있을 때 혜택을 알려 드릴까요?" → 설정 > 근처 제휴 알림 창(10-31).
 * 근처 알림을 쓸 수 있는 빌드·로그인·아직 안 켬일 때만, 닫으면 다시 띄우지 않는다(조르지 않게). 첫 실행 안내에는 넣지 않는다.
 */
export default function NearbyAlertPromo() {
  const { status } = useAuth();
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (!nearbyAlertsAvailable() || status !== "authenticated") return;
    let alive = true;
    void (async () => {
      const dismissed = await AsyncStorage.getItem(DISMISSED_KEY).catch(() => null);
      if (dismissed) return;
      const settings = await getNearbySettings();
      if (alive && !settings.enabled) setShow(true);
    })();
    return () => {
      alive = false;
    };
  }, [status]);

  if (!show) return null;

  const dismiss = () => {
    setShow(false);
    AsyncStorage.setItem(DISMISSED_KEY, "1").catch(() => {});
  };

  const open = () => {
    requestSettingsIntent({ type: "openNearbyAlerts" });
    if (navigationRef.isReady()) navigationRef.navigate("Main", { screen: "Settings" });
  };

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
