import { useMemo } from 'react'
import { useChipRowScrollStyle } from '../../../components/map/chipStyles'
import { PARTNER_AFFILIATIONS } from '../../../constants/partnerAffiliations'
import { PARTNER_CATEGORIES } from '../../../constants/partnerCategories'
import { partnerCount } from '../../../utils/map/partner/partners'
import { useMapData } from '../../../lib/mapData'
import type { PartnerChipsProps } from '../../../components/map/partner/PartnerChips'

/** PartnerChips 의 상태·효과·핸들러. 화면 파일은 이 훅을 불러 그리기만 한다. */
export function usePartnerChips({ affiliation, category }: Pick<PartnerChipsProps, 'affiliation' | 'category'>) {
  const rowScroll = useChipRowScrollStyle();
  // 지도 데이터를 아직 못 받았으면 업체가 0곳이라 칩이 전부 흐리게(눌리지 않게) 보인다.
  const { partners } = useMapData();
  // 칩 순서는 업종을 골라도 바뀌지 않게 고정한다(예전엔 고른 업종에 업체가 없는 소속을 매번 뒤로 밀어 칩이 출렁였다).
  // 제휴 업체가 아예 없는 소속만 데이터 기준으로 오른쪽 끝에 둔다. 고른 업종에 없는 소속은 자리는 그대로, 흐리게만.
  const affiliationOrder = useMemo(() => {
    const hasAny = (key: (typeof PARTNER_AFFILIATIONS)[number]) =>
      partnerCount(partners, { affiliation: key, category: null }) > 0;
    return [...PARTNER_AFFILIATIONS.filter(hasAny), ...PARTNER_AFFILIATIONS.filter((key) => !hasAny(key))];
  }, [partners]);
  const affiliationCounts = useMemo(
    () =>
      affiliationOrder.map((key) => ({
        key,
        count: partnerCount(partners, { affiliation: key, category }),
      })),
    [affiliationOrder, partners, category],
  );

  const categoryCounts = useMemo(
    () =>
      PARTNER_CATEGORIES.map((meta) => ({
        meta,
        count: partnerCount(partners, { affiliation, category: meta.key }),
      })),
    [partners, affiliation],
  );
  return { rowScroll, affiliationCounts, categoryCounts }
}
