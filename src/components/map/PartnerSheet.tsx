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
import { PARTNER_AFFILIATION_USAGE_NOTES } from "../../constants/partnerAffiliations";
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
  // affiliationBenefits 로 예외가 걸린 소속은 그 예외 줄 안에서 이용 방법을
  // 보여준다. 예외가 없는 소속(기본 benefit 을 그대로 쓰는 소속)의 이용
  // 방법은 기본 혜택 줄 아래에 붙인다 — 어느 쪽이든 "혜택 + 그 밑 이용
  // 방법"이 하나의 구획으로 읽히게 하고, 별도 구분선으로 떼어놓지 않는다.
  const exceptionAffiliations = new Set(
    partner.affiliationBenefits?.map((item) => item.affiliation) ?? [],
  );
  // 예외로 빠지지 않은 소속은 기본 혜택을 그대로 받는다 — 이 소속들을
  // 칩으로 보여줘야 "이 혜택이 어느 제휴처 것인지" 한눈에 보인다.
  const baseAffiliations = (partner.affiliations ?? []).filter(
    (affiliation) => !exceptionAffiliations.has(affiliation),
  );
  const baseUsageNotes = Array.from(
    new Set(
      baseAffiliations
        .map((affiliation) => PARTNER_AFFILIATION_USAGE_NOTES[affiliation])
        .filter((note): note is string => Boolean(note)),
    ),
  );

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
            {/*
              baseAffiliations 가 비면(모든 소속이 예외로 빠지면, 예: 네코노유부)
              이 기본 문구를 아무도 안 쓴다는 뜻 — 주인 없는 텍스트만 남아
              위쪽이 지저분해지므로 통째로 건너뛴다.
            */}
            {baseAffiliations.length > 0 && (
              <>
                <View style={styles.chipRow}>
                  {baseAffiliations.map((affiliation) => (
                    <View
                      key={affiliation}
                      style={[styles.sharedChip, { borderColor: meta.color }]}
                    >
                      <Text style={[styles.sharedChipText, { color: meta.color }]}>
                        {affiliation}
                      </Text>
                    </View>
                  ))}
                </View>
                <Text style={styles.benefitText}>{partner.benefit}</Text>
                {baseUsageNotes.map((note) => (
                  <View key={note} style={styles.usageNoteInline}>
                    <Ionicons name="card-outline" size={11} color={meta.color} />
                    <Text style={styles.usageNoteInlineText}>
                      <Text style={[styles.usageNoteInlineLabel, { color: meta.color }]}>
                        이용 방법{"  "}
                      </Text>
                      {note}
                    </Text>
                  </View>
                ))}
              </>
            )}

            {partner.affiliationBenefits?.map((item) => {
              const note = PARTNER_AFFILIATION_USAGE_NOTES[item.affiliation];
              return (
                <View key={item.affiliation} style={styles.exceptionRow}>
                  <View
                    style={[styles.exceptionChip, { backgroundColor: meta.color }]}
                  >
                    <Text style={styles.exceptionChipText}>
                      {item.affiliation}
                    </Text>
                  </View>
                  <Text style={styles.benefitText}>{item.benefit}</Text>
                  {note && (
                    <View style={styles.usageNoteInline}>
                      <Ionicons name="card-outline" size={11} color={meta.color} />
                      <Text style={styles.usageNoteInlineText}>
                        <Text
                          style={[styles.usageNoteInlineLabel, { color: meta.color }]}
                        >
                          이용 방법{"  "}
                        </Text>
                        {note}
                      </Text>
                    </View>
                  )}
                </View>
              );
            })}
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
  /** 한 혜택 줄에 소속이 여럿 걸릴 수 있어(예: 소코아 4개 소속) 줄바꿈을 허용한다. */
  chipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 5,
    marginBottom: 5,
  },
  /**
   * 기본 혜택을 공유하는 소속 칩. 예외 칩(꽉 찬 색)과 달리 테두리만 둔다 —
   * "이 소속들엔 다 같은 혜택"이라 예외처럼 눈길을 끌 필요가 없고,
   * 소속이 여럿(소코아 4개) 겹칠 때 꽉 찬 칩만큼 무거워 보이지 않게 한다.
   */
  sharedChip: {
    borderWidth: 1,
    borderRadius: 5,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  sharedChipText: {
    fontFamily: FONTS.semibold,
    fontSize: 10,
    letterSpacing: 0.2,
  },
  /**
   * 소속별 예외 혜택. 기본 혜택 아래에 얇은 구분선을 두고 이어 붙여,
   * 별개 항목이 아니라 "이 소속만 다르다"로 읽히게 한다.
   */
  exceptionRow: {
    marginTop: 9,
    paddingTop: 9,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "rgba(0,0,0,0.12)",
    gap: 5,
    alignItems: "flex-start",
  },
  exceptionChip: {
    borderRadius: 5,
    paddingHorizontal: 6,
    paddingVertical: 2.5,
  },
  exceptionChipText: {
    fontFamily: FONTS.bold,
    fontSize: 10,
    color: COLORS.white,
    letterSpacing: 0.2,
  },
  /**
   * 이용 방법은 별도 구획이 아니라, 그것이 딸린 혜택 줄(기본 혜택 또는
   * 소속별 예외) 바로 아래에 이어 붙인다 — 구분선 없이 같은 구획으로 읽히게.
   */
  usageNoteInline: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 4,
    marginTop: 6,
  },
  usageNoteInlineLabel: {
    fontFamily: FONTS.bold,
    fontSize: 11,
  },
  usageNoteInlineText: {
    flex: 1,
    fontFamily: FONTS.regular,
    fontSize: 12,
    lineHeight: 17,
    color: "#666",
  },
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
