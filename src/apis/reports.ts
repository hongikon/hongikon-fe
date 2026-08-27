import { apiRequest } from './client'
import type {
  CreateReportFlagInput,
  CreateReportInput,
  Report,
  ReportFlagResult,
  ReportListItem,
} from '../types'

interface GetLiveReportsOptions {
  /** 특정 건물로 필터링. 생략하면 전체 제보를 받는다. */
  buildingId?: number
  accessToken?: string | null
}

/**
 * 사진 첨부. 실제 백엔드(`Report` 엔티티)에는 이 컬럼도 업로드 API도 없어
 * (`docs/report-api-spec.md` §8.2 제안이 아직 구현 전), 고른 이미지의 로컬
 * URI를 그대로 돌려준다. `<Image source={{ uri }} />` 는 로컬 파일 URI도
 * 그대로 그릴 수 있어 작성자 본인 화면에서는 차이가 없다.
 */
export async function uploadReportImage(
  uri: string,
  _accessToken: string,
): Promise<string> {
  return uri
}

/**
 * 제보 생성. `customCategoryLabel`/`imageUrl`은 서버 스펙에 없는 로컬 전용
 * 필드라(`Report` 타입 주석 참고) 요청 바디에서 빼고 보낸다. 서버 응답에는
 * 당연히 두 값이 없으므로, 방금 만든 제보를 곧바로 화면에 보여줄 수 있도록
 * 응답에 다시 덧붙여 돌려준다 — 새로고침하거나 다른 사용자가 보면 사라진다.
 */
export async function createReport(
  input: CreateReportInput,
  accessToken: string,
): Promise<Report> {
  const { customCategoryLabel, imageUrl, ...body } = input

  const report = await apiRequest<Report>('/reports', {
    method: 'POST',
    body,
    accessToken,
  })

  return { ...report, customCategoryLabel, imageUrl }
}

/** 현재 진행 중인 제보 목록. */
export async function getLiveReports(
  options: GetLiveReportsOptions = {},
): Promise<ReportListItem[]> {
  const params = new URLSearchParams({ live: 'true' })
  if (options.buildingId !== undefined) params.set('buildingId', String(options.buildingId))

  const { reports } = await apiRequest<{ reports: ReportListItem[] }>(
    `/reports?${params.toString()}`,
    { accessToken: options.accessToken },
  )
  return reports
}

/** 본인 제보 삭제. */
export async function deleteReport(id: number, accessToken: string): Promise<void> {
  await apiRequest<void>(`/reports/${id}`, { method: 'DELETE', accessToken })
}

/** 신고. */
export async function flagReport(
  id: number,
  input: CreateReportFlagInput,
  accessToken: string,
): Promise<ReportFlagResult> {
  return apiRequest<ReportFlagResult>(`/reports/${id}/flags`, {
    method: 'POST',
    body: input,
    accessToken,
  })
}
