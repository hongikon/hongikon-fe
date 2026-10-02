import { useCallback, useEffect, useState, type ComponentProps, type ReactNode } from 'react'
import { Image, Pressable, StyleSheet, Text, TextInput, View, type StyleProp, type TextStyle } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { getErrorMessage, isCancelledError } from '../../apis/client'
import { COLORS } from '../../constants/colors'
import { FONTS } from '../../constants/typography'
import { fetchReportFlags, fetchReports, updateReportStatus } from '../api'
import {
  FLAG_REASON_LABEL,
  REPORT_STATUS_LABEL,
  formatDateTime,
  formatRange,
  formatRelative,
  parseServerDate,
  reportCategoryColor,
  reportCategoryLabel,
} from '../format'
import { formatServerSchedule } from '../../utils/reportSchedule'
import type { AdminOverview, AdminReport, AdminReportFlag, ReportStatus, ReportStatusFilter, ReportTargetStatus } from '../types'
import { ReportAuthorModeration } from '../UserModeration'
import { ADMIN_COLORS, Badge, Button, Card, ConfirmBar, EmptyState, FilterTabs, InlineError, Loading, ScreenHeader, useAdminHost, type Tone } from '../ui'
import { confirmAction } from '../../utils/dialog'
import { openExternalUrl } from '../../utils/openExternalUrl'
import { reportImageUrls } from '../../utils/reports'
import { requestMapIntent } from '../../lib/mapIntents'
import { navigationRef } from '../../navigation/navigationRef'

/** 반려 사유 최대 길이(서버 제한과 같다). */
const NOTE_MAX_LENGTH = 200

const STATUS_TONE: Record<ReportStatus, Tone> = {
  PENDING: 'warning',
  ACTIVE: 'success',
  HIDDEN: 'neutral',
  REJECTED: 'danger',
  DELETED: 'neutral',
}

type ActionKind = 'approve' | 'reopen' | 'reject' | 'hide' | 'delete'

/** 앱 관리 탭에서 처리 전에 묻는 문구. 반려는 사유를 적은 뒤에 묻는다. */
const ACTION_CONFIRM: Record<ActionKind, { title: string; message: string; destructive?: boolean }> = {
  approve: { title: '제보를 승인할까요?', message: '승인하면 바로 지도와 목록에 보입니다.' },
  reopen: { title: '다시 공개할까요?', message: '숨겼던 제보가 다시 지도와 목록에 보입니다.' },
  reject: { title: '제보를 반려할까요?', message: '반려하면 지도와 목록에 보이지 않습니다.', destructive: true },
  hide: { title: '제보를 숨길까요?', message: '지도와 목록에서 내려갑니다. 나중에 다시 공개할 수 있습니다.', destructive: true },
  delete: { title: '제보를 삭제할까요?', message: '목록과 지도에서 사라지며 이 화면에서는 되돌릴 수 없습니다.', destructive: true },
}

const ACTION_META: Record<ActionKind, { label: string; target: ReportTargetStatus }> = {
  approve: { label: '승인', target: 'ACTIVE' },
  reopen: { label: '다시 공개', target: 'ACTIVE' },
  reject: { label: '반려', target: 'REJECTED' },
  hide: { label: '숨김', target: 'HIDDEN' },
  delete: { label: '삭제', target: 'DELETED' },
}

