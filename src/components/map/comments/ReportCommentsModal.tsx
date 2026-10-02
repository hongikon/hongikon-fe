import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context'
import { COLORS } from '../../../constants/colors'
import { FONTS } from '../../../constants/typography'
import { useAuth } from '../../../contexts/AuthContext'
import { ToastViewport, useToast } from '../../common/Toast'
import { useHiddenAuthorKeys } from '../../../lib/hiddenAuthors'
import { getErrorMessage, isCancelledError, isNetworkError, isRetryableError } from '../../../apis/client'
import { COMMENTS_PAGE_SIZE, getCommentReplies, getReportComments } from '../../../apis/comments'
import { mergeComments } from '../../../utils/comments'
import { promptLogin } from '../../../utils/reports'
import ModalHeader from '../../settings/ModalHeader'
import ContentColumn from '../../common/ContentColumn'
import RetryableError from '../../common/RetryableError'
import { SkeletonBlock, SkeletonGroup } from '../../common/Skeleton'
import CommentItem from './CommentItem'
import CommentComposer, { type ReplyTarget } from './CommentComposer'
import ModerationMenu from '../ModerationMenu'
import { useCommentActions } from './useCommentActions'
import type { ReportComment, ReportListItem } from '../../../types'

interface ReportCommentsModalProps {
  visible: boolean
  report: ReportListItem
  onClose: () => void
  /** 시트의 "댓글 달기"로 열면 바로 입력하게 한다. */
  focusInput?: boolean
}

type LoadState =
  | { kind: 'loading' }
  | { kind: 'ready' }
  | { kind: 'error'; message: string; network: boolean; retryable: boolean }

/** 숨긴 사용자 걸러 내기 — 최상위 댓글을 숨기면 그 아래 답글도 함께 감춘다(대화 맥락이 없어서). */
function visibleThreads(items: readonly ReportComment[], hidden: ReadonlySet<string>): ReportComment[] {
  if (hidden.size === 0) return items as ReportComment[]
  const isHidden = (c: ReportComment) => !!c.authorKey && hidden.has(c.authorKey)
  return items
    .filter((c) => !isHidden(c))
    .map((c) => (c.replies?.some(isHidden) ? { ...c, replies: c.replies.filter((r) => !isHidden(r)) } : c))
}

/**
 * 제보 댓글 전체. 오래된 순(최신이 맨 아래), 최상위 댓글 아래 답글을 들여 써서 보여 준다(한 단계).
 * 끝까지 내리면 다음 페이지, 당겨서 새로고침, 아래 고정 입력줄(키보드가 가리지 않게 KeyboardAvoidingView).
 * 쓰고 나면 맨 아래로 내린다. 답글은 "답글 달기" → 입력줄 위 "○○님에게 답글" 칩.
 */
