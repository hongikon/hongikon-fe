import {
  createMockReport,
  deleteMockReport,
  flagMockReport,
  listMockReports,
} from '../lib/mockReportsStore'
import type {
  CreateReportFlagInput,
  CreateReportInput,
  Report,
  ReportFlagResult,
  ReportListItem,
} from '../types'

/**
 * 백엔드가 준비되지 않아 임시로 기기 로컬 스토어(`mockReportsStore.ts`)를 쓴다.
 * 함수 시그니처는 실제 API를 그대로 흉내 내, 백엔드가 생기면 이 파일 안쪽만
 * `apiRequest`/`apiUpload` 호출로 되돌리면 되고 호출부(컴포넌트)는 안 건드려도 된다.
 */

interface GetLiveReportsOptions {
  /** 특정 건물로 필터링. 생략하면 전체 제보를 받는다. */
  buildingId?: number
  accessToken?: string | null
}

/**
 * 사진 첨부. 업로드할 서버가 없어 고른 이미지의 로컬 URI를 그대로 돌려준다.
 * `<Image source={{ uri }} />` 는 로컬 파일 URI도 그대로 그릴 수 있어 화면상 차이가 없다.
 */
export async function uploadReportImage(
  uri: string,
  _accessToken: string,
): Promise<string> {
  return uri
}

/** 제보 생성. 검토 절차를 처리할 운영자 화면이 없어 만들자마자 ACTIVE로 올린다. */
export async function createReport(
  input: CreateReportInput,
  _accessToken: string,
): Promise<Report> {
  return createMockReport(input)
}

/** 현재 진행 중인 제보 목록. */
export async function getLiveReports(
  options: GetLiveReportsOptions = {},
): Promise<ReportListItem[]> {
  return listMockReports(options.buildingId)
}

/** 본인 제보 삭제. */
export async function deleteReport(id: number, _accessToken: string): Promise<void> {
  await deleteMockReport(id)
}

/** 신고. */
export async function flagReport(
  id: number,
  input: CreateReportFlagInput,
  _accessToken: string,
): Promise<ReportFlagResult> {
  return flagMockReport(id, input)
}
