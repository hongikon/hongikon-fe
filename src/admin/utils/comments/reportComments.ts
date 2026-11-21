import type { AdminComment } from '../../types'

export type CommentAction = 'hide' | 'delete' | 'restore'

/**
 * 작성자가 스스로 지운 댓글(관리자 검토 기록 없음)은 되살리지 않는다 — 작성자의 삭제 의사를 따른다.
 * 관리자가 숨기거나 지운 댓글만 다시 공개할 수 있다.
 */
export function actionsFor(comment: AdminComment): CommentAction[] {
  switch (comment.status) {
    case 'VISIBLE':
      return ['hide', 'delete']
    case 'HIDDEN':
      return ['restore', 'delete']
    case 'DELETED':
      return comment.reviewedAt ? ['restore'] : []
  }
}

/** 서버는 id 순으로 준다 — 답글을 그 최상위 댓글 바로 아래로 모아 대화 순서로 보여 준다. */
export function byThread(comments: AdminComment[]): AdminComment[] {
  const replies = new Map<number, AdminComment[]>()
  for (const c of comments) {
    if (c.parentId) replies.set(c.parentId, [...(replies.get(c.parentId) ?? []), c])
  }
  const roots = comments.filter((c) => !c.parentId)
  const rootIds = new Set(roots.map((c) => c.id))
  const orphans = comments.filter((c) => c.parentId && !rootIds.has(c.parentId))
  return [...roots.flatMap((root) => [root, ...(replies.get(root.id) ?? [])]), ...orphans]
}

/** 서버에 댓글 관리 API 가 없으면(배포 전) 한 번 확인한 뒤로는 토글 자체를 감춘다. */
export let commentsApiMissing = false

/** 댓글 API 가 없음을 기억한다. */
export function markCommentsApiMissing(): void {
  commentsApiMissing = true
}
