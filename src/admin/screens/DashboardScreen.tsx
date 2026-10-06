import { useEffect, useState, type ReactNode } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { COLORS } from '../../constants/colors'
import { FONTS } from '../../constants/typography'
import { formatDateTime, formatDuration, formatNumber, formatRelative } from '../format'
import type { AdminSection, OverviewState } from '../types'
import { ADMIN_COLORS, Badge, Button, Card, InlineError, LabelValue, Loading, ScreenHeader } from '../ui'

/** 한눈에 보는 운영 현황. 수치는 AdminApp 이 들고 있는 overview 를 그대로 쓴다. */
export default function DashboardScreen({
  overview,
  onNavigate,
}: {
  overview: OverviewState
  onNavigate: (section: AdminSection) => void
}) {
  const { data, loading, error, updatedAt, refresh } = overview
  // 상대 시각(“3분 전”)이 멈춰 보이지 않게 30초마다 다시 그린다.
  const [now, setNow] = useState(Date.now())
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 30_000)
    return () => clearInterval(timer)
  }, [])
  // 새 수치를 받은 순간 기준 시각도 맞춘다(안 그러면 방금 받은 값이 "곧"으로 보인다).
  useEffect(() => {
    if (updatedAt) setNow(Date.now())
  }, [updatedAt])

  const header = (
    <ScreenHeader
      title="대시보드"
      subtitle={updatedAt ? `마지막 갱신 ${formatClock(updatedAt)}` : undefined}
      right={<Button label="새로고침" icon="refresh" onPress={refresh} loading={loading} small />}
    />
  )

  if (!data) {
    return (
      <View>
        {header}
        {error ? <InlineError message={error} onRetry={refresh} /> : <Loading />}
      </View>
    )
  }

  const { server, reports, feedback, news, crawler } = data
  const missingRatio = news.total > 0 ? Math.round((news.missingDepartment / news.total) * 1000) / 10 : 0
  const crawlerNeverRan = !crawler.running && !crawler.lastStartedAt
  const duration = formatDuration(crawler.lastStartedAt, crawler.lastFinishedAt)

  return (
    <View>
      {header}
      {error ? <InlineError message={error} onRetry={refresh} style={styles.staleError} /> : null}

      <View style={styles.grid}>
        <Tile title="제보" onPress={() => onNavigate('reports')} actionLabel="제보 검토 →">
          <View style={styles.statRow}>
            <Stat label="승인 대기" value={reports.pending} highlight={reports.pending > 0} />
            <Stat label="노출 중" value={reports.active} />
            {/* 예정 수를 주는 서버(hongikon-be #37)부터 보인다. */}
            {typeof reports.upcoming === 'number' ? <Stat label="노출 예정" value={reports.upcoming} /> : null}
            <Stat label="숨김" value={reports.hidden} />
            <Stat label="반려" value={reports.rejected} />
          </View>
        </Tile>

        <Tile title="문의" onPress={() => onNavigate('feedback')} actionLabel="문의 보기 →">
          <View style={styles.statRow}>
            <Stat label="미처리" value={feedback.open} highlight={feedback.open > 0} />
          </View>
        </Tile>

        <Tile title="크롤러" onPress={() => onNavigate('tools')} actionLabel="운영 도구 →">
          {crawlerNeverRan ? (
            <Text style={styles.muted}>서버가 재시작된 뒤 아직 실행 기록이 없습니다.</Text>
          ) : (
            <View style={styles.stack}>
              <View style={styles.inlineRow}>
                {crawler.running ? (
                  <Badge label="실행 중" tone="info" />
                ) : crawler.lastError ? (
                  <Badge label="마지막 실행 실패" tone="danger" />
                ) : (
                  <Badge label="정상" tone="success" />
                )}
                {crawler.lastTrigger ? (
                  <Badge label={crawler.lastTrigger === 'MANUAL' ? '수동 실행' : '자동 실행'} tone="neutral" />
                ) : null}
              </View>
              <LabelValue
                label="마지막 시작"
                value={`${formatRelative(crawler.lastStartedAt, now)} · ${formatDateTime(crawler.lastStartedAt)}`}
                valueStyle={styles.smallValue}
              />
              {crawler.lastFinishedAt ? (
                <LabelValue
                  label="마지막 종료"
                  value={`${formatRelative(crawler.lastFinishedAt, now)}${duration ? ` · ${duration} 걸림` : ''}`}
                  valueStyle={styles.smallValue}
                />
              ) : null}
              {crawler.lastSavedCount !== null ? (
                <LabelValue label="새로 저장한 소식" value={`${formatNumber(crawler.lastSavedCount)}건`} valueStyle={styles.smallValue} />
              ) : null}
              {crawler.lastError ? (
                <Text selectable style={styles.errorBox}>
                  {crawler.lastError}
                </Text>
              ) : null}
            </View>
          )}
        </Tile>

        <Tile title="소식(뉴스)">
          <View style={styles.statRow}>
            <Stat label="전체" value={news.total} />
            <Stat label="학과 미지정" value={news.missingDepartment} />
          </View>
          <Text style={styles.muted}>학과 미지정 비율 {missingRatio}%</Text>
        </Tile>

        <Tile title="서버">
          <View style={styles.stack}>
            <LabelValue label="버전" value={server.version ?? '-'} valueStyle={styles.smallValue} />
            <LabelValue
              label="빌드 시각"
              value={server.buildTime ? `${formatDateTime(server.buildTime)} (${formatRelative(server.buildTime, now)})` : '-'}
              valueStyle={styles.smallValue}
            />
          </View>
        </Tile>
      </View>
    </View>
  )
}

