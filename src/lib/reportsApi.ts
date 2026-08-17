import { apiRequest, apiUpload } from './api'
import type {
  CreateReportFlagInput,
  CreateReportInput,
  Report,
  ReportFlagResult,
  ReportListItem,
} from '../types'

interface LiveReportsResponse {
  reports: ReportListItem[]
}

interface GetLiveReportsOptions {
  /** 특정 건물로 필터링. 생략하면 전체 제보를 받는다. */
  buildingId?: number
  /**
   * `docs/report-api-spec.md` §3.2: 비로그인 허용 여부 미확정.
   * 게스트로 호출할 땐 null을 넘긴다.
   */
  accessToken?: string | null
}

interface UploadedImage {
  imageUrl: string
}

/**
 * `POST /reports/images` — 첨부 사진 업로드. 로그인 필수.
 *
 * 제보 생성과 나눈 이유는 두 가지다. 사진 없이 올리는 제보가 더 많아 본문을
 * multipart 로 통일할 이유가 없고, 업로드가 실패해도 작성 중이던 내용이
 * 날아가지 않는다.
 *
 * 주의: 이 엔드포인트는 `docs/report-api-spec.md` 에 아직 없다. 사진 첨부가
 * 뒤늦게 정해져 서버와 합의가 필요한 부분이다(§4.5 로 제안해 둠).
 */
export async function uploadReportImage(
  uri: string,
  accessToken: string,
): Promise<string> {
  const form = new FormData()
  const name = uri.split('/').pop() || 'report.jpg'
  const extension = name.split('.').pop()?.toLowerCase() ?? 'jpg'
  // React Native 의 FormData 는 로컬 파일 URI 를 이 모양의 객체로 받는다.
  form.append('file', {
    uri,
    name,
    type: extension === 'png' ? 'image/png' : 'image/jpeg',
  } as unknown as Blob)

  const { imageUrl } = await apiUpload<UploadedImage>('/reports/images', form, accessToken)
  return imageUrl
}

/** `POST /reports` — 제보 생성. 로그인 필수. */
export async function createReport(
  input: CreateReportInput,
  accessToken: string,
): Promise<Report> {
  return apiRequest<Report>('/reports', {
    method: 'POST',
    body: input,
    accessToken,
  })
}

/** `GET /reports?live=true` — 현재 진행 중인 제보 목록. */
export async function getLiveReports(
  options: GetLiveReportsOptions = {},
): Promise<ReportListItem[]> {
  const { buildingId, accessToken } = options
  const query = buildingId !== undefined ? `&buildingId=${buildingId}` : ''

  const { reports } = await apiRequest<LiveReportsResponse>(`/reports?live=true${query}`, {
    accessToken,
  })
  return reports
}

/** `DELETE /reports/{id}` — 본인 제보 삭제. */
export async function deleteReport(id: number, accessToken: string): Promise<void> {
  await apiRequest<void>(`/reports/${id}`, {
    method: 'DELETE',
    accessToken,
  })
}

/** `POST /reports/{id}/flags` — 신고. */
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
