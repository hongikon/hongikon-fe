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
import { SafeAreaProvider, SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context'
import type { ReactNode } from 'react'
import { COLORS } from '../../../constants/colors'
import { FONTS } from '../../../constants/typography'
import { useAuth } from '../../../contexts/AuthContext'
import { ToastViewport, useToast } from '../../common/Toast'
import { useHiddenAuthorKeys } from '../../../lib/hiddenAuthors'
import { getErrorMessage, isCancelledError, isNetworkError, isRetryableError } from '../../../apis/client'
import { getCommentReplies, getReportComments, type CommentOrder } from '../../../apis/comments'
import { mergeComments, patchComment, supportsCommentLikes } from '../../../utils/comments'
import { promptLogin } from '../../../utils/reports'
import ModalHeader, { ModalPanel } from '../../settings/ModalHeader'
import ContentColumn from '../../common/ContentColumn'
import RetryableError from '../../common/RetryableError'
import { SkeletonBlock, SkeletonGroup } from '../../common/Skeleton'
import CommentItem from './CommentItem'
import CommentComposer, { type ReplyTarget } from './CommentComposer'
import ModerationMenu from '../ModerationMenu'
import ReportPostBody from '../ReportPostBody'
import type { ReportCommunityPatch } from '../ReportActionRow'
import { useCommentActions, type CommentRemovedReason } from './useCommentActions'
import type { ReportComment, ReportListItem } from '../../../types'
import EmptyState from '../../common/EmptyState'

interface ReportCommentsModalProps {
  visible: boolean
  report: ReportListItem
  /** 장소 문구(시트와 같은 값 — 작성자가 고친 장소 설명, 없으면 가까운 건물). */
  placeText: string
  /** 공감·관심·조회 수 변화를 지도 시트 사본에도 반영한다(시트와 같은 applyPatch). */
  onPatch: (patch: ReportCommunityPatch) => void
  onClose: () => void
  /** 시트의 "댓글 달기"로 열면 바로 입력하게 한다. */
  focusInput?: boolean
}

/**
 * 처음에 보여 줄 최상위 댓글 수. 더 있으면 목록 끝에 '이전 댓글 N개 보기'(인기순은 '댓글 N개 더 보기') 버튼을 두고,
 * 누르면 나머지를 한 번에 모두 펼친다 — 처음 열 땐 최근 대화만 짧게, 원하면 전부 본다.
 */
const COMMENTS_MODAL_PAGE_SIZE = 10
/** 댓글은 작성된 순서(오래된 순)로 고정한다(10-09 요청 — 최신순·인기순 고르기를 없앴다). */
const COMMENT_ORDER: CommentOrder = 'oldest'
/** '나머지 보기'로 한 번에 받는 최대 페이지 수(10개 × 30 = 300개). 이보다 많으면 버튼이 다시 남는다. */
const LOAD_REST_MAX_PAGES = 30

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
 * 제보 본문 창 — 게시글처럼 본문 전체(ReportPostBody) 아래로 댓글이 바로 이어지고, 맨 아래 입력줄에서 바로 쓴다
 * (10-09 요청 — 댓글을 달러 가는 게 곧 본문을 보러 가는 것이라 두 창을 하나로 합쳤다). 댓글은 작성된 순서(오래된 순) 고정.
 * 최상위 댓글 아래 답글을 들여 써서 보여 준다(한 단계).
 * 처음엔 10개만 보이고, 더 있으면 목록 끝 '이전 댓글 보기' 버튼으로 10개씩 더 받는다. 당겨서 새로고침, 아래 고정 입력줄(키보드가 가리지 않게 KeyboardAvoidingView).
 * 쓰고 나면 맨 아래로 내린다. 답글은 "답글 달기" → 입력줄 위 "○○님에게 답글" 칩.
 */
export default function ReportCommentsModal({
  visible,
  report,
  placeText,
  onPatch,
  onClose,
  focusInput = false,
}: ReportCommentsModalProps) {
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
  /** 서버가 👍 를 아는지(likeCount 가 옴). 새로 쓴 댓글의 좋아요 0 표시에 쓴다. */
  const [likesSupported, setLikesSupported] = useState(false)
  const pageRef = useRef(0)
  const hasNextRef = useRef(false)
  /** 더 받을 댓글이 있는지 — '이전 댓글 보기' 버튼을 그릴지(ref 는 화면을 다시 그리지 않아 따로 둔다). */
  const [hasNext, setHasNext] = useState(false)
  /** 최상위 댓글 전체 수(답글 제외) — 버튼의 '나머지 N개' 계산용. */
  const [topTotal, setTopTotal] = useState(0)
  /**
   * 마지막으로 받은 페이지 뒤에 목록에서 빠진 최상위 댓글 수(지움·신고 숨김). 서버는 page·size 오프셋으로 끊어 주는데,
   * 앞쪽 댓글이 빠지면 뒤 댓글이 한 칸씩 당겨져 다음 페이지를 그대로 받으면 경계의 댓글을 건너뛴다.
   * 0 보다 크면 그만큼 앞에서부터 다시 받는다(`nextPageToLoad`) — 겹친 댓글은 mergeComments 가 id 로 걸러 준다.
   * "삭제된 댓글" 자리로 남긴 것도 센다 — 서버 목록에 남아 있었다면 한 페이지를 더 겹쳐 받을 뿐 건너뛰지는 않는다.
   */
  const removedTopRef = useRef(0)
  const itemsRef = useRef(items)
  itemsRef.current = items
  const controllerRef = useRef<AbortController | null>(null)
  const listRef = useRef<FlatList<ReportComment>>(null)
  const tokenRef = useRef(accessToken)
  tokenRef.current = accessToken

  /** 받아 넣었으면 true. 실패·취소, 정렬을 바꿔 처음부터 다시 받으러 간 경우는 false. */
  const load = useCallback(
    async (page: number, mode: 'initial' | 'refresh' | 'more'): Promise<boolean> => {
      if (mode !== 'more') controllerRef.current?.abort()
      const controller = new AbortController()
      controllerRef.current = controller
      if (mode === 'initial') setState({ kind: 'loading' })
      if (mode === 'refresh') setRefreshing(true)
      if (mode === 'more') setLoadingMore(true)
      // 이 요청을 보낼 때까지 빠진 수. 응답을 받는 사이 또 빠진 것은 다음 요청 몫으로 남긴다.
      const removedAtRequest = removedTopRef.current
      try {
        const result = await getReportComments(report.id, {
          page,
          size: COMMENTS_MODAL_PAGE_SIZE,
          order: COMMENT_ORDER,
          accessToken: tokenRef.current,
          signal: controller.signal,
        })
        if (controller.signal.aborted) return false
        // 👍 를 아는 서버면 좋아요 수를 보인다. 정렬은 작성된 순서(오래된 순)로 고정한다(10-09 요청).
        if (page === 0 && supportsCommentLikes(result.content)) setLikesSupported(true)
        // 처음·새로고침은 갈아 끼우고, 더 받기는 합친다(빠진 댓글 때문에 0쪽을 다시 받을 때도 합친다).
        setItems((prev) => (mode !== 'more' ? result.content : mergeComments(prev, result.content, COMMENT_ORDER)))
        setCount(result.commentCount ?? result.totalElements)
        setTopTotal(result.totalElements)
        removedTopRef.current = mode === 'more' ? Math.max(0, removedTopRef.current - removedAtRequest) : 0
        pageRef.current = page
        hasNextRef.current = result.hasNext
        setHasNext(result.hasNext)
        setState({ kind: 'ready' })
        return true
      } catch (error) {
        if (controller.signal.aborted || isCancelledError(error)) return false
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
        return false
      } finally {
        if (mode === 'refresh') setRefreshing(false)
        if (mode === 'more') setLoadingMore(false)
      }
    },
    [report.id, toast],
  )

  /**
   * 다음에 받을 페이지. 받은 뒤 빠진 최상위 댓글이 없으면 바로 다음 쪽, 있으면 서버 목록에서 아직 못 본 첫 댓글
   * (지금까지 받은 수 − 빠진 수 번째)이 든 쪽을 다시 받는다. 예: 10개씩 2쪽(20개)을 받고 1개를 지웠으면 19번째가
   * 든 1쪽을 다시 받아 당겨진 1개를 얻는다(이미 있는 9개는 id 로 합쳐진다).
   */
  const nextPageToLoad = useCallback(() => {
    const removed = removedTopRef.current
    if (removed === 0) return pageRef.current + 1
    const consumed = (pageRef.current + 1) * COMMENTS_MODAL_PAGE_SIZE
    return Math.max(0, Math.floor((consumed - removed) / COMMENTS_MODAL_PAGE_SIZE))
  }, [])

  /** 나머지 댓글을 한 번에 모두 펼친다(10개씩 페이지를 이어 받음). 실패하면 그때까지 받은 것만 두고 버튼이 남는다. */
  const loadingRestRef = useRef(false)
  const loadRest = useCallback(async () => {
    if (loadingRestRef.current) return
    loadingRestRef.current = true
    try {
      for (let i = 0; i < LOAD_REST_MAX_PAGES && hasNextRef.current; i += 1) {
        // 실패(토스트가 이미 떴음)면 멈춘다 — 같은 페이지를 다시 시도하지 않는다.
        if (!(await load(nextPageToLoad(), 'more'))) break
      }
    } finally {
      loadingRestRef.current = false
    }
  }, [load, nextPageToLoad])

  useEffect(() => {
    if (!visible) {
      controllerRef.current?.abort()
      return
    }
    setItems([])
    setReplyTo(null)
    setLikesSupported(false)
    pageRef.current = 0
    removedTopRef.current = 0
    hasNextRef.current = false
    setHasNext(false)
    void load(0, 'initial')
    if (focusInput) setFocusKey((key) => key + 1)
  }, [visible, load, focusInput])

  /**
   * 지웠거나 신고로 숨겨진 댓글을 목록에서 정리한다. 답글이 남은 최상위 댓글은 자리로 바꾼다 — 지움이면 "삭제된 댓글",
   * 신고 누적 자동 숨김이면 "운영 정책에 따라 숨겨진 댓글"(서버가 다시 줄 때의 placeholder 와 같게).
   */
  const handleRemoved = useCallback((commentId: number, reason: CommentRemovedReason = 'DELETED') => {
    // 최상위 댓글이 빠지면 다음 페이지 경계가 당겨진다(removedTopRef). 자리까지 없어지면 '나머지 N개' 계산의 전체 수도 줄인다.
    // 답글이 다 빠져 "삭제된 댓글" 자리만 남은 최상위 댓글도 아래에서 함께 없어지니 같이 센다.
    const removedTop = itemsRef.current.find((top) => top.id === commentId)
    const emptiedPlaceholder = itemsRef.current.find(
      (top) =>
        !!top.placeholder &&
        !!top.replies?.some((r) => r.id === commentId) &&
        Math.max(0, (top.replyCount ?? top.replies.length) - 1) === 0,
    )
    if (removedTop || emptiedPlaceholder) {
      removedTopRef.current += 1
      if (emptiedPlaceholder || (removedTop?.replyCount ?? 0) === 0) setTopTotal((prev) => Math.max(0, prev - 1))
    }
    setItems((prev) =>
      prev.flatMap((top) => {
        if (top.id === commentId) {
          return (top.replyCount ?? 0) > 0 ? [{ ...top, placeholder: reason, content: null, authorDisplayName: null, authorKey: null, isMine: false }] : []
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
    // 새 최상위 댓글은 목록에도 전체 수에도 하나씩 더해 '나머지 N개'가 그대로 맞게 한다.
    setTopTotal((prev) => prev + 1)
    const fresh = { ...comment, replies: [], replyCount: 0, likeCount: comment.likeCount ?? (likesSupportedRef.current ? 0 : undefined) }
    setItems((prev) => mergeComments(prev, [fresh], COMMENT_ORDER))
    // 작성된 순서라 새 댓글은 맨 아래 — 끝으로 내린다.
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
            flagged={actions.isFlagged(item)}
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
                  flagged={actions.isFlagged(reply)}
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
    [actions.pendingId, actions.isFlagged, actions.remove, actions.like, handleReply, loadMoreReplies, loadingReplies],
  )

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <SafeAreaProvider>
        <KeyboardFrame>
        <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
          <ContentColumn style={styles.column}>
            <ModalHeader title="제보 본문" onClose={onClose} />
            {/* 머리 카드 아래 흰 판 — 입력줄도 판 안 맨 아래에 붙어 키보드 위로 같이 올라간다. */}
            <ModalPanel>
            <View style={styles.body}>
                <FlatList
                  ref={listRef}
                  data={shown}
                  keyExtractor={(item) => String(item.id)}
                  renderItem={renderItem}
                  ItemSeparatorComponent={Separator}
                  contentContainerStyle={styles.listContent}
                  keyboardShouldPersistTaps="handled"
                  keyboardDismissMode="interactive"
                  refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void load(0, 'refresh')} />}
                  ListHeaderComponent={
                    <>
                      <ReportPostBody report={report} placeText={placeText} onPatch={onPatch} />
                      <View style={styles.commentsHeading}>
                        <Text style={styles.commentsHeadingText}>
                          댓글{state.kind === 'ready' ? <Text style={styles.commentsHeadingCount}> {count}</Text> : null}
                        </Text>
                      </View>
                    </>
                  }
                  ListEmptyComponent={
                    state.kind === 'loading' ? (
                      <CommentsSkeleton />
                    ) : state.kind === 'error' ? (
                      <RetryableError
                        message={state.message}
                        isNetworkError={state.network}
                        onRetry={() => void load(0, 'initial')}
                        style={styles.error}
                      />
                    ) : (
                    // 다른 빈 화면과 같은 EmptyState(10-08).
                    <EmptyState
                      style={styles.empty}
                      icon={count > 0 ? 'eye-off-outline' : 'chatbubbles-outline'}
                      message={
                        count > 0
                          ? hasNext
                            ? '불러온 댓글은 모두 숨긴 사용자의 댓글이에요'
                            : '숨긴 사용자의 댓글만 있어요'
                          : '첫 댓글을 남겨 보세요'
                      }
                      description={count > 0 ? undefined : '줄이 긴지, 아직 남았는지 지금 상황을 알려 주면 다른 학생들에게 도움이 돼요.'}
                    />
                    )
                  }
                  ListFooterComponent={
                    loadingMore ? (
                      <ActivityIndicator style={styles.footer} color={COLORS.primary} />
                    ) : hasNext ? (
                      // 첫 페이지가 모두 숨긴 사용자의 댓글이라 보이는 게 없어도 버튼은 둔다(빈 안내 아래에 같이 뜬다) —
                      // 예전엔 보이는 댓글이 없으면 버튼을 숨겨 나머지 댓글을 볼 길이 없었다.
                      <Pressable
                        onPress={() => void loadRest()}
                        style={({ pressed }) => [styles.moreButton, pressed && styles.moreButtonPressed]}
                        accessibilityRole="button"
                        hitSlop={6}
                      >
                        <Text style={styles.moreText}>
                          {(() => {
                            const rest = Math.max(0, topTotal - items.length)
                            const n = rest > 0 ? ` ${rest}개` : ''
                            return `댓글${n} 더 보기`
                          })()}
                        </Text>
                      </Pressable>
                    ) : null
                  }
                />
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
            </View>
            </ModalPanel>
          </ContentColumn>
        </SafeAreaView>
        </KeyboardFrame>
        <ModerationMenu
          visible={menuFor !== null}
          onClose={() => setMenuFor(null)}
          target="댓글"
          canHide={!!menuFor?.authorKey}
          onHide={() => menuFor && actions.hide(menuFor)}
          flagged={menuFor ? actions.isFlagged(menuFor) : false}
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

/**
 * 키보드가 입력줄을 가리지 않게 화면 전체를 감싼다. 예전엔 머리줄 아래 목록 칸만 감싸, iOS 가 자기 위치를 화면 기준이 아니라
 * 부모 기준으로 재는 탓에 위쪽 안전 영역(노치)만큼 덜 올라가 입력줄이 키보드에 반쯤 가렸다. 화면 전체를 감싸면 키보드 높이만큼
 * 올리면 되고, 아래 안전 영역(홈 표시줄) 여백은 키보드 뒤로 들어가므로 그만큼 빼 입력줄이 키보드 바로 위에 붙는다.
 */
function KeyboardFrame({ children }: { children: ReactNode }) {
  const insets = useSafeAreaInsets()
  return (
    <KeyboardAvoidingView
      style={styles.keyboardFrame}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? -insets.bottom : 0}
    >
      {children}
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  keyboardFrame: { flex: 1 },
  container: { flex: 1, backgroundColor: COLORS.background },
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
  body: { flex: 1 },
  listContent: { paddingHorizontal: 20, paddingBottom: 16 },
  // 본문과 댓글 사이 — 굵은 구분선 대신 위 여백 + 얇은 선, "댓글 N" 을 본문 제목처럼 또렷하게.
  commentsHeading: {
    marginTop: 16,
    paddingTop: 16,
    paddingBottom: 4,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: COLORS.border,
  },
  commentsHeadingText: { fontFamily: FONTS.bold, fontSize: 16, color: COLORS.textPrimary },
  commentsHeadingCount: { color: COLORS.primary },
  empty: { paddingVertical: 32 },
  error: { marginTop: 12 },
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
  skeleton: { paddingTop: 12, gap: 20 },
  skeletonRow: { flexDirection: 'row', gap: 10 },
  skeletonText: { flex: 1, gap: 8 },
})
