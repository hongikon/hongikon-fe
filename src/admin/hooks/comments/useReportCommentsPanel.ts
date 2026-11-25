import { useState } from 'react'
import type { AdminComment } from '../../types'
import { useAdminHost } from '../../ui'
import { commentsApiMissing, type CommentAction } from '../../utils/comments/reportComments'
import { getErrorMessage } from '../../../apis/client'
import { confirmAction } from '../../../utils/common/dialog'
import { fetchReportComments, isAdminCommentsMissing, updateCommentStatus } from '../../api'
import { markCommentsApiMissing } from '../../utils/comments/reportComments'
import { ACTION_META } from '../../utils/comments/reportComments'

/** ReportCommentsPanel 의 상태·효과·핸들러. 화면 파일은 이 훅을 불러 그리기만 한다. */
export function useReportCommentsPanel({ reportId }: Pick<{ reportId: number }, 'reportId'>) {
  const app = useAdminHost() === 'app'
  const [open, setOpen] = useState(false)
  const [comments, setComments] = useState<AdminComment[] | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [missing, setMissing] = useState(commentsApiMissing)
  const [pending, setPending] = useState<{ id: number; action: CommentAction } | null>(null)
  const [actionError, setActionError] = useState<{ id: number; message: string } | null>(null)

  const load = () => {
    setLoading(true)
    setError(null)
    fetchReportComments(reportId)
      .then(setComments)
      .catch((err: unknown) => {
        if (isAdminCommentsMissing(err)) {
          markCommentsApiMissing()
          setMissing(true)
          return
        }
        setError(getErrorMessage(err, '댓글을 불러오지 못했습니다.'))
      })
      .finally(() => setLoading(false))
  }

  const toggle = () => {
    const next = !open
    setOpen(next)
    if (next && !comments && !loading) load()
  }

  const run = (comment: AdminComment, action: CommentAction) => {
    setPending({ id: comment.id, action })
    setActionError(null)
    updateCommentStatus(comment.id, ACTION_META[action].target)
      .then((updated) => setComments((prev) => prev?.map((item) => (item.id === updated.id ? updated : item)) ?? prev))
      .catch((err: unknown) => setActionError({ id: comment.id, message: getErrorMessage(err, '처리하지 못했습니다. 다시 시도해주세요.') }))
      .finally(() => setPending(null))
  }

  const onAction = (comment: AdminComment, action: CommentAction) => {
    if (!app) {
      run(comment, action)
      return
    }
    confirmAction({
      title: `댓글 ${ACTION_META[action].label}`,
      message: `${ACTION_META[action].confirm}\n\n"${comment.content.slice(0, 60)}"`,
      confirmLabel: ACTION_META[action].label,
      destructive: ACTION_META[action].destructive,
      onConfirm: () => run(comment, action),
    })
  }
  return {
    app,
    open,
    setOpen,
    comments,
    setComments,
    loading,
    setLoading,
    error,
    setError,
    missing,
    setMissing,
    pending,
    setPending,
    actionError,
    setActionError,
    load,
    toggle,
    onAction,
  }
}
