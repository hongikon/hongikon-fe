import { Platform } from 'react-native'
import { ApiError, apiRequest } from './client'
import {
  getNotificationSettings,
  patchNotificationSettings,
  type NewReportsScope,
} from './notificationSettings'
import { resolveMockMode } from '../admin/session'

export interface ReportKeyword {
  id: number
  keyword: string
}

/** 서버 제보 키워드 요청의 길이 상한(공지 키워드 `KeywordSubscriptionCreateRequest` 와 같다). */
export const MAX_REPORT_KEYWORD_LENGTH = 30
/** 서버가 한 사람에게 허락하는 제보 키워드 수. */
export const MAX_REPORT_KEYWORDS = 30

/**
 * 개발 웹에서 `?mock=1`(관리자 목업과 같은 스위치)이면 서버 없이 메모리 목업으로 돈다. 운영 빌드는 늘 false.
 * 네이티브에는 `window.location` 이 없어 웹에서만 확인한다.
 */
export function isReportKeywordsMock(): boolean {
  return __DEV__ && Platform.OS === 'web' && resolveMockMode() === 'on'
}

async function mock() {
  return import('./reportKeywordsMock')
}

/**
 * 제보 전용 키워드(`/users/me/report-keywords`). 공지 키워드(`/users/me/keyword-subscriptions`)와 따로 저장하며,
 * 새 제보 알림 범위가 'KEYWORDS' 면 이 키워드가 들어간 제보만 바로 알린다. 서버에만 저장한다(게스트 불가).
 */
export async function getReportKeywords(accessToken: string): Promise<ReportKeyword[]> {
  if (isReportKeywordsMock()) return (await mock()).mockGetReportKeywords()
  const res = await remember(
    apiRequest<{ keywords: ReportKeyword[] }>('/users/me/report-keywords', { accessToken }),
  )
  return res.keywords
}

/** 서버가 앞뒤 공백을 지우고, 중복(409)·개수 초과·형식 오류는 기존 오류 형식으로 돌려준다. */
export async function createReportKeyword(keyword: string, accessToken: string): Promise<ReportKeyword> {
  if (isReportKeywordsMock()) return (await mock()).mockCreateReportKeyword(keyword)
  return remember(
    apiRequest<ReportKeyword>('/users/me/report-keywords', {
      method: 'POST',
      body: { keyword },
      accessToken,
    }),
  )
}

export async function deleteReportKeyword(id: number, accessToken: string): Promise<void> {
  if (isReportKeywordsMock()) return (await mock()).mockDeleteReportKeyword(id)
  return apiRequest<void>(`/users/me/report-keywords/${id}`, { method: 'DELETE', accessToken })
}

/**
 * 서버에 제보 키워드 API 가 아직 없다(배포 전 404·405, 또는 없는 경로를 Spring `/error` 가 401 로 돌려줘 재발급 뒤에도 401 —
 * `myReports.ts` 와 같은 판정). 이때는 화면에서 "준비 중"으로 보여 준다.
 */
export function isReportKeywordsApiMissing(error: unknown): boolean {
  if (!(error instanceof ApiError)) return false
  return error.status === 404 || error.status === 405 || (error.status === 401 && error.afterTokenRefresh === true)
}

/** 한 번 "API 없음"으로 판정되면 앱을 다시 켤 때까지 부르지 않는다(부를 때마다 토큰 재발급이 일어나지 않게). */
let apiMissing = false

export function isReportKeywordsApiKnownMissing(): boolean {
  return apiMissing
}

function remember<T>(promise: Promise<T>): Promise<T> {
  return promise.catch((error: unknown) => {
    if (isReportKeywordsApiMissing(error)) apiMissing = true
    throw error
  })
}

/** 새 제보 알림 범위. 응답에 값이 없거나 모르는 값이면 기본값 'CAMPUS' 로 본다. */
export async function getNewReportsScope(accessToken: string): Promise<NewReportsScope> {
  if (isReportKeywordsMock()) return (await mock()).mockGetScope()
  const server = await getNotificationSettings(accessToken)
  return server.newReportsScope === 'KEYWORDS' ? 'KEYWORDS' : 'CAMPUS'
}

export async function patchNewReportsScope(
  scope: NewReportsScope,
  accessToken: string,
): Promise<NewReportsScope> {
  if (isReportKeywordsMock()) return (await mock()).mockPatchScope(scope)
  const server = await patchNotificationSettings({ newReportsScope: scope }, accessToken)
  return server.newReportsScope === 'KEYWORDS' ? 'KEYWORDS' : server.newReportsScope === 'CAMPUS' ? 'CAMPUS' : scope
}
