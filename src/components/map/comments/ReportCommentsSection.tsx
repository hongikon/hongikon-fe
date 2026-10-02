import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { COLORS } from '../../../constants/colors'
import { FONTS } from '../../../constants/typography'
import { useAuth } from '../../../contexts/AuthContext'
import { useHiddenAuthorKeys } from '../../../lib/hiddenAuthors'
import { getErrorMessage, isCancelledError, isNetworkError, isRetryableError } from '../../../apis/client'
import {
  COMMENTS_PREVIEW_SIZE,
  getReportComments,
  isCommentsApiKnownMissing,
  isCommentsApiMissing,
} from '../../../apis/comments'
import { formatCommentTime, withoutHiddenCommentAuthors } from '../../../utils/comments'
import { promptLogin } from '../../../utils/reports'
import RetryableError from '../../common/RetryableError'
import CommentAvatar from './CommentAvatar'
import ReportCommentsModal from './ReportCommentsModal'
import type { ReportComment, ReportListItem } from '../../../types'

/** 숨긴 사용자·지운 댓글 자리를 빼고도 미리보기를 채우도록 조금 더 받는다. */
const PREVIEW_FETCH_SIZE = COMMENTS_PREVIEW_SIZE + 3

type LoadState =
  | { kind: 'loading' }
  | { kind: 'ready' }
  | { kind: 'error'; message: string; network: boolean; retryable: boolean }
  /** 서버에 댓글 기능이 없거나(배포 전) 이 제보가 더는 공개 상태가 아니다 → 댓글 칸을 감춘다. */
  | { kind: 'unavailable' }

/**
 * 제보 시트의 댓글 미리보기: "댓글 N", 최근 댓글 2개(한 줄 요약), "댓글 N개 모두 보기", 아래 "댓글 달기" 줄.
 * 쓰기·답글·신고는 전체 댓글 창에서 한다(시트는 지도를 가리지 않게 짧게 둔다). 서버에 댓글 API 가 없으면 아무것도 그리지 않는다.
 */
