import { ApiError, apiRequest } from './client'
import { stripJpegLocation, stripPngMetadata } from '../utils/jpegPrivacy'
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
  /** 레이어를 끄거나 화면을 떠나면 진행 중인 요청을 끊는다(`useApiResource`). */
  signal?: AbortSignal
}

/** 서버(`POST /reports/images`)가 받는 최대 크기. 응답의 `maxBytes` 가 오면 그 값을 따른다. */
export const REPORT_IMAGE_MAX_BYTES = 5 * 1024 * 1024
/** S3 로 직접 올리는 PUT 제한 시간. 느린 캠퍼스 와이파이를 고려해 넉넉히 준다. */
const IMAGE_PUT_TIMEOUT_MS = 30_000
const SUPPORTED_IMAGE_TYPES = new Set(['image/jpeg', 'image/png'])

/** 고른 사진. `expo-image-picker` 의 asset 에서 필요한 것만. */
export interface PickedReportImage {
  uri: string
  mimeType?: string | null
  fileSize?: number | null
}

/**
 * 사진 업로드 실패 종류. 화면은 종류에 따라 안내를 고른다.
 * - unavailable: 서버에 사진 기능이 아직 없다(배포 전 404/405, 저장소 미설정 503) → 사진 없이 올린다
 * - unsupported: JPEG·PNG 가 아니다(HEIC·GIF 등) → 다른 사진을 고르게 한다
 * - tooLarge: 5MB 초과
 * - failed: 연결 끊김·S3 오류 등 → 다시 시도 또는 사진 없이 올리기
 */
export class ReportImageUploadError extends Error {
  kind: 'unavailable' | 'unsupported' | 'tooLarge' | 'failed'

  constructor(kind: ReportImageUploadError['kind'], message: string) {
    super(message)
    this.name = 'ReportImageUploadError'
    this.kind = kind
  }
}

/** 확장자·피커가 준 MIME 으로 형식을 고른다. JPEG·PNG 가 아니면 null. */
export function reportImageContentType(image: PickedReportImage): string | null {
  const mime = image.mimeType?.toLowerCase()
  if (mime) {
    const normalized = mime === 'image/jpg' ? 'image/jpeg' : mime
    return SUPPORTED_IMAGE_TYPES.has(normalized) ? normalized : null
  }
  const ext = image.uri.split('?')[0].split('.').pop()?.toLowerCase()
  if (ext === 'jpg' || ext === 'jpeg') return 'image/jpeg'
  if (ext === 'png') return 'image/png'
  return null
}

/** Blob → 바이트. RN 의 Blob 에는 arrayBuffer() 가 없어 FileReader 로 읽는다(웹에서도 동작). */
function readBlobBytes(blob: Blob): Promise<Uint8Array> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(new Uint8Array(reader.result as ArrayBuffer))
    reader.onerror = () => reject(reader.error ?? new Error('read failed'))
    reader.readAsArrayBuffer(blob)
  })
}

interface ReportImageUploadTicket {
  key: string
  uploadUrl: string
  method: 'PUT'
  headers: Record<string, string>
  expiresAt: string
  maxBytes: number
}

/**
 * 제보 사진 1장을 올리고, `createReport` 의 `imageKey` 로 넣을 키를 돌려준다.
 * 1) 서버에서 S3 presigned PUT URL 을 받고 2) 사진을 S3 로 직접 올린다(백엔드를 거치지 않음).
 * 실패는 전부 `ReportImageUploadError` 로 바꿔 던진다.
 */
export async function uploadReportImage(
  image: PickedReportImage,
  accessToken: string,
): Promise<string> {
  const contentType = reportImageContentType(image)
  if (contentType === null) {
    throw new ReportImageUploadError('unsupported', '이 형식의 사진은 올릴 수 없어요. 다른 사진을 골라 주세요.')
  }
  if (image.fileSize && image.fileSize > REPORT_IMAGE_MAX_BYTES) {
    throw new ReportImageUploadError('tooLarge', '사진 용량이 너무 커요. 5MB 이하 사진을 골라 주세요.')
  }

  let ticket: ReportImageUploadTicket
  try {
    ticket = await apiRequest<ReportImageUploadTicket>('/reports/images', {
      method: 'POST',
      body: { contentType },
      accessToken,
    })
  } catch (caught) {
    // 백엔드 배포 전(엔드포인트 없음 404/405)이거나 저장소 미설정(503).
    if (caught instanceof ApiError && [404, 405, 501, 503].includes(caught.status)) {
      throw new ReportImageUploadError('unavailable', '사진 첨부는 아직 준비 중이에요.')
    }
    if (caught instanceof ApiError && caught.status === 429) {
      throw new ReportImageUploadError('failed', '사진을 너무 자주 올렸어요. 잠시 후 다시 시도해 주세요.')
    }
    if (caught instanceof ApiError && caught.status === 401) throw caught
    throw new ReportImageUploadError('failed', '사진을 올리지 못했어요. 다시 시도하거나 사진 없이 올려 주세요.')
  }

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), IMAGE_PUT_TIMEOUT_MS)
  try {
    // 로컬 파일(file://, 웹은 blob:/data:)을 읽어, 촬영 위치 등 메타데이터(JPEG GPS·XMP, PNG eXIf·텍스트)를 지운 뒤 PUT 한다.
    const blob = await (await fetch(image.uri)).blob()
    const raw = await readBlobBytes(blob)
    const bytes = contentType === 'image/jpeg' ? stripJpegLocation(raw) : stripPngMetadata(raw)
    const maxBytes = ticket.maxBytes || REPORT_IMAGE_MAX_BYTES
    if (bytes.byteLength > maxBytes) {
      throw new ReportImageUploadError('tooLarge', '사진 용량이 너무 커요. 5MB 이하 사진을 골라 주세요.')
    }
    // 서명에 들어간 헤더만 그대로 싣는다. Authorization(앱 토큰)은 S3 로 보내지 않는다.
    const response = await fetch(ticket.uploadUrl, {
      method: 'PUT',
      headers: ticket.headers,
      // RN fetch 는 ArrayBuffer 바디를 바이너리 그대로 보낸다.
      body: bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer,
      signal: controller.signal,
    })
    if (!response.ok) {
      if (__DEV__) console.warn(`[api] 제보 사진 S3 업로드 실패 (${response.status})`)
      throw new ReportImageUploadError('failed', '사진을 올리지 못했어요. 다시 시도하거나 사진 없이 올려 주세요.')
    }
    return ticket.key
  } catch (caught) {
    if (caught instanceof ReportImageUploadError) throw caught
    throw new ReportImageUploadError(
      'failed',
      '인터넷 연결이 불안정해 사진을 올리지 못했어요. 다시 시도하거나 사진 없이 올려 주세요.',
    )
  } finally {
    clearTimeout(timer)
  }
}

/**
 * 제보 생성. 사진은 `uploadReportImage` 로 먼저 올리고 받은 키를 `imageKey` 로 보낸다.
 * 서버가 사진 보기 URL(`imageUrl`, 1시간 유효)을 붙여 돌려준다.
 */
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

/** 현재 진행 중인 제보 목록. */
export async function getLiveReports(
  options: GetLiveReportsOptions = {},
): Promise<ReportListItem[]> {
  const params = new URLSearchParams({ live: 'true' })
  if (options.buildingId !== undefined) params.set('buildingId', String(options.buildingId))

  const { reports } = await apiRequest<{ reports: ReportListItem[] }>(
    `/reports?${params.toString()}`,
    { accessToken: options.accessToken, signal: options.signal },
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
