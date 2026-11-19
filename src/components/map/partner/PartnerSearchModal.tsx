import { useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  SectionList,
} from "react-native";
import { COLORS } from "../../../constants/colors";
import { FONTS } from "../../../constants/typography";
import { browsePartnersByCategory, searchPartners } from "../../../utils/partnerSearch";
import { searchFacilities } from "../../../utils/facilitySearch";
import { pinnedPartnerGroup, searchResultSections, type PinnedPartnerGroup } from "../../../utils/map/partnerSearchSections";
import { CategoryHeader, FacilityRow, FarPartnersBlock, PartnerRow } from "./search/SearchRows";
import { partnersOutsideFocus } from "../../../utils/partners";
import type { Facility, Partner, PartnerCategory } from "../../../types";
import ContentColumn from "../../common/ContentColumn";
import ScreenHeader from "../../common/ScreenHeader";
import { ModalPanel } from "../../settings/ModalHeader";
import EmptyState from "../../common/EmptyState";
import SearchBar from "../../news/SearchBar";
import Button from "../../common/Button";
import { useMapData } from "../../../lib/mapData";
import NearbyPartners, { INITIAL_NEARBY_STATE, type NearbyState } from "./NearbyPartners";
import SwipeBackModal from "../../common/SwipeBackModal";

interface PartnerSearchModalProps {
  visible: boolean;
  /** 상위 화면(Modal 밖)에서 잰 top safe-area inset. */
  topInset: number;
  onClose: () => void;
  onSelect: (partner: Partner) => void;
  /** 편의시설 결과를 골랐다(지도에서 그 시설 종류·건물 시트를 연다). */
  onSelectFacility: (facility: Facility) => void;
  /**
   * 검색어가 없을 때 목록 맨 위에 따로 모아 보여 줄 업체들. 지도 위 "지도에 안 보이는 N곳" 안내에서
   * 열 때 그 업체들을 바로 고르게 하려고 쓴다.
   */
  pinned?: PinnedPartnerGroup;
  /** 열 때 검색창에 커서를 둘지(키보드). 근처 알림 목록처럼 고르기만 하면 될 때는 false. */
  autoFocus?: boolean;
}

/**
 * 지도 검색(제휴 업체 + 편의시설).
 * 이미 받아 둔 지도 데이터만 훑기 때문에 네트워크를 타지 않고 한 글자마다 즉시 반응한다.
 * 제휴는 상호명 외에 혜택·주소·소속으로도 걸리므로 '10%할인', '상수동', '총학생회' 같은 검색도 된다.
 * 편의시설은 부서 이름('교무처')·종류('프린터', 별칭 '인쇄')·건물로 찾는다 — 칩만으로 찾기 어려운 행정 부서 등(10-12 요청).
 */
