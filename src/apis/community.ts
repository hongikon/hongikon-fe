import { ApiError, apiRequest } from './client'
import { getInstallId } from '../lib/installId'
import type { ReportListItem } from '../types'

/**
 * 제보 커뮤니티 API(hongikon-be `feat/report-community`): 🔥 공감, 관심 제보, 작성자 알림 끄기, 조회 수, HOT 목록, 댓글 👍.
 *
 * 서버 배포 전에는 이 경로들이 없다(로그인 404 서버 문구 없음·405, 게스트 401). 화면은 목록 응답에 해당 필드가
 * 없으면 기능을 아예 그리지 않고, 그래도 호출했다가 "없음"으로 판정되면 조용히 감춘다 — `isCommunityApiMissing`.
 */

export function isCommunityApiMissing(error: unknown, sentToken: boolean): boolean {
  if (!(error instanceof ApiError)) return false
  if (error.status === 405) return true
  if (error.status === 404) return !error.serverMessage
  if (error.status === 401) return !sentToken || error.afterTokenRefresh === true
  return false
}

export interface FireResult {
  fired: boolean
  fireCount: number
  recentFireCount?: number
  hot?: boolean
}

/** 🔥 켜기·끄기. PUT/DELETE 라 같은 요청을 다시 보내도 결과가 같다(멱등) — 빠르게 연타해도 서버 상태는 마지막 값. */
export function setReportFire(reportId: number, fired: boolean, accessToken: string): Promise<FireResult> {
  return apiRequest<FireResult>(`/reports/${reportId}/fire`, {
    method: fired ? 'PUT' : 'DELETE',
    accessToken,
    retries: 0,
  })
}

/** 관심 제보 등록·해제. */
export function setReportFollow(reportId: number, followed: boolean, accessToken: string): Promise<{ followed: boolean }> {
  return apiRequest<{ followed: boolean }>(`/reports/${reportId}/follow`, {
    method: followed ? 'PUT' : 'DELETE',
    accessToken,
    retries: 0,
  })
}

/** 내 제보 알림(새 댓글·🔥 기념) 켜기·끄기. 작성자만(남이면 403). */
export function setReportNotifications(reportId: number, enabled: boolean, accessToken: string): Promise<{ enabled: boolean }> {
  return apiRequest<{ enabled: boolean }>(`/reports/${reportId}/notifications`, {
    method: 'PUT',
    body: { enabled },
    accessToken,
    retries: 0,
  })
}

/**
 * 시트를 열 때 조회 1회. 서버가 계정(로그인)이나 설치 id(`X-Install-Id`)로 하루 한 번만 센다. 앱도 같은 날 같은 제보는
 * 다시 보내지 않는다(메모리). 실패는 조용히 무시한다 — 조회 수는 꾸밈 정보다.
 */
const sentToday = new Set<string>()

function kstDayKey(now: number = Date.now()): string {
  const d = new Date(now + 9 * 3600 * 1000)
  return `${d.getUTCFullYear()}-${d.getUTCMonth() + 1}-${d.getUTCDate()}`
}

export async function recordReportView(
  reportId: number,
  accessToken: string | null,
): Promise<{ viewCount: number; counted: boolean } | null> {
  const key = `${reportId}:${kstDayKey()}`
  if (sentToday.has(key)) return null
  sentToday.add(key)
  try {
    const installId = await getInstallId()
    return await apiRequest<{ viewCount: number; counted: boolean }>(`/reports/${reportId}/views`, {
      method: 'POST',
      accessToken,
      headers: { 'X-Install-Id': installId },
      retries: 0,
    })
  } catch {
    return null
  }
}

/**
 * HOT·인기 제보(`GET /reports?sort=hot`) — 🔥 가 1개 이상인 진행 중 제보를 최근 60분 🔥 순으로 최대 20개.
 * 구서버는 sort 를 몰라 전체 진행 중 목록을 주므로, 여기서도 🔥 가 있는 것만 남기고 같은 순서로 정렬한다.
 */
export async function getHotReports(options: { accessToken?: string | null; signal?: AbortSignal } = {}): Promise<ReportListItem[]> {
  const { reports } = await apiRequest<{ reports: ReportListItem[] }>('/reports?live=true&sort=hot', {
    accessToken: options.accessToken,
    signal: options.signal,
  })
  return sortHot((reports ?? []).filter((r) => (r.fireCount ?? 0) > 0))
}

export function sortHot<T extends Pick<ReportListItem, 'recentFireCount' | 'fireCount' | 'id'>>(reports: readonly T[]): T[] {
  return [...reports].sort(
    (a, b) =>
      (b.recentFireCount ?? 0) - (a.recentFireCount ?? 0) ||
      (b.fireCount ?? 0) - (a.fireCount ?? 0) ||
      b.id - a.id,
  )
}

/** 목록 응답에 커뮤니티 필드가 있는지(= 서버가 이 기능을 안다). */
export function hasCommunityFields(reports: readonly ReportListItem[] | undefined): boolean {
  return !!reports && reports.some((r) => typeof r.fireCount === 'number')
}

/** 댓글 👍 켜기·끄기. */
export function setCommentLike(
  reportId: number,
  commentId: number,
  liked: boolean,
  accessToken: string,
): Promise<{ liked: boolean; likeCount: number }> {
  return apiRequest<{ liked: boolean; likeCount: number }>(`/reports/${reportId}/comments/${commentId}/like`, {
    method: liked ? 'PUT' : 'DELETE',
    accessToken,
    retries: 0,
  })
}

/** 커뮤니티 동작 실패 안내 — 서버 문구(빈도 제한·끝난 제보·관심 제보 개수 초과 등)를 우선한다. */
export function communityErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof ApiError) {
    if ([400, 403, 409, 429].includes(error.status) && error.serverMessage) return error.serverMessage
    if (error.status === 429) return '너무 자주 누르고 있어요. 잠시 뒤에 다시 해 주세요.'
    if (error.status === 409) return '끝난 제보예요.'
    if (error.status === 404) return '지금은 볼 수 없는 제보예요.'
  }
  return fallback
}