export default function ReportCommentsSection({ report }: { report: ReportListItem }) {
  const { accessToken, logout } = useAuth()
  const hiddenKeys = useHiddenAuthorKeys()
  const [state, setState] = useState<LoadState>(() =>
    isCommentsApiKnownMissing() ? { kind: 'unavailable' } : { kind: 'loading' },
  )
  /** 최근 최상위 댓글(오래된 → 최신 순). */
  const [recent, setRecent] = useState<ReportComment[]>([])
  const [count, setCount] = useState<number | null>(report.commentCount ?? null)
  const [modal, setModal] = useState<{ focusInput: boolean } | null>(null)
  const [reloadKey, setReloadKey] = useState(0)
  const tokenRef = useRef(accessToken)
  tokenRef.current = accessToken

  useEffect(() => {
    if (isCommentsApiKnownMissing()) {
      setState({ kind: 'unavailable' })
      return
    }
    const controller = new AbortController()
    const token = tokenRef.current
    setState((prev) => (prev.kind === 'ready' ? prev : { kind: 'loading' }))
    getReportComments(report.id, { size: PREVIEW_FETCH_SIZE, order: 'latest', accessToken: token, signal: controller.signal })
      .then((page) => {
        if (controller.signal.aborted) return
        setRecent([...page.content].reverse())
        setCount(page.commentCount ?? page.totalElements)
        setState({ kind: 'ready' })
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted || isCancelledError(error)) return
        if (isCommentsApiMissing(error, !!token) || (error as { status?: number })?.status === 404) {
          setState({ kind: 'unavailable' })
          return
        }
        setState({
          kind: 'error',
          message: getErrorMessage(error, '댓글을 불러오지 못했어요.'),
          network: isNetworkError(error),
          retryable: isRetryableError(error),
        })
      })
    return () => controller.abort()
    // 로그인·로그아웃하면 다시 받는다.
  }, [report.id, reloadKey, !!accessToken])

  const preview = useMemo(
    () =>
      withoutHiddenCommentAuthors(
        recent.filter((c) => !c.placeholder),
        hiddenKeys,
      ).slice(-COMMENTS_PREVIEW_SIZE),
    [recent, hiddenKeys],
  )

  const openWrite = useCallback(() => {
    if (!accessToken) {
      promptLogin('댓글을 달려면 로그인해 주세요.', logout)
      return
    }
    setModal({ focusInput: true })
  }, [accessToken, logout])

  if (state.kind === 'unavailable') return null

  const total = count ?? 0

  return (
    <View style={styles.section}>
      <Pressable
        style={styles.header}
        onPress={() => setModal({ focusInput: false })}
        disabled={state.kind !== 'ready'}
        accessibilityRole="button"
        accessibilityLabel={total > 0 ? `댓글 ${total}개 모두 보기` : '댓글 보기'}
        hitSlop={6}
      >
        <Text style={styles.headerText}>
          댓글 <Text style={styles.headerCount}>{count === null ? '' : total}</Text>
        </Text>
        <View style={styles.spacer} />
        {state.kind === 'ready' && total > 0 ? (
          <>
            <Text style={styles.more}>댓글 {total}개 모두 보기</Text>
            <Ionicons name="chevron-forward" size={14} color={COLORS.textSecondary} />
          </>
        ) : null}
      </Pressable>

      {state.kind === 'loading' ? (
        <View style={styles.skeletonRow}>
          <View style={styles.skeletonDot} />
          <View style={styles.skeletonLine} />
        </View>
      ) : state.kind === 'error' ? (
        <RetryableError
          variant="chip"
          message={state.message}
          isNetworkError={state.network}
          onRetry={() => setReloadKey((key) => key + 1)}
          style={styles.error}
        />
      ) : preview.length > 0 ? (
        <Pressable onPress={() => setModal({ focusInput: false })} accessibilityRole="button" accessibilityLabel="댓글 모두 보기">
          {preview.map((comment) => (
            <View key={comment.id} style={styles.item}>
              <CommentAvatar name={comment.authorDisplayName} seed={comment.authorKey} size={24} />
              <View style={styles.itemMain}>
                <Text style={styles.itemHead} numberOfLines={1}>
                  <Text style={styles.itemName}>{comment.authorDisplayName}</Text>
                  {'  '}
                  <Text style={styles.itemTime}>{formatCommentTime(comment.createdAt)}</Text>
                  {(comment.likeCount ?? 0) > 0 ? <Text style={styles.itemTime}>{` · 👍 ${comment.likeCount}`}</Text> : null}
                </Text>
                <Text style={styles.itemBody} numberOfLines={2}>
                  {comment.content}
                </Text>
              </View>
            </View>
          ))}
        </Pressable>
      ) : null}

      {state.kind !== 'error' ? (
        <Pressable
          style={({ pressed }) => [styles.write, pressed && styles.pressed]}
          onPress={openWrite}
          accessibilityRole="button"
          accessibilityLabel={accessToken ? '댓글 달기' : '로그인하고 댓글 달기'}
        >
          <Text style={styles.writeText}>
            {accessToken ? (total > 0 ? '댓글 달기…' : '첫 댓글을 남겨 보세요') : '로그인하고 댓글 달기'}
          </Text>
          <Ionicons name="create-outline" size={16} color={COLORS.textTertiary} />
        </Pressable>
      ) : null}

      <ReportCommentsModal
        visible={modal !== null}
        focusInput={modal?.focusInput ?? false}
        report={report}
        onClose={() => {
          setModal(null)
          // 창에서 쓰거나 지운 것을 미리보기에 반영한다.
          setReloadKey((key) => key + 1)
        }}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  section: {
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: COLORS.border,
  },
  header: { flexDirection: 'row', alignItems: 'center', gap: 2, minHeight: 28 },
  headerText: { fontFamily: FONTS.semibold, fontSize: 13, color: COLORS.textPrimary },
  headerCount: { color: COLORS.primary },
  spacer: { flex: 1 },
  more: { fontFamily: FONTS.regular, fontSize: 12, color: COLORS.textSecondary },
  item: { flexDirection: 'row', gap: 8, paddingVertical: 5 },
  itemMain: { flex: 1, minWidth: 0 },
  itemHead: { fontSize: 12 },
  itemName: { fontFamily: FONTS.semibold, fontSize: 12, color: COLORS.textPrimary },
  itemTime: { fontFamily: FONTS.regular, fontSize: 11, color: COLORS.textTertiary },
  itemBody: { fontFamily: FONTS.regular, fontSize: 13, lineHeight: 18, color: COLORS.textPrimary, marginTop: 1 },
  skeletonRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 6 },
  skeletonDot: { width: 24, height: 24, borderRadius: 12, backgroundColor: COLORS.fill },
  skeletonLine: { flex: 1, height: 12, borderRadius: 6, backgroundColor: COLORS.fill },
  error: { marginTop: 6 },
  write: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 8,
    minHeight: 40,
    paddingHorizontal: 14,
    borderRadius: 20,
    backgroundColor: COLORS.fill,
  },
  pressed: { opacity: 0.7 },
  writeText: { fontFamily: FONTS.regular, fontSize: 13, color: COLORS.textTertiary },
})
