import { useCallback, useState } from 'react'
import { useAuth } from '../../../contexts/AuthContext'
import { useToast } from '../../common/Toast'
import * as haptics from '../../../lib/haptics'
import { hideAuthor } from '../../../lib/hiddenAuthors'
import { ApiError, getErrorMessage } from '../../../apis/client'
import { deleteReportComment, flagReportComment } from '../../../apis/comments'
import { communityErrorMessage, setCommentLike } from '../../../apis/community'
import { confirmAction } from '../../../utils/dialog'
import { promptLogin } from '../../../utils/reports'
import type { ReportComment, ReportFlagReason } from '../../../types'

/** 목록에서 빠진 까닭. 답글이 남은 최상위 댓글은 이 값으로 자리 문구를 고른다("삭제된 댓글" / "운영 정책에 따라 숨겨진 댓글"). */
export type CommentRemovedReason = 'DELETED' | 'HIDDEN'

/** 댓글 신고 빈도 제한(서버 10분 10번)에 걸렸을 때. 서버 문구가 없을 때(구버전·프록시) 쓴다. */
const FLAG_RATE_LIMIT_MESSAGE = '신고를 너무 자주 하고 있어요. 잠시 뒤에 다시 시도해 주세요.'

/**
 * 댓글 한 줄에서 하는 일(내 댓글 지우기·남의 댓글 신고·작성자 숨기기). 시트 미리보기와 전체 댓글 창이 같이 쓴다.
 * `onRemoved` 는 목록에서 빼야 할 때(지움 → DELETED, 신고로 자동 숨김 → HIDDEN) 부른다. 작성자 숨기기는 `useHiddenAuthorKeys` 가 걸러 준다.
 */
