import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { COLORS } from "../../../../constants/colors";
import { facilityKindMeta } from "../../../../constants/facilityKinds";
import { partnerCategoryMeta } from "../../../../constants/partnerCategories";
import { RADIUS } from "../../../../constants/spacing";
import { FONTS } from "../../../../constants/typography";
import type { Facility, Partner, PartnerCategory } from "../../../../types";
import type { FacilitySearchResult } from "../../../../utils/facilitySearch";
import type { PinnedPartnerGroup } from "../../../../utils/map/partnerSearchSections";
import { KindIcon } from "../../ChipIcon";

/** 검색 결과의 편의시설 한 줄(종류 아이콘 · 이름 · 건물·층). */
export function FacilityRow({
  result,
  onSelect,
}: {
  result: FacilitySearchResult;
  onSelect: (facility: Facility) => void;
}) {
  const { facility, title, subtitle } = result;
  const meta = facilityKindMeta(facility.kind);
  return (
    <TouchableOpacity
      style={styles.row}
      activeOpacity={0.7}
      onPress={() => onSelect(facility)}
      accessibilityRole="button"
      accessibilityLabel={`${title}, ${subtitle}`}
    >
      <View style={styles.facilityIcon}>
        <KindIcon name={meta.icon} size={15} color={meta.color} />
      </View>
      <View style={styles.info}>
        <Text style={styles.name} numberOfLines={1}>
          {title}
        </Text>
        <Text style={styles.address} numberOfLines={1}>
          {subtitle}
        </Text>
      </View>
      <Ionicons name="chevron-forward" size={16} color={COLORS.chevron} />
    </TouchableOpacity>
  );
}

/**
 * 제휴 업체 한 줄. 카테고리별로 묶인 목록에서는 구획 제목이 이미 카테고리를
 * 보여주므로, 각 줄에서는 뱃지를 또 반복하지 않는다(showCategory=false).
 */
export function PartnerRow({
  partner,
  onSelect,
  showCategory = true,
}: {
  partner: Partner;
  onSelect: (partner: Partner) => void;
  showCategory?: boolean;
}) {
  const meta = partnerCategoryMeta(partner.category);
  return (
    <TouchableOpacity
      style={styles.row}
      activeOpacity={0.7}
      onPress={() => onSelect(partner)}
      accessibilityRole="button"
    >
      <View style={[styles.dot, { backgroundColor: meta.color }]} />
      <View style={styles.info}>
        <View style={styles.titleRow}>
          <Text style={styles.name} numberOfLines={1}>
            {partner.name}
          </Text>
          {showCategory && (
            <Text style={[styles.category, { color: meta.color }]}>
              {partner.category}
            </Text>
          )}
        </View>
        {partner.affiliations && partner.affiliations.length > 0 && (
          <View style={styles.affiliationRow}>
            {partner.affiliations.map((affiliation) => (
              <View key={affiliation} style={styles.affiliationChip}>
                <Text style={styles.affiliationChipText}>{affiliation}</Text>
              </View>
            ))}
          </View>
        )}
        {partner.benefit && (
          <Text style={styles.benefit} numberOfLines={2}>
            {partner.benefit}
          </Text>
        )}
        {partner.address && (
          <Text style={styles.address} numberOfLines={1}>
            {partner.address}
          </Text>
        )}
      </View>
      <Ionicons name="chevron-forward" size={16} color={COLORS.chevron} />
    </TouchableOpacity>
  );
}

