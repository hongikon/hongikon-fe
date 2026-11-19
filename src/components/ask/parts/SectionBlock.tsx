import { StyleSheet, Text, View } from "react-native";
import { COLORS } from "../../../constants/colors";
import { FONTS } from "../../../constants/typography";
import { RADIUS } from "../../../constants/spacing";
import type { AskSection } from "../../../constants/askAnswers";
import { splitItemLabel } from "../../../utils/ask/replyText";

/** '라벨: 내용' 항목은 라벨을 굵게(서버 답이 '- 자격·조건: …'처럼 쓴다). */
function itemLabel(itemText: string) {
  const match = splitItemLabel(itemText);
  return match ? (
    <>
      <Text style={styles.itemLabel}>{match[0]}: </Text>
      {match[1]}
    </>
  ) : (
    itemText
  );
}

/** 답의 소제목 한 덩어리 — 표(색 테두리 칸 포함)와 항목 목록(번호·점). */
export default function SectionBlock({ section, appMode }: { section: AskSection; appMode: boolean }) {
  return (
    <View style={appMode ? styles.sectionApp : styles.section}>
      {section.title ? <Text style={appMode ? styles.sectionTitleApp : styles.sectionTitle}>{section.title}</Text> : null}
      {section.table ? (
        <View style={styles.table}>
          {[section.table.head, ...section.table.rows].map((row, rowIndex) => (
            <View key={rowIndex} style={[styles.tableRow, rowIndex === 0 && styles.tableHead]}>
              {row.map((cell, cellIndex) => {
                const ring = section.table?.colors?.[cellIndex];
                if (ring && cell) {
                  const color = COLORS.gradeTurn[ring];
                  return (
                    <View key={cellIndex} style={[styles.tableRingCell, cellIndex === 0 && styles.tableFirst]}>
                      <View style={[styles.tableRing, { borderColor: color }]}>
                        <Text style={[styles.tableRingText, { color }]}>{cell}</Text>
                      </View>
                    </View>
                  );
                }
                return (
                  <Text
                    key={cellIndex}
                    style={[styles.tableCell, rowIndex === 0 && styles.tableHeadText, cellIndex === 0 && styles.tableFirst]}
                  >
                    {cell}
                  </Text>
                );
              })}
            </View>
          ))}
        </View>
      ) : null}
      {section.items?.map((itemText, index) => (
        <View key={index} style={styles.itemRow}>
          <Text style={[styles.itemMark, section.ordered && styles.itemNumber]}>{section.ordered ? `${index + 1}` : "•"}</Text>
          <Text style={styles.itemText}>{itemLabel(itemText)}</Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  sectionApp: { gap: 6, paddingTop: 2 },
  sectionTitleApp: { fontSize: 15, lineHeight: 22, fontFamily: FONTS.bold, color: COLORS.textPrimary },
  section: { gap: 6, paddingTop: 10, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: COLORS.border },
  sectionTitle: { fontSize: 13, fontFamily: FONTS.bold, color: COLORS.primary },
  itemRow: { flexDirection: "row", gap: 8 },
  itemMark: { width: 14, fontSize: 14, lineHeight: 21, fontFamily: FONTS.bold, color: COLORS.textTertiary, textAlign: "center" },
  itemNumber: { color: COLORS.primary },
  itemText: { flex: 1, fontSize: 14, lineHeight: 21, fontFamily: FONTS.regular, color: COLORS.textPrimary },
  // 표는 말풍선 폭 안에서 칸을 고르게 나눈다(첫 칸만 조금 넓게). 좁은 화면에선 칸 안에서 줄을 바꾼다.
  table: { borderRadius: RADIUS.md, borderWidth: StyleSheet.hairlineWidth, borderColor: COLORS.border, overflow: "hidden" },
  tableRow: { flexDirection: "row", borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: COLORS.border },
  tableHead: { borderTopWidth: 0, backgroundColor: COLORS.fill },
  tableCell: { flex: 1, paddingHorizontal: 6, paddingVertical: 7, fontSize: 12, lineHeight: 16, fontFamily: FONTS.regular, color: COLORS.textPrimary },
  tableFirst: { flex: 1.3 },
  tableHeadText: { fontFamily: FONTS.semibold, color: COLORS.textSecondary },
  tableRingCell: { flex: 1, alignItems: "center", justifyContent: "center", paddingVertical: 5, paddingHorizontal: 2 },
  tableRing: { minWidth: 26, paddingHorizontal: 5, paddingVertical: 1, borderRadius: 999, borderWidth: 1.5, alignItems: "center" },
  tableRingText: { fontSize: 12, lineHeight: 16, fontFamily: FONTS.semibold },
  itemLabel: { fontFamily: FONTS.semibold, color: COLORS.textPrimary },
});
