import { memo, useCallback, useEffect, useRef, useState } from 'react'
import {
  ActivityIndicator,
  FlatList,
  Image,
  Modal,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { COLORS } from '../../constants/colors'
import { TYPE } from '../../constants/typography'
import { RADIUS, SPACING } from '../../constants/spacing'
import { REPORT_CATEGORIES } from '../../constants/reportCategories'
import { useAuth } from '../../contexts/AuthContext'
import { deleteReport } from '../../apis/reports'
import { ApiError, getErrorMessage, isCancelledError, isNetworkError, isRetryableError } from '../../apis/client'
import {
  getMyReports,
  isMyReportsApiKnownMissing,
  isMyReportsApiMissing,
  type MyReport,
} from '../../apis/myReports'
import { formatDateTime } from '../../admin/format'
import { formatServerSchedule, isUpcomingReport } from '../../utils/reportSchedule'
import { formatFloor } from '../../utils/floors'
import { reportImageUrls } from '../../utils/reports'
import { mergeReportPages, resolveDisplayStatus, STATUS_META } from '../../utils/myReports'
import { confirmAction } from '../../utils/dialog'
import ModalHeader from './ModalHeader'
import ContentColumn from '../common/ContentColumn'
import Button from '../common/Button'
import EmptyState from '../common/EmptyState'
import RetryableError from '../common/RetryableError'
import { SkeletonBlock, SkeletonGroup } from '../common/Skeleton'
import { useToast } from '../common/Toast'

interface MyReportsModalProps {
  visible: boolean
  onClose: () => void
  /** 반려 알림으로 들어왔을 때 강조할 제보 */
  highlightReportId?: number | null
  /** 지도에 표시 중인 제보를 눌렀을 때 — 창을 닫고 지도에서 그 제보를 띄운다 */
  onShowOnMap: (reportId: number) => void
  /** 빈 화면의 "지도로 가서 제보하기" */
  onStartReport: () => void
  /** 목록이 바뀌었을 때(새로 불러옴·삭제) — 설정 줄의 승인 대기 배지를 맞춘다 */
  onChanged?: () => void
}

const CATEGORY_BY_KEY = new Map(REPORT_CATEGORIES.map((meta) => [meta.key, meta]))

function categoryLabel(report: MyReport): string {
  if (report.category === 'ETC' && report.customCategoryLabel) return report.customCategoryLabel
  return CATEGORY_BY_KEY.get(report.category)?.label ?? '기타'
}

function placeLabel(report: MyReport): string | null {
  const parts = [report.buildingName, report.floor !== null && report.floor !== undefined ? formatFloor(report.floor) : null]
  const text = parts.filter(Boolean).join(' ')
  return text || null
}

type LoadState =
  | { kind: 'loading' }
  | { kind: 'ready' }
  | { kind: 'error'; message: string; retryable: boolean; network: boolean }
  | { kind: 'missing' }

/**
 * 설정 > 계정 > 내 제보 내역. 내가 올린 제보와 검토 결과(승인 대기·지도 표시·반려 사유·숨김·종료·삭제됨)를
 * 최신순으로 보여 준다. 당겨서 새로고침, 끝까지 내리면 다음 페이지. 서버에 API 가 없으면(배포 전) "준비 중" 안내.
 */
export default function MyReportsModal({
  visible,
  onClose,
  highlightReportId = null,
  onShowOnMap,
  onStartReport,
  onChanged,
}: MyReportsModalProps) {
  const { accessToken } = useAuth()
  const toast = useToast()
  const [items, setItems] = useState<MyReport[]>([])
  const [state, setState] = useState<LoadState>({ kind: 'loading' })
  const [refreshing, setRefreshing] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [deletingId, setDeletingId] = useState<number | null>(null)
  const pageRef = useRef(0)
  const hasNextRef = useRef(false)
  const controllerRef = useRef<AbortController | null>(null)
  // 토큰은 ref 로 읽는다 — 401 → 재발급으로 토큰이 바뀔 때마다 처음부터 다시 부르지 않게(재요청은 client 가 한다).
  const tokenRef = useRef(accessToken)
  tokenRef.current = accessToken
  const onChangedRef = useRef(onChanged)
  onChangedRef.current = onChanged

  const load = useCallback(async (page: number, mode: 'initial' | 'refresh' | 'more') => {
    const token = tokenRef.current
    if (!token) return
    if (isMyReportsApiKnownMissing()) {
      setState({ kind: 'missing' })
      return
    }
    if (mode !== 'more') controllerRef.current?.abort()
    const controller = new AbortController()
    controllerRef.current = controller
    if (mode === 'initial') setState({ kind: 'loading' })
    if (mode === 'refresh') setRefreshing(true)
    if (mode === 'more') setLoadingMore(true)
    try {
      const result = await getMyReports(page, token, controller.signal)
      if (controller.signal.aborted) return
      const content = Array.isArray(result?.content) ? result.content : []
      setItems((prev) => (page === 0 ? content : mergeReportPages(prev, content)))
      pageRef.current = page
      hasNextRef.current = !!result?.hasNext
      setState({ kind: 'ready' })
      if (page === 0) onChangedRef.current?.()
    } catch (error) {
      if (controller.signal.aborted || isCancelledError(error)) return
      if (isMyReportsApiMissing(error)) {
        setState({ kind: 'missing' })
      } else if (mode === 'more') {
        toast.show({ message: '다음 제보를 불러오지 못했어요. 잠시 뒤 다시 내려 주세요.', tone: 'info' })
      } else if (mode === 'refresh') {
        toast.show({ message: getErrorMessage(error, '새로 불러오지 못했어요.'), tone: 'info' })
      } else {
        setState({
          kind: 'error',
          message: getErrorMessage(error, '내 제보를 불러오지 못했어요. 잠시 뒤 다시 시도해 주세요.'),
          retryable: isRetryableError(error),
          network: isNetworkError(error),
        })
      }
    } finally {
      if (mode === 'refresh') setRefreshing(false)
      if (mode === 'more') setLoadingMore(false)
    }
  }, [toast])

  // 열 때마다 처음부터 새로 받는다(검토 결과가 그사이 바뀌었을 수 있다).
  useEffect(() => {
    if (!visible) {
      controllerRef.current?.abort()
      return
    }
    setItems([])
    hasNextRef.current = false
    void load(0, 'initial')
  }, [visible, load])

  const handleEndReached = () => {
    if (state.kind !== 'ready' || loadingMore || refreshing || !hasNextRef.current) return
    void load(pageRef.current + 1, 'more')
  }

  const handleDelete = useCallback((report: MyReport) => {
    const status = resolveDisplayStatus(report)
    confirmAction({
      title: '제보 삭제',
      message:
        status === 'ACTIVE' || status === 'SCHEDULED'
          ? '지도에서도 내려가고 되돌릴 수 없어요. 삭제할까요?'
          : status === 'PENDING'
            ? '승인 대기 중인 제보를 취소하고 지워요. 되돌릴 수 없어요.'
            : '내역에서 지우면 되돌릴 수 없어요. 삭제할까요?',
      confirmLabel: '삭제',
      destructive: true,
      onConfirm: async () => {
        const token = tokenRef.current
        if (!token) return
        setDeletingId(report.id)
        try {
          await deleteReport(report.id, token)
          setItems((prev) => prev.filter((r) => r.id !== report.id))
          toast.show({ message: '제보를 삭제했어요' })
          onChangedRef.current?.()
        } catch (error) {
          const conflict = error instanceof ApiError && error.status === 409
          toast.show({
            message: conflict
              ? '신고로 검토 중인 제보는 운영진 검토가 끝난 뒤에 지울 수 있어요.'
              : getErrorMessage(error, '삭제하지 못했어요. 잠시 뒤 다시 시도해 주세요.'),
            tone: 'warning',
          })
        } finally {
          setDeletingId(null)
        }
      },
    })
  }, [toast])

  const renderBody = () => {
    if (state.kind === 'loading') return <ListSkeleton />
    if (state.kind === 'missing') {
      return (
        <EmptyState
          icon="construct-outline"
          message="내 제보 내역은 곧 볼 수 있어요"
          description="서버 업데이트 후에 열려요. 검토 결과는 알림으로 먼저 알려 드려요."
          style={styles.empty}
        />
      )
    }
    if (state.kind === 'error') {
      return (
        <RetryableError
          message={state.message}
          isNetworkError={state.network}
          onRetry={state.retryable ? () => void load(0, 'initial') : undefined}
          style={styles.error}
        />
      )
    }
    return (
      <FlatList
        data={items}
        keyExtractor={(item) => String(item.id)}
        renderItem={({ item }) => (
          <MyReportCard
            report={item}
            highlighted={item.id === highlightReportId}
            deleting={deletingId === item.id}
            onShowOnMap={onShowOnMap}
            onDelete={handleDelete}
          />
        )}
        contentContainerStyle={items.length === 0 ? styles.listEmpty : styles.list}
        ItemSeparatorComponent={Separator}
        onEndReached={handleEndReached}
        onEndReachedThreshold={0.4}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => void load(0, 'refresh')} tintColor={COLORS.textTertiary} />
        }
        ListHeaderComponent={
          items.length > 0 ? (
            <Text style={styles.intro}>운영진 검토 결과는 알림으로도 알려 드려요. 반려된 제보는 사유를 확인할 수 있어요.</Text>
          ) : null
        }
        ListEmptyComponent={
          <EmptyState
            icon="megaphone-outline"
            message="아직 올린 제보가 없어요"
            description="캠퍼스에서 벌어지는 행사·공연·부스를 지도에 알려 주세요"
            action={
              <Button label="지도로 가서 제보하기" size="md" fullWidth={false} icon="map-outline" onPress={onStartReport} />
            }
          />
        }
        ListFooterComponent={
          loadingMore ? <ActivityIndicator style={styles.footerSpinner} color={COLORS.textTertiary} /> : null
        }
      />
    )
  }

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      {/* Modal 은 별도 화면으로 떠서 바깥 SafeAreaProvider 의 inset 이 맞지 않는다(노치·홈 인디케이터와 겹침). */}
      <SafeAreaProvider>
        <SafeAreaView style={styles.container} edges={['top']}>
          <ContentColumn>
            <ModalHeader title="내 제보 내역" onClose={onClose} />
            <View style={styles.body}>{renderBody()}</View>
          </ContentColumn>
        </SafeAreaView>
      </SafeAreaProvider>
    </Modal>
  )
}

