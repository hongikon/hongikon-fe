import { useEffect, useMemo, useRef, useState } from 'react'
import { TextInput } from 'react-native'
import { browsePartnersByCategory, searchPartners } from '../../../utils/map/partner/partnerSearch'
import { searchFacilities } from '../../../utils/map/facilitySearch'
import { pinnedPartnerGroup, searchResultSections } from '../../../utils/map/partner/partnerSearchSections'
import { partnersOutsideFocus } from '../../../utils/map/partner/partners'
import type { Facility, Partner, PartnerCategory } from '../../../types'
import { useMapData } from '../../../lib/mapData'
import { INITIAL_NEARBY_STATE, type NearbyState } from '../../../components/map/partner/NearbyPartners'
import type { PartnerSearchModalProps } from '../../../components/map/partner/PartnerSearchModal'

/** PartnerSearchModal 의 상태·효과·핸들러. 화면 파일은 이 훅을 불러 그리기만 한다. */
export function usePartnerSearchModal({ visible, onClose, onSelect, onSelectFacility, pinned }: Pick<PartnerSearchModalProps, 'visible' | 'onClose' | 'onSelect' | 'onSelectFacility' | 'pinned'>) {
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
  return {
    query,
    setQuery,
    inputRef,
    nearbyState,
    setNearbyState,
    partners,
    data,
    status,
    reload,
    resultSections,
    resultCount,
    hasQuery,
    browseSections,
    pinnedGroup,
    farCollapsed,
    setFarCollapsed,
    farOnTop,
    collapsedCategories,
    toggleCategory,
    visibleSections,
    handleClose,
    handleSelect,
    handleSelectFacility,
  }
}
