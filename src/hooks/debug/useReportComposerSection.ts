import { useState } from 'react'
import { initialReportSchedule, resolveSchedule, scheduleDaysFor, type ReportSchedule } from '../../components/map/ReportScheduleFields'
import { kstDateTime } from '../../utils/map/report/reportSchedule'

/** ReportComposerSection 의 상태·효과·핸들러. 화면 파일은 이 훅을 불러 그리기만 한다. */
export function useReportComposerSection() {
  const [schedule, setSchedule] = useState<ReportSchedule>(() => {
    const base = initialReportSchedule(2)
    return {
      ...base,
      startMode: 'scheduled',
      scheduledStartMs: kstDateTime(2, 14, 0),
      endMode: 'custom',
      customEndMs: kstDateTime(4, 18, 0),
      daily: true,
    }
  })
  const [now] = useState(Date.now())
  const days = scheduleDaysFor(schedule, resolveSchedule(schedule, now))
  return { schedule, setSchedule, now, days }
}
