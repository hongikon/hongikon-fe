import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useAuth } from '../../../../contexts/AuthContext'
import { useHiddenAuthorKeys } from '../../../../lib/hiddenAuthors'
import { getErrorMessage, isCancelledError, isNetworkError, isRetryableError } from '../../../../apis/client'
import { COMMENTS_PREVIEW_SIZE, getReportComments, isCommentsApiKnownMissing, isCommentsApiMissing } from '../../../../apis/comments'
import { withoutHiddenCommentAuthors } from '../../../../utils/map/report/comments'
import { promptLogin } from '../../../../utils/map/report/reports'
import type { ReportComment } from '../../../../types'
import { PREVIEW_FETCH_SIZE, type LoadState } from '../../../../utils/map/report/comments/reportCommentsSection'
import type { ReportCommentsSectionProps } from '../../../../components/map/report/comments/ReportCommentsSection'

/** ReportCommentsSection 의 상태·효과·핸들러. 화면 파일은 이 훅을 불러 그리기만 한다. */
export function useReportCommentsSection({ report, onOpen, refreshKey = 0 }: Pick<ReportCommentsSectionProps, 'report' | 'onOpen' | 'refreshKey'>) {
  const { accessToken, logout } = useAuth()
  const hiddenKeys = useHiddenAuthorKeys()
  const [state, setState] = useState<LoadState>(() =>
    isCommentsApiKnownMissing() ? { kind: 'unavailable' } : { kind: 'loading' },
  )
  /** 최근 최상위 댓글(오래된 → 최신 순). */
  const [recent, setRecent] = useState<ReportComment[]>([])
  const [count, setCount] = useState<number | null>(report.commentCount ?? null)
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
  }, [report.id, reloadKey, refreshKey, !!accessToken])

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
    onOpen(true)
  }, [accessToken, logout, onOpen])
  return { accessToken, state, count, setReloadKey, preview, openWrite }
}
