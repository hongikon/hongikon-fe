import { PARTNER_AFFILIATION_USAGE_NOTES } from "../../../constants/partnerAffiliations";
import type { Partner, PartnerAffiliation } from "../../../types";

/**
 * " / "로 여러 항목이 이어진 혜택·이용방법 문구를 "- 항목" 줄로 쪼갠다. 구분자가
 * 없으면(하나뿐이면) 그대로 한 줄만 돌려준다 — "단품/세트"처럼 공백 없이 붙은
 * "/"는 복합 단어라 여기 안 걸린다(제휴업체 데이터가 이 표기 규칙을 따른다).
 */
export function splitBulletItems(text: string): string[] {
  const items = text.split(" / ");
  return items.length > 1 ? items : [text];
}

/**
 * 주류 혜택이 있는 업체인지. 주점 카테고리는 모두, 그 밖의 업체는 혜택 문구에 술 이름이 있을 때
 * ("주류 제외"처럼 빼는 말은 제외). 청소년보호법상 청소년(만 19세 미만)에게 주류를 팔 수 없어
 * 시트에 한 줄 안내를 붙인다(store-submission-kit §3-6).
 */
const ALCOHOL_PATTERN = /소주|맥주|생맥|하이볼|와인|칵테일|막걸리|사케|위스키|주류(?!\s*제외)/;

export function hasAlcoholBenefit(partner: Partner): boolean {
  if (partner.category === "주점") return true;
  const texts = [partner.benefit, ...(partner.affiliationBenefits?.map((item) => item.benefit) ?? [])];
  return texts.some((text) => !!text && ALCOHOL_PATTERN.test(text));
}

/**
 * 혜택 카드에 그릴 묶음: 기본 혜택을 그대로 받는 소속(칩), 소속별 제휴 기한, 기본 혜택 줄 아래 붙일 이용 방법.
 */
export function partnerBenefitGroups(partner: Partner): {
  baseAffiliations: PartnerAffiliation[];
  affiliationEnds: Map<PartnerAffiliation, string>;
  baseAffiliationEnds: PartnerAffiliation[];
  ownUsageNote: string | null;
  baseUsageNotes: string[];
} {
  // affiliationBenefits 로 예외가 걸린 소속은 그 예외 줄 안에서 이용 방법을
  // 보여준다. 예외가 없는 소속(기본 benefit 을 그대로 쓰는 소속)의 이용
  // 방법은 기본 혜택 줄 아래에 붙인다 — 어느 쪽이든 "혜택 + 그 밑 이용
  // 방법"이 하나의 구획으로 읽히게 하고, 별도 구분선으로 떼어놓지 않는다.
  const exceptionAffiliations = new Set(
    partner.affiliationBenefits?.map((item) => item.affiliation) ?? [],
  );
  // 예외로 빠지지 않은 소속은 기본 혜택을 그대로 받는다 — 이 소속들을
  // 칩으로 보여줘야 "이 혜택이 어느 제휴처 것인지" 한눈에 보인다.
  const baseAffiliations = (partner.affiliations ?? []).filter(
    (affiliation) => !exceptionAffiliations.has(affiliation),
  );
  // 기숙사 안내는 항상 학생증 안내 다음(맨 아래)에 오도록 정렬한다 — 소속
  // 배열에서의 순서와 무관하게 "일반 방법 먼저, 기숙사 방법 나중"을 보장한다.
  // 제휴 종료일: 업체 전체 기한(endsOn)은 카드 맨 아래 한 줄로, 소속별 기한은 그 소속 혜택 줄 밑에 붙인다.
  const affiliationEnds = new Map(
    (partner.affiliationEnds ?? []).map((item) => [item.affiliation, item.endsOn]),
  );
  const baseAffiliationEnds = baseAffiliations.filter((affiliation) => affiliationEnds.has(affiliation));
  const dormUsageNote = PARTNER_AFFILIATION_USAGE_NOTES.기숙사;
  // 업체가 자기만의 이용 방법(usageNote)을 주면 소속별 기본 안내 대신 그것만 보여 준다 —
  // 학생증을 보여 주는 곳이 아닌데(예: 에버랜드는 QR코드·인증코드로 예매) "학생증 제시"가 붙으면 틀린 안내가 된다.
  const ownUsageNote = partner.usageNote?.trim() || null;
  const baseUsageNotes = ownUsageNote
    ? [ownUsageNote]
    : Array.from(
        new Set(baseAffiliations.map((affiliation) => PARTNER_AFFILIATION_USAGE_NOTES[affiliation])),
      ).sort((a, b) => (a === dormUsageNote ? 1 : b === dormUsageNote ? -1 : 0));

  return { baseAffiliations, affiliationEnds, baseAffiliationEnds, ownUsageNote, baseUsageNotes };
}