/** 브라우저 시계 기준 `14:05:09`. 갱신 시각은 이 화면에서 잰 값이라 서버 시간대와 무관하다. */
function formatClock(ms: number): string {
  const date = new Date(ms)
  const pad = (value: number) => String(value).padStart(2, '0')
  return `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`
}

function Tile({
  title,
  children,
  onPress,
  actionLabel,
}: {
  title: string
  children: ReactNode
  onPress?: () => void
  actionLabel?: string
}) {
  return (
    <Card style={styles.tile}>
      <View style={styles.tileHeader}>
        <Text style={styles.tileTitle}>{title}</Text>
        {onPress && actionLabel ? (
          <Pressable onPress={onPress} accessibilityRole="link" hitSlop={12}>
            <Text style={styles.tileAction}>{actionLabel}</Text>
          </Pressable>
        ) : null}
      </View>
      {children}
    </Card>
  )
}

function Stat({ label, value, highlight }: { label: string; value: number; highlight?: boolean }) {
  return (
    <View style={styles.stat}>
      <Text style={[styles.statValue, highlight && styles.statValueHighlight]}>{formatNumber(value)}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  staleError: { marginBottom: 12 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 16 },
  tile: { flexGrow: 1, flexBasis: 300, gap: 12 },
  tileHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  tileTitle: { fontFamily: FONTS.semibold, fontSize: 15, color: COLORS.textPrimary },
  tileAction: { fontFamily: FONTS.medium, fontSize: 13, color: COLORS.primary },
  statRow: { flexDirection: 'row', flexWrap: 'wrap', columnGap: 18, rowGap: 12 },
  stat: { gap: 2, minWidth: 48 },
  statValue: { fontFamily: FONTS.bold, fontSize: 26, color: COLORS.textPrimary },
  statValueHighlight: { color: COLORS.danger },
  statLabel: { fontFamily: FONTS.regular, fontSize: 12, color: COLORS.textSecondary },
  stack: { gap: 10 },
  inlineRow: { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
  smallValue: { fontSize: 14, fontFamily: FONTS.medium },
  muted: { fontFamily: FONTS.regular, fontSize: 13, color: COLORS.textSecondary },
  errorBox: {
    fontFamily: 'monospace',
    fontSize: 12,
    lineHeight: 18,
    color: COLORS.danger,
    backgroundColor: ADMIN_COLORS.dangerBg,
    padding: 10,
    borderRadius: 8,
  },
})