export function useCommentActions(
  reportId: number,
  onRemoved: (commentId: number, reason?: CommentRemovedReason) => void,
  /** 👍 처럼 목록 안에서 값만 바뀔 때(낙관적 반영·실패 시 되돌리기). */
  onUpdated?: (commentId: number, patch: Partial<ReportComment>) => void,
) {
  const { accessToken, logout } = useAuth()
  const toast = useToast()
  /** 지우는 중·신고 보내는 중인 댓글. */
  const [pendingId, setPendingId] = useState<number | null>(null)
  /**
   * 이번에 신고한 댓글(같은 창에서 다시 신고 버튼을 보이지 않게). 예전에 신고한 댓글은 서버가 주는 `flaggedByMe` 로 안다 —
   * 화면에서는 둘을 합쳐 본다(`isFlagged`).
   */
  const [flaggedIds, setFlaggedIds] = useState<ReadonlySet<number>>(() => new Set())

  const markFlagged = (id: number) => setFlaggedIds((prev) => new Set(prev).add(id))

  const remove = useCallback(
    (comment: ReportComment) => {
      if (!accessToken) return
      confirmAction({
        title: '댓글을 지울까요?',
        message: '지운 댓글은 다른 사람에게 더 이상 보이지 않아요.',
        confirmLabel: '지우기',
        destructive: true,
        onConfirm: () => {
          setPendingId(comment.id)
          deleteReportComment(reportId, comment.id, accessToken)
            .then(() => {
              haptics.success()
              toast.show({ message: '댓글을 지웠어요' })
              onRemoved(comment.id)
            })
            .catch((error: unknown) => {
              // 이미 지워졌거나 제보가 내려갔으면 목록에서만 뺀다.
              if (error instanceof ApiError && error.status === 404) {
                onRemoved(comment.id)
                return
              }
              toast.show({ message: getErrorMessage(error, '댓글을 지우지 못했어요.'), tone: 'warning' })
            })
            .finally(() => setPendingId(null))
        },
      })
    },
    [accessToken, reportId, onRemoved, toast],
  )

  /** 신고 버튼을 눌렀을 때 — 게스트면 로그인 안내 후 false. */
  const canFlag = useCallback(() => {
    if (accessToken) return true
    promptLogin('댓글을 신고하려면 로그인해 주세요.', logout)
    return false
  }, [accessToken, logout])

  const flag = useCallback(
    (comment: ReportComment, reason: ReportFlagReason) => {
      if (!accessToken) return
      setPendingId(comment.id)
      flagReportComment(reportId, comment.id, reason, accessToken)
        .then((result) => {
          markFlagged(comment.id)
          haptics.success()
          toast.show({ message: '신고가 접수됐어요. 확인 후 조치할게요' })
          // 이번 신고로 자동 숨김 — 운영 정책에 따른 숨김이라 "삭제된 댓글"이 아니라 숨김 자리로 바꾼다.
          if (result?.hidden) onRemoved(comment.id, 'HIDDEN')
        })
        .catch((error: unknown) => {
          if (error instanceof ApiError && error.status === 409) {
            markFlagged(comment.id)
            toast.show({ message: '이미 신고한 댓글이에요', tone: 'info' })
            return
          }
          if (error instanceof ApiError && error.status === 404) {
            // 그사이 숨겨졌거나 지워졌다.
            onRemoved(comment.id)
            toast.show({ message: '이미 내려간 댓글이에요', tone: 'info' })
            return
          }
          if (error instanceof ApiError && error.status === 429) {
            // 신고 남용 방지 제한(10분 10번). 이번 신고는 접수되지 않았다 — 표시는 그대로 두고 다시 하도록 안내만.
            toast.show({ message: error.serverMessage || FLAG_RATE_LIMIT_MESSAGE, tone: 'warning' })
            return
          }
          const message =
            error instanceof ApiError && error.status === 403 && error.serverMessage
              ? error.serverMessage
              : getErrorMessage(error, '신고를 접수하지 못했어요.')
          toast.show({ message, tone: 'warning' })
        })
        .finally(() => setPendingId(null))
    },
    [accessToken, reportId, onRemoved, toast],
  )

  const hide = useCallback(
    (comment: ReportComment) => {
      const key = comment.authorKey
      if (!key) return
      const name = comment.authorDisplayName ?? '익명'
      confirmAction({
        title: '이 사용자 숨기기',
        message: `${name}님이 쓴 제보와 댓글이 이 기기에서 더 이상 보이지 않아요. 설정 > 일반 > 숨긴 사용자에서 다시 볼 수 있어요.`,
        confirmLabel: '숨기기',
        destructive: true,
        onConfirm: () => {
          hideAuthor(key, name)
          haptics.success()
          toast.show({ message: '이 사용자의 제보와 댓글을 숨겼어요' })
        },
      })
    },
    [toast],
  )

  /** 👍 켜기·끄기. 내 댓글은 누를 수 없다(서버 400). 게스트는 로그인 안내. */
  const like = useCallback(
    (comment: ReportComment) => {
      if (comment.isMine) {
        toast.show({ message: '내 댓글에는 좋아요를 누를 수 없어요', tone: 'info' })
        return
      }
      if (!accessToken) {
        promptLogin('좋아요를 누르려면 로그인해 주세요.', logout)
        return
      }
      const next = !comment.likedByMe
      const before = { likedByMe: !!comment.likedByMe, likeCount: comment.likeCount ?? 0 }
      if (next) haptics.switchOn()
      else haptics.tapLight()
      onUpdated?.(comment.id, { likedByMe: next, likeCount: Math.max(0, before.likeCount + (next ? 1 : -1)) })
      setCommentLike(reportId, comment.id, next, accessToken)
        .then((result) => onUpdated?.(comment.id, { likedByMe: result.liked, likeCount: result.likeCount }))
        .catch((error: unknown) => {
          onUpdated?.(comment.id, before)
          toast.show({ message: communityErrorMessage(error, '좋아요를 반영하지 못했어요.'), tone: 'warning' })
        })
    },
    [accessToken, logout, reportId, onUpdated, toast],
  )

  /** 내가 신고한 댓글인지 — 이번 창에서 신고했거나, 서버가 `flaggedByMe` 로 알려 준 것(다시 열어도 "신고함" 유지). */
  const isFlagged = useCallback(
    (comment: Pick<ReportComment, 'id' | 'flaggedByMe'>) => flaggedIds.has(comment.id) || comment.flaggedByMe === true,
    [flaggedIds],
  )

  return { pendingId, flaggedIds, isFlagged, remove, flag, canFlag, hide, like }
}
