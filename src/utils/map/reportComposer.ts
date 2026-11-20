import { ApiError, isNetworkError } from '../../apis/client'
import { REPORT_IMAGE_MAX_BYTES, reportImageContentType, type PickedReportImage } from '../../apis/reports'
import { REPORT_OFF_CAMPUS_MAX_METERS } from '../../constants/report'
import type { Building } from '../../types'
import { buildFloorOptions } from '../floors'

/** 장소 설명 최대 길이(서버 reports.place_label 과 같다). */
export const REPORT_PLACE_MAX_LENGTH = 60

/** 층 다이얼 상한(캠퍼스 최고층 건물 + 여유). 지하는 서버 검증(-10층까지)에 맞춰 B10 까지. */
export const MAX_FLOOR = 30
export const MAX_BASEMENT = 10

export const FLOOR_NUMBERS = Array.from({ length: MAX_FLOOR }, (_, index) => index + 1)
export const BASEMENT_NUMBERS = FLOOR_NUMBERS.slice(0, MAX_BASEMENT)

/** 층 표시: 지상 3층 = '3F', 지하 1층 = 'B1'. */
export function formatFloor(basement: boolean, floorNumber: number): string {
  return basement ? `B${floorNumber}` : `${floorNumber}F`
}

/**
 * 로비층(L, 0층)이 있는 건물(홍문관 R동)의 층 다이얼 항목(위층 → 아래층). 일반 다이얼(지상/지하 · 1~30)로는 L 을 고를 수 없어,
 * 이런 건물은 길찾기 층 다이얼과 같은 그 건물의 층 목록 하나로 고른다. 1.5F 같은 중간층 출입구는 제보 층이 아니라 뺀다.
 * L 이 없는 건물은 null — 일반 다이얼을 쓴다.
 */
export function buildingFloorDialItems(building: Building | null): { value: number; label: string }[] | null {
  if (!building) return null
  const options = buildFloorOptions(building).filter((option) => Number.isInteger(option.value))
  if (!options.some((option) => option.value === 0)) return null
  return [...options].reverse().map((option) => ({ value: option.value, label: option.label }))
}

/** 층 목록 다이얼에서 처음 고를 층: 1F, 없으면 L, 그것도 없으면 맨 위 층. */
export function defaultBuildingFloor(items: readonly { value: number }[]): number {
  if (items.some((item) => item.value === 1)) return 1
  if (items.some((item) => item.value === 0)) return 0
  return items[0]?.value ?? 1
}

export function formatCoord(value: number): string {
  return value.toFixed(5)
}

/** 채워야 올릴 수 있는 항목. 화면 위→아래 순서다(빠진 첫 항목으로 스크롤한다). 층은 다이얼이라 늘 유효하다. */
export type RequiredField = 'building' | 'category' | 'title' | 'schedule'

export interface MissingField {
  field: RequiredField
  message: string
}

interface MissingInput {
  /** 핀 근처 학교 건물을 찾았는지. */
  hasBuilding: boolean
  /** 학교 건물 밖이지만 홍대 생활권 안인 핀인지. */
  offCampus: boolean
  /** 지금 장소 칸에 보이는 글. */
  shownPlace: string
  customInputOpen: boolean
  customLabelDraft: string
  trimmedTitle: string
  /** 시간 규칙 위반 안내. 없으면 null. */
  scheduleProblem: string | null
}

/**
 * 아직 채우지 않은 필수 항목과 그 아래 띄울 짧은 안내(화면 순서). 비어 있지 않으면 '제보 올리기'를 흐리게
 * 보여 주되 누를 수는 있게 두고, 누르면 빠진 칸을 깜빡이며 첫 칸으로 데려간다.
 * - 직접 입력 칸을 열어 두고 ✓ 로 적용하지 않으면 카테고리가 이전 값으로 올라가므로 빠진 것으로 본다.
 */
export function composerMissingFields(input: MissingInput): MissingField[] {
  const missing: MissingField[] = []
  if (!input.hasBuilding && !input.offCampus) {
    missing.push({
      field: 'building',
      message: `캠퍼스와 홍대 근처(캠퍼스에서 ${REPORT_OFF_CAMPUS_MAX_METERS / 1000}km 안)까지만 제보할 수 있어요.`,
    })
  } else if (input.offCampus && input.shownPlace.trim().length === 0) {
    missing.push({ field: 'building', message: '캠퍼스 밖 제보는 장소를 적어 주세요. 예: 홍대입구역 9번 출구 앞' })
  }
  if (input.customInputOpen) {
    missing.push({
      field: 'category',
      message: input.customLabelDraft.trim()
        ? '입력칸 오른쪽 확인 버튼을 눌러 직접 입력한 카테고리를 적용해 주세요.'
        : '카테고리 이름을 입력하거나 닫아 주세요.',
    })
  }
  if (input.trimmedTitle.length === 0) missing.push({ field: 'title', message: '제목을 입력해 주세요.' })
  if (input.scheduleProblem !== null) missing.push({ field: 'schedule', message: input.scheduleProblem })
  return missing
}

