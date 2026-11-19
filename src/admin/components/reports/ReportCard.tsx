import { Pressable, StyleSheet, Text, View } from 'react-native'
import { COLORS } from '../../../constants/colors'
import { RADIUS } from '../../../constants/spacing'
import { FONTS } from '../../../constants/typography'
import { formatReportSchedule, parseReportDays } from '../../../utils/reportSchedule'
import { reportImageUrls } from '../../../utils/reports'
import {
  REPORT_STATUS_LABEL,
  formatDateTime,
  formatMemberRef,
  formatRange,
  formatRelative,
  parseServerDate,
  reportCategoryColor,
  reportCategoryLabel,
} from '../../format'
import { useReportActions } from '../../hooks/useReportActions'
import { ReportCommentsPanel } from '../../ReportComments'
import type { AdminReport, ReportStatus } from '../../types'
import { ADMIN_COLORS, Badge, Card, InlineError, useAdminHost, type Tone } from '../../ui'
import { ReportAuthorModeration } from '../../UserModeration'
import { belongsTo, reportLocationText, type ScreenFilter } from '../../utils/reportReview'
import { openReportOnMap } from './openReportOnMap'
import { ReportActionBar } from './ReportActionBar'
import { ReportFact } from './ReportFact'
import { ReportFlags } from './ReportFlags'
import { ReportPhotos } from './ReportPhotos'

const STATUS_TONE: Record<ReportStatus, Tone> = {
  PENDING: 'warning',
  ACTIVE: 'success',
  HIDDEN: 'neutral',
  REJECTED: 'danger',
  DELETED: 'neutral',
}

interface Props {
  report: AdminReport
  /** 지금 탭. 탭과 상태가 달라지면 '방금 처리함'으로 흐리게 남긴다. */
  filter: ScreenFilter
  onUpdated: (report: AdminReport) => void
  /** 관리자 알림으로 연 제보면 테두리로 강조한다. */
  highlighted?: boolean
}

