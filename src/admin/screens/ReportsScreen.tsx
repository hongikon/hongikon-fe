import { StyleSheet, View } from 'react-native'
import { ReportCard } from '../components/reports/ReportCard'
import { ReportDayNav } from '../components/reports/ReportDayNav'
import { useAdminReports } from '../hooks/useAdminReports'
import type { AdminOverview, ReportStatusFilter } from '../types'
import { Button, EmptyState, FilterTabs, InlineError, Loading, ScreenHeader } from '../ui'
import { PERIOD_TABS, emptyReportsMessage, withFocusedFirst } from '../utils/reportReview'

export default function ReportsScreen({
  onChanged,
  overview,
  initialFilter,
  focusReportId = null,
}: {
  onChanged: () => void
  overview: AdminOverview | null
  /** 처음 열 필터(관리자 알림: 승인 대기 → PENDING, 자동 숨김 → HIDDEN). 기본 PENDING */
  initialFilter?: ReportStatusFilter
  /** 관리자 알림으로 연 제보. 목록에 있으면 맨 위로 올려 강조한다. */
  focusReportId?: number | null
}) {
  const { filter, period, day, reports, loading, error, changeFilter, changePeriod, isLatestDay, prevDay, nextDay, reload, handleUpdated } =
    useAdminReports(initialFilter, onChanged)

  const tabs = [
    { value: 'PENDING' as const, label: '승인 대기', count: overview?.reports.pending },
    { value: 'ACTIVE' as const, label: '노출 중' },
    { value: 'UPCOMING' as const, label: '예정' },
    { value: 'ENDED' as const, label: '종료' },
    { value: 'HIDDEN' as const, label: '숨김', count: overview?.reports.hidden },
    { value: 'REJECTED' as const, label: '반려' },
    { value: 'ALL' as const, label: '전체' },
  ]

  return (
    <View>
      <ScreenHeader
        title="제보 검토"
        subtitle="최신순 최대 200건. 처리한 제보는 새로고침 전까지 이 목록에 남아 있어 바로 되돌릴 수 있습니다."
        right={<Button label="새로고침" icon="refresh" onPress={reload} loading={loading && !!reports} small />}
      />
      <FilterTabs options={tabs} value={filter} onChange={changeFilter} />
      {/* 등록일 기간. '날짜 지정'이면 하루씩 ‹ › 로 넘겨 본다(오늘 이후로는 못 간다). */}
      <FilterTabs options={PERIOD_TABS} value={period} onChange={changePeriod} />
      {period === 'day' ? <ReportDayNav day={day} isLatestDay={isLatestDay} onPrev={prevDay} onNext={nextDay} /> : null}

      {error ? <InlineError message={error} onRetry={reload} style={styles.listError} /> : null}
      {!reports ? (
        loading ? <Loading /> : null
      ) : reports.length === 0 ? (
        <EmptyState message={emptyReportsMessage(period, filter)} />
      ) : (
        <View style={styles.list}>
          {withFocusedFirst(reports, focusReportId).map((report) => (
            <ReportCard
              key={report.id}
              report={report}
              filter={filter}
              onUpdated={handleUpdated}
              highlighted={report.id === focusReportId}
            />
          ))}
        </View>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  listError: { marginBottom: 12 },
  list: { gap: 12 },
})
