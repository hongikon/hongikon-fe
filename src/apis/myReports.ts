import { ApiError, apiRequest } from './client'
import type { ReportCategory, ReportStatus } from '../types'

/**
 * 화면용 상태(`GET /users/me/reports` 의 `displayStatus`). 서버가 저장 상태에 시간을 더해 정한다.
 * - SCHEDULED: 승인됐지만 아직 시작 전 / ENDED: 기간이 지남(승인 대기 중 끝난 것 포함)
 */
export type MyReportDisplayStatus =
  | 'PENDING'
  | 'SCHEDULED'
  | 'ACTIVE'
  | 'ENDED'
  | 'REJECTED'
  | 'HIDDEN'
  | 'DELETED'

/** 내 제보 내역 한 줄(hongikon-be `MyReportResponse`). 시각은 존 없는 UTC 문자열(`parseServerTime`). */
export interface MyReport {
  id: number
  title: string
  category: ReportCategory
  customCategoryLabel: string | null
  buildingId: number | null
  buildingName: string | null
  floor: number | null
  lat: number
  lng: number
  startsAt: string
  endsAt: string
  status: ReportStatus
  /** 없으면(옛 서버) `resolveDisplayStatus` 가 status·시각으로 정한다. */
  displayStatus?: MyReportDisplayStatus | null
  /** 반려·숨김 사유. 그 밖의 상태에서는 null. */
  moderationNote: string | null
  reviewedAt: string | null
  createdAt: string
  imageUrl?: string | null
  imageUrls?: string[] | null
}

/** 백엔드 공통 `PageResponse`. */
export interface MyReportPage {
  content: MyReport[]
  page: number
  size: number
  totalElements: number
  totalPages: number
  hasNext: boolean
}

export interface MyReportCount {
  total: number
  /** 승인 대기 개수 — 설정 줄 배지 */
  pending: number
}

export const MY_REPORTS_PAGE_SIZE = 20

/**
 * 서버에 내 제보 내역 API 가 아직 없는지(백엔드 배포 전). 없는 경로는 404/405 이고, 운영 서버는 없는 경로를
 * 401 로 돌려주기도 해서 "토큰을 막 재발급받았는데도 401" 도 없는 것으로 본다(`isNicknameApiMissing` 과 같다).
 */
export function isMyReportsApiMissing(error: unknown): boolean {
  if (!(error instanceof ApiError)) return false
  return error.status === 404 || error.status === 405 || (error.status === 401 && error.afterTokenRefresh === true)
}

/** 한 번 "API 없음"으로 판정되면 앱을 다시 켤 때까지 부르지 않는다(부를 때마다 토큰 재발급이 일어나지 않게). */
let apiMissing = false

export function isMyReportsApiKnownMissing(): boolean {
  return apiMissing
}

function remember<T>(promise: Promise<T>): Promise<T> {
  return promise.catch((error: unknown) => {
    if (isMyReportsApiMissing(error)) apiMissing = true
    throw error
  })
}

/** `GET /users/me/reports` — 내가 올린 제보, 최신 등록순. page 는 0부터. */
export function getMyReports(
  page: number,
  accessToken: string,
  signal?: AbortSignal,
  size: number = MY_REPORTS_PAGE_SIZE,
): Promise<MyReportPage> {
  const params = new URLSearchParams({ page: String(page), size: String(size) })
  return remember(apiRequest<MyReportPage>(`/users/me/reports?${params.toString()}`, { accessToken, signal }))
}

/** `GET /users/me/reports/count` — 전체·승인 대기 개수. */
export function getMyReportCount(accessToken: string, signal?: AbortSignal): Promise<MyReportCount> {
  return remember(apiRequest<MyReportCount>('/users/me/reports/count', { accessToken, signal }))
}
