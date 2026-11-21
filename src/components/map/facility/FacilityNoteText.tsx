import type { ReactNode } from "react";
import { Linking, StyleSheet, Text, View } from 'react-native'
import { COLORS } from "../../../constants/colors";
import { FONTS } from "../../../constants/typography";
import { splitFacilityNote } from "../../../utils/map/facilityNote";
import { heyYoungUrl } from '../../../utils/map/facility/facilityNoteText'

const HEYYOUNG_RE = /(헤이영 ?캠퍼스(?: 공간예약)?)/;

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