/** 현재 상태에서 할 수 있는 처리. 이미 그 상태로 가는 버튼은 빼고, 삭제는 항상 끝에 둔다. */
function actionsFor(status: ReportStatus): ActionKind[] {
  switch (status) {
    case 'PENDING':
      return ['approve', 'reject', 'hide', 'delete']
    case 'ACTIVE':
      return ['hide', 'reject', 'delete']
    case 'HIDDEN':
      return ['reopen', 'reject', 'delete']
    case 'REJECTED':
      return ['approve', 'delete']
    default:
      return []
  }
}

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
  const [filter, setFilter] = useState<ReportStatusFilter>(initialFilter ?? 'PENDING')
  const [reports, setReports] = useState<AdminReport[] | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    const controller = new AbortController()
    setLoading(true)
    setError(null)
    fetchReports(filter, controller.signal)
      .then((list) => setReports(list))
      .catch((err: unknown) => {
        if (isCancelledError(err)) return
        setError(getErrorMessage(err, '제보 목록을 불러오지 못했습니다.'))
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false)
      })
    return () => controller.abort()
  }, [filter, reloadKey])

  const changeFilter = (next: ReportStatusFilter) => {
    if (next === filter) return
    setReports(null)
    setFilter(next)
  }

  const handleUpdated = useCallback(
    (updated: AdminReport) => {
      setReports((prev) =>
        prev
          ? updated.status === 'DELETED'
            ? prev.filter((item) => item.id !== updated.id)
            : prev.map((item) => (item.id === updated.id ? updated : item))
          : prev,
      )
      onChanged()
    },
    [onChanged],
  )

  const tabs = [
    { value: 'PENDING' as const, label: '승인 대기', count: overview?.reports.pending },
    { value: 'ACTIVE' as const, label: '노출 중' },
    { value: 'HIDDEN' as const, label: '숨김', count: overview?.reports.hidden },
    { value: 'REJECTED' as const, label: '반려' },
    { value: 'ALL' as const, label: '전체' },
  ]

  return (
    <View>
      <ScreenHeader
        title="제보 검토"
        subtitle="최신순 최대 200건. 처리한 제보는 새로고침 전까지 이 목록에 남아 있어 바로 되돌릴 수 있습니다."
        right={<Button label="새로고침" icon="refresh" onPress={() => setReloadKey((key) => key + 1)} loading={loading && !!reports} small />}
      />
      <FilterTabs options={tabs} value={filter} onChange={changeFilter} />

      {error ? <InlineError message={error} onRetry={() => setReloadKey((key) => key + 1)} style={styles.listError} /> : null}
      {!reports ? (
        loading ? <Loading /> : null
      ) : reports.length === 0 ? (
        <EmptyState message={filter === 'PENDING' ? '승인 대기 중인 제보가 없습니다.' : '해당하는 제보가 없습니다.'} />
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

/** 알림으로 연 항목을 맨 위로(나머지 순서는 그대로). */
function withFocusedFirst<T extends { id: number }>(items: T[], focusId: number | null): T[] {
  if (focusId === null) return items
  const focused = items.find((item) => item.id === focusId)
  return focused ? [focused, ...items.filter((item) => item !== focused)] : items
}

function ReportCard({
  report,
  filter,
  onUpdated,
  highlighted = false,
}: {
  report: AdminReport
  filter: ReportStatusFilter
  onUpdated: (report: AdminReport) => void
  highlighted?: boolean
}) {
  const app = useAdminHost() === 'app'
  /** 펼친 확인 단계. 반려는 사유 입력, 삭제는 한 번 더 확인. */
  const [confirming, setConfirming] = useState<'reject' | 'delete' | null>(null)
  const [pending, setPending] = useState<ActionKind | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [note, setNote] = useState('')

  const [flagsOpen, setFlagsOpen] = useState(false)
  const [flags, setFlags] = useState<AdminReportFlag[] | null>(null)
  const [flagsLoading, setFlagsLoading] = useState(false)
  const [flagsError, setFlagsError] = useState<string | null>(null)
  /** 사진 URL 이 만료(1시간)돼 못 불러온 장. 새로고침하면 새 URL 을 받는다. */
  const [failedPhotoUrls, setFailedPhotoUrls] = useState<readonly string[]>([])
  /** 최대 3장(등록 순서). 여러 장 기능 전 서버는 imageUrl 1장만 준다. */
  const photoUrls = reportImageUrls(report)

  const now = Date.now()
  const endsAt = parseServerDate(report.endsAt)
  const startsAt = parseServerDate(report.startsAt)
  const expired = !!endsAt && endsAt.getTime() < now
  const upcoming = !!startsAt && startsAt.getTime() > now
  /** 필터 탭과 상태가 달라졌다 = 방금 이 화면에서 처리했다. */
  const movedOut = filter !== 'ALL' && report.status !== filter

  const runAction = (kind: ActionKind, noteText?: string) => {
    setPending(kind)
    setActionError(null)
    updateReportStatus(report.id, ACTION_META[kind].target, noteText)
      .then((updated) => {
        setConfirming(null)
        setNote('')
        onUpdated(updated)
      })
      .catch((err: unknown) => setActionError(getErrorMessage(err, '처리하지 못했습니다. 다시 시도해주세요.')))
      .finally(() => setPending(null))
  }

  /** 앱에서는 처리 전에 확인 창으로 한 번 묻는다(폰에서 잘못 누르기 쉽다). 웹 콘솔은 기존대로 바로 처리. */
  const confirmThenRun = (kind: ActionKind, noteText?: string) => {
    if (!app) {
      runAction(kind, noteText)
      return
    }
    const meta = ACTION_CONFIRM[kind]
    // 예정 제보는 승인해도 시작 시각이 돼야 지도에 뜬다 — 바로 보인다고 안내하지 않는다.
    const baseMessage =
      upcoming && (kind === 'approve' || kind === 'reopen')
        ? `시작 시각(${formatServerSchedule(report.startsAt, report.endsAt)})이 되면 지도와 목록에 보입니다.`
        : meta.message
    confirmAction({
      title: meta.title,
      message: noteText ? `${baseMessage}\n\n사유: ${noteText}` : baseMessage,
      confirmLabel: ACTION_META[kind].label,
      destructive: meta.destructive,
      onConfirm: () => runAction(kind, noteText),
    })
  }

  const onActionPress = (kind: ActionKind) => {
    setActionError(null)
    if (kind === 'reject' || (kind === 'delete' && !app)) {
      setConfirming(kind)
      return
    }
    confirmThenRun(kind)
  }

  const loadFlags = () => {
    setFlagsLoading(true)
    setFlagsError(null)
    fetchReportFlags(report.id)
      .then(setFlags)
      .catch((err: unknown) => setFlagsError(getErrorMessage(err, '신고 내역을 불러오지 못했습니다.')))
      .finally(() => setFlagsLoading(false))
  }

  const toggleFlags = () => {
    const next = !flagsOpen
    setFlagsOpen(next)
    if (next && !flags && !flagsLoading) loadFlags()
  }

  const openMap = () => {
    if (report.lat === null || report.lng === null) return
    if (app) {
      // 앱 관리 탭: 우리 지도 탭으로 옮겨 그 좌표에 핀을 찍는다(승인 전 제보도 확인 가능).
      requestMapIntent({ type: 'previewLocation', lat: report.lat, lng: report.lng, label: report.title })
      if (navigationRef.isReady()) navigationRef.navigate('Main', { screen: 'Map' })
      return
    }
    // 웹 /admin: 좌표 검색이 정확한 구글 지도로 연다(네이버 좌표 검색은 위치가 어긋났다).
    openExternalUrl(`https://www.google.com/maps/search/?api=1&query=${report.lat},${report.lng}`)
  }

  const location = [report.buildingName, report.floor !== null ? `${report.floor}층` : null].filter(Boolean).join(' ')
  const busy = pending !== null
  const trimmedNote = note.trim()

  return (
    <Card style={[styles.card, highlighted && styles.cardHighlighted, movedOut && styles.cardMoved]}>
      <View style={styles.cardTop}>
        <View style={styles.badges}>
          <Badge label={REPORT_STATUS_LABEL[report.status]} tone={STATUS_TONE[report.status]} />
          <View style={[styles.categoryChip, { borderColor: reportCategoryColor(report.category) }]}>
            <Text style={[styles.categoryText, { color: reportCategoryColor(report.category) }]}>
              {reportCategoryLabel(report.category, report.customCategoryLabel)}
            </Text>
          </View>
          {expired ? <Badge label="이미 종료됨" tone="danger" /> : upcoming ? <Badge label="예정 · 시작 전" tone="info" /> : null}
          {movedOut ? <Badge label="방금 처리함" tone="info" /> : null}
        </View>
        <Text style={styles.meta}>#{report.id}</Text>
      </View>

      <Text style={styles.title}>{report.title}</Text>
      {report.content ? <Text style={styles.content}>{report.content}</Text> : <Text style={styles.metaItalic}>(내용 없음)</Text>}

      {photoUrls.length > 0 ? (
        <View style={styles.photoRow}>
          {photoUrls.map((url, index) =>
            failedPhotoUrls.includes(url) ? (
              <View key={url} style={[styles.photoFailed, app ? styles.photoAppTile : styles.photoTile]}>
                <Text style={styles.metaItalic}>사진을 불러오지 못했습니다. 새로고침하면 다시 불러옵니다.</Text>
              </View>
            ) : (
              <Pressable
                key={url}
                style={app ? styles.photoAppTile : styles.photoTile}
                onPress={() => openExternalUrl(url)}
                accessibilityRole="link"
                accessibilityLabel={photoUrls.length > 1 ? `첨부 사진 ${index + 1}/${photoUrls.length} 원본 보기` : '첨부 사진 원본 보기'}
              >
                <Image
                  source={{ uri: url }}
                  style={styles.photoImage}
                  resizeMode={app ? 'cover' : 'contain'}
                  onError={() => setFailedPhotoUrls((prev) => (prev.includes(url) ? prev : [...prev, url]))}
                />
                {app ? (
                  <View style={styles.photoHint} pointerEvents="none">
                    <Ionicons name="expand-outline" size={12} color={COLORS.white} />
                    <Text style={styles.photoHintText}>{photoUrls.length > 1 ? `${index + 1}/${photoUrls.length}` : '원본'}</Text>
                  </View>
                ) : null}
              </Pressable>
            ),
          )}
        </View>
      ) : null}

      <View style={styles.facts}>
        <Fact icon="location-outline" text={location || '건물 지정 없음(지도 위치)'}>
          {report.lat !== null && report.lng !== null ? (
            <Pressable onPress={openMap} accessibilityRole="link" hitSlop={12}>
              <Text style={styles.link}>지도에서 보기 ↗</Text>
            </Pressable>
          ) : null}
        </Fact>
        <Fact
          icon={upcoming ? 'calendar-outline' : 'time-outline'}
          text={
            upcoming
              ? `예정 ${formatServerSchedule(report.startsAt, report.endsAt)} (${formatRelative(report.startsAt, now)} 시작)`
              : formatRange(report.startsAt, report.endsAt)
          }
          textStyle={expired ? styles.expiredText : upcoming ? styles.upcomingText : undefined}
        />
        <Fact icon="person-outline" text={authorText(report)} />
        {report.authorId !== null ? <ReportAuthorModeration authorId={report.authorId} /> : null}
        <Fact icon="create-outline" text={`${formatDateTime(report.createdAt)} 등록 (${formatRelative(report.createdAt, now)})`} />
      </View>

      {report.reviewedAt || report.moderationNote ? (
        <View style={styles.review}>
          {report.reviewedAt ? <Text style={styles.reviewText}>관리자 검토: {formatDateTime(report.reviewedAt)}</Text> : null}
          {report.moderationNote ? <Text style={styles.reviewText}>메모/반려 사유: {report.moderationNote}</Text> : null}
        </View>
      ) : null}

      {report.flagCount > 0 ? (
        <View>
          <Pressable onPress={toggleFlags} accessibilityRole="button" hitSlop={12} style={styles.flagToggle}>
            <Ionicons name="alert-circle-outline" size={16} color={COLORS.danger} />
            <Text style={styles.flagToggleText}>신고 {report.flagCount}건</Text>
            <Ionicons name={flagsOpen ? 'chevron-up' : 'chevron-down'} size={14} color={COLORS.danger} />
          </Pressable>
          {flagsOpen ? (
            <View style={styles.flags}>
              {flagsLoading ? <Text style={styles.meta}>불러오는 중…</Text> : null}
              {flagsError ? <InlineError message={flagsError} onRetry={loadFlags} /> : null}
              {flags?.map((flag) => (
                <View key={flag.id} style={styles.flagRow}>
                  <Badge label={FLAG_REASON_LABEL[flag.reason] ?? flag.reason} tone="danger" />
                  <Text style={styles.meta}>
                    {flag.reporterNickname ?? '익명'} · {formatDateTime(flag.createdAt)}
                  </Text>
                </View>
              ))}
              {flags && flags.length === 0 ? <Text style={styles.meta}>신고 내역이 없습니다.</Text> : null}
            </View>
          ) : null}
        </View>
      ) : null}

      {confirming === 'reject' ? (
        <ConfirmBar
          message="반려 사유를 적어주세요. 작성자에게 보일 수 있으니 짧고 정중하게 씁니다."
          confirmLabel="반려"
          danger
          busy={pending === 'reject'}
          onCancel={() => setConfirming(null)}
          onConfirm={() => {
            if (!trimmedNote) {
              setActionError('반려 사유를 입력해주세요.')
              return
            }
            confirmThenRun('reject', trimmedNote)
          }}
        >
          <TextInput
            value={note}
            onChangeText={setNote}
            placeholder="예: 캠퍼스 현장 정보가 아닌 광고입니다"
            placeholderTextColor={COLORS.textPlaceholder}
            maxLength={NOTE_MAX_LENGTH}
            style={[styles.noteInput, app && styles.noteInputApp]}
            autoFocus
            editable={!busy}
            multiline={app}
            returnKeyType="done"
            submitBehavior={app ? 'blurAndSubmit' : undefined}
            accessibilityLabel="반려 사유"
          />
          <Text style={styles.counter}>
            {note.length}/{NOTE_MAX_LENGTH}
          </Text>
        </ConfirmBar>
      ) : confirming === 'delete' ? (
        <ConfirmBar
          message="이 제보를 삭제할까요? 목록과 지도에서 사라지며 이 화면에서는 되돌릴 수 없습니다."
          confirmLabel="삭제"
          danger
          busy={pending === 'delete'}
          onCancel={() => setConfirming(null)}
          onConfirm={() => runAction('delete')}
        />
      ) : (
        <View style={[styles.actions, app && styles.actionsApp]}>
          {actionsFor(report.status).map((kind) => (
            <Button
              key={kind}
              label={ACTION_META[kind].label}
              onPress={() => onActionPress(kind)}
              loading={pending === kind}
              disabled={busy}
              variant={kind === 'approve' || kind === 'reopen' ? 'primary' : kind === 'delete' ? 'ghost' : 'secondary'}
              small
            />
          ))}
        </View>
      )}
      {actionError ? <InlineError message={actionError} /> : null}
    </Card>
  )
}

/** 작성자: 로그인 닉네임 원문, 앱에 보이는 이름이 다르면 괄호로 함께. */
function authorText(report: AdminReport): string {
  const raw = report.authorNickname ?? (report.authorId !== null ? `사용자 #${report.authorId}` : '알 수 없음')
  const shown = report.authorDisplayName
  return shown && shown !== report.authorNickname ? `${raw} (앱 표시: ${shown})` : raw
}

function Fact({
  icon,
  text,
  textStyle,
  children,
}: {
  icon: ComponentProps<typeof Ionicons>['name']
  text: string
  textStyle?: StyleProp<TextStyle>
  children?: ReactNode
}) {
  return (
    <View style={styles.fact}>
      <Ionicons name={icon} size={15} color={COLORS.textSecondary} />
      <Text style={[styles.factText, textStyle]}>{text}</Text>
      {children}
    </View>
  )
}

const styles = StyleSheet.create({
  listError: { marginBottom: 12 },
  list: { gap: 12 },
  card: { gap: 10 },
  cardMoved: { opacity: 0.7, borderStyle: 'dashed' },
  cardHighlighted: { borderColor: COLORS.primary, borderWidth: 2 },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 },
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, flexShrink: 1 },
  categoryChip: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999, borderWidth: 1 },
  categoryText: { fontFamily: FONTS.semibold, fontSize: 12 },
  title: { fontFamily: FONTS.bold, fontSize: 17, color: COLORS.textPrimary },
  content: { fontFamily: FONTS.regular, fontSize: 14, lineHeight: 21, color: COLORS.textPrimary },
  // 웹 콘솔은 원본 비율 그대로(contain) 나란히, 앱은 같은 폭 타일(cover)로 나눈다.
  photoRow: { flexDirection: 'row', gap: 8 },
  // 좁은 화면에서도 한 줄에 나란히(줄어듦), 넓으면 장당 240 까지.
  photoTile: { flex: 1, minWidth: 0, maxWidth: 240, height: 200, borderRadius: 8, overflow: 'hidden', backgroundColor: '#F2F2F2' },
  photoAppTile: { flex: 1, height: 140, borderRadius: 8, overflow: 'hidden', backgroundColor: '#F2F2F2' },
  photoImage: { width: '100%', height: '100%' },
  photoFailed: { justifyContent: 'center', padding: 8 },
  photoHint: {
    position: 'absolute',
    right: 8,
    bottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 999,
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  photoHintText: { fontFamily: FONTS.medium, fontSize: 11, color: COLORS.white },
  meta: { fontFamily: FONTS.regular, fontSize: 12, color: COLORS.textSecondary },
  upcomingText: { fontFamily: FONTS.semibold, color: COLORS.primary },
  metaItalic: { fontFamily: FONTS.regular, fontSize: 13, color: COLORS.textTertiary },
  facts: { gap: 6 },
  fact: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  factText: { fontFamily: FONTS.regular, fontSize: 13, color: COLORS.chipText, flexShrink: 1 },
  expiredText: { color: COLORS.danger, textDecorationLine: 'line-through' },
  link: { fontFamily: FONTS.medium, fontSize: 13, color: COLORS.primary, textDecorationLine: 'underline' },
  review: { gap: 2, padding: 10, borderRadius: 8, backgroundColor: ADMIN_COLORS.neutralBg },
  reviewText: { fontFamily: FONTS.regular, fontSize: 12, color: ADMIN_COLORS.neutralText },
  flagToggle: { flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start', paddingVertical: 2 },
  flagToggleText: { fontFamily: FONTS.semibold, fontSize: 13, color: COLORS.danger },
  flags: { gap: 6, marginTop: 6, paddingLeft: 20 },
  flagRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'flex-end', marginTop: 4 },
  actionsApp: { justifyContent: 'flex-start' },
  noteInput: {
    fontFamily: FONTS.regular,
    fontSize: 14,
    color: COLORS.textPrimary,
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: '#D4D4D8',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  noteInputApp: { minHeight: 72, fontSize: 15, textAlignVertical: 'top', paddingVertical: 10 },
  counter: { fontFamily: FONTS.regular, fontSize: 11, color: COLORS.textSecondary, textAlign: 'right' },
})
