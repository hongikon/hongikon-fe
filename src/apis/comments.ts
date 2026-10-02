import { ApiError, apiRequest } from './client'
import type { ReportComment, ReportCommentFlagResult, ReportCommentPage, ReportFlagReason } from '../types'

/**
 * 제보 댓글 API(hongikon-be `ReportCommentController`).
 * - 목록: 게스트도 본다. 지도에 공개된 제보의 공개 댓글만, 기본 오래된 순(`order=latest` 면 최신 순).
 * - 쓰기·지우기·신고: 로그인 필요. 쓰기는 1~200자, 1분 5개·하루 50개(429), 끝난 제보 409, 정지 회원 403.
 *
 * 서버에 댓글 기능이 아직 없으면(배포 전) 화면은 댓글 UI 를 통째로 감춘다 — `isCommentsApiMissing`.
 */

export type CommentOrder = 'oldest' | 'latest' | 'popular'

/** 서버 `ReportComment.MAX_LENGTH` 와 같다(앞뒤 공백을 지운 뒤 글자 수). */
export const COMMENT_MAX_LENGTH = 200
export const COMMENTS_PAGE_SIZE = 20
/** 제보 시트에 미리 보여 줄 최근 댓글 수. */
export const COMMENTS_PREVIEW_SIZE = 2

/**
 * 서버에 댓글 API 가 없는지(백엔드 배포 전).
 * - 옛 서버는 `GET /reports/{id}/comments` 를 인증이 필요한 경로로 보고 게스트에게 401 을 준다(토큰 없이 보낸 401).
 * - 로그인 상태면 없는 경로라 404(서버 문구 없음) 또는 405. 새 서버의 "없는 제보" 404 는 `{message}` 가 있어 구별된다.
 * - 토큰을 막 재발급받았는데도 401 이면 토큰 문제가 아니다(없는 경로를 401 로 돌려주는 경우, `isMyReportsApiMissing` 과 같음).
 */
export function isCommentsApiMissing(error: unknown, sentToken: boolean): boolean {
  if (!(error instanceof ApiError)) return false
  if (error.status === 405) return true
  if (error.status === 404) return !error.serverMessage
  if (error.status === 401) return !sentToken || error.afterTokenRefresh === true
  return false
}

/** 한 번 "API 없음"으로 판정되면 앱을 다시 켤 때까지 부르지 않는다. */
let apiMissing = false

export function isCommentsApiKnownMissing(): boolean {
  return apiMissing
}

/** 테스트·스크린샷용. */
export function resetCommentsApiMissing(): void {
  apiMissing = false
}

export async function getReportComments(
  reportId: number,
  options: {
    page?: number
    size?: number
    /** oldest(기본·서버 기본값) / latest(최신순) / popular(인기순 — 👍 많은 순, 좋아요 기능 전 서버는 무시하고 오래된 순). */
    order?: CommentOrder
    accessToken?: string | null
    signal?: AbortSignal
  } = {},
): Promise<ReportCommentPage> {
  const params = new URLSearchParams({
    page: String(options.page ?? 0),
    size: String(options.size ?? COMMENTS_PAGE_SIZE),
  })
  if (options.order === 'latest' || options.order === 'popular') params.set('order', options.order)
  try {
    const page = await apiRequest<ReportCommentPage>(`/reports/${reportId}/comments?${params.toString()}`, {
      accessToken: options.accessToken,
      signal: options.signal,
    })
    return {
      content: Array.isArray(page?.content) ? page.content : [],
      page: page?.page ?? 0,
      size: page?.size ?? 0,
      totalElements: page?.totalElements ?? 0,
      totalPages: page?.totalPages ?? 0,
      hasNext: !!page?.hasNext,
      commentCount: typeof page?.commentCount === 'number' ? page.commentCount : page?.totalElements ?? 0,
    }
  } catch (error) {
    if (isCommentsApiMissing(error, !!options.accessToken)) apiMissing = true
    throw error
  }
}

/**
 * 댓글·답글 쓰기. parentId 를 주면 답글 — 답글에 답해도 서버가 같은 최상위 댓글에 붙인다(한 단계만).
 * POST 라 자동으로 다시 보내지 않는다(중복 댓글 방지).
 */
export function createReportComment(
  reportId: number,
  content: string,
  accessToken: string,
  parentId?: number | null,
): Promise<ReportComment> {
  return apiRequest<ReportComment>(`/reports/${reportId}/comments`, {
    method: 'POST',
    body: parentId ? { content, parentId } : { content },
    accessToken,
    retries: 0,
  })
}

/** 최상위 댓글의 공개 답글(오래된 순) — "답글 N개 더 보기". */
export async function getCommentReplies(
  reportId: number,
  commentId: number,
  options: { page?: number; size?: number; accessToken?: string | null; signal?: AbortSignal } = {},
): Promise<{ content: ReportComment[]; hasNext: boolean; totalElements: number }> {
  const params = new URLSearchParams({ page: String(options.page ?? 0), size: String(options.size ?? COMMENTS_PAGE_SIZE) })
  const page = await apiRequest<{ content: ReportComment[]; hasNext: boolean; totalElements: number }>(
    `/reports/${reportId}/comments/${commentId}/replies?${params.toString()}`,
    { accessToken: options.accessToken, signal: options.signal },
  )
  return {
    content: Array.isArray(page?.content) ? page.content : [],
    hasNext: !!page?.hasNext,
    totalElements: page?.totalElements ?? 0,
  }
}

export async function deleteReportComment(reportId: number, commentId: number, accessToken: string): Promise<void> {
  await apiRequest<void>(`/reports/${reportId}/comments/${commentId}`, { method: 'DELETE', accessToken })
}

export function flagReportComment(
  reportId: number,
  commentId: number,
  reason: ReportFlagReason,
  accessToken: string,
): Promise<ReportCommentFlagResult> {
  return apiRequest<ReportCommentFlagResult>(`/reports/${reportId}/comments/${commentId}/flags`, {
    method: 'POST',
    body: { reason },
    accessToken,
    retries: 0,
  })
}

/** 댓글 쓰기 실패 안내. 서버가 사용자용 문구를 준 경우(빈도 제한·정지·끝난 제보·글자 수) 그 문구를 쓴다. */
export function commentWriteErrorMessage(error: unknown): string | null {
  if (!(error instanceof ApiError)) return null
  if ([400, 403, 409, 429].includes(error.status) && error.serverMessage) return error.serverMessage
  if (error.status === 429) return '댓글을 너무 자주 달고 있어요. 잠시 뒤에 다시 시도해 주세요.'
  if (error.status === 404) return '이 댓글이나 제보가 내려가서 댓글을 달 수 없어요.'
  return null
}