export default function ReportCommentsModal({ visible, report, onClose, focusInput = false }: ReportCommentsModalProps) {
  const { accessToken, logout } = useAuth()
  const toast = useToast()
  const hiddenKeys = useHiddenAuthorKeys()
  const [items, setItems] = useState<ReportComment[]>([])
  const [count, setCount] = useState(0)
  const [state, setState] = useState<LoadState>({ kind: 'loading' })
  const [refreshing, setRefreshing] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [loadingReplies, setLoadingReplies] = useState<number | null>(null)
  const [replyTo, setReplyTo] = useState<ReplyTarget | null>(null)
  const [focusKey, setFocusKey] = useState(0)
  const [menuFor, setMenuFor] = useState<ReportComment | null>(null)
  const pageRef = useRef(0)
  const hasNextRef = useRef(false)
  const controllerRef = useRef<AbortController | null>(null)
  const listRef = useRef<FlatList<ReportComment>>(null)
  const tokenRef = useRef(accessToken)
  tokenRef.current = accessToken

  const load = useCallback(
    async (page: number, mode: 'initial' | 'refresh' | 'more') => {
      if (mode !== 'more') controllerRef.current?.abort()
      const controller = new AbortController()
      controllerRef.current = controller
      if (mode === 'initial') setState({ kind: 'loading' })
      if (mode === 'refresh') setRefreshing(true)
      if (mode === 'more') setLoadingMore(true)
      try {
        const result = await getReportComments(report.id, {
          page,
          size: COMMENTS_PAGE_SIZE,
          accessToken: tokenRef.current,
          signal: controller.signal,
        })
        if (controller.signal.aborted) return
        setItems((prev) => (page === 0 ? result.content : mergeComments(prev, result.content)))
        setCount(result.commentCount ?? result.totalElements)
        pageRef.current = page
        hasNextRef.current = result.hasNext
        setState({ kind: 'ready' })
      } catch (error) {
        if (controller.signal.aborted || isCancelledError(error)) return
        if (mode === 'more') {
          toast.show({ message: getErrorMessage(error, '댓글을 더 불러오지 못했어요.'), tone: 'warning' })
        } else {
          setState({
            kind: 'error',
            message: getErrorMessage(error, '댓글을 불러오지 못했어요.'),
            network: isNetworkError(error),
            retryable: isRetryableError(error),
          })
        }
      } finally {
        if (mode === 'refresh') setRefreshing(false)
        if (mode === 'more') setLoadingMore(false)
      }
    },
    [report.id, toast],
  )

  useEffect(() => {
    if (!visible) {
      controllerRef.current?.abort()
      return
    }
    setItems([])
    setReplyTo(null)
    pageRef.current = 0
    hasNextRef.current = false
    void load(0, 'initial')
    if (focusInput) setFocusKey((key) => key + 1)
  }, [visible, load, focusInput])

  /** 지웠거나 신고로 숨겨진 댓글을 목록에서 정리한다. 답글이 남은 최상위 댓글은 "삭제된 댓글" 자리로 바꾼다. */
  const handleRemoved = useCallback((commentId: number) => {
    setItems((prev) =>
      prev.flatMap((top) => {
        if (top.id === commentId) {
          return (top.replyCount ?? 0) > 0 ? [{ ...top, placeholder: 'DELETED' as const, content: null, authorDisplayName: null, authorKey: null, isMine: false }] : []
        }
        if (!top.replies?.some((r) => r.id === commentId)) return [top]
        const replies = top.replies.filter((r) => r.id !== commentId)
        const replyCount = Math.max(0, (top.replyCount ?? replies.length + 1) - 1)
        if (top.placeholder && replyCount === 0) return []
        return [{ ...top, replies, replyCount }]
      }),
    )
    setCount((prev) => Math.max(0, prev - 1))
  }, [])
  const actions = useCommentActions(report.id, handleRemoved)

  const handlePosted = useCallback((comment: ReportComment) => {
    setCount((prev) => prev + 1)
    if (comment.parentId) {
      setItems((prev) =>
        prev.map((top) =>
          top.id === comment.parentId
            ? { ...top, replies: [...(top.replies ?? []), comment], replyCount: (top.replyCount ?? 0) + 1 }
            : top,
        ),
      )
      setReplyTo(null)
      return
    }
    setItems((prev) => mergeComments(prev, [{ ...comment, replies: [], replyCount: 0 }]))
    // 새 댓글은 맨 아래(오래된 순)라 끝으로 내린다.
    setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 80)
  }, [])

  const handleReply = useCallback((target: ReportComment) => {
    if (!tokenRef.current) {
      promptLogin('답글을 달려면 로그인해 주세요.', logout)
      return
    }
    // 답글에 답해도 같은 최상위 댓글에 붙는다(한 단계만).
    const parentId = target.parentId ?? target.id
    setReplyTo({ parentId, name: target.authorDisplayName ?? '' })
    setFocusKey((key) => key + 1)
  }, [logout])

  const loadMoreReplies = useCallback(
    async (parent: ReportComment) => {
      setLoadingReplies(parent.id)
      try {
        // 답글은 많아야 수십 개라 한 번에 넉넉히 받는다.
        const result = await getCommentReplies(report.id, parent.id, { size: 50, accessToken: tokenRef.current })
        setItems((prev) =>
          prev.map((top) =>
            top.id === parent.id
              ? { ...top, replies: mergeComments(top.replies ?? [], result.content), replyCount: result.totalElements }
              : top,
          ),
        )
      } catch (error) {
        toast.show({ message: getErrorMessage(error, '답글을 불러오지 못했어요.'), tone: 'warning' })
      } finally {
        setLoadingReplies(null)
      }
    },
    [report.id, toast],
  )

  const shown = useMemo(() => visibleThreads(items, hiddenKeys), [items, hiddenKeys])

  const renderItem = useCallback(
    ({ item }: { item: ReportComment }) => {
      const replies = item.replies ?? []
      const more = Math.max(0, (item.replyCount ?? replies.length) - replies.length)
      const handlers = { onReply: handleReply, onDelete: actions.remove, onOpenMenu: setMenuFor }
      return (
        <View>
          <CommentItem
            comment={item}
            pending={actions.pendingId === item.id}
            flagged={actions.flaggedIds.has(item.id)}
            {...handlers}
          />
          {replies.length > 0 || more > 0 ? (
            <View style={styles.replies}>
              {replies.map((reply) => (
                <CommentItem
                  key={reply.id}
                  comment={reply}
                  reply
                  pending={actions.pendingId === reply.id}
                  flagged={actions.flaggedIds.has(reply.id)}
                  {...handlers}
                />
              ))}
              {more > 0 ? (
                <Pressable
                  style={styles.moreReplies}
                  onPress={() => void loadMoreReplies(item)}
                  disabled={loadingReplies === item.id}
                  accessibilityRole="button"
                  hitSlop={6}
                >
                  <View style={styles.moreLine} />
                  <Text style={styles.moreRepliesText}>
                    {loadingReplies === item.id ? '불러오는 중…' : `답글 ${more}개 더 보기`}
                  </Text>
                </Pressable>
              ) : null}
            </View>
          ) : null}
        </View>
      )
    },
    [actions.pendingId, actions.flaggedIds, actions.remove, handleReply, loadMoreReplies, loadingReplies],
  )

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <SafeAreaProvider>
        <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
          <ContentColumn style={styles.column}>
            <ModalHeader title={state.kind === 'ready' ? `댓글 ${count}` : '댓글'} onClose={onClose} />
            <Text style={styles.reportTitle} numberOfLines={1}>
              {report.title}
            </Text>
            <KeyboardAvoidingView style={styles.body} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
              {state.kind === 'loading' ? (
                <CommentsSkeleton />
              ) : state.kind === 'error' ? (
                <View style={styles.center}>
                  <RetryableError
                    message={state.message}
                    isNetworkError={state.network}
                    onRetry={() => void load(0, 'initial')}
                  />
                </View>
              ) : (
                <FlatList
                  ref={listRef}
                  data={shown}
                  keyExtractor={(item) => String(item.id)}
                  renderItem={renderItem}
                  ItemSeparatorComponent={Separator}
                  contentContainerStyle={shown.length === 0 ? styles.emptyContainer : styles.listContent}
                  keyboardShouldPersistTaps="handled"
                  keyboardDismissMode="interactive"
                  onEndReachedThreshold={0.4}
                  onEndReached={() => {
                    if (hasNextRef.current && !loadingMore) void load(pageRef.current + 1, 'more')
                  }}
                  refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void load(0, 'refresh')} />}
                  ListEmptyComponent={
                    <View style={styles.empty}>
                      <Text style={styles.emptyTitle}>{count > 0 ? '숨긴 사용자의 댓글만 있어요' : '첫 댓글을 남겨 보세요'}</Text>
                      {count > 0 ? null : (
                        <Text style={styles.emptyBody}>줄이 긴지, 아직 남았는지 지금 상황을 알려 주면 다른 학생들에게 도움이 돼요.</Text>
                      )}
                    </View>
                  }
                  ListFooterComponent={loadingMore ? <ActivityIndicator style={styles.footer} color={COLORS.textTertiary} /> : null}
                />
              )}
              <View style={styles.composer}>
                <CommentComposer
                  reportId={report.id}
                  onPosted={handlePosted}
                  replyTo={replyTo}
                  onCancelReply={() => setReplyTo(null)}
                  focusKey={focusKey}
                />
                <Text style={styles.notice}>댓글은 바로 공개돼요. 욕설·광고·개인정보는 신고되면 숨겨져요.</Text>
              </View>
            </KeyboardAvoidingView>
          </ContentColumn>
        </SafeAreaView>
        <ModerationMenu
          visible={menuFor !== null}
          onClose={() => setMenuFor(null)}
          target="댓글"
          canHide={!!menuFor?.authorKey}
          onHide={() => menuFor && actions.hide(menuFor)}
          flagged={menuFor ? actions.flaggedIds.has(menuFor.id) : false}
          beforeFlag={actions.canFlag}
          onFlag={(reason) => menuFor && actions.flag(menuFor, reason)}
        />
        <ToastViewport />
      </SafeAreaProvider>
    </Modal>
  )
}

