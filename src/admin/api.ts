import { apiRequest, ApiError, NetworkError, type ApiRequestOptions } from '../apis/client'
import { buildWebKakaoLoginUrl, exchangeAuthCode, logoutRequest, type TokenResponse } from '../apis/auth'
import { clearTokens, getTokens, saveTokens, type MockMode } from './session'
import type {
  AdminFeedback,
  AdminOverview,
  AdminReport,
  AdminReportFlag,
  FeedbackStatus,
  FeedbackStatusFilter,
  ReportStatusFilter,
  ReportTargetStatus,
} from './types'

/**
 * 관리자 화면 전용 API 모듈.
 *
 * 요청 자체는 앱과 같은 `apiRequest`(웹 운영에선 `/api` 프록시)를 쓰고, 여기서는
 * 관리자 토큰(sessionStorage)을 붙이고 401/403 을 처리하는 일만 더한다.
 * - 401: `/auth/reissue` 로 한 번만 재발급해 같은 요청을 다시 보낸다. 재발급도 실패하면
 *        토큰을 지우고 'unauthenticated' 를 알려 로그인 화면으로 돌려보낸다.
 *        401 은 서버가 인증 단계에서 막은 것이라 POST 를 다시 보내도 중복 처리되지 않는다.
 * - 403: 로그인은 됐지만 ADMIN 이 아니다. 'forbidden' 을 알려 권한 안내 화면을 띄운다.
 */

/** 크롤링·위치 보정은 서버에서 수십 초~분 단위로 돌 수 있어 넉넉히 기다린다. */
const LONG_TASK_TIMEOUT_MS = 180_000

// ── 로그인 ────────────────────────────────────────────────────────────

/** 카카오 로그인 주소. 성공하면 서버가 `{현재 출처}/admin?code=...` 로 돌려보낸다. */
export function buildAdminLoginUrl(): string | null {
  return buildWebKakaoLoginUrl('/admin')
}

/** 1회용 코드 → 토큰. 성공하면 sessionStorage 에 저장한다. */
export async function completeLogin(code: string): Promise<void> {
  const tokens = await exchangeAuthCode(code)
  saveTokens(tokens)
}

/** 서버 쪽 refresh 토큰 폐기는 최선만 다하고(실패해도 무시) 로컬 토큰은 반드시 지운다. */
export async function logout(): Promise<void> {
  const tokens = getTokens()
  clearTokens()
  if (tokens && !activeMockMode) {
    await logoutRequest(tokens.refreshToken).catch(() => undefined)
  }
}

// ── 인증 이벤트 ─────────────────────────────────────────────────────────

export type AdminAuthEvent = 'unauthenticated' | 'forbidden'
type AuthListener = (event: AdminAuthEvent) => void
const authListeners = new Set<AuthListener>()

export function subscribeAdminAuth(listener: AuthListener): () => void {
  authListeners.add(listener)
  return () => {
    authListeners.delete(listener)
  }
}

function emitAuth(event: AdminAuthEvent): void {
  authListeners.forEach((listener) => listener(event))
}

// ── 목업 ──────────────────────────────────────────────────────────────

let activeMockMode: MockMode | null = null

/** AdminApp 이 시작할 때 한 번 정한다. 운영 빌드에서는 항상 null 이 들어온다. */
export function setMockMode(mode: MockMode | null): void {
  activeMockMode = __DEV__ ? mode : null
}

// ── 공통 요청 ─────────────────────────────────────────────────────────

type AdminRequestOptions = Pick<ApiRequestOptions, 'method' | 'body' | 'timeoutMs' | 'retries' | 'signal'>

/** 동시에 여러 요청이 401 을 받아도 재발급은 한 번만 보낸다(refresh 토큰이 로테이션되기 때문). */
let reissueInFlight: Promise<boolean> | null = null

/**
 * refresh 토큰으로 새 토큰을 받는다. 서버가 거절(4xx)하면 false.
 * 네트워크 오류는 "로그아웃할 이유"가 아니라서 그대로 던진다 — 연결이 돌아오면 다시 쓸 수 있다.
 */
function reissueTokens(): Promise<boolean> {
  if (!reissueInFlight) {
    reissueInFlight = (async () => {
      const refreshToken = getTokens()?.refreshToken
      if (!refreshToken) return false
      try {
        const next = await apiRequest<TokenResponse>('/auth/reissue', {
          method: 'POST',
          body: { refreshToken },
          retries: 0,
        })
        saveTokens(next)
        return true
      } catch (error) {
        if (error instanceof ApiError && error.status >= 400 && error.status < 500) return false
        throw error
      }
    })().finally(() => {
      reissueInFlight = null
    })
  }
  return reissueInFlight
}