/** 제보 검토 카드 한 장: 상태·분류 배지, 본문·사진, 장소·기간·작성자, 신고·댓글, 처리 버튼. */
export function ReportCard({ report, filter, onUpdated, highlighted = false }: Props) {
  const app = useAdminHost() === 'app'
  /** 최대 3장(등록 순서). 여러 장 기능 전 서버는 imageUrl 1장만 준다. */
  const photoUrls = reportImageUrls(report)

  const now = Date.now()
  const endsAt = parseServerDate(report.endsAt)
  const startsAt = parseServerDate(report.startsAt)
  const expired = !!endsAt && endsAt.getTime() < now
  const upcoming = !!startsAt && startsAt.getTime() > now
  /** 필터 탭과 상태가 달라졌다 = 방금 이 화면에서 처리했다. */
  const movedOut = !belongsTo(report, filter)

  const actions = useReportActions({ report, app, upcoming, onUpdated })
  const location = reportLocationText(report)

  return (
    <Card style={[styles.card, highlighted && styles.cardHighlighted, movedOut && styles.cardMoved]}>
      <View style={styles.cardTop}>
        <View style={styles.badges}>
          {/* 승인됐지만 끝나는 시각이 지난 제보는 지도에 없다 — '노출 중' 대신 '종료'로 보인다. */}
          {report.status === 'ACTIVE' && expired ? (
            <Badge label="종료" tone="neutral" />
          ) : (
            <Badge label={REPORT_STATUS_LABEL[report.status]} tone={STATUS_TONE[report.status]} />
          )}
          <View style={[styles.categoryChip, { borderColor: reportCategoryColor(report.category) }]}>
            <Text style={[styles.categoryText, { color: reportCategoryColor(report.category) }]}>
              {reportCategoryLabel(report.category, report.customCategoryLabel)}
            </Text>
          </View>
          {expired && report.status !== 'ACTIVE' ? (
            <Badge label="이미 종료됨" tone="danger" />
          ) : !expired && upcoming ? (
            <Badge label="예정 · 시작 전" tone="info" />
          ) : null}
          {movedOut ? <Badge label="방금 처리함" tone="info" /> : null}
        </View>
        <Text style={styles.meta}>#{report.id}</Text>
      </View>

      <Text style={styles.title}>{report.title}</Text>
      {report.content ? <Text style={styles.content}>{report.content}</Text> : <Text style={styles.metaItalic}>(내용 없음)</Text>}

      <ReportPhotos photoUrls={photoUrls} app={app} />

      <View style={styles.facts}>
        <ReportFact icon="location-outline" text={location || '건물 지정 없음(지도 위치)'}>
          {report.lat !== null && report.lng !== null ? (
            <Pressable onPress={() => openReportOnMap(report, app)} accessibilityRole="link" hitSlop={12}>
              <Text style={styles.link}>{app ? '지도에서 보기' : '지도에서 보기(새 창)'}</Text>
            </Pressable>
          ) : null}
        </ReportFact>
        <ReportFact
          icon={upcoming ? 'calendar-outline' : 'time-outline'}
          text={
            upcoming
              ? `예정 ${formatReportSchedule(report)} (${formatRelative(report.startsAt, now)} 시작)`
              : parseReportDays(report)
                ? formatReportSchedule(report)
                : formatRange(report.startsAt, report.endsAt)
          }
          textStyle={expired ? styles.expiredText : upcoming ? styles.upcomingText : undefined}
        />
        <ReportFact icon="person-outline" text={authorText(report)} />
        {report.authorId !== null ? <ReportAuthorModeration authorId={report.authorId} /> : null}
        <ReportFact icon="create-outline" text={`${formatDateTime(report.createdAt)} 등록 (${formatRelative(report.createdAt, now)})`} />
      </View>

      {report.reviewedAt || report.moderationNote ? (
        <View style={styles.review}>
          {report.reviewedAt ? <Text style={styles.reviewText}>관리자 검토: {formatDateTime(report.reviewedAt)}</Text> : null}
          {report.moderationNote ? <Text style={styles.reviewText}>메모/반려 사유: {report.moderationNote}</Text> : null}
        </View>
      ) : null}

      {report.flagCount > 0 ? <ReportFlags reportId={report.id} flagCount={report.flagCount} /> : null}

      {/* 댓글은 지도에 공개된 적이 있는 제보에만 달린다 — 승인 대기 제보에는 감춘다. */}
      {report.status !== 'PENDING' ? <ReportCommentsPanel reportId={report.id} /> : null}

      <ReportActionBar
        status={report.status}
        app={app}
        confirming={actions.confirming}
        pending={actions.pending}
        busy={actions.busy}
        note={actions.note}
        onChangeNote={actions.setNote}
        onCancelConfirm={() => actions.setConfirming(null)}
        onConfirmReject={actions.confirmReject}
        onConfirmDelete={() => actions.runAction('delete')}
        onActionPress={actions.onActionPress}
      />
      {actions.actionError ? <InlineError message={actions.actionError} /> : null}
    </Card>
  )
}

/**
 * 작성자: 앱에 보이는 이름 · 회원 번호(없으면 #id). 로그인 닉네임 원문은 보여 주지 않는다(개인정보 최소 처리) —
 * 필요하면 "작성자 관리" → "로그인 닉네임 보기". 예전 서버의 authorNickname 은 원문이라 쓰지 않는다.
 */
function authorText(report: AdminReport): string {
  return formatMemberRef(report.authorDisplayName, report.authorMemberCode, report.authorId)
}

const styles = StyleSheet.create({
  card: { gap: 10 },
  cardMoved: { opacity: 0.7, borderStyle: 'dashed' },
  cardHighlighted: { borderColor: COLORS.primary, borderWidth: 2 },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 },
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, flexShrink: 1 },
  categoryChip: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: RADIUS.pill, borderWidth: 1 },
  categoryText: { fontFamily: FONTS.semibold, fontSize: 12 },
  title: { fontFamily: FONTS.bold, fontSize: 17, color: COLORS.textPrimary },
  content: { fontFamily: FONTS.regular, fontSize: 14, lineHeight: 21, color: COLORS.textPrimary },
  meta: { fontFamily: FONTS.regular, fontSize: 12, color: COLORS.textSecondary },
  upcomingText: { fontFamily: FONTS.semibold, color: COLORS.primary },
  metaItalic: { fontFamily: FONTS.regular, fontSize: 13, color: COLORS.textTertiary },
  facts: { gap: 6 },
  expiredText: { color: COLORS.danger, textDecorationLine: 'line-through' },
  link: { fontFamily: FONTS.medium, fontSize: 13, color: COLORS.primary, textDecorationLine: 'underline' },
  review: { gap: 2, padding: 10, borderRadius: RADIUS.md, backgroundColor: ADMIN_COLORS.neutralBg },
  reviewText: { fontFamily: FONTS.regular, fontSize: 12, color: ADMIN_COLORS.neutralText },
})