function Separator() {
  return <View style={styles.separator} />
}

function CommentsSkeleton() {
  return (
    <SkeletonGroup style={styles.skeleton}>
      {[0, 1, 2, 3].map((i) => (
        <View key={i} style={styles.skeletonRow}>
          <SkeletonBlock width={32} height={32} radius={16} />
          <View style={styles.skeletonText}>
            <SkeletonBlock width="35%" height={12} />
            <SkeletonBlock width={i % 2 ? '70%' : '90%'} height={14} />
          </View>
        </View>
      ))}
    </SkeletonGroup>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.white },
  column: { flex: 1 },
  reportTitle: {
    fontFamily: FONTS.regular,
    fontSize: 12,
    color: COLORS.textTertiary,
    paddingHorizontal: 16,
    paddingBottom: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: COLORS.divider,
  },
  body: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 16 },
  listContent: { paddingHorizontal: 16, paddingBottom: 16 },
  emptyContainer: { flexGrow: 1, justifyContent: 'center', paddingHorizontal: 32 },
  empty: { alignItems: 'center', gap: 6 },
  emptyTitle: { fontFamily: FONTS.semibold, fontSize: 16, color: COLORS.textPrimary },
  emptyBody: { fontFamily: FONTS.regular, fontSize: 13, lineHeight: 19, color: COLORS.textSecondary, textAlign: 'center' },
  separator: { height: StyleSheet.hairlineWidth, backgroundColor: COLORS.divider, marginLeft: 42 },
  replies: {
    marginLeft: 15,
    paddingLeft: 27,
    borderLeftWidth: 2,
    borderLeftColor: COLORS.divider,
    marginBottom: 8,
  },
  moreReplies: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 32 },
  moreLine: { width: 18, height: 1, backgroundColor: COLORS.border },
  moreRepliesText: { fontFamily: FONTS.semibold, fontSize: 12.5, color: COLORS.textSecondary },
  footer: { marginVertical: 12 },
  composer: {
    paddingHorizontal: 12,
    paddingTop: 8,
    paddingBottom: 6,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: COLORS.border,
    backgroundColor: COLORS.white,
  },
  notice: { fontFamily: FONTS.regular, fontSize: 11, color: COLORS.textTertiary, marginTop: 6, marginLeft: 6 },
  skeleton: { paddingHorizontal: 16, paddingTop: 12, gap: 20 },
  skeletonRow: { flexDirection: 'row', gap: 10 },
  skeletonText: { flex: 1, gap: 8 },
})
