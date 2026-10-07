import { useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity, useWindowDimensions } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { COLORS } from "../../constants/colors";
import { FONTS } from "../../constants/typography";
import {
  CAFETERIA_FACILITY_IDS,
  isCafeteriaApiMissing,
  type CafeteriaDay,
  type CafeteriaMeal,
  type CafeteriaWeek,
} from "../../apis/cafeteria";
import type { ApiResource } from "../../hooks/useApiResource";
import { formatYmdShort, ymdToDayIndex } from "../../utils/exhibitions";
import { formatCommentTime } from "../../utils/comments";
import { isSafeExternalUrl, openExternalUrl } from "../../utils/openExternalUrl";

const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];
/** 화면이 이보다 넓으면(태블릿·넓은 웹) 반찬을 두 칸으로 나눠 보여 준다. 폰은 한 칸. */
const TWO_COLUMN_MIN_WIDTH = 600;

interface CafeteriaMenuProps {
  facilityId: string;
  week: ApiResource<CafeteriaWeek> & { today: string };
}

function weekdayOf(ymd: string): number {
  const index = ymdToDayIndex(ymd);
  return index === null ? -1 : new Date(index * 86_400_000).getUTCDay();
}

/** 오늘이 목록에 있으면 오늘, 없으면(주말·데이터 없는 날) 가장 가까운 날. 거리가 같으면 뒤쪽 날을 고른다. */
function defaultDate(days: readonly CafeteriaDay[], today: string): string | null {
  if (days.length === 0) return null;
  if (days.some((d) => d.date === today)) return today;
  const t = ymdToDayIndex(today) ?? 0;
  let best = days[0];
  let bestDist = Number.POSITIVE_INFINITY;
  for (const day of days) {
    const index = ymdToDayIndex(day.date) ?? 0;
    const dist = Math.abs(index - t);
    if (dist < bestDist || (dist === bestDist && index > t)) {
      best = day;
      bestDist = dist;
    }
  }
  return best.date;
}

/**
 * 학식 식당(제2기숙사 학생식당·교직원식당) 줄 아래에 붙는 주간 메뉴. 월~금 칩으로 날을 고르고, 끼니마다 시간·가격·메뉴를 보여 준다.
 * 서버에 API 가 아직 없으면(배포 전) 아무것도 그리지 않고, 연결 실패면 "다시 시도"만 한 줄 둔다.
 */
