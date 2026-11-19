import { useCallback, useEffect, useState } from 'react'
import { getErrorMessage, isCancelledError } from '../../apis/client'
import { fetchFlaggedComments, isAdminCommentsMissing } from '../api'
import type { AdminComment, AdminFlaggedComment } from '../types'
import type { CommentAction } from '../utils/commentModeration'

/**
 * 신고 댓글 목록. 새로 받을 때마다 '방금 처리함' 표시를 비운다. 이 기능 전 서버(경로 없음)면 `missing`.
 * 처리한 카드는 목록에서 지우지 않고 바뀐 상태로 남긴다(실수했을 때 바로 되돌릴 수 있게).
 */
export function useFlaggedComments(onChanged: () => void) {
  const [items, setItems] = useState<AdminFlaggedComment[] | null>(null)
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [missing, setMissing] = useState(false)
  /** 이번에 처리한 댓글 id → 처리 내용. 카드를 지우지 않고 흐리게 남긴다. */
  const [handled, setHandled] = useState<Record<number, CommentAction>>({})
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    const controller = new AbortController()
    setLoading(true)
    setError(null)
    fetchFlaggedComments(controller.signal)
      .then((result) => {
        setItems(result.comments)
        setTotal(result.total)
        setHandled({})
      })
      .catch((err: unknown) => {
        if (isCancelledError(err)) return
        if (isAdminCommentsMissing(err)) {
          setMissing(true)
          return
        }
        setError(getErrorMessage(err, '신고된 댓글을 불러오지 못했습니다.'))
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false)
      })
    return () => controller.abort()
  }, [reloadKey])

  const reload = () => setReloadKey((key) => key + 1)

  const handleDone = useCallback(
    (updated: AdminComment, action: CommentAction) => {
      setItems((prev) => prev?.map((item) => (item.id === updated.id ? { ...item, ...updated } : item)) ?? prev)
      setHandled((prev) => ({ ...prev, [updated.id]: action }))
      onChanged()
    },
    [onChanged],
  )

  return { items, total, loading, error, missing, handled, reload, handleDone }
}
