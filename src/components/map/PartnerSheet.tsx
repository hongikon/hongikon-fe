import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Linking,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { COLORS } from "../../constants/colors";
import { partnerCategoryMeta } from "../../constants/partnerCategories";
import type { Partner } from "../../types";
import { FONTS } from "../../constants/typography";

interface PartnerSheetProps {
  partner: Partner;
  onClose: () => void;
}

/**
 * 제휴 업체 상세. 혜택이 가장 중요하므로 카드로 강조한다.
 * benefit / address / hours / contact / link 는 값이 있을 때만 렌더한다.
 */
export default function PartnerSheet({ partner, onClose }: PartnerSheetProps) {
  const meta = partnerCategoryMeta(partner.category);

  return (
    <View style={styles.sheet}>
      <View style={styles.handle} />

      <View style={styles.header}>
        <View style={[styles.badge, { backgroundColor: meta.color }]}>
          <Text style={styles.badgeText}>{partner.category}</Text>
        </View>
        <TouchableOpacity
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel="닫기"
        >
          <Ionicons name="close" size={20} color="#ccc" />
        </TouchableOpacity>
      </View>

      <Text style={styles.name}>{partner.name}</Text>

      <ScrollView
        style={styles.body}
        contentContainerStyle={styles.bodyContent}
        showsVerticalScrollIndicator={false}
      >
        {partner.benefit && (
          <View
            style={[
              styles.benefitCard,
              {
                backgroundColor: `${meta.color}12`,
                borderLeftColor: meta.color,
              },
            ]}
          >
            <Text style={[styles.benefitLabel, { color: meta.color }]}>
              제휴 혜택
            </Text>
            <Text style={styles.benefitText}>{partner.benefit}</Text>
          </View>
        )}

        {partner.address && (
          <View style={styles.row}>
            <Ionicons
              name="location-outline"
              size={13}
              color={COLORS.primary}
            />
            <Text style={styles.rowText}>{partner.address}</Text>
          </View>
        )}

        {partner.hours && (
          <View style={styles.row}>
            <Ionicons name="time-outline" size={13} color={COLORS.primary} />
            <Text style={styles.rowText}>{partner.hours}</Text>
          </View>
        )}

        {partner.contact && (
          <View style={styles.row}>
            <Ionicons name="call-outline" size={13} color={COLORS.primary} />
            <Text style={styles.rowText}>{partner.contact}</Text>
          </View>
        )}

        {partner.link && (
          <TouchableOpacity
            style={styles.linkBtn}
            onPress={() => Linking.openURL(partner.link!.url)}
          >
            <Ionicons name="open-outline" size={14} color={COLORS.primary} />
            <Text style={styles.linkText}>{partner.link.label}</Text>
          </TouchableOpacity>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  sheet: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    maxHeight: "62%",
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
  },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
  },
  badgeText: { fontSize: 11, fontFamily: FONTS.bold, color: COLORS.white },
  name: {
    fontSize: 18,
    fontFamily: FONTS.bold,
    color: COLORS.textPrimary,
    marginTop: 8,
  },
  body: { marginTop: 12 },
  bodyContent: { paddingBottom: 4 },
  benefitCard: {
    borderLeftWidth: 3,
    borderRadius: 10,
    paddingVertical: 11,
    paddingHorizontal: 13,
    marginBottom: 12,
  },
  benefitLabel: {
    fontSize: 10.5,
    fontFamily: FONTS.bold,
    letterSpacing: 0.4,
    marginBottom: 4,
  },
  benefitText: { fontFamily: FONTS.regular, fontSize: 13.5, lineHeight: 20, color: COLORS.textPrimary },
  row: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 7,
    paddingVertical: 5,
  },
  rowText: { fontFamily: FONTS.regular, flex: 1, fontSize: 12.5, lineHeight: 18, color: "#666" },
  linkBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 8,
  },
  linkText: {
    fontSize: 13,
    color: COLORS.primary,
    fontFamily: FONTS.semibold,
    textDecorationLine: "underline",
  },
});