export default function CafeteriaMenu({ facilityId, week }: CafeteriaMenuProps) {
  const [picked, setPicked] = useState<string | null>(null);
  const { width } = useWindowDimensions();
  const known = CAFETERIA_FACILITY_IDS.has(facilityId);
  const { data, loading, error, canRetry, retry, today } = week;

  if (!data) {
    if (!known) return null;
    if (loading) {
      return (
        <View style={styles.block}>
          <Text style={styles.muted}>메뉴를 불러오는 중…</Text>
        </View>
      );
    }
    if (error && !isCafeteriaApiMissing(error) && canRetry) {
      return (
        <View style={[styles.block, styles.errorRow]}>
          <Text style={styles.muted}>메뉴를 불러오지 못했어요</Text>
          <TouchableOpacity
            onPress={retry}
            accessibilityRole="button"
            accessibilityLabel="메뉴 다시 불러오기"
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Text style={styles.retryText}>다시 시도</Text>
          </TouchableOpacity>
        </View>
      );
    }
    return null;
  }

  // 이 식당이 들어 있는 날만 칩으로 보여 준다. 한 날도 없으면 학식 식당이 아니거나 서버가 아직 모르는 식당이다.
  const days = data.days.filter((d) => d.restaurants.some((r) => r.facilityId === facilityId));
  if (days.length === 0) return null;

  const fallback = defaultDate(days, today);
  const selected = days.find((d) => d.date === picked) ?? days.find((d) => d.date === fallback) ?? days[0];
  const restaurant = selected.restaurants.find((r) => r.facilityId === facilityId);
  const meals = restaurant?.meals ?? [];
  const todayDow = weekdayOf(today);
  const isWeekend = todayDow === 0 || todayDow === 6;
  const twoColumns = width >= TWO_COLUMN_MIN_WIDTH;
  const updated = selected.fetchedAt ? formatCommentTime(selected.fetchedAt) : "";
  const sourceUrl = isSafeExternalUrl(selected.sourceUrl) ? selected.sourceUrl : null;

  return (
    <View style={styles.block}>
      <Text style={styles.title} accessibilityRole="header">
        {selected.date === today ? "오늘 메뉴" : `${formatYmdShort(selected.date)} 메뉴`}
      </Text>
      {isWeekend && !picked && selected.date !== today && (
        <Text style={styles.notice}>주말에는 운영하지 않아요 · 가까운 평일 메뉴를 보여 드려요</Text>
      )}

      <View style={styles.chips} accessibilityRole="tablist">
        {days.map((day) => {
          const active = day.date === selected.date;
          const isToday = day.date === today;
          const [, month, date] = day.date.split("-");
          const label = isToday ? "오늘" : WEEKDAYS[weekdayOf(day.date)] ?? "";
          return (
            <TouchableOpacity
              key={day.date}
              style={[styles.chip, active && styles.chipActive]}
              onPress={() => setPicked(day.date)}
              accessibilityRole="tab"
              accessibilityState={{ selected: active }}
              accessibilityLabel={`${formatYmdShort(day.date)}${isToday ? " 오늘" : ""} 메뉴`}
            >
              <Text style={[styles.chipDay, active && styles.chipTextActive]}>{label}</Text>
              <Text style={[styles.chipDate, active && styles.chipTextActive]}>
                {Number(month)}/{Number(date)}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {meals.length === 0 ? (
        <Text style={styles.muted}>등록된 메뉴가 없어요</Text>
      ) : meals.every((meal) => meal.closed) ? (
        // 하루 통째로 쉬는 날(공휴일)은 끼니마다 같은 줄을 반복하지 않고 한 줄로 알린다.
        <View style={styles.meal}>
          <Text style={styles.muted}>{closedText(meals[0])}</Text>
        </View>
      ) : (
        meals.map((meal, index) => <Meal key={`${meal.meal}-${index}`} meal={meal} twoColumns={twoColumns} />)
      )}

      <View style={styles.footer}>
        <Ionicons name="information-circle-outline" size={13} color={COLORS.textTertiary} />
        <Text style={styles.footerText}>
          출처:{" "}
          {sourceUrl ? (
            <Text
              style={styles.footerLink}
              onPress={() => openExternalUrl(sourceUrl)}
              accessibilityRole="link"
            >
              {selected.source}
            </Text>
          ) : (
            selected.source
          )}
          {updated ? ` · ${updated} 업데이트` : ""}
        </Text>
      </View>
    </View>
  );
}

/** 휴무 사유(예: '한글날', '대체공휴일')만 남기고 '운영X' 같은 원문 표기는 빼서 우리 말투로 붙인다. */
function closedText(meal: CafeteriaMeal): string {
  const reason = meal.items.filter((item) => !/운영\s*X/i.test(item)).join(" ");
  return reason ? `${reason} · 운영하지 않아요` : "운영하지 않아요";
}

function Meal({ meal, twoColumns }: { meal: CafeteriaMeal; twoColumns: boolean }) {
  const meta = [meal.time, meal.price].filter(Boolean).join(" · ");

  return (
    <View
      style={styles.meal}
      accessible
      accessibilityLabel={`${meal.meal}${meta ? `, ${meta}` : ""}, ${
        meal.closed
          ? closedText(meal)
          : meal.items.length > 0
            ? meal.items.join(", ")
            : "등록된 메뉴가 없어요"
      }`}
    >
      <View style={styles.mealHeader}>
        <Text style={[styles.mealName, meal.closed && styles.closedName]}>{meal.meal}</Text>
        {meta ? <Text style={styles.mealMeta}>{meta}</Text> : null}
      </View>
      {meal.closed ? (
        <Text style={styles.muted}>{closedText(meal)}</Text>
      ) : meal.items.length === 0 ? (
        <Text style={styles.muted}>등록된 메뉴가 없어요</Text>
      ) : (
        <View style={[styles.items, twoColumns && styles.itemsTwo]}>
          {meal.items.map((item, index) => (
            <Text key={`${item}-${index}`} style={[styles.item, twoColumns && styles.itemHalf]}>
              {item}
            </Text>
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  block: { paddingHorizontal: 12, paddingBottom: 12, gap: 8, minWidth: 0 },
  errorRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  title: { fontSize: 14, fontFamily: FONTS.bold, color: COLORS.textPrimary },
  notice: { fontSize: 12.5, fontFamily: FONTS.regular, color: COLORS.textSecondary },
  muted: { fontSize: 13, fontFamily: FONTS.regular, color: COLORS.textTertiary },
  retryText: { fontSize: 13, fontFamily: FONTS.semibold, color: COLORS.primary, textDecorationLine: "underline" },
  chips: { flexDirection: "row", gap: 6, minWidth: 0 },
  // 칩·메뉴 글자가 본래 너비로 시트를 밀어내지 않게 줄어들 수 있게 둔다(minWidth: 0).
  chip: {
    flex: 1,
    minWidth: 0,
    alignItems: "center",
    paddingVertical: 6,
    borderRadius: 10,
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  chipActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  chipDay: { fontSize: 12.5, fontFamily: FONTS.semibold, color: COLORS.textPrimary },
  chipDate: { fontSize: 11, fontFamily: FONTS.regular, color: COLORS.textTertiary, fontVariant: ["tabular-nums"] },
  chipTextActive: { color: COLORS.white },
  meal: { backgroundColor: COLORS.white, borderRadius: 10, padding: 12, gap: 6, minWidth: 0 },
  mealHeader: { flexDirection: "row", alignItems: "baseline", gap: 8, flexWrap: "wrap" },
  mealName: { fontSize: 14, fontFamily: FONTS.bold, color: COLORS.primary },
  closedName: { color: COLORS.textTertiary },
  mealMeta: { flexShrink: 1, fontSize: 12, fontFamily: FONTS.regular, color: COLORS.textSecondary, fontVariant: ["tabular-nums"] },
  items: { gap: 2, minWidth: 0 },
  itemsTwo: { flexDirection: "row", flexWrap: "wrap", columnGap: 12 },
  item: { flexShrink: 1, minWidth: 0, fontSize: 13.5, lineHeight: 20, fontFamily: FONTS.regular, color: COLORS.textPrimary },
  itemHalf: { width: "47%" },
  footer: { flexDirection: "row", alignItems: "center", gap: 4 },
  footerText: { flex: 1, minWidth: 0, fontSize: 11.5, fontFamily: FONTS.regular, color: COLORS.textTertiary },
  footerLink: { textDecorationLine: "underline", color: COLORS.textSecondary },
});