function Separator() {
  return <View style={styles.separator} />
}

function ListSkeleton() {
  return (
    <SkeletonGroup style={styles.list} accessibilityLabel="내 제보 불러오는 중">
      {[0, 1, 2].map((i) => (
        <View key={i} style={[styles.card, i > 0 && styles.skeletonGap]}>
          <SkeletonBlock width={88} height={22} radius={RADIUS.pill} />
          <SkeletonBlock width="70%" height={16} style={styles.skeletonLine} />
          <SkeletonBlock width="50%" height={12} style={styles.skeletonLine} />
          <SkeletonBlock width="60%" height={12} style={styles.skeletonLine} />
        </View>
      ))}
    </SkeletonGroup>
  )
}

interface MyReportCardProps {
  report: MyReport
  highlighted: boolean
  deleting: boolean
  onShowOnMap: (reportId: number) => void
  onDelete: (report: MyReport) => void
}

const MyReportCard = memo(function MyReportCard({ report, highlighted, deleting, onShowOnMap, onDelete }: MyReportCardProps) {
  const status = resolveDisplayStatus(report)
  // 승인 대기·승인된 제보 중 아직 시작 전인 것(끝난·반려된 제보엔 붙이지 않는다).
  const upcoming = (status === 'PENDING' || status === 'SCHEDULED') && isUpcomingReport(report)
  const meta = STATUS_META[status]
  const category = CATEGORY_BY_KEY.get(report.category)
  const place = placeLabel(report)
  const photos = reportImageUrls(report)
  const [failedPhotos, setFailedPhotos] = useState<ReadonlySet<string>>(new Set())
  const visiblePhotos = photos.filter((url) => !failedPhotos.has(url))
  const onMap = status === 'ACTIVE'
  const note = report.moderationNote?.trim()
  const showNote = !!note && (status === 'REJECTED' || status === 'HIDDEN')

  const content = (
    <>
      <View style={styles.cardTop}>
        <View style={[styles.statusPill, { backgroundColor: meta.bg }]}>
          <Ionicons name={meta.icon} size={13} color={meta.fg} />
          <Text style={[styles.statusText, { color: meta.fg }]}>{meta.label}</Text>
        </View>
        <Text style={styles.createdAt}>{formatDateTime(report.createdAt).slice(0, 10)} 등록</Text>
      </View>

      <Text style={styles.title} numberOfLines={2}>
        {report.title}
      </Text>

      <View style={styles.metaRow}>
        <View style={[styles.categoryChip, { borderColor: category?.color ?? COLORS.chipBorder }]}>
          <Ionicons name={category?.icon ?? 'ellipsis-horizontal'} size={12} color={category?.color ?? COLORS.chipText} />
          <Text style={[styles.categoryText, { color: category?.color ?? COLORS.chipText }]} numberOfLines={1}>
            {categoryLabel(report)}
          </Text>
        </View>
        {place && (
          <View style={styles.metaItem}>
            <Ionicons name="location-outline" size={13} color={COLORS.textTertiary} />
            <Text style={styles.metaText} numberOfLines={1}>
              {place}
            </Text>
          </View>
        )}
      </View>
      <View style={styles.metaItem}>
        <Ionicons name={upcoming ? 'calendar-outline' : 'time-outline'} size={13} color={COLORS.textTertiary} />
        {/* 지도·시트와 같은 형식(여러 날이면 끝 날짜도). 시작 전이면 '예정'을 붙인다. */}
        <Text style={styles.metaText}>
          {upcoming ? '예정 · ' : ''}
          {formatServerSchedule(report.startsAt, report.endsAt)}
        </Text>
      </View>

      {visiblePhotos.length > 0 && (
        <View style={styles.photoRow}>
          {visiblePhotos.map((url, index) => (
            <Image
              key={url}
              source={{ uri: url }}
              style={styles.photo}
              resizeMode="cover"
              accessibilityLabel={`첨부 사진 ${index + 1}`}
              onError={() => setFailedPhotos((prev) => new Set(prev).add(url))}
            />
          ))}
        </View>
      )}

      {showNote ? (
        <View style={[styles.noteBox, status === 'REJECTED' ? styles.noteRejected : styles.noteHidden]}>
          <Text style={[styles.noteTitle, status === 'REJECTED' && styles.noteTitleRejected]}>
            {status === 'REJECTED' ? '반려 사유' : '숨김 사유'}
          </Text>
          <Text style={styles.noteBody}>{note}</Text>
        </View>
      ) : (
        <Text style={styles.hint}>{meta.hint}</Text>
      )}

      <View style={styles.cardFooter}>
        {onMap ? (
          <View style={styles.mapLink}>
            <Text style={styles.mapLinkText}>지도에서 보기</Text>
            <Ionicons name="chevron-forward" size={14} color={COLORS.primary} />
          </View>
        ) : (
          <View />
        )}
          <Pressable
            onPress={() => onDelete(report)}
            disabled={deleting}
            hitSlop={8}
            style={({ pressed }) => [styles.deleteBtn, pressed && styles.pressed]}
            accessibilityRole="button"
            accessibilityLabel={`${report.title} 제보 삭제`}
            accessibilityState={{ disabled: deleting, busy: deleting }}
          >
            {deleting ? (
              <ActivityIndicator size="small" color={COLORS.textTertiary} />
            ) : (
              <>
                <Ionicons name="trash-outline" size={14} color={COLORS.textTertiary} />
                <Text style={styles.deleteText}>삭제</Text>
              </>
            )}
          </Pressable>
      </View>
    </>
  )

  const cardStyle = [styles.card, highlighted && styles.cardHighlighted]
  if (!onMap) {
    return (
      <View style={cardStyle} accessibilityLabel={`${report.title}, ${meta.label}${showNote ? `, 사유 ${note}` : ''}`}>
        {content}
      </View>
    )
  }
  return (
    <Pressable
      onPress={() => onShowOnMap(report.id)}
      style={({ pressed }) => [...cardStyle, pressed && styles.pressed]}
      accessibilityRole="button"
      accessibilityLabel={`${report.title}, ${meta.label}`}
      accessibilityHint="지도에서 이 제보를 보여 줘요"
    >
      {content}
    </Pressable>
  )
})

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.white },
  body: { flex: 1, backgroundColor: COLORS.background },
  list: { padding: SPACING.lg, paddingBottom: SPACING.xxxl },
  listEmpty: { flexGrow: 1, justifyContent: 'center', padding: SPACING.lg },
  intro: { ...TYPE.caption, color: COLORS.textSecondary, marginBottom: SPACING.md },
  empty: { marginTop: SPACING.xl },
  error: { margin: SPACING.lg },
  separator: { height: SPACING.md },
  footerSpinner: { marginVertical: SPACING.lg },
  skeletonGap: { marginTop: SPACING.md },
  skeletonLine: { marginTop: SPACING.sm },

  card: {
    backgroundColor: COLORS.cardBg,
    borderRadius: RADIUS.lg,
    padding: SPACING.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  cardHighlighted: { borderColor: COLORS.primary, borderWidth: 1.5 },
  pressed: { opacity: 0.7 },
  cardTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: SPACING.sm },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xxs + 1,
    borderRadius: RADIUS.pill,
  },
  statusText: { ...TYPE.label },
  createdAt: { ...TYPE.caption, color: COLORS.textTertiary },
  title: { ...TYPE.subhead, color: COLORS.textPrimary, marginTop: SPACING.sm },
  metaRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: SPACING.sm, marginTop: SPACING.sm },
  categoryChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xxs,
    borderRadius: RADIUS.pill,
    borderWidth: 1,
    maxWidth: 160,
  },
  categoryText: { ...TYPE.label },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: SPACING.xs, marginTop: SPACING.xs, flexShrink: 1 },
  metaText: { ...TYPE.caption, color: COLORS.textSecondary, flexShrink: 1 },
  photoRow: { flexDirection: 'row', gap: SPACING.sm, marginTop: SPACING.md },
  photo: { width: 64, height: 64, borderRadius: RADIUS.sm, backgroundColor: COLORS.fill },
  noteBox: { marginTop: SPACING.md, borderRadius: RADIUS.md, padding: SPACING.md },
  noteRejected: { backgroundColor: COLORS.dangerSoft },
  noteHidden: { backgroundColor: COLORS.fill },
  noteTitle: { ...TYPE.label, color: COLORS.textSecondary },
  noteTitleRejected: { color: COLORS.danger },
  noteBody: { ...TYPE.callout, color: COLORS.textPrimary, marginTop: SPACING.xs },
  hint: { ...TYPE.caption, color: COLORS.textTertiary, marginTop: SPACING.md },
  cardFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: SPACING.md },
  mapLink: { flexDirection: 'row', alignItems: 'center', gap: SPACING.xxs },
  mapLinkText: { ...TYPE.label, color: COLORS.primary },
  deleteBtn: { flexDirection: 'row', alignItems: 'center', gap: SPACING.xs, minHeight: 24, minWidth: 44, justifyContent: 'flex-end' },
  deleteText: { ...TYPE.caption, color: COLORS.textTertiary },
})
