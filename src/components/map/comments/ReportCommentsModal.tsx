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
import { getCommentReplies, getReportComments, type CommentOrder } from '../../../apis/comments'
import { mergeComments, patchComment, supportsCommentLikes } from '../../../utils/comments'
import * as haptics from '../../../lib/haptics'
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

/**
 * 한 번에 보여 줄 최상위 댓글 수. 넘으면 목록 끝에 '이전 댓글 보기'(인기순은 '댓글 더 보기') 버튼을 두고,
 * 누를 때마다 이만큼 더 받는다 — 댓글이 많아도 창이 끝없이 길어지지 않고 최근 대화가 먼저 보인다.
 */
const COMMENTS_MODAL_PAGE_SIZE = 10

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
 * 제보 댓글 전체. 최상위 댓글 아래 답글을 들여 써서 보여 준다(한 단계).
 * 처음엔 10개만 보이고, 더 있으면 목록 끝 '이전 댓글 보기' 버튼으로 10개씩 더 받는다. 당겨서 새로고침, 아래 고정 입력줄(키보드가 가리지 않게 KeyboardAvoidingView).
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
  /**
   * 정렬. 서버가 👍 를 알면(likeCount 가 옴) 최신순·인기순을 고르게 하고 기본은 최신순(새 댓글이 위).
   * 모르는 서버(좋아요 기능 전)는 예전처럼 오래된 순(새 댓글이 아래)만.
   */
  const [order, setOrder] = useState<CommentOrder>('oldest')
  const [likesSupported, setLikesSupported] = useState(false)
  const orderRef = useRef(order)
  orderRef.current = order
  const pageRef = useRef(0)
  const hasNextRef = useRef(false)
  /** 더 받을 댓글이 있는지 — '이전 댓글 보기' 버튼을 그릴지(ref 는 화면을 다시 그리지 않아 따로 둔다). */
  const [hasNext, setHasNext] = useState(false)
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
        const requested = orderRef.current
        const result = await getReportComments(report.id, {
          page,
          size: COMMENTS_MODAL_PAGE_SIZE,
          order: requested,
          accessToken: tokenRef.current,
          signal: controller.signal,
        })
        if (controller.signal.aborted) return
        // 첫 페이지에서 👍 를 아는 서버로 확인되면 최신순으로 바꿔 다시 받는다(한 번만).
        if (page === 0 && requested === 'oldest' && supportsCommentLikes(result.content)) {
          setLikesSupported(true)
          setOrder('latest')
          orderRef.current = 'latest'
          void load(0, mode === 'more' ? 'initial' : mode)
          return
        }
        setItems((prev) => (page === 0 ? result.content : mergeComments(prev, result.content, requested)))
        setCount(result.commentCount ?? result.totalElements)
        pageRef.current = page
        hasNextRef.current = result.hasNext
        setHasNext(result.hasNext)
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
    setOrder('oldest')
    orderRef.current = 'oldest'
    setLikesSupported(false)
    pageRef.current = 0
    hasNextRef.current = false
    setHasNext(false)
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
  const handleUpdated = useCallback((commentId: number, patch: Partial<ReportComment>) => {
    setItems((prev) => patchComment(prev, commentId, patch))
  }, [])
  const actions = useCommentActions(report.id, handleRemoved, handleUpdated)

  const changeOrder = useCallback(
    (next: CommentOrder) => {
      if (next === orderRef.current) return
      haptics.selection()
      setOrder(next)
      orderRef.current = next
      void load(0, 'initial')
    },
    [load],
  )

  const likesSupportedRef = useRef(likesSupported)
  likesSupportedRef.current = likesSupported
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
    const current = orderRef.current
    const fresh = { ...comment, replies: [], replyCount: 0, likeCount: comment.likeCount ?? (likesSupportedRef.current ? 0 : undefined) }
    if (current === 'latest') {
      // 최신순이면 맨 위에 붙이고 위로 올린다.
      setItems((prev) => mergeComments(prev, [fresh], 'latest'))
      setTimeout(() => listRef.current?.scrollToOffset({ offset: 0, animated: true }), 80)
      return
    }
    setItems((prev) => mergeComments(prev, [fresh], current))
    // 오래된 순·인기순(새 댓글은 👍 0개)이면 맨 아래라 끝으로 내린다.
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
      const handlers = { onReply: handleReply, onDelete: actions.remove, onOpenMenu: setMenuFor, onLike: actions.like }
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
    [actions.pendingId, actions.flaggedIds, actions.remove, actions.like, handleReply, loadMoreReplies, loadingReplies],
  )

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <SafeAreaProvider>
        <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
          <ContentColumn style={styles.column}>
            <ModalHeader title={state.kind === 'ready' ? `댓글 ${count}` : '댓글'} onClose={onClose} />
            <View style={styles.subHeader}>
              <Text style={styles.reportTitle} numberOfLines={1}>
                {report.title}
              </Text>
              {likesSupported ? (
                <View style={styles.sortRow} accessibilityRole="radiogroup" accessibilityLabel="댓글 정렬">
                  {(['popular', 'latest'] as const).map((value) => {
                    const active = order === value
                    return (
                      <Pressable
                        key={value}
                        onPress={() => changeOrder(value)}
                        hitSlop={6}
                        style={styles.sortItem}
                        accessibilityRole="radio"
                        accessibilityState={{ checked: active }}
                      >
                        {active ? <View style={styles.sortDot} /> : null}
                        <Text style={[styles.sortText, active && styles.sortTextActive]}>
                          {value === 'popular' ? '인기순' : '최신순'}
                        </Text>
                      </Pressable>
                    )
                  })}
                </View>
              ) : null}
            </View>
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
                  refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void load(0, 'refresh')} />}
                  ListEmptyComponent={
                    <View style={styles.empty}>
                      <Text style={styles.emptyTitle}>{count > 0 ? '숨긴 사용자의 댓글만 있어요' : '첫 댓글을 남겨 보세요'}</Text>
                      {count > 0 ? null : (
                        <Text style={styles.emptyBody}>줄이 긴지, 아직 남았는지 지금 상황을 알려 주면 다른 학생들에게 도움이 돼요.</Text>
                      )}
                    </View>
                  }
                  ListFooterComponent={
                    loadingMore ? (
                      <ActivityIndicator style={styles.footer} color={COLORS.textTertiary} />
                    ) : hasNext && shown.length > 0 ? (
                      // 최신순(새 댓글이 위)이면 아래로 더 받는 게 지난 댓글이라 '이전 댓글 보기'.
                      // 인기순·오래된 순(구서버)은 순위·시간이 이어지니 '댓글 더 보기'.
                      <Pressable
                        onPress={() => void load(pageRef.current + 1, 'more')}
                        style={({ pressed }) => [styles.moreButton, pressed && styles.moreButtonPressed]}
                        accessibilityRole="button"
                        hitSlop={6}
                      >
                        <Text style={styles.moreText}>{order === 'latest' ? '이전 댓글 보기' : '댓글 더 보기'}</Text>
                      </Pressable>
                    ) : null
                  }
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
  moreButton: {
    alignSelf: 'center',
    marginVertical: 14,
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 999,
    backgroundColor: COLORS.primarySoft,
  },
  moreButtonPressed: { opacity: 0.7 },
  moreText: { fontFamily: FONTS.semibold, fontSize: 13, color: COLORS.primary },
  column: { flex: 1 },
  subHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingBottom: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: COLORS.divider,
  },
  reportTitle: { flex: 1, fontFamily: FONTS.regular, fontSize: 12, color: COLORS.textTertiary },
  sortRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  sortItem: { flexDirection: 'row', alignItems: 'center', gap: 4, minHeight: 24 },
  sortDot: { width: 4, height: 4, borderRadius: 2, backgroundColor: COLORS.primary },
  sortText: { fontFamily: FONTS.regular, fontSize: 12.5, color: COLORS.textTertiary },
  sortTextActive: { fontFamily: FONTS.semibold, color: COLORS.primary },
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
