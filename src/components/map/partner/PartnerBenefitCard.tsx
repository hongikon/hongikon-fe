import { StyleSheet, Text, View } from "react-native";
import { PARTNER_AFFILIATION_USAGE_NOTES } from "../../../constants/partnerAffiliations";
import { RADIUS } from "../../../constants/spacing";
import { FONTS } from "../../../constants/typography";
import type { Partner } from "../../../types";
import { partnerBenefitGroups } from "../../../utils/map/partnerBenefits";
import { BenefitText, EndsOnNote, UsageNote } from "./PartnerBenefitNotes";

interface PartnerBenefitCardProps {
  partner: Partner;
  /** 기본 혜택 문구(없으면 부모가 카드를 그리지 않는다). */
  benefit: string;
  /** 업체 종류 색(카드 바탕·왼쪽 띠·칩). */
  color: string;
}

/**
 * 제휴 혜택 카드. 예외 없이 기본 혜택을 받는 소속은 칩 + 기본 혜택 + 이용 방법 + 기한으로 한 구획,
 * 소속별 예외 혜택(affiliationBenefits)은 그 아래 소속마다 한 구획, 업체 전체 기한은 맨 아래 한 줄.
 */
export default function PartnerBenefitCard({ partner, benefit, color }: PartnerBenefitCardProps) {
  const { baseAffiliations, affiliationEnds, baseAffiliationEnds, ownUsageNote, baseUsageNotes } = partnerBenefitGroups(partner);
  return (
    <View
      style={[
        styles.benefitCard,
        {
          backgroundColor: `${color}12`,
          borderLeftColor: color,
        },
      ]}
    >
      <Text style={[styles.benefitLabel, { color }]}>
        제휴 혜택
      </Text>
      {/*
        baseAffiliations 가 비면(모든 소속이 예외로 빠지면, 예: 네코노유부)
        이 기본 문구를 아무도 안 쓴다는 뜻 — 주인 없는 텍스트만 남아
        위쪽이 지저분해지므로 통째로 건너뛴다.
      */}
      {baseAffiliations.length > 0 && (
        <>
          <View style={styles.chipRow}>
            {baseAffiliations.map((affiliation) => (
              <View
                key={affiliation}
                style={[styles.sharedChip, { borderColor: color }]}
              >
                <Text style={[styles.sharedChipText, { color }]}>
                  {affiliation}
                </Text>
              </View>
            ))}
          </View>
          <BenefitText text={benefit} />
          {baseUsageNotes.map((note) => (
            <UsageNote key={note} note={note} color={color} />
          ))}
          {baseAffiliationEnds.map((affiliation) => (
            <EndsOnNote
              key={affiliation}
              endsOn={affiliationEnds.get(affiliation) ?? ""}
              // 소속이 하나뿐이면 누구 기한인지 분명하니 이름을 되풀이하지 않는다.
              affiliation={baseAffiliations.length > 1 ? affiliation : undefined}
              color={color}
            />
          ))}
        </>
      )}

      {partner.affiliationBenefits?.map((item) => {
        const note = ownUsageNote ?? PARTNER_AFFILIATION_USAGE_NOTES[item.affiliation];
        return (
          <View key={item.affiliation} style={styles.exceptionRow}>
            {/* 소속 칩은 기본 혜택 줄과 같은 모양(테두리 칩) 하나로 통일한다(10-13 요청). */}
            <View style={[styles.sharedChip, { borderColor: color }]}>
              <Text style={[styles.sharedChipText, { color }]}>
                {item.affiliation}
              </Text>
            </View>
            <BenefitText text={item.benefit} />
            <UsageNote note={note} color={color} />
            {affiliationEnds.has(item.affiliation) && (
              <EndsOnNote endsOn={affiliationEnds.get(item.affiliation) ?? ""} color={color} />
            )}
          </View>
        );
      })}
      {partner.endsOn && <EndsOnNote endsOn={partner.endsOn} color={color} />}
    </View>
  );
}

const styles = StyleSheet.create({
  benefitCard: {
    borderLeftWidth: 3,
    borderRadius: RADIUS.md,
    paddingVertical: 11,
    paddingHorizontal: 13,
    marginBottom: 12,
  },
  benefitLabel: {
    fontSize: 11,
    fontFamily: FONTS.bold,
    letterSpacing: 0.4,
    marginBottom: 4,
  },
  chipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 5,
    marginBottom: 5,
  },
  sharedChip: {
    borderWidth: 1,
    borderRadius: RADIUS.sm,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  sharedChipText: {
    fontFamily: FONTS.semibold,
    fontSize: 11,
    letterSpacing: 0.2,
  },
  exceptionRow: {
    marginTop: 9,
    paddingTop: 9,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "rgba(0,0,0,0.12)",
    gap: 5,
    alignItems: "flex-start",
  },
});