/** 지도에 안 보이는 곳 묶음(머리줄을 눌러 접고 편다). 안내 줄로 열었으면 목록 맨 위, 검색창으로 열었으면 맨 아래. */
export function FarPartnersBlock({
  group,
  onTop,
  collapsed,
  onToggle,
  onSelect,
}: {
  group: PinnedPartnerGroup;
  onTop: boolean;
  collapsed: boolean;
  onToggle: () => void;
  onSelect: (partner: Partner) => void;
}) {
  return (
    <View style={[styles.pinnedBox, onTop ? styles.pinnedBoxTop : styles.pinnedBoxBottom]}>
      <TouchableOpacity
        style={styles.sectionHeader}
        activeOpacity={0.6}
        onPress={onToggle}
        accessibilityRole="button"
        accessibilityLabel={`${group.title} ${collapsed ? "펼치기" : "접기"}`}
      >
        <View style={styles.sectionHeaderTitle}>
          <Ionicons name="navigate-circle-outline" size={20} color={COLORS.primary} />
          <Text style={[styles.sectionHeaderText, { color: COLORS.primary }]}>{group.title}</Text>
          <Text style={styles.sectionHeaderCount}>{group.partners.length}곳</Text>
        </View>
        <Ionicons name={collapsed ? "chevron-forward" : "chevron-down"} size={19} color={COLORS.primary} />
      </TouchableOpacity>
      {!collapsed && (
        <>
          {group.hint && <Text style={styles.pinnedHint}>{group.hint}</Text>}
          {group.partners.map((partner) => (
            <View key={partner.id}><PartnerRow partner={partner} onSelect={onSelect} /></View>
          ))}
        </>
      )}
    </View>
  );
}

/** 카테고리 구획 머리줄(아이콘 · 이름 · N곳, 눌러 접고 편다). */
export function CategoryHeader({
  category,
  total,
  collapsed,
  onToggle,
}: {
  category: PartnerCategory;
  /** 접혀 있어도 원래 개수(구획 data 는 접히면 비운다). */
  total: number;
  collapsed: boolean;
  onToggle: (category: PartnerCategory) => void;
}) {
  const meta = partnerCategoryMeta(category);
  return (
    <TouchableOpacity
      style={styles.sectionHeader}
      activeOpacity={0.6}
      onPress={() => onToggle(category)}
      accessibilityRole="button"
      accessibilityLabel={`${category} ${collapsed ? "펼치기" : "접기"}`}
    >
      <View style={styles.sectionHeaderTitle}>
        <Ionicons name={meta.icon} size={20} color={meta.color} />
        <Text style={[styles.sectionHeaderText, { color: meta.color }]}>
          {category}
        </Text>
        <Text style={styles.sectionHeaderCount}>{total}곳</Text>
      </View>
      <Ionicons
        name={collapsed ? "chevron-forward" : "chevron-down"}
        size={19}
        color={meta.color}
      />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  pinnedBox: { paddingBottom: 4 },
  pinnedBoxTop: { marginTop: 4, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  pinnedBoxBottom: { marginTop: 8, borderTopWidth: 1, borderTopColor: COLORS.border },
  pinnedHint: {
    fontSize: 12,
    lineHeight: 17,
    fontFamily: FONTS.regular,
    color: COLORS.textTertiary,
    marginTop: 4,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: COLORS.white,
    paddingTop: 18,
    paddingBottom: 8,
  },
  sectionHeaderTitle: { flexDirection: "row", alignItems: "center", gap: 7 },
  facilityIcon: { width: 20, alignItems: "center", marginTop: 1 },
  sectionHeaderText: { fontSize: 20, fontFamily: FONTS.bold },
  sectionHeaderCount: {
    fontSize: 12,
    fontFamily: FONTS.regular,
    color: COLORS.textTertiary,
  },
  row: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: COLORS.border,
  },
  dot: { width: 9, height: 9, borderRadius: 4.5, marginTop: 6 },
  info: { flex: 1, gap: 4 },
  titleRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  name: {
    fontSize: 15,
    fontFamily: FONTS.semibold,
    color: COLORS.textPrimary,
  },
  category: { fontSize: 12, fontFamily: FONTS.semibold },
  affiliationRow: { flexDirection: "row", flexWrap: "wrap", gap: 4 },
  affiliationChip: {
    borderWidth: 1,
    borderColor: COLORS.chipBorder,
    borderRadius: RADIUS.sm,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  affiliationChipText: { fontSize: 11, fontFamily: FONTS.medium, color: COLORS.textSecondary },
  benefit: {
    fontSize: 13,
    fontFamily: FONTS.regular,
    color: COLORS.textPrimary,
    lineHeight: 18,
  },
  address: {
    fontSize: 12,
    fontFamily: FONTS.regular,
    color: COLORS.textTertiary,
  },
});
