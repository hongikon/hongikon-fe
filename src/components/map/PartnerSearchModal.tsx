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
import { partnersOutsideFocus } from "../../utils/partners";
import type { Partner, PartnerCategory } from "../../types";
import ContentColumn from "../common/ContentColumn";
import ScreenHeader from "../common/ScreenHeader";
import { ModalPanel } from "../settings/ModalHeader";
import EmptyState from "../common/EmptyState";
import SearchBar from "../news/SearchBar";
import Button from "../common/Button";
import { useMapData } from "../../lib/mapData";

interface PartnerSearchModalProps {
  visible: boolean;
  /** 상위 화면(Modal 밖)에서 잰 top safe-area inset. */
  topInset: number;
  onClose: () => void;
  onSelect: (partner: Partner) => void;
  /**
   * 검색어가 없을 때 목록 맨 위에 따로 모아 보여 줄 업체들. 지도 위 "지도에 안 보이는 N곳" 안내에서
   * 열 때 그 업체들을 바로 고르게 하려고 쓴다.
   */
  pinned?: { title: string; hint?: string; partners: readonly Partner[] };
}

/**
 * 제휴 업체 검색.
 * 이미 받아 둔 지도 데이터만 훑기 때문에 네트워크를 타지 않고 한 글자마다 즉시 반응한다.
 * 상호명 외에 혜택·주소로도 걸리므로 '10%할인', '상수동' 같은 검색도 된다.
 */
export default function PartnerSearchModal({
  visible,
  topInset,
  onClose,
  onSelect,
  pinned,
}: PartnerSearchModalProps) {
  const [query, setQuery] = useState("");
  const inputRef = useRef<TextInput>(null);

  // 지도 데이터를 아직 못 받았으면(빈 배열) 검색·목록 대신 안내를 띄운다.
  const { partners, data, status, reload } = useMapData();
  const results = useMemo(() => searchPartners(partners, query), [partners, query]);
  const hasQuery = query.trim().length > 0;
  // 목록 자체는 검색어와 무관하게 데이터가 바뀔 때만 다시 계산한다.
  const browseSections = useMemo(() => browsePartnersByCategory(partners), [partners]);
  // 맨 위 "지도에 안 보이는 곳" 묶음. 지도 안내 줄에서 열면 그때 필터에 걸린 업체들,
  // 검색창으로 열면 캠퍼스에서 멀어 지도 핀이 안 보이는 업체 전체.
  const farPartners = useMemo(() => partnersOutsideFocus(partners), [partners]);
  const pinnedGroup =
    pinned && pinned.partners.length > 0
      ? pinned
      : farPartners.length > 0
        ? {
            title: "지도에 안 보이는 곳",
            hint: "캠퍼스에서 멀어 지도에는 핀이 안 보여요. 누르면 그 주변으로 이동해요.",
            partners: farPartners,
          }
        : null;
  // 접힌 카테고리 집합. 기본은 전부 펼친 상태(빈 집합).
  // 지도에 안 보이는 곳 묶음 접기. 안내 줄('보기')로 열었으면 그 업체들을 보러 온 것이라 맨 위에 펼쳐 두고,
  // 검색창으로 열었으면 카테고리 목록 맨 아래에 둔다(카테고리처럼 머리줄을 눌러 접고 편다).
  const [farCollapsed, setFarCollapsed] = useState(false);
  const farOnTop = !!pinned && pinned.partners.length > 0;
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
  };

  const farBlock = pinnedGroup ? (
    <View style={[styles.pinnedBox, farOnTop ? styles.pinnedBoxTop : styles.pinnedBoxBottom]}>
      <TouchableOpacity
        style={styles.sectionHeader}
        activeOpacity={0.6}
        onPress={() => setFarCollapsed((v) => !v)}
        accessibilityRole="button"
        accessibilityLabel={`${pinnedGroup.title} ${farCollapsed ? "펼치기" : "접기"}`}
      >
        <View style={styles.sectionHeaderTitle}>
          <Ionicons name="navigate-circle-outline" size={20} color={COLORS.primary} />
          <Text style={[styles.sectionHeaderText, { color: COLORS.primary }]}>{pinnedGroup.title}</Text>
          <Text style={styles.sectionHeaderCount}>{pinnedGroup.partners.length}곳</Text>
        </View>
        <Ionicons name={farCollapsed ? "chevron-forward" : "chevron-down"} size={19} color={COLORS.primary} />
      </TouchableOpacity>
      {!farCollapsed && (
        <>
          {pinnedGroup.hint && <Text style={styles.pinnedHint}>{pinnedGroup.hint}</Text>}
          {pinnedGroup.partners.map((partner) => (
            <View key={partner.id}>{renderPartnerRow(partner)}</View>
          ))}
        </>
      )}
    </View>
  ) : null;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      onRequestClose={handleClose}
      onShow={() => inputRef.current?.focus()}
    >
      <View style={[styles.container, { paddingTop: topInset }]}>
        {/* 폴드를 펼친 화면·넓은 웹 창에선 검색창·목록을 가운데 읽기 폭으로 모은다. */}
        <ContentColumn>
        <ScreenHeader onBack={handleClose} card>
          <SearchBar
            inputRef={inputRef}
            value={query}
            onChangeText={setQuery}
            placeholder="제휴 업체 검색"
            accessibilityLabel="제휴 업체 검색"
            style={styles.searchBar}
          />
        </ScreenHeader>

        {/* 회색 바탕 위 둥근 흰 판에 결과를 담는다(10-07 — 소식 검색·설정 창들과 같은 모양). */}
        <ModalPanel>
        {!data ? (
          status === "error" ? (
            <EmptyState
              icon="cloud-offline-outline"
              message="제휴 업체 정보를 불러오지 못했어요"
              action={<Button label="다시 시도" size="md" fullWidth={false} onPress={reload} />}
              style={styles.hintBox}
            />
          ) : (
            <EmptyState icon="time-outline" message="제휴 업체 정보를 불러오는 중이에요" style={styles.hintBox} />
          )
        ) : hasQuery && results.length === 0 ? (
          <EmptyState icon="search-outline" message="검색 결과가 없어요" style={styles.hintBox} />
        ) : null}

        {!data ? null : hasQuery ? (
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
              <>
                {farOnTop && farBlock}
                <Text style={styles.browseHint}>
                  상호명은 물론 혜택이나 주소로도 찾을 수 있어요. 예: 어리 · 10%할인 · 상수동
                </Text>
              </>
            }
            ListFooterComponent={farOnTop ? null : farBlock}
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
        </ModalPanel>
        </ContentColumn>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  // 카드 안 검색창은 회색 알약(카드와 같은 흰색이면 경계가 안 보인다).
  searchBar: { flex: 1, marginRight: 4, backgroundColor: COLORS.background, borderWidth: 0 },
  hintBox: { minHeight: 200 },
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
  browseHint: {
    fontSize: 12,
    lineHeight: 17,
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
    fontSize: 12,
    fontFamily: FONTS.regular,
    color: COLORS.textTertiary,
  },
  list: { paddingHorizontal: 16 },
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
    borderRadius: 6,
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
