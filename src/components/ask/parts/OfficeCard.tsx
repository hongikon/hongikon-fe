import { StyleSheet, Text, View } from "react-native";
import { COLORS } from "../../../constants/colors";
import { FONTS } from "../../../constants/typography";
import { RADIUS } from "../../../constants/spacing";
import type { OfficeAskResult } from "../../../utils/ask/officeAsk";
import { LinkButton, PhoneRow } from "./ContactButtons";

/** 담당 부서 카드 — 이름·위치, 업무별 전화, 부서 안내 한 줄, 학교 홈페이지 부서 안내 링크. */
export default function OfficeCard({ office, appMode }: { office: OfficeAskResult; appMode: boolean }) {
  return (
    <View style={styles.card}>
      <View style={styles.cardTitle}>
        <Text style={styles.name} numberOfLines={1}>{office.name}</Text>
        <Text style={styles.place} numberOfLines={1}>{office.place}</Text>
      </View>
      {office.contacts.map((contact, index) => (
        <PhoneRow key={`${contact.phone}-${index}`} label={contact.duty} phone={contact.phone} />
      ))}
      {office.snippet ? <Text style={styles.snippet} numberOfLines={3}>{office.snippet}</Text> : null}
      <LinkButton link={{ label: "학교 홈페이지 · 부서 안내", url: office.source }} appMode={appMode} />
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: RADIUS.lg, backgroundColor: COLORS.fill, padding: 12, gap: 8 },
  cardTitle: { gap: 2 },
  name: { fontSize: 15, fontFamily: FONTS.bold, color: COLORS.textPrimary },
  place: { fontSize: 12, fontFamily: FONTS.regular, color: COLORS.textTertiary },
  snippet: { fontSize: 12, lineHeight: 17, fontFamily: FONTS.regular, color: COLORS.textTertiary },
});
