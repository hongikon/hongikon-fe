import { ApiError, isNetworkError } from '../../apis/client'
import {
  REPORT_IMAGE_MAX_BYTES,
  ReportImageUploadError,
  reportImageContentType,
  type PickedReportImage,
} from '../../apis/reports'
import type { ReportListItem } from '../../types'
import { formatFloor } from '../floors'

/** 장소 설명 최대 길이(서버 reports.place_label 과 같다). */
export const PLACE_MAX_LENGTH = 60
export const MIN_FLOOR = -10
export const MAX_FLOOR = 30

/** 사진 한 칸: 지금 붙은 사진(서버 번호 index) 또는 새로 고른 사진. */
export type PhotoItem = { kind: 'existing'; index: number; url: string } | { kind: 'new'; picked: PickedReportImage }

/** 층 표시: 지상 3층 = '3F', 지하 1층 = 'B1', 로비층(0, 홍문관 R동) = 'L'. */
export function formatEditFloor(floor: number): string {
  return formatFloor(floor)
}

/** 층 −/+ 한 칸(0층은 없다: B1 ↔ 1F). */
export function stepFloor(floor: number, delta: 1 | -1): number {
  const next = floor + delta
  if (next === 0) return delta
  return Math.max(MIN_FLOOR, Math.min(MAX_FLOOR, next))
}

/** 저장 실패를 사용자가 다음에 뭘 해야 하는지 알 수 있는 문구로. */
export function saveErrorMessage(error: unknown): string {
  if (error instanceof ReportImageUploadError) return error.message
  if (isNetworkError(error)) return '인터넷 연결이 불안정해 고치지 못했어요. 연결을 확인하고 다시 시도해 주세요.'
  if (error instanceof ApiError) {
    if (error.status === 404 || error.status === 405) {
      return error.serverMessage && error.status === 404 ? '이미 지워진 제보예요.' : '아직 제보 수정을 쓸 수 없어요. 잠시 뒤 다시 시도해 주세요.'
    }
    if (error.serverMessage && error.status < 500) return error.serverMessage
    if (error.status === 401) return '로그인이 만료됐어요. 다시 로그인한 뒤 고쳐 주세요.'
    if (error.status >= 500) return '서버에 일시적인 문제가 있어 고치지 못했어요. 잠시 뒤 다시 시도해 주세요.'
  }
  return '제보를 고치지 못했어요. 잠시 뒤 다시 시도해 주세요.'
}

/** 고치기 시작할 때의 사진 칸. 서버 번호(index)는 imageUrls 원래 순서다 — 못 만든 URL(null)은 건너뛰되 번호는 그대로 둔다. */
export function initialEditPhotos(report: Pick<ReportListItem, 'imageUrls' | 'imageUrl'>, maxImages: number): PhotoItem[] {
  const urls: (string | null)[] = Array.isArray(report.imageUrls) ? report.imageUrls : report.imageUrl ? [report.imageUrl] : []
  return urls.flatMap((url, index) => (url ? [{ kind: 'existing' as const, index, url }] : [])).slice(0, maxImages)
}

/** 새로 고른 사진 중 붙일 수 있는 것(JPEG·PNG, 5MB 이하, 남은 자리만큼)과 뺀 장수. */
export function acceptEditPhotos(
  assets: readonly PickedReportImage[],
  remaining: number,
): { accepted: PhotoItem[]; rejected: number } {
  const accepted: PhotoItem[] = []
  let rejected = 0
  for (const asset of assets) {
    const picked: PickedReportImage = { uri: asset.uri, mimeType: asset.mimeType, fileSize: asset.fileSize }
    if (reportImageContentType(picked) === null || (picked.fileSize && picked.fileSize > REPORT_IMAGE_MAX_BYTES)) {
      rejected += 1
      continue
    }
    if (accepted.length < remaining) accepted.push({ kind: 'new', picked })
  }
  return { accepted, rejected }
}
