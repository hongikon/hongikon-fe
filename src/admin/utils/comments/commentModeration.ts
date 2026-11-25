import { FLAG_REASON_LABEL } from '../../format'
import type { AdminComment, AdminCommentStatus, AdminFlaggedComment, FlagReason } from '../../types'

/**
 * 신고 댓글(FlaggedCommentsScreen)의 처리 규칙과 표시 문구(순수 함수).
 */

/**
 * 숨김·삭제 사유 버튼. 작성자 알림에 그대로 들어간다. 서버가 사유를 비웠을 때 쓰는 신고 사유 문구(ReportCommentService.FLAG_REASON_LABELS)와 같다.
 */
export const MODERATION_REASONS = ['욕설·비하 등 부적절한 내용', '스팸·광고', '개인정보 노출', '허위 정보'] as const
const FLAG_TO_REASON: Record<string, (typeof MODERATION_REASONS)[number]> = {
  INAPPROPRIATE: '욕설·비하 등 부적절한 내용',
  SPAM: '스팸·광고',
  PRIVACY: '개인정보 노출',
  FALSE_INFO: '허위 정보',
}

/** 가장 많이 들어온 신고 사유의 문구(기타·없음이면 빈칸). */
export function topReasonLabel(flagReasons: Record<string, number> | null | undefined): string {
  let best = ''
  let bestCount = 0
  for (const [code, count] of Object.entries(flagReasons ?? {})) {
    if (FLAG_TO_REASON[code] && count > bestCount) {
      best = FLAG_TO_REASON[code]
      bestCount = count
    }
  }
  return best
}

export type CommentAction = 'keep' | 'hide' | 'delete' | 'restore'

export const COMMENT_ACTION_META: Record<CommentAction, { label: string; target: AdminCommentStatus; done: string }> = {
  keep: { label: '검토 완료(유지)', target: 'VISIBLE', done: '검토 완료 · 유지' },
  hide: { label: '숨김', target: 'HIDDEN', done: '숨김 처리함' },
  delete: { label: '삭제', target: 'DELETED', done: '삭제함' },
  restore: { label: '다시 공개', target: 'VISIBLE', done: '다시 공개함' },
}

/**
 * 공개 중이면 유지·숨김·삭제, 신고 누적으로 자동 숨김됐으면 다시 공개·숨김 유지(사유와 함께 작성자에게 다시 알림)·삭제.
 * 어떤 처리든 서버가 검토 시각을 남겨 그 전 신고는 더 세지 않는다 — 그래서 처리한 댓글은 다음에 목록을 받을 때 빠진다.
 */
export function commentActionsFor(comment: AdminComment): CommentAction[] {
  if (comment.status === 'VISIBLE') return ['keep', 'hide', 'delete']
  if (comment.status === 'HIDDEN') return ['restore', 'hide', 'delete']
  return []
}

/** 버튼 글자. 이미 숨겨진 댓글의 '숨김'은 '숨김 유지'. */
export function commentActionLabel(comment: AdminComment, action: CommentAction): string {
  return comment.status === 'HIDDEN' && action === 'hide' ? '숨김 유지' : COMMENT_ACTION_META[action].label
}

/** '부적절 2, 스팸 1' 처럼 신고 사유별 건수. */
export function flagReasonsText(flagReasons: AdminFlaggedComment['flagReasons']): string {
  return Object.entries(flagReasons ?? {})
    .map(([key, count]) => `${FLAG_REASON_LABEL[key as FlagReason] ?? key} ${count}`)
    .join(', ')
}

/** 상태 배지 글자. 검토 대기 중인 숨김은 늘 신고 누적 자동 숨김이다(관리자가 숨긴 댓글은 더 신고할 수 없다). */
export function commentStatusLabel(status: AdminCommentStatus, handled: boolean): string {
  return status === 'VISIBLE' ? '공개 중' : status === 'HIDDEN' ? (handled ? '숨김' : '자동 숨김') : '삭제됨'
}

/** 신고 건수 배지. 처리한 뒤에는 서버가 그 전 신고를 더 세지 않는다 — "검토 대기"로 남겨 두지 않는다. */
export function flagCountLabel(item: Pick<AdminFlaggedComment, 'flagCount' | 'pendingFlagCount'>, handled: boolean): string {
  if (handled) return `신고 ${item.flagCount}건`
  return `신고 ${item.pendingFlagCount}건 검토 대기${item.flagCount > item.pendingFlagCount ? ` · 전체 ${item.flagCount}` : ''}`
}
