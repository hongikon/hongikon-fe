import { useState } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { COLORS } from "../../../constants/colors";
import { RADIUS } from "../../../constants/spacing";
import { FONTS } from "../../../constants/typography";
import type { Exhibition } from "../../../types";
import {
  daysUntilStart,
  dDayLabel,
  exhibitionsForVenue,
  formatExhibitionPeriod,
  kstTodayIndex,
} from "../../../utils/exhibitions";
import { isSafeExternalUrl, openExternalUrl } from "../../../utils/openExternalUrl";

/** 설명이 이보다 길거나 줄바꿈이 있으면 두 줄로 줄이고 "자세히 보기"를 단다. */
const DESCRIPTION_FOLD_CHARS = 60;

/** 전시장 한 곳의 "지금 전시"와 "다음 전시"(최대 2개). 아무것도 없으면 한 줄 안내. */
export function VenueExhibitions({ facilityId, exhibitions }: { facilityId: string; exhibitions: readonly Exhibition[] }) {
  const now = Date.now();
  const today = kstTodayIndex(now);
  const { current, upcoming } = exhibitionsForVenue(exhibitions, facilityId, now);

  return (
    <View style={styles.exhibitions}>
      {current.length > 0 ? (
        current.map((exhibition) => <CurrentExhibition key={exhibition.id} exhibition={exhibition} />)
      ) : (
        <Text style={styles.emptyText}>지금 진행 중인 전시 정보가 없어요</Text>
      )}
      {upcoming.length > 0 && (
        <View style={styles.upcoming}>
          <Text style={styles.sectionLabel}>다음 전시</Text>
          {upcoming.map((exhibition) => {
            const dday = dDayLabel(daysUntilStart(exhibition, today));
            return (
              <View
                key={exhibition.id}
                style={styles.upcomingRow}
                accessible
                accessibilityLabel={`다음 전시 ${exhibition.title}, ${formatExhibitionPeriod(exhibition)}, ${dday}`}
              >
                <View style={styles.dday}>
                  <Text style={styles.ddayText}>{dday}</Text>
                </View>
                <View style={styles.upcomingBody}>
                  <Text style={styles.upcomingTitle} numberOfLines={1}>
                    {exhibition.title}
                  </Text>
                  <Text style={styles.metaText}>{formatExhibitionPeriod(exhibition)}</Text>
                </View>
              </View>
            );
          })}
        </View>
      )}
    </View>
  );
}

function CurrentExhibition({ exhibition }: { exhibition: Exhibition }) {
  const [expanded, setExpanded] = useState(false);
  const description = exhibition.description?.trim();
  const foldable = !!description && (description.length > DESCRIPTION_FOLD_CHARS || description.includes("\n"));
  const link = exhibition.link && isSafeExternalUrl(exhibition.link.url) ? exhibition.link : null;

  return (
    <View style={styles.current}>
      <View style={styles.currentHeader}>
        <View style={styles.nowBadge}>
          <Text style={styles.nowBadgeText}>지금 전시</Text>
        </View>
      </View>
      <Text style={styles.currentTitle}>{exhibition.title}</Text>
      <View style={styles.metaRow}>
        <Ionicons name="calendar-outline" size={13} color={COLORS.textTertiary} />
        <Text style={styles.metaText}>{formatExhibitionPeriod(exhibition)}</Text>
      </View>
      {exhibition.hours ? (
        <View style={styles.metaRow}>
          <Ionicons name="time-outline" size={13} color={COLORS.textTertiary} />
          <Text style={styles.metaText}>{exhibition.hours}</Text>
        </View>
      ) : null}
      {description ? (
        <>
          <Text style={styles.description} numberOfLines={foldable && !expanded ? 2 : undefined}>
            {description}
          </Text>
          {foldable && (
            <TouchableOpacity
              onPress={() => setExpanded((prev) => !prev)}
              accessibilityRole="button"
              accessibilityState={{ expanded }}
              hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
            >
              <Text style={styles.moreText}>{expanded ? "접기" : "자세히 보기"}</Text>
            </TouchableOpacity>
          )}
        </>
      ) : null}
      {link && (
        <TouchableOpacity
          style={styles.linkBtn}
          onPress={() => openExternalUrl(link.url)}
          accessibilityRole="link"
          accessibilityLabel={`${exhibition.title} ${link.label || "전시 안내"}`}
        >
          <Ionicons name="open-outline" size={14} color={COLORS.primary} />
          <Text style={styles.linkText}>{link.label || "전시 안내"}</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}


const styles = StyleSheet.create({
  exhibitions: { paddingHorizontal: 12, paddingBottom: 12, gap: 10 },
  emptyText: { fontSize: 13, fontFamily: FONTS.regular, color: COLORS.textTertiary },
  current: {
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.md,
    padding: 12,
    gap: 4,
  },
  currentHeader: { flexDirection: "row", marginBottom: 2 },
  nowBadge: {
    backgroundColor: COLORS.primary,
    borderRadius: RADIUS.sm,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  nowBadgeText: { fontSize: 11, fontFamily: FONTS.semibold, color: COLORS.white },
  currentTitle: { fontSize: 15, fontFamily: FONTS.bold, color: COLORS.textPrimary },
  metaRow: { flexDirection: "row", alignItems: "center", gap: 5 },
  metaText: { fontSize: 12.5, fontFamily: FONTS.regular, color: COLORS.textSecondary, fontVariant: ["tabular-nums"] },
  description: { marginTop: 4, fontSize: 13, lineHeight: 19, fontFamily: FONTS.regular, color: COLORS.textPrimary },
  moreText: { fontSize: 12.5, fontFamily: FONTS.semibold, color: COLORS.primary, paddingVertical: 2 },
  linkBtn: { flexDirection: "row", alignItems: "center", gap: 6, paddingTop: 6 },
  linkText: { fontSize: 13, color: COLORS.primary, fontFamily: FONTS.semibold, textDecorationLine: "underline" },
  upcoming: { gap: 6 },
  sectionLabel: { fontSize: 12, fontFamily: FONTS.semibold, color: COLORS.textSecondary },
  upcomingRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  dday: {
    minWidth: 44,
    alignItems: "center",
    borderRadius: RADIUS.sm,
    paddingHorizontal: 6,
    paddingVertical: 3,
    backgroundColor: COLORS.primarySoft,
  },
  ddayText: { fontSize: 11.5, fontFamily: FONTS.bold, color: COLORS.primary, fontVariant: ["tabular-nums"] },
  upcomingBody: { flex: 1 },
  upcomingTitle: { fontSize: 13.5, fontFamily: FONTS.semibold, color: COLORS.textPrimary },
});
