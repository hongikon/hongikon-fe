import type { ReportComment } from '../../../types'

/** 지운 댓글('DELETED') 또는 신고 누적으로 숨겨진 댓글('HIDDEN'). */
export type CommentRemovalReason = 'DELETED' | 'HIDDEN'

/** 숨긴 사용자 걸러 내기 — 최상위 댓글을 숨기면 그 아래 답글도 함께 감춘다(대화 맥락이 없어서). */
export function visibleThreads(items: readonly ReportComment[], hidden: ReadonlySet<string>): ReportComment[] {
  if (hidden.size === 0) return items as ReportComment[]
  const isHidden = (c: ReportComment) => !!c.authorKey && hidden.has(c.authorKey)
  return items
    .filter((c) => !isHidden(c))
    .map((c) => (c.replies?.some(isHidden) ? { ...c, replies: c.replies.filter((r) => !isHidden(r)) } : c))
}

/**
 * 다음에 받을 페이지. 받은 뒤 빠진 최상위 댓글이 없으면 바로 다음 쪽, 있으면 서버 목록에서 아직 못 본 첫 댓글
 * (지금까지 받은 수 − 빠진 수 번째)이 든 쪽을 다시 받는다. 예: 10개씩 2쪽(20개)을 받고 1개를 지웠으면 19번째가
 * 든 1쪽을 다시 받아 당겨진 1개를 얻는다(이미 있는 9개는 id 로 합쳐진다).
 */
export function nextCommentPage(lastPage: number, removedTop: number, pageSize: number): number {
  if (removedTop === 0) return lastPage + 1
  const consumed = (lastPage + 1) * pageSize
  return Math.max(0, Math.floor((consumed - removedTop) / pageSize))
}

/**
 * 댓글 하나가 빠질 때 최상위 목록이 얼마나 줄어드는지. `top` 이면 페이지 경계가 당겨지고(다음 페이지를 겹쳐 받는다),
 * `total` 이면 '나머지 N개' 계산의 전체 수도 하나 줄인다(자리까지 없어진 경우). 답글이 다 빠져 "삭제된 댓글" 자리만
 * 남은 최상위 댓글도 함께 없어지니 같이 센다.
 */
export function commentRemovalCounts(items: readonly ReportComment[], commentId: number): { top: boolean; total: boolean } {
  const removedTop = items.find((top) => top.id === commentId)
  const emptiedPlaceholder = items.find(
    (top) =>
      !!top.placeholder &&
      !!top.replies?.some((r) => r.id === commentId) &&
      Math.max(0, (top.replyCount ?? top.replies.length) - 1) === 0,
  )
  if (!removedTop && !emptiedPlaceholder) return { top: false, total: false }
  return { top: true, total: !!emptiedPlaceholder || (removedTop?.replyCount ?? 0) === 0 }
}

/**
 * 지웠거나 신고로 숨겨진 댓글을 목록에서 정리한다. 답글이 남은 최상위 댓글은 자리로 바꾼다 — 지움이면 "삭제된 댓글",
 * 신고 누적 자동 숨김이면 "운영 정책에 따라 숨겨진 댓글"(서버가 다시 줄 때의 placeholder 와 같게).
 */
export function removeCommentFromThreads(
  items: readonly ReportComment[],
  commentId: number,
  reason: CommentRemovalReason,
): ReportComment[] {
  return items.flatMap((top) => {
    if (top.id === commentId) {
      return (top.replyCount ?? 0) > 0 ? [{ ...top, placeholder: reason, content: null, authorDisplayName: null, authorKey: null, isMine: false }] : []
    }
    if (!top.replies?.some((r) => r.id === commentId)) return [top]
    const replies = top.replies.filter((r) => r.id !== commentId)
    const replyCount = Math.max(0, (top.replyCount ?? replies.length + 1) - 1)
    if (top.placeholder && replyCount === 0) return []
    return [{ ...top, replies, replyCount }]
  })
}

/** 새 답글을 그 최상위 댓글 아래 맨 끝에 붙인다. */
export function appendReply(items: readonly ReportComment[], reply: ReportComment): ReportComment[] {
  return items.map((top) =>
    top.id === reply.parentId
      ? { ...top, replies: [...(top.replies ?? []), reply], replyCount: (top.replyCount ?? 0) + 1 }
      : top,
  )
}

/** '댓글 N개 더 보기' 버튼 문구. 남은 수를 모르면(0 이하) 수 없이. */
export function moreCommentsLabel(topTotal: number, loaded: number): string {
  const rest = Math.max(0, topTotal - loaded)
  const n = rest > 0 ? ` ${rest}개` : ''
  return `댓글${n} 더 보기`
}
