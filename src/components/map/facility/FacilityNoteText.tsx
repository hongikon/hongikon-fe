import type { ReactNode } from "react";
import { Linking, Platform, StyleSheet, Text, View } from "react-native";
import { COLORS } from "../../../constants/colors";
import { FONTS } from "../../../constants/typography";
import { splitFacilityNote } from "../../../utils/map/facilityNote";

/**
 * 스터디룸·세미나실 예약은 신한은행 '헤이영 캠퍼스' 앱에서만 된다(웹 예약 주소 없음, 앱 안 공간예약 화면으로 바로 가는 공개 링크도 없다).
 * 그래서 문구의 '헤이영캠퍼스 공간예약' 을 눌러 앱 스토어의 헤이영 캠퍼스 페이지를 연다 — 설치돼 있으면 스토어에서 바로 '열기'.
 */
const HEYYOUNG_IOS = "https://apps.apple.com/kr/app/id1605688685";
const HEYYOUNG_ANDROID = "https://play.google.com/store/apps/details?id=com.shinhan.heyoung";
const HEYYOUNG_RE = /(헤이영 ?캠퍼스(?: 공간예약)?)/;

function heyYoungUrl(): string {
  if (Platform.OS === "android") return HEYYOUNG_ANDROID;
  if (Platform.OS === "web" && typeof navigator !== "undefined" && /android/i.test(navigator.userAgent)) {
    return HEYYOUNG_ANDROID;
  }
  return HEYYOUNG_IOS;
}

function linkHeyYoung(line: string): ReactNode {
  const parts = line.split(HEYYOUNG_RE);
  if (parts.length === 1) return line;
  return parts.map((part, i) =>
    HEYYOUNG_RE.test(part) ? (
      <Text
        key={i}
        style={styles.noteLink}
        accessibilityRole="link"
        accessibilityHint="헤이영 캠퍼스 앱 스토어 페이지를 엽니다"
        onPress={() => void Linking.openURL(heyYoungUrl())}
      >
        {part}
      </Text>
    ) : (
      part
    ),
  );
}

export function NoteText({ note }: { note: string }) {
  const { title, lines } = splitFacilityNote(note);
  return (
    <View style={styles.noteBox}>
      <Text style={styles.note}>{title}</Text>
      {lines.map((line, i) => (
        <Text key={i} style={styles.noteLine}>
          {linkHeyYoung(line)}
        </Text>
      ))}
    </View>
  );
}


const styles = StyleSheet.create({
  noteBox: { flex: 1, gap: 3 },
  note: { fontSize: 15, lineHeight: 21, fontFamily: FONTS.semibold, color: COLORS.textPrimary },
  noteLink: { color: COLORS.primary, fontFamily: FONTS.semibold, textDecorationLine: "underline" },
  noteLine: { fontSize: 13.5, lineHeight: 20, fontFamily: FONTS.regular, color: COLORS.textSecondary },
});
