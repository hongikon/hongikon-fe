import { useMemo } from "react";
import { ScrollView, TouchableOpacity, Text, StyleSheet } from "react-native";
import { COLORS } from "../../constants/colors";
import { chipStyles } from "./chipStyles";
import ChipIcon from "./ChipIcon";
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
              <ChipIcon name={meta.icon} color={meta.color} active={isActive} />
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

// 칩 모양은 최상단·편의시설 줄과 공유한다. 여기서만 쓰는 선택 상태만 덧붙인다.
const own = StyleSheet.create({
  affiliationChipActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
});

const styles = { ...chipStyles, ...own };
