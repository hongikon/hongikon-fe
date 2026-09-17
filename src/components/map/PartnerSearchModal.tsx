import { useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  FlatList,
  SectionList,
  Modal,
  TouchableOpacity,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { COLORS } from "../../constants/colors";
import { FONTS } from "../../constants/typography";
import { partnerCategoryMeta } from "../../constants/partnerCategories";
import { browsePartnersByCategory, searchPartners } from "../../utils/partnerSearch";
import type { Partner, PartnerCategory } from "../../types";

interface PartnerSearchModalProps {
  visible: boolean;
  /** 상위 화면(Modal 밖)에서 잰 top safe-area inset. */
  topInset: number;
  onClose: () => void;
  onSelect: (partner: Partner) => void;
}

/**
 * 제휴 업체 검색.
 * 앱 안 상수만 훑기 때문에 네트워크를 타지 않고 한 글자마다 즉시 반응한다.
 * 상호명 외에 혜택·주소로도 걸리므로 '10%할인', '상수동' 같은 검색도 된다.
 */
export default function PartnerSearchModal({
  visible,
  topInset,
  onClose,
  onSelect,
}: PartnerSearchModalProps) {
  const [query, setQuery] = useState("");
  const inputRef = useRef<TextInput>(null);

  const results = useMemo(() => searchPartners(query), [query]);
  const hasQuery = query.trim().length > 0;
  // 목록 자체는 검색어와 무관하게 고정이라 한 번만 계산해 둔다.
  const browseSections = useMemo(() => browsePartnersByCategory(), []);
  // 접힌 카테고리 집합. 기본은 전부 펼친 상태(빈 집합).
  const [collapsedCategories, setCollapsedCategories] = useState<Set<PartnerCategory>>(
    () => new Set(),
  );
  const toggleCategory = (category: PartnerCategory) => {
    setCollapsedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(category)) next.delete(category);
      else next.add(category);
      return next;
    });
  };
  // SectionList는 구획을 통째로 숨기는 API가 없어, 접힌 구획은 data를
  // 비워 헤더만 남긴다(개수·펼침 상태는 원본 section에서 그대로 읽는다).
  const visibleSections = useMemo(
    () =>
      browseSections.map((section) =>
        collapsedCategories.has(section.category) ? { ...section, data: [] } : section,
      ),
    [browseSections, collapsedCategories],
  );

  const handleClose = () => {
    setQuery("");
    onClose();
  };

  const handleSelect = (partner: Partner) => {
    setQuery("");
    onSelect(partner);
  };

  // 카테고리별로 묶인 목록(browseSections)에서는 구획 제목이 이미 카테고리를
  // 보여주므로, 각 줄에서는 뱃지를 또 반복하지 않는다(showCategory=false).
  const renderPartnerRow = (partner: Partner, showCategory = true) => {
    const meta = partnerCategoryMeta(partner.category);
    return (
      <TouchableOpacity
        style={styles.row}
        activeOpacity={0.7}
        onPress={() => handleSelect(partner)}
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
        <Ionicons name="chevron-forward" size={14} color="#ddd" />
      </TouchableOpacity>
    );
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      onRequestClose={handleClose}
      onShow={() => inputRef.current?.focus()}
    >
      <View style={[styles.container, { paddingTop: topInset }]}>
        <View style={styles.header}>
          <TouchableOpacity
            onPress={handleClose}
            accessibilityRole="button"
            accessibilityLabel="검색 닫기"
          >
            <Ionicons name="arrow-back" size={22} color={COLORS.textPrimary} />
          </TouchableOpacity>
          <View style={styles.searchBar}>
            <Ionicons name="search" size={16} color="#999" />
            <TextInput
              ref={inputRef}
              style={styles.input}
              placeholder="제휴 업체 검색"
              placeholderTextColor="#bbb"
              value={query}
              onChangeText={setQuery}
              returnKeyType="search"
            />
            {hasQuery && (
              <TouchableOpacity
                onPress={() => setQuery("")}
                accessibilityRole="button"
                accessibilityLabel="검색어 지우기"
              >
                <Ionicons name="close-circle" size={16} color="#ccc" />
              </TouchableOpacity>
            )}
          </View>
        </View>

        {hasQuery && results.length === 0 && (
          <View style={styles.hintBox}>
            <Ionicons name="search" size={22} color="#ddd" />
            <Text style={styles.hintText}>검색 결과가 없어요.</Text>
          </View>
        )}

        {hasQuery ? (
          <FlatList
            data={results}
            keyExtractor={(item) => item.id}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={styles.list}
            renderItem={({ item }) => renderPartnerRow(item)}
          />
        ) : (
          <SectionList
            sections={visibleSections}
            keyExtractor={(item) => item.id}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={styles.list}
            stickySectionHeadersEnabled
            ListHeaderComponent={
              <Text style={styles.browseHint}>
                상호명은 물론 혜택이나 주소로도 찾을 수 있어요. 예: 어리 · 10%할인 · 상수동
              </Text>
            }
            renderSectionHeader={({ section }) => {
              const meta = partnerCategoryMeta(section.category);
              // section.data는 접혔을 때 비워 두므로 개수는 원본(browseSections)에서 찾는다.
              const total =
                browseSections.find((s) => s.category === section.category)?.data.length ?? 0;
              const collapsed = collapsedCategories.has(section.category);
              return (
                <TouchableOpacity
                  style={styles.sectionHeader}
                  activeOpacity={0.6}
                  onPress={() => toggleCategory(section.category)}
                  accessibilityRole="button"
                  accessibilityLabel={`${section.category} ${collapsed ? "펼치기" : "접기"}`}
                >
                  <View style={styles.sectionHeaderTitle}>
                    <Ionicons name={meta.icon} size={20} color={meta.color} />
                    <Text style={[styles.sectionHeaderText, { color: meta.color }]}>
                      {section.category}
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
            }}
            renderItem={({ item }) => renderPartnerRow(item, false)}
          />
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.white },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 0.5,
    borderBottomColor: "#eee",
  },
  searchBar: {
    flex: 1,
    height: 38,
    borderRadius: 10,
    backgroundColor: "#F0F0F0",
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    gap: 8,
  },
  input: {
    flex: 1,
    fontSize: 14,
    fontFamily: FONTS.regular,
    color: COLORS.textPrimary,
  },
  hintBox: { alignItems: "center", paddingTop: 40, gap: 6 },
  hintText: {
    fontSize: 13,
    fontFamily: FONTS.regular,
    color: COLORS.textSecondary,
  },
  browseHint: {
    fontSize: 12,
    fontFamily: FONTS.regular,
    color: COLORS.textTertiary,
    paddingTop: 14,
    paddingBottom: 6,
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
  sectionHeaderText: { fontSize: 20, fontFamily: FONTS.bold },
  sectionHeaderCount: {
    fontSize: 11.5,
    fontFamily: FONTS.regular,
    color: COLORS.textTertiary,
  },
  list: { paddingHorizontal: 16 },
  row: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    paddingVertical: 13,
    borderBottomWidth: 0.5,
    borderBottomColor: "#f4f4f4",
  },
  dot: { width: 9, height: 9, borderRadius: 4.5, marginTop: 5 },
  info: { flex: 1, gap: 3 },
  titleRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  name: {
    fontSize: 14.5,
    fontFamily: FONTS.semibold,
    color: COLORS.textPrimary,
  },
  category: { fontSize: 11, fontFamily: FONTS.semibold },
  affiliationRow: { flexDirection: "row", flexWrap: "wrap", gap: 4 },
  affiliationChip: {
    borderWidth: 1,
    borderColor: "#e2e2e2",
    borderRadius: 4,
    paddingHorizontal: 5,
    paddingVertical: 1.5,
  },
  affiliationChipText: { fontSize: 10, fontFamily: FONTS.regular, color: "#999" },
  benefit: {
    fontSize: 12.5,
    fontFamily: FONTS.regular,
    color: COLORS.textPrimary,
    lineHeight: 17,
  },
  address: {
    fontSize: 11.5,
    fontFamily: FONTS.regular,
    color: COLORS.textTertiary,
  },
});
