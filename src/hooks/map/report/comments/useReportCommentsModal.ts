import { useCallback, useState } from 'react'
import { useReportCommentThread } from '../useReportCommentThread'
import type { ReportCommentsModalProps } from '../../../../components/map/report/comments/ReportCommentsModal'

/** ReportCommentsModal 의 상태·효과·핸들러. 화면 파일은 이 훅을 불러 그리기만 한다. */
export function useReportCommentsModal({ visible, report, focusInput = false }: Pick<ReportCommentsModalProps, 'visible' | 'report' | 'focusInput'>) {
  // 크게 보는 사진 번호. null 이면 닫힘.
  const [viewerIndex, setViewerIndex] = useState<number | null>(null)
  const closeViewer = useCallback(() => setViewerIndex(null), [])
  const {
    items,
    shown,
    count,
    state,
    refreshing,
    loadingMore,
    loadingReplies,
    replyTo,
    setReplyTo,
    focusKey,
    menuFor,
    setMenuFor,
    hasNext,
    topTotal,
    listRef,
    load,
    loadRest,
    handlePosted,
    handleReply,
    loadMoreReplies,
    actions,
  } = useReportCommentThread(report.id, visible, focusInput)
  return {
    viewerIndex,
    setViewerIndex,
    closeViewer,
    items,
    shown,
    count,
    state,
    refreshing,
    loadingMore,
    loadingReplies,
    replyTo,
    setReplyTo,
    focusKey,
    menuFor,
    setMenuFor,
    hasNext,
    topTotal,
    listRef,
    load,
    loadRest,
    handlePosted,
    handleReply,
    loadMoreReplies,
    actions,
  }
}
