import { BUILDINGS } from '../constants/buildings'
import { FACILITIES } from '../constants/facilities'
import { facilityKindMeta } from '../constants/facilityKinds'
import { formatFloor } from './floors'
import type { Facility, FacilityKind } from '../types'

const BUILDING_BY_NAME = new Map(BUILDINGS.map((building) => [building.name, building]))

/**
 * 지도에 찍을 편의시설 핀 하나.
 *
 * 한 건물의 같은 종류를 하나로 묶은 단위다. 편의시설은 건물 좌표를 그대로
 * 쓰기 때문에, 층마다 핀을 찍으면 같은 자리에 완전히 겹쳐 버린다.
 */
export interface FacilityMarker {
  id: string
  kind: FacilityKind
  buildingName: string
  lat: number
  lng: number
  /** 확인된 층만. 오름차순. 비어 있으면 층 정보가 없는 것이다. */
  floors: number[]
  color: string
  /** 핀 아래에 쓰는 문구. 예: '홍문관 R동 2F·4F' */
  label: string
}

/** 종류를 고르지 않았으면(null) 아무것도 그리지 않는다. 제휴 칩과 같은 규칙이다. */
export function filterFacilities(kind: FacilityKind | null): Facility[] {
  if (kind === null) return []
  return FACILITIES.filter((facility) => facility.kind === kind)
}

/** 칩을 흐리게 처리할지 판단하는 데 쓴다. 제휴 칩의 `partnerCount` 와 같은 역할이다. */
export function facilityCount(kind: FacilityKind): number {
  return FACILITIES.filter((facility) => facility.kind === kind).length
}

/**
 * 건물명이 `BUILDINGS` 에 없어 지도에 올릴 수 없는 항목들.
 *
 * 좌표를 못 찾은 편의시설을 조용히 버리면, 데이터를 넣었는데 지도에 안 뜨는
 * 이유를 알 수 없다. 호출하는 쪽에서 개발 중 경고로 드러내라고 따로 내보낸다.
 */
export function unresolvedFacilities(): Facility[] {
  return FACILITIES.filter((facility) => !BUILDING_BY_NAME.has(facility.buildingName))
}

function buildLabel(buildingName: string, floors: readonly number[]): string {
  if (floors.length === 0) return buildingName
  return `${buildingName} ${floors.map(formatFloor).join('·')}`
}

/**
 * 고른 종류의 편의시설을 건물 단위로 묶어 지도 핀 목록으로 만든다.
 * 건물을 못 찾은 항목은 좌표가 없어 뺀다(`unresolvedFacilities` 로 확인할 수 있다).
 */
export function facilityMarkers(kind: FacilityKind | null): FacilityMarker[] {
  const color = kind === null ? '' : facilityKindMeta(kind).color
  const byBuilding = new Map<string, FacilityMarker>()

  filterFacilities(kind).forEach((facility) => {
    const building = BUILDING_BY_NAME.get(facility.buildingName)
    if (!building) return

    const existing = byBuilding.get(building.name)
    const floors = existing ? existing.floors : []
    if (facility.floor !== undefined && !floors.includes(facility.floor)) {
      floors.push(facility.floor)
      floors.sort((a, b) => a - b)
    }

    byBuilding.set(building.name, {
      id: `${facility.kind}-${building.name}`,
      kind: facility.kind,
      buildingName: building.name,
      lat: building.lat,
      lng: building.lng,
      floors,
      color,
      label: buildLabel(building.name, floors),
    })
  })

  return [...byBuilding.values()]
}
