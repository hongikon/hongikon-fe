import { StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { COLORS } from "../../../constants/colors";
import { FONTS } from "../../../constants/typography";
import { formatUntilYmd } from "../../../utils/exhibitions";
import { splitBulletItems } from "../../../utils/map/partnerBenefits";

/** 혜택 본문. 항목이 여럿이면(위 splitBulletItems) 한 줄씩 "- "로 나눠 보여준다. */
export function BenefitText({ text }: { text: string }) {
  const items = splitBulletItems(text);
  if (items.length === 1) return <Text style={styles.benefitText}>{text}</Text>;
  return (
    <View style={styles.bulletList}>
      {items.map((item, index) => (
        <Text key={index} style={styles.benefitText}>
          {"- "}
          {item}
        </Text>
      ))}
    </View>
  );
}

/** "12월 31일까지 제휴" 한 줄. 소속 이름을 주면 "미술대학 제휴는 12월 31일까지". 날짜가 아니면 그리지 않는다. */
export function EndsOnNote({ endsOn, affiliation, color }: { endsOn: string; affiliation?: string; color: string }) {
  const until = formatUntilYmd(endsOn);
  if (!until) return null;
  return (
    <View style={styles.usageNoteInline}>
      <Ionicons name="calendar-outline" size={11} color={color} style={styles.usageNoteIcon} />
      <Text style={styles.usageNoteInlineText}>
        <Text style={[styles.usageNoteInlineLabel, { color }]}>제휴 기간{"  "}</Text>
        {affiliation ? `${affiliation} 제휴는 ${until}` : until}
      </Text>
    </View>
  );
}

/**
 * "이용 방법" 안내. 문구가 하나면 라벨과 한 줄로 붙여 쓰던 기존 모양 그대로 두고,
 * " / "로 여럿이면(예: 기숙사 안내) 라벨을 제 줄로 떼고 그 아래 항목을 나눠 보여준다.
 */
export function UsageNote({ note, color }: { note: string; color: string }) {
  const items = splitBulletItems(note);
  return (
    <View style={styles.usageNoteInline}>
      <Ionicons name="card-outline" size={11} color={color} style={styles.usageNoteIcon} />
      {items.length === 1 ? (
        <Text style={styles.usageNoteInlineText}>
          <Text style={[styles.usageNoteInlineLabel, { color }]}>이용 방법{"  "}</Text>
          {note}
        </Text>
      ) : (
        <View style={styles.usageNoteBlock}>
          <Text style={[styles.usageNoteInlineLabel, { color }]}>이용 방법</Text>
          {items.map((item, index) => (
            <Text key={index} style={styles.usageNoteInlineText}>
              {"- "}
              {item}
            </Text>
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  benefitText: { fontFamily: FONTS.regular, fontSize: 13.5, lineHeight: 20, color: COLORS.textPrimary },
  bulletList: { gap: 2 },
  usageNoteInline: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 4,
    marginTop: 6,
  },
  // 아이콘이 라벨 텍스트(fontSize 11)의 첫 줄 가운데에 오도록 살짝 내린다.
  usageNoteIcon: { marginTop: 1 },
  usageNoteInlineLabel: {
    fontFamily: FONTS.bold,
    fontSize: 11,
  },
  usageNoteInlineText: {
    flex: 1,
    fontFamily: FONTS.regular,
    fontSize: 12,
    lineHeight: 17,
    color: COLORS.textSecondary,
  },
  // UsageNote 가 항목을 여럿(" / ")으로 쪼갤 때: 라벨 줄 + 그 아래 "- 항목" 줄들.
  usageNoteBlock: { flex: 1, gap: 2 },
});
