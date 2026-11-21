import { FACILITY_KINDS } from '../../../constants/facilityKinds'
import type { FacilityKind } from '../../../types'
import { normalize } from '../../../utils/common/normalize'
import type { AdminBuildingOption, AdminFacility, AdminFacilityInput } from '../../types'
import { LAT_RANGE, LNG_RANGE, optional, parseCoordinate, tooLong, type BuildResult } from './mapFormRules'

/**
 * 편의시설 관리(FacilitiesScreen)의 편집 초안 ↔ 서버 본문 변환과 검색. 순수 함수라 `pnpm test` 에서 바로 돈다.
 * 시설은 건물을 가리키고 지도 핀은 그 건물 좌표에 찍힌다. 현장에서 잰 좌표가 있을 때만 위도·경도를 넣는다.
 */

export const FACILITY_KIND_KEYS: readonly FacilityKind[] = FACILITY_KINDS.map((meta) => meta.key)

export interface FacilityDraft {
  /** 수정 중이면 원래 code, 새로 추가면 null. */
  originalCode: string | null
  code: string
  kind: FacilityKind | null
  buildingCode: string | null
  floor: string
  note: string
  lat: string
  lng: string
}

export function emptyFacilityDraft(): FacilityDraft {
  return { originalCode: null, code: '', kind: null, buildingCode: null, floor: '', note: '', lat: '', lng: '' }
}

export function facilityDraftFrom(facility: AdminFacility): FacilityDraft {
  return {
    originalCode: facility.id,
    code: facility.id,
    kind: facility.kind,
    buildingCode: facility.buildingCode,
    floor: facility.floor === undefined || facility.floor === null ? '' : String(facility.floor),
    note: facility.note ?? '',
    lat: facility.lat === undefined || facility.lat === null ? '' : String(facility.lat),
    lng: facility.lng === undefined || facility.lng === null ? '' : String(facility.lng),
  }
}

/** 화면 검증. 통과하면 요청 본문, 아니면 오류 문구 목록. */
export function buildFacilityInput(draft: FacilityDraft): BuildResult<AdminFacilityInput> {
  const errors: string[] = []
  if (!draft.kind) errors.push('시설 종류를 골라 주세요.')
  if (!draft.buildingCode) errors.push('건물을 골라 주세요.')
  const code = draft.code.trim()
  if (code.length > 100) errors.push('코드는 100자까지 쓸 수 있어요.')
  let floor: number | undefined
  if (draft.floor.trim()) {
    const value = Number(draft.floor.trim())
    if (!Number.isInteger(value)) errors.push('층은 정수로 입력해 주세요(지하는 음수, B1 = -1, 로비층 L = 0).')
    else floor = value
  }
  const noteError = tooLong(draft.note, 255, '위치 설명')
  if (noteError) errors.push(noteError)
  const lat = parseCoordinate(draft.lat, LAT_RANGE, '위도')
  const lng = parseCoordinate(draft.lng, LNG_RANGE, '경도')
  if (typeof lat === 'string') errors.push(lat)
  if (typeof lng === 'string') errors.push(lng)
  if ((lat === null) !== (lng === null)) errors.push('위도·경도는 둘 다 넣거나 둘 다 비워 주세요.')
  if (errors.length || !draft.kind || !draft.buildingCode) return { errors }
  return {
    input: {
      id: draft.originalCode ?? (code || undefined),
      kind: draft.kind,
      buildingCode: draft.buildingCode,
      floor,
      note: optional(draft.note),
      lat: typeof lat === 'number' ? lat : undefined,
      lng: typeof lng === 'number' ? lng : undefined,
    },
  }
}

/** 검색어(normalize 한 값)가 종류·건물·코드·위치 설명 중 하나에 들어 있는지. */
export function facilityMatches(facility: AdminFacility, query: string): boolean {
  if (!query) return true
  return [facility.kind, facility.buildingName, facility.buildingCode, facility.id, facility.note ?? ''].some((field) =>
    normalize(field).includes(query),
  )
}

/** 건물 고르기 칩에 보일 건물. 이름·코드로 거르되, 고른 건물은 걸러져도 맨 앞에 남겨 무엇을 골랐는지 보이게 한다. */
export function filterBuildingOptions(
  buildings: AdminBuildingOption[],
  query: string,
  selectedCode: string | null | undefined,
): AdminBuildingOption[] {
  const q = normalize(query)
  const filtered = q ? buildings.filter((b) => normalize(b.name).includes(q) || normalize(b.code).includes(q)) : buildings
  const selected = selectedCode ? buildings.find((b) => b.code === selectedCode) : undefined
  return selected && !filtered.includes(selected) ? [selected, ...filtered] : filtered
}

/** 건물 코드 → 이름(목록에 없으면 코드, 없으면 빈 글자). */
export function buildingNameOf(buildings: readonly AdminBuildingOption[], code: string | null): string {
  return buildings.find((b) => b.code === code)?.name ?? code ?? ''
}
