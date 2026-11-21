import { useMemo, useState } from 'react'
import { type WheelItem } from '../../../utils/common/wheelPicker'
import { DAY_MS, HOUR_MS, MINUTE_MS, SLOTS_PER_DAY, STEP_MS, HOURS, MINUTES } from '../../../utils/map/report/reportTimeSheet'
import type { ReportTimeSheetProps } from '../../../components/map/report/ReportTimeSheet'

/** SheetBody 의 상태·효과·핸들러. 화면 파일은 이 훅을 불러 그리기만 한다. */
export function useSheetBody({ baseMidnight, dayCount, dayLabel, isValid, initialMs }: Pick<ReportTimeSheetProps, 'baseMidnight' | 'dayCount' | 'dayLabel' | 'isValid' | 'initialMs'>) {
  const at = (day: number, hour: number, minute: number) =>
    baseMidnight + day * DAY_MS + hour * HOUR_MS + minute * MINUTE_MS

  /** 가장 가까운 고를 수 있는 10분 칸. 없으면 null. */
  const nearestValid = (target: number): number | null => {
    let best: number | null = null
    for (let slot = 0; slot < dayCount * SLOTS_PER_DAY; slot += 1) {
      const ms = baseMidnight + slot * STEP_MS
      if (isValid(ms) && (best === null || Math.abs(ms - target) < Math.abs(best - target))) best = ms
    }
    return best
  }

  // 10분 칸에 맞춰 시작한다. 칸에 안 맞는 값(예: 14:24)이 들어오면 분 다이얼은 목록에 24가 없어 '00분'을 보여 주는데
  // 실제 값·미리보기는 24분으로 남아, 다이얼과 고른 시각이 어긋났다(10-19 지적).
  const [draft, setDraft] = useState(() => {
    const snapped = Math.round(initialMs / STEP_MS) * STEP_MS
    return isValid(snapped) ? snapped : nearestValid(snapped) ?? snapped
  })
  const day = Math.floor((draft - baseMidnight) / DAY_MS)
  const hour = Math.floor((draft - baseMidnight - day * DAY_MS) / HOUR_MS)
  const minute = Math.round((draft % HOUR_MS) / MINUTE_MS)

  const pick = (nextDay: number, nextHour: number, nextMinute: number) => {
    const target = at(nextDay, nextHour, nextMinute)
    setDraft(isValid(target) ? target : nearestValid(target) ?? draft)
  }

  const dayItems = useMemo<WheelItem<number>[]>(
    () =>
      Array.from({ length: dayCount }, (_, index) => ({
        value: index,
        label: dayLabel(index),
        disabled: !HOURS.some((h) => MINUTES.some((m) => isValid(at(index, h, m)))),
      })),
    [baseMidnight, dayCount, dayLabel, isValid],
  )
  const hourItems: WheelItem<number>[] = HOURS.map((h) => ({
    value: h,
    label: `${h}시`,
    disabled: !MINUTES.some((m) => isValid(at(day, h, m))),
  }))
  const minuteItems: WheelItem<number>[] = MINUTES.map((m) => ({
    value: m,
    label: `${m < 10 ? '0' : ''}${m}분`,
    disabled: !isValid(at(day, hour, m)),
  }))
  return { draft, day, hour, minute, pick, dayItems, hourItems, minuteItems }
}