/**
 * 등록 실패를 사용자가 다음에 뭘 해야 하는지 알 수 있는 문구로 바꾼다.
 * (서버 원문은 개발용이라 그대로 보여주지 않는다.)
 */
export function reportSubmitErrorMessage(error: unknown): string {
  if (isNetworkError(error)) return '인터넷 연결이 불안정해 제보를 올리지 못했어요. 연결을 확인하고 다시 시도해 주세요.'
  if (error instanceof ApiError) {
    // 시작·종료 시각 규칙(예정 제보)에 걸리면 서버가 해요체 문구를 준다 — 그대로 보여 준다.
    if (error.status === 400 && error.serverMessage && /시각|진행 시간|진행 기간/.test(error.serverMessage)) {
      return error.serverMessage
    }
    if (error.status === 400) return '제보 내용이 올바르지 않아요. 위치(건물·층)와 제목을 다시 확인해 주세요.'
    if (error.status === 401) return '로그인이 만료됐어요. 다시 로그인한 뒤 제보해 주세요.'
    if (error.status === 403) return '이 계정으로는 제보를 올릴 수 없어요.'
    // 429 는 두 갈래라 서버 문구를 그대로 보인다 — 승인 대기 3건 초과("승인을 기다리는 제보가 3건 있어요…")와
    // 1시간 5건 초과. 예전엔 둘 다 "너무 자주"로 보여 승인 대기에 막힌 사용자가 까닭을 몰랐다(10-19).
    if (error.status === 429) return error.serverMessage || '제보를 너무 자주 올렸어요. 잠시 뒤 다시 시도해 주세요.'
    if (error.status >= 500) return '서버에 일시적인 문제가 있어 제보를 올리지 못했어요. 잠시 뒤 다시 시도해 주세요.'
  }
  if (error instanceof Error && error.message) return error.message
  return '제보를 올리지 못했어요. 잠시 뒤 다시 시도해 주세요.'
}

/**
 * 서버가 등록을 사진 문제로 거절했는지. 사진 문제로 보는 건 서버 문구가 없거나(구버전·프록시) 문구가 사진 이야기일
 * 때만이다 — 서버의 사진 거절 문구는 모두 '사진'을 담는다(BE ReportImageService).
 */
export function isPhotoRejection(error: unknown, imageCount: number): boolean {
  const photoRejected = error instanceof ApiError && (!error.serverMessage || error.serverMessage.includes('사진'))
  return imageCount > 0 && error instanceof ApiError && error.status === 400 && photoRejected
}

export interface PickedAssetFilter {
  accepted: PickedReportImage[]
  unsupported: number
  tooLarge: number
  overflow: number
}

/**
 * 고른 사진에서 붙일 수 있는 것만 남긴다. 이미 붙인 사진·형식이 안 맞는 사진(JPEG·PNG 외)·5MB 넘는 사진은 빼고,
 * 남은 자리(`remaining`)보다 많이 고르면(웹은 selectionLimit 를 지원하지 않는다) 앞에서부터 남은 장수만 쓴다.
 */
export function filterPickedAssets(
  assets: readonly PickedReportImage[],
  existingUris: Iterable<string>,
  remaining: number,
): PickedAssetFilter {
  const existing = new Set(existingUris)
  const accepted: PickedReportImage[] = []
  let unsupported = 0
  let tooLarge = 0
  let overflow = 0
  for (const asset of assets) {
    const picked: PickedReportImage = { uri: asset.uri, mimeType: asset.mimeType, fileSize: asset.fileSize }
    if (existing.has(picked.uri)) continue
    if (reportImageContentType(picked) === null) {
      unsupported += 1
      continue
    }
    if (picked.fileSize && picked.fileSize > REPORT_IMAGE_MAX_BYTES) {
      tooLarge += 1
      continue
    }
    if (accepted.length >= remaining) {
      overflow += 1
      continue
    }
    existing.add(picked.uri)
    accepted.push(picked)
  }
  return { accepted, unsupported, tooLarge, overflow }
}

/** 걸러 낸 사진이 있으면 그 까닭(한 장만 골랐으면 그 사진 이야기로). 없으면 null. */
export function pickedAssetsError(result: PickedAssetFilter, single: boolean, maxImages: number): string | null {
  if (result.unsupported > 0) {
    return single ? '이 형식의 사진은 올릴 수 없어요. 다른 사진을 골라 주세요.' : `JPEG·PNG 가 아닌 사진 ${result.unsupported}장은 뺐어요.`
  }
  if (result.tooLarge > 0) {
    return single ? '사진 용량이 너무 커요. 5MB 이하 사진을 골라 주세요.' : `5MB 가 넘는 사진 ${result.tooLarge}장은 뺐어요.`
  }
  if (result.overflow > 0) return `사진은 ${maxImages}장까지라 ${result.overflow}장은 뺐어요.`
  return null
}
