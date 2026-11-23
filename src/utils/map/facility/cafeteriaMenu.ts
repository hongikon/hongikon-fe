import { type CafeteriaDay, type CafeteriaMeal } from '../../../apis/cafeteria'
import { ymdToDayIndex } from '../exhibitions'

export function weekdayOf(ymd: string): number {
  const index = ymdToDayIndex(ymd);
  return index === null ? -1 : new Date(index * 86_400_000).getUTCDay();
}

/** 오늘이 목록에 있으면 오늘, 없으면(주말·데이터 없는 날) 가장 가까운 날. 거리가 같으면 뒤쪽 날을 고른다. */
export function defaultDate(days: readonly CafeteriaDay[], today: string): string | null {
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

/** 휴무 사유(예: '한글날', '대체공휴일')만 남기고 '운영X' 같은 원문 표기는 빼서 우리 말투로 붙인다. */
export function closedText(meal: CafeteriaMeal): string {
  const reason = meal.items.filter((item) => !/운영\s*X/i.test(item)).join(" ");
  return reason ? `${reason} · 운영하지 않아요` : "운영하지 않아요";
}