function sessionExpired(): ApiError {
  clearTokens()
  emitAuth('unauthenticated')
  return new ApiError(401, '로그인이 만료되었습니다. 다시 로그인해주세요.')
}

async function adminRequest<T>(path: string, options: AdminRequestOptions = {}): Promise<T> {
  if (__DEV__ && activeMockMode) {
    const { handleMockRequest } = await import('./mock')
    try {
      return (await handleMockRequest(path, options, activeMockMode)) as T
    } catch (error) {
      if (error instanceof ApiError && error.status === 403) emitAuth('forbidden')
      throw error
    }
  }

  const tokens = getTokens()
  if (!tokens) throw sessionExpired()

  const send = (accessToken: string) => apiRequest<T>(path, { ...options, accessToken })

  try {
    return await send(tokens.accessToken)
  } catch (error) {
    if (!(error instanceof ApiError)) throw error
    if (error.status === 403) {
      emitAuth('forbidden')
      throw error
    }
    if (error.status !== 401) throw error
  }

  // 401 → 한 번만 재발급 후 재요청
  const reissued = await reissueTokens()
  const renewed = getTokens()
  if (!reissued || !renewed) throw sessionExpired()
  try {
    return await send(renewed.accessToken)
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) throw sessionExpired()
    if (error instanceof ApiError && error.status === 403) emitAuth('forbidden')
    throw error
  }
}

// ── 대시보드 ──────────────────────────────────────────────────────────

export function fetchOverview(signal?: AbortSignal): Promise<AdminOverview> {
  return adminRequest<AdminOverview>('/admin/overview', { signal })
}

// ── 제보 검토 ─────────────────────────────────────────────────────────

export async function fetchReports(status: ReportStatusFilter, signal?: AbortSignal): Promise<AdminReport[]> {
  const response = await adminRequest<{ reports: AdminReport[] }>(
    `/admin/reports?status=${encodeURIComponent(status)}`,
    { signal },
  )
  return response?.reports ?? []
}

export async function fetchReportFlags(reportId: number): Promise<AdminReportFlag[]> {
  const response = await adminRequest<{ flags: AdminReportFlag[] }>(`/admin/reports/${reportId}/flags`)
  return response?.flags ?? []
}

/** 상태 변경. REJECTED 일 때만 반려 사유(note)를 싣는다. 응답은 바뀐 제보. */
export function updateReportStatus(reportId: number, status: ReportTargetStatus, note?: string): Promise<AdminReport> {
  return adminRequest<AdminReport>(`/admin/reports/${reportId}`, {
    method: 'PATCH',
    body: note ? { status, note } : { status },
    retries: 0,
  })
}

// ── 문의 ──────────────────────────────────────────────────────────────

export async function fetchFeedback(status: FeedbackStatusFilter, signal?: AbortSignal): Promise<AdminFeedback[]> {
  const response = await adminRequest<{ feedback: AdminFeedback[] }>(
    `/admin/feedback?status=${encodeURIComponent(status)}`,
    { signal },
  )
  return response?.feedback ?? []
}

export function updateFeedbackStatus(feedbackId: number, status: FeedbackStatus): Promise<AdminFeedback> {
  return adminRequest<AdminFeedback>(`/admin/feedback/${feedbackId}`, {
    method: 'PATCH',
    body: { status },
    retries: 0,
  })
}

// ── 운영 도구 ─────────────────────────────────────────────────────────
// 둘 다 멱등이 아닌 POST 라 자동 재시도하지 않는다(retries: 0). 한 번 보낸 뒤 응답만 늦는 경우가 많다.

export function triggerCrawler(): Promise<{ savedCount: number }> {
  return adminRequest<{ savedCount: number }>('/crawler/trigger', {
    method: 'POST',
    timeoutMs: LONG_TASK_TIMEOUT_MS,
    retries: 0,
  })
}

export function backfillNewsLocation(): Promise<{ updatedCount: number }> {
  return adminRequest<{ updatedCount: number }>('/admin/news/backfill-location', {
    method: 'POST',
    timeoutMs: LONG_TASK_TIMEOUT_MS,
    retries: 0,
  })
}

/** 오래 걸리는 작업이 응답 없이 끊겼는지(서버에선 계속 돌고 있을 수 있다). */
export function isGatewayTimeout(error: unknown): boolean {
  return (
    (error instanceof NetworkError && error.kind === 'timeout') ||
    (error instanceof ApiError && (error.status === 504 || error.status === 502))
  )
}
