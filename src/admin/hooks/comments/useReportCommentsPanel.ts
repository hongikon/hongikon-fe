import { useState } from 'react'
import type { AdminComment } from '../../types'
import { useAdminHost } from '../../ui'
import { commentsApiMissing, type CommentAction } from '../../utils/comments/reportComments'

/** ReportCommentsPanel 의 상태·효과·핸들러. 화면 파일은 이 훅을 불러 그리기만 한다. */
export function useReportCommentsPanel() {
  const app = useAdminHost() === 'app'
  const [open, setOpen] = useState(false)
  const [comments, setComments] = useState<AdminComment[] | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [missing, setMissing] = useState(commentsApiMissing)
  const [pending, setPending] = useState<{ id: number; action: CommentAction } | null>(null)
  const [actionError, setActionError] = useState<{ id: number; message: string } | null>(null)
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
  }
}
