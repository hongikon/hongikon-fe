import { useMemo } from "react";
import { ScrollView, TouchableOpacity, Text, StyleSheet } from "react-native";
import { COLORS } from "../../constants/colors";
import { chipStyles } from "./chipStyles";
import ChipIcon from "./ChipIcon";
import { PARTNER_AFFILIATIONS } from "../../constants/partnerAffiliations";
import { PARTNER_CATEGORIES } from "../../constants/partnerCategories";
import { partnerCount } from "../../utils/partners";
import { useMapData } from "../../lib/mapData";
import type { PartnerAffiliation, PartnerCategory } from "../../types";
import * as haptics from "../../lib/haptics";

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
  // 지도 데이터를 아직 못 받았으면 업체가 0곳이라 칩이 전부 흐리게(눌리지 않게) 보인다.
  const { partners } = useMapData();
  const affiliationCounts = useMemo(() => {
    const withCounts = PARTNER_AFFILIATIONS.map((key) => ({
      key,
      count: partnerCount(partners, { affiliation: key, category }),
    }));
    // 업체가 하나도 없는 소속은 골라도 빈 지도만 보여줄 뿐이라, 목록 오른쪽 끝으로
    // 밀어낸다(각 그룹 안에서는 원래 순서 유지). 있는 것부터 먼저 보이게 하려는 것.
    const withPartners = withCounts.filter((c) => c.count > 0);
    const empty = withCounts.filter((c) => c.count === 0);
    return [...withPartners, ...empty];
  }, [partners, category]);

  const categoryCounts = useMemo(
    () =>
      PARTNER_CATEGORIES.map((meta) => ({
        meta,
        count: partnerCount(partners, { affiliation, category: meta.key }),
      })),
    [partners, affiliation],
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
          // 이미 골라둔 상태에서 다른 업종을 눌러 0곳이 된 경우는, 해제는 계속
          // 할 수 있어야 하니 그때만 눌리게 둔다.
          const disabled = count === 0 && !isActive;
          return (
            <TouchableOpacity
              key={key}
              activeOpacity={0.75}
              onPress={() => {
                haptics.selection();
                onSelectAffiliation(key);
              }}
              disabled={disabled}
              accessibilityRole="button"
              accessibilityState={{ selected: isActive, disabled }}
              accessibilityLabel={
                count === 0 ? `${key}: 제휴 업체 없음` : `${key} 제휴 업체 ${count}곳`
              }
              style={[
                styles.chip,
                disabled && own.affiliationChipDisabled,
                isActive && styles.affiliationChipActive,
              ]}
            >
              <Text
                style={[
                  styles.label,
                  disabled && own.affiliationLabelDisabled,
                  isActive && styles.labelActive,
                ]}
              >
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
              onPress={() => {
                haptics.selection();
                onSelectCategory(meta.key);
              }}
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
  // 공용 chipEmpty(옅게 흐림)보다 또렷하게 "선택 불가"를 알린다 — 옅은 회색으로
  // 채우고 글자는 반투명만 주던 이전과 달리 아예 다른 회색 글자로 바꾼다.
  affiliationChipDisabled: {
    backgroundColor: COLORS.sectionBg,
    borderColor: COLORS.chipBorder,
  },
  // 이전엔 opacity 로 통째로 흐리게만 했는데, 그러면 글자가 거의 안 읽혔다.
  // 진한 회색으로 바꿔 또렷이 읽히면서도(요청사항) 활성 칩의 남색과는 분명히 다르게 둔다.
  affiliationLabelDisabled: { color: COLORS.textSecondary },
});

const styles = { ...chipStyles, ...own };
