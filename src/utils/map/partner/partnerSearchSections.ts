import type { Partner } from "../../../types";
import type { FacilitySearchResult } from "../facilitySearch";

/** 검색 결과 한 줄: 편의시설 또는 제휴 업체. */
export type SearchRow =
  | { type: "facility"; key: string; item: FacilitySearchResult }
  | { type: "partner"; key: string; item: Partner };

/** 목록 맨 위(또는 맨 아래)에 따로 모아 보여 줄 업체 묶음. */
export interface PinnedPartnerGroup {
  title: string;
  hint?: string;
  partners: readonly Partner[];
}

/** 편의시설 결과는 '제휴 업체' 위에 따로 묶는다(둘 다 있을 때만 구획 머리줄을 단다). */
export function searchResultSections(
  facilityResults: readonly FacilitySearchResult[],
  results: readonly Partner[],
): { title: string | null; data: SearchRow[] }[] {
  const sections: { title: string | null; data: SearchRow[] }[] = [];
  const both = facilityResults.length > 0 && results.length > 0;
  if (facilityResults.length > 0) {
    sections.push({
      title: both ? "편의시설" : null,
      data: facilityResults.map((item) => ({ type: "facility" as const, key: `f:${item.facility.id}`, item })),
    });
  }
  if (results.length > 0) {
    sections.push({
      title: both ? "제휴 업체" : null,
      data: results.map((item) => ({ type: "partner" as const, key: `p:${item.id}`, item })),
    });
  }
  return sections;
}

/**
 * 맨 위 "지도에 안 보이는 곳" 묶음. 지도 안내 줄에서 열면 그때 필터에 걸린 업체들(`pinned`),
 * 검색창으로 열면 캠퍼스에서 멀어 지도 핀이 안 보이는 업체 전체(`farPartners`). 둘 다 없으면 null.
 */
export function pinnedPartnerGroup(
  pinned: PinnedPartnerGroup | undefined,
  farPartners: readonly Partner[],
): PinnedPartnerGroup | null {
  return pinned && pinned.partners.length > 0
    ? pinned
    : farPartners.length > 0
      ? {
          title: "지도에 안 보이는 곳",
          hint: "캠퍼스에서 멀어 지도에는 핀이 안 보여요. 누르면 그 주변으로 이동해요.",
          partners: farPartners,
        }
      : null;
}