export default function PartnerSearchModal({
  visible,
  topInset,
  onClose,
  onSelect,
  onSelectFacility,
  pinned,
  autoFocus = true,
}: PartnerSearchModalProps) {
  const [query, setQuery] = useState("");
  const inputRef = useRef<TextInput>(null);
  // "내 주변 제휴" 결과. 검색어를 쳤다 지워도 남고, 창이 닫히면 지운다(읽은 좌표를 창 밖으로 남기지 않는다).
  const [nearbyState, setNearbyState] = useState<NearbyState>(INITIAL_NEARBY_STATE);
  useEffect(() => {
    if (!visible) setNearbyState(INITIAL_NEARBY_STATE);
  }, [visible]);

  // 지도 데이터를 아직 못 받았으면(빈 배열) 검색·목록 대신 안내를 띄운다.
  const { partners, facilities, data, status, reload } = useMapData();
  const results = useMemo(() => searchPartners(partners, query), [partners, query]);
  const facilityResults = useMemo(() => searchFacilities(facilities, query), [facilities, query]);
  // 편의시설 결과는 '제휴 업체' 위에 따로 묶는다(둘 다 있을 때만 구획 머리줄을 단다).
  const resultSections = useMemo(() => searchResultSections(facilityResults, results), [facilityResults, results]);
  const resultCount = results.length + facilityResults.length;
  const hasQuery = query.trim().length > 0;
  // 목록 자체는 검색어와 무관하게 데이터가 바뀔 때만 다시 계산한다.
  const browseSections = useMemo(() => browsePartnersByCategory(partners), [partners]);
  // 맨 위 "지도에 안 보이는 곳" 묶음. 지도 안내 줄에서 열면 그때 필터에 걸린 업체들,
  // 검색창으로 열면 캠퍼스에서 멀어 지도 핀이 안 보이는 업체 전체.
  const farPartners = useMemo(() => partnersOutsideFocus(partners), [partners]);
  const pinnedGroup = pinnedPartnerGroup(pinned, farPartners);
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

  const handleSelectFacility = (facility: Facility) => {
    setQuery("");
    onSelectFacility(facility);
  };

  const farBlock = pinnedGroup ? (
    <FarPartnersBlock
      group={pinnedGroup}
      onTop={farOnTop}
      collapsed={farCollapsed}
      onToggle={() => setFarCollapsed((v) => !v)}
      onSelect={handleSelect}
    />
  ) : null;

  return (
    <SwipeBackModal
      visible={visible}
      onRequestClose={handleClose}
      onShow={() => {
        if (autoFocus) inputRef.current?.focus();
      }}
    >
      <View style={[styles.container, { paddingTop: topInset }]}>
        {/* 폴드를 펼친 화면·넓은 웹 창에선 검색창·목록을 가운데 읽기 폭으로 모은다. */}
        <ContentColumn>
        <ScreenHeader onBack={handleClose} card>
          <SearchBar
            inputRef={inputRef}
            value={query}
            onChangeText={setQuery}
            placeholder="제휴 업체·편의시설 검색"
            accessibilityLabel="제휴 업체·편의시설 검색"
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
        ) : hasQuery && resultCount === 0 ? (
          <EmptyState icon="search-outline" message={query.trim() ? `'${query.trim()}' 검색 결과가 없어요` : "검색 결과가 없어요"} style={styles.hintBox} />
        ) : null}

        {!data ? null : hasQuery ? (
          <SectionList
            sections={resultSections}
            keyExtractor={(row) => row.key}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={styles.list}
            stickySectionHeadersEnabled={false}
            renderSectionHeader={({ section }) =>
              section.title ? <Text style={styles.resultHeader}>{section.title}</Text> : null
            }
            renderItem={({ item: row }) =>
              row.type === "facility" ? (
                <FacilityRow result={row.item} onSelect={handleSelectFacility} />
              ) : (
                <PartnerRow partner={row.item} onSelect={handleSelect} />
              )
            }
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
                <NearbyPartners partners={partners} onSelect={handleSelect} state={nearbyState} onStateChange={setNearbyState} />
                <Text style={styles.browseHint}>
                  제휴 업체는 상호명·혜택·주소·소속으로, 편의시설은 부서·종류·건물로 찾을 수 있어요. 예: 총학생회 · 10%할인 · 교무처 · 프린터
                </Text>
              </>
            }
            ListFooterComponent={farOnTop ? null : farBlock}
            renderSectionHeader={({ section }) => (
              <CategoryHeader
                category={section.category}
                // section.data는 접혔을 때 비워 두므로 개수는 원본(browseSections)에서 찾는다.
                total={browseSections.find((s) => s.category === section.category)?.data.length ?? 0}
                collapsed={collapsedCategories.has(section.category)}
                onToggle={toggleCategory}
              />
            )}
            renderItem={({ item }) => <PartnerRow partner={item} onSelect={handleSelect} showCategory={false} />}
          />
        )}
        </ModalPanel>
        </ContentColumn>
      </View>
    </SwipeBackModal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  // 카드 안 검색창은 회색 알약(카드와 같은 흰색이면 경계가 안 보인다).
  searchBar: { flex: 1, marginRight: 4, backgroundColor: COLORS.background, borderWidth: 0 },
  hintBox: { minHeight: 200 },
  browseHint: {
    fontSize: 12,
    lineHeight: 17,
    fontFamily: FONTS.regular,
    color: COLORS.textTertiary,
    paddingTop: 14,
    paddingBottom: 6,
  },
  resultHeader: {
    fontSize: 13,
    fontFamily: FONTS.semibold,
    color: COLORS.textSecondary,
    backgroundColor: COLORS.white,
    paddingTop: 16,
    paddingBottom: 4,
  },
  list: { paddingHorizontal: 16 },
});
