import { Linking, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { COLORS } from "../../../constants/colors";
import { FONTS } from "../../../constants/typography";
import { RADIUS } from "../../../constants/spacing";
import type { AskLink } from "../../../constants/askAnswers";
import * as haptics from "../../../lib/haptics";

function call(phone: string) {
  haptics.selection();
  Linking.openURL(`tel:${phone.replace(/[^0-9+]/g, "")}`).catch(() => {});
}

function openLink(url: string) {
  haptics.selection();
  Linking.openURL(url).catch(() => {});
}

/** 담당 업무 한 줄과 전화 걸기 버튼. */
export function PhoneRow({ label, phone }: { label: string; phone: string }) {
  return (
    <View style={styles.contact}>
      <Text style={styles.duty} numberOfLines={3}>{label}</Text>
      <TouchableOpacity
        style={styles.phone}
        activeOpacity={0.7}
        onPress={() => call(phone)}
        accessibilityRole="button"
        accessibilityLabel={`${phone} 전화 걸기`}
        hitSlop={6}
      >
        <Ionicons name="call" size={13} color={COLORS.primary} />
        <Text style={styles.phoneText}>{phone}</Text>
      </TouchableOpacity>
    </View>
  );
}

/** 학교 페이지·공지 링크 버튼. 앱 탭은 전화 버튼처럼 옅은 브랜드색 바탕. */
export function LinkButton({ link, appMode }: { link: AskLink; appMode: boolean }) {
  return (
    <TouchableOpacity
      style={appMode ? LINK_APP : styles.linkButton}
      activeOpacity={0.7}
      onPress={() => openLink(link.url)}
      accessibilityRole="link"
      accessibilityLabel={`${link.label} 열기`}
    >
      <Text style={styles.linkText} numberOfLines={1}>{link.label}</Text>
      <Ionicons name="open-outline" size={15} color={COLORS.primary} />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  contact: { flexDirection: "row", alignItems: "center", gap: 10 },
  duty: { flex: 1, fontSize: 13, lineHeight: 18, fontFamily: FONTS.regular, color: COLORS.textSecondary },
  phone: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    height: 30,
    borderRadius: RADIUS.pill,
    backgroundColor: COLORS.primarySoft,
  },
  phoneText: { fontSize: 13, fontFamily: FONTS.semibold, color: COLORS.primary },
  linkButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
    minHeight: 40,
    paddingHorizontal: 12,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.white,
  },
  /** 앱 탭: 원문 링크도 전화 버튼처럼 옅은 브랜드색 바탕(테두리 없이). */
  linkButtonApp: { borderColor: COLORS.primarySoft, backgroundColor: COLORS.primarySoft },
  linkText: { flex: 1, fontSize: 13, fontFamily: FONTS.semibold, color: COLORS.primary },
});

const LINK_APP = [styles.linkButton, styles.linkButtonApp];
