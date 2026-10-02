import type { ReportComment } from '../types'
import { parseServerTime } from './serverTime'

/** 댓글 시각. '방금 전' · '12분 전' · '3시간 전' · '2일 전'(제보는 길어야 7일이라 날짜까지는 쓰지 않는다). */
export function formatCommentTime(iso: string, now: number = Date.now()): string {
  const ms = parseServerTime(iso)
  if (!Number.isFinite(ms)) return ''
  const minutes = Math.floor((now - ms) / 60000)
  if (minutes < 1) return '방금 전'
  if (minutes < 60) return `${minutes}분 전`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}시간 전`
  return `${Math.floor(hours / 24)}일 전`
}

/**
 * 페이지를 이어 붙인다. 그사이 새 댓글을 직접 붙였으면 같은 id 는 한 번만 남긴다.
 * order: 'oldest'(기본, id 오름차순) / 'latest'(id 내림차순) / 'popular'(서버가 준 순서 유지 — 새 것은 뒤에).
 */
export function mergeComments(
  prev: readonly ReportComment[],
  next: readonly ReportComment[],
  order: 'oldest' | 'latest' | 'popular' = 'oldest',
): ReportComment[] {
  const byId = new Map<number, ReportComment>()
  for (const comment of prev) byId.set(comment.id, comment)
  for (const comment of next) byId.set(comment.id, comment)
  const merged = [...byId.values()]
  if (order === 'popular') return merged
  return merged.sort((a, b) => (order === 'latest' ? b.id - a.id : a.id - b.id))
}

/** 목록(최상위 + 답글) 안의 댓글 하나에 값을 덮어쓴다(👍 등). */
export function patchComment(
  items: readonly ReportComment[],
  commentId: number,
  patch: Partial<ReportComment>,
): ReportComment[] {
  return items.map((top) => {
    if (top.id === commentId) return { ...top, ...patch }
    if (!top.replies?.some((r) => r.id === commentId)) return top
    return { ...top, replies: top.replies.map((r) => (r.id === commentId ? { ...r, ...patch } : r)) }
  })
}

/** 서버가 댓글 👍 를 아는지(첫 댓글에 likeCount 가 있는지). */
export function supportsCommentLikes(items: readonly ReportComment[]): boolean {
  return items.some((c) => typeof c.likeCount === 'number')
}

/** 숨긴 사용자의 댓글을 뺀다. authorKey 가 없는 댓글은 그대로 둔다. */
export function withoutHiddenCommentAuthors(
  comments: readonly ReportComment[],
  hidden: ReadonlySet<string>,
): ReportComment[] {
  if (hidden.size === 0) return comments as ReportComment[]
  return comments.filter((comment) => !comment.authorKey || !hidden.has(comment.authorKey))
}

/** 입력 중 글자 수(서버와 같이 앞뒤 공백을 지운 뒤 센다). */
export function commentLength(text: string): number {
  return text.trim().length
}
