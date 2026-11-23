import { Linking, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { COLORS } from "../../../constants/colors";
import { FONTS } from "../../../constants/typography";
import type { AdminOfficeDetail } from "../../../constants/adminOffices";
import { splitFacilityNote } from "../../../utils/map/facilityNote";
import { openExternalUrl } from "../../../utils/common/openExternalUrl";

/**
 * 행정·지원 목록 줄 아래의 짧은 미리보기(10-14 요청): 주요업무 두 줄 + "담당 업무·연락처 N개 >". 줄 전체를 누르면 부서 화면(`OfficeFull`).
 */
export function OfficePreview({ detail }: { detail: AdminOfficeDetail }) {
  const summary = detail.summary?.trim();
  const count = detail.contacts?.length ?? 0;
  return (
    <View style={styles.office}>
      {summary ? (
        <Text style={styles.officeSummary} numberOfLines={2}>
          {summary}
        </Text>
      ) : null}
      <View style={styles.officeMore}>
        <Text style={styles.moreText}>{count > 0 ? `담당 업무·연락처 ${count}개` : "부서 안내 보기"}</Text>
        <Ionicons name="chevron-forward" size={14} color={COLORS.primary} />
      </View>
    </View>
  );
}

/**
 * 부서 하나의 안내 화면(시트 안). 학교 홈페이지 부서 페이지의 '주요업무' 전문, 대표 메일, '담당정보' 업무별 전화 전부.
 * 담당자 이름은 학교가 공개하지 않아 없다. 전화·메일은 누르면 바로 건다(tel:, mailto:).
 */
export function OfficeFull({ note, detail }: { note?: string; detail: AdminOfficeDetail }) {
  const { lines } = splitFacilityNote(note ?? "");
  const summary = detail.summary?.trim();
  const contacts = detail.contacts ?? [];
  const call = (phone: string) => Linking.openURL(`tel:${phone.replace(/[^0-9+]/g, "")}`).catch(() => {});
  return (
    <View style={styles.officeFull}>
      {lines.length > 0 ? (
        <View style={styles.officeInfo}>
          {lines.map((line, i) => (
            <Text key={i} style={styles.noteLine}>
              {line}
            </Text>
          ))}
        </View>
      ) : null}
      {summary ? (
        <View style={styles.officeSection}>
          <Text style={styles.sectionLabel}>주요업무</Text>
          <Text style={styles.description}>{summary}</Text>
        </View>
      ) : null}
      {detail.email ? (
        <View style={styles.officeSection}>
          <Text style={styles.sectionLabel}>대표 메일</Text>
          <TouchableOpacity
            style={styles.contactRow}
            onPress={() => Linking.openURL(`mailto:${detail.email}`).catch(() => {})}
            accessibilityRole="link"
            accessibilityLabel={`대표 메일 ${detail.email} 보내기`}
          >
            <Ionicons name="mail-outline" size={14} color={COLORS.primary} />
            <Text style={styles.contactValue}>{detail.email}</Text>
          </TouchableOpacity>
        </View>
      ) : null}
      {contacts.length > 0 ? (
        <View style={styles.officeSection}>
          <Text style={styles.sectionLabel}>{`업무별 연락처 ${contacts.length}`}</Text>
          {contacts.map((c, i) => (
            <TouchableOpacity
              key={`${c.phone}:${i}`}
              style={styles.contactRow}
              onPress={() => call(c.phone)}
              accessibilityRole="button"
              accessibilityLabel={`${c.duty} 전화 ${c.phone} 걸기`}
            >
              <Ionicons name="call-outline" size={14} color={COLORS.primary} />
              <Text style={styles.contactValue}>{c.phone}</Text>
              <Text style={styles.contactDuty}>{c.duty}</Text>
            </TouchableOpacity>
          ))}
        </View>
      ) : null}
      <Text style={styles.officeNote}>담당자 이름은 학교 홈페이지에 공개되지 않아 업무별 전화만 보여 드려요.</Text>
      <TouchableOpacity
        style={styles.linkBtn}
        onPress={() => openExternalUrl(detail.source)}
        accessibilityRole="link"
        accessibilityLabel="학교 홈페이지에서 부서 안내 보기"
      >
        <Ionicons name="open-outline" size={14} color={COLORS.primary} />
        <Text style={styles.linkText}>학교 홈페이지에서 보기</Text>
      </TouchableOpacity>
    </View>
  );
}


const styles = StyleSheet.create({
  noteLine: { fontSize: 13.5, lineHeight: 20, fontFamily: FONTS.regular, color: COLORS.textSecondary },
  office: { paddingHorizontal: 14, paddingBottom: 12, gap: 6 },
  officeSummary: { fontSize: 12.5, lineHeight: 18, fontFamily: FONTS.regular, color: COLORS.textSecondary },
  officeMore: { flexDirection: "row", alignItems: "center", gap: 2 },
  officeFull: { gap: 16, paddingBottom: 8 },
  officeInfo: { gap: 2 },
  officeSection: { gap: 6 },
  officeNote: { fontSize: 11.5, fontFamily: FONTS.regular, color: COLORS.textTertiary },
  contactRow: { flexDirection: "row", alignItems: "flex-start", gap: 6, paddingVertical: 2 },
  contactValue: { fontSize: 12.5, fontFamily: FONTS.semibold, color: COLORS.primary, fontVariant: ["tabular-nums"] },
  contactDuty: { flex: 1, fontSize: 12.5, fontFamily: FONTS.regular, color: COLORS.textSecondary, lineHeight: 18 },
  description: { marginTop: 4, fontSize: 13, lineHeight: 19, fontFamily: FONTS.regular, color: COLORS.textPrimary },
  moreText: { fontSize: 12.5, fontFamily: FONTS.semibold, color: COLORS.primary, paddingVertical: 2 },
  linkBtn: { flexDirection: "row", alignItems: "center", gap: 6, paddingTop: 6 },
  linkText: { fontSize: 13, color: COLORS.primary, fontFamily: FONTS.semibold, textDecorationLine: "underline" },
  sectionLabel: { fontSize: 12, fontFamily: FONTS.semibold, color: COLORS.textSecondary },
});
