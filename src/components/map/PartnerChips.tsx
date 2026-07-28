import { useMemo } from "react";
import { ScrollView, TouchableOpacity, Text, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { COLORS } from "../../constants/colors";
import { FONTS } from "../../constants/typography";
import { PARTNER_AFFILIATIONS } from "../../constants/partnerAffiliations";
import { PARTNER_CATEGORIES } from "../../constants/partnerCategories";
import { partnerCount } from "../../utils/partners";
import type { PartnerAffiliation, PartnerCategory } from "../../types";

interface PartnerChipsProps {
  /** 1단: 제휴 주체. 고르지 않았으면 null. */
  affiliation: PartnerAffiliation | null;
  /** 2단: 업종. 고르지 않았으면 null. */
  category: PartnerCategory | null;
  /** 같은 칩을 다시 눌렀을 때의 해제 처리는 호출하는 쪽이 맡는다. */
  onSelectAffiliation: (value: PartnerAffiliation) => void;
  onSelectCategory: (value: PartnerCategory) => void;
}

/**
 * 검색바 아래 2단 필터.
 * 위 줄은 소속(총학생회·단과대), 아래 줄은 업종(카페·주점 …).
 *
 * 개수 숫자 배지는 반대편 단계에 따라 값이 바뀌어 헷갈리므로 화면에 띄우지
 * 않는다. 다만 개수는 여전히 세어, 해당 조건에 업체가 없는 칩(count 0)만
 * 흐리게 처리하고 접근성 라벨에 쓴다.
 */
export default function PartnerChips({
  affiliation,
  category,
  onSelectAffiliation,
  onSelectCategory,
}: PartnerChipsProps) {
  const affiliationCounts = useMemo(
    () =>
      PARTNER_AFFILIATIONS.map((key) => ({
        key,
        count: partnerCount({ affiliation: key, category }),
      })),
    [category],
  );

  const categoryCounts = useMemo(
    () =>
      PARTNER_CATEGORIES.map((meta) => ({
        meta,
        count: partnerCount({ affiliation, category: meta.key }),
      })),
    [affiliation],
  );

  return (
    <>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.scroll}
        contentContainerStyle={styles.row}
      >
        {affiliationCounts.map(({ key, count }) => {
          const isActive = affiliation === key;
          return (
            <TouchableOpacity
              key={key}
              activeOpacity={0.75}
              onPress={() => onSelectAffiliation(key)}
              accessibilityRole="button"
              accessibilityState={{ selected: isActive }}
              accessibilityLabel={`${key} 제휴 업체 ${count}곳`}
              style={[
                styles.chip,
                count === 0 && styles.chipEmpty,
                isActive && styles.affiliationChipActive,
              ]}
            >
              <Text style={[styles.label, isActive && styles.labelActive]}>
                {key}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.scroll}
        contentContainerStyle={styles.row}
      >
        {categoryCounts.map(({ meta, count }) => {
          const isActive = category === meta.key;
          return (
            <TouchableOpacity
              key={meta.key}
              activeOpacity={0.75}
              onPress={() => onSelectCategory(meta.key)}
              accessibilityRole="button"
              accessibilityState={{ selected: isActive }}
              accessibilityLabel={`${meta.key} 제휴 업체 ${count}곳`}
              style={[
                styles.chip,
                count === 0 && styles.chipEmpty,
                isActive && {
                  backgroundColor: meta.color,
                  borderColor: meta.color,
                },
              ]}
            >
              <Ionicons
                name={meta.icon}
                size={13}
                color={isActive ? COLORS.white : meta.color}
              />
              <Text style={[styles.label, isActive && styles.labelActive]}>
                {meta.key}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  // flexGrow 0 이 없으면 가로 스크롤이 남은 세로 공간을 먹어 지도를 밀어낸다.
  scroll: { flexGrow: 0, marginBottom: 8 },
  row: { paddingHorizontal: 16, gap: 7 },
  chip: {
    height: 32,
    paddingHorizontal: 11,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.chipBorder,
    backgroundColor: COLORS.white,
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  // 해당 조건에 업체가 없는 칩. 눌리기는 하되 먼저 눈에 띄지는 않게 둔다.
  chipEmpty: { opacity: 0.45 },
  affiliationChipActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  label: { fontSize: 12.5, fontFamily: FONTS.semibold, color: COLORS.chipText },
  labelActive: { color: COLORS.white },
});
