import { facilityKindMeta } from '../constants/facilityKinds'
import { formatFloor } from './floors'
import type { Building, Facility, FacilityKind } from '../types'

// 편의시설·건물 목록은 지도 데이터(`useMapData()`)에서 받아 인자로 넘긴다. 이 파일은 계산만 한다.

/** 같은 건물 배열로 여러 번 불려도 이름 색인을 다시 만들지 않는다. */
const buildingIndexCache = new WeakMap<readonly Building[], Map<string, Building>>()

function buildingsByName(buildings: readonly Building[]): Map<string, Building> {
  let index = buildingIndexCache.get(buildings)
  if (!index) {
    index = new Map(buildings.map((building) => [building.name, building]))
    buildingIndexCache.set(buildings, index)
  }
  return index
}

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
export function filterFacilities(facilities: readonly Facility[], kind: FacilityKind | null): Facility[] {
  if (kind === null) return []
  return facilities.filter((facility) => facility.kind === kind)
}

/** 칩을 흐리게 처리할지 판단하는 데 쓴다. 제휴 칩의 `partnerCount` 와 같은 역할이다. */
export function facilityCount(facilities: readonly Facility[], kind: FacilityKind): number {
  return facilities.filter((facility) => facility.kind === kind).length
}

/**
 * 건물명이 건물 목록에 없어 지도에 올릴 수 없는 항목들.
 *
 * 좌표를 못 찾은 편의시설을 조용히 버리면, 데이터를 넣었는데 지도에 안 뜨는
 * 이유를 알 수 없다. 호출하는 쪽에서 개발 중 경고로 드러내라고 따로 내보낸다.
 */
export function unresolvedFacilities(facilities: readonly Facility[], buildings: readonly Building[]): Facility[] {
  const byName = buildingsByName(buildings)
  return facilities.filter((facility) => !byName.has(facility.buildingName))
}

function buildLabel(buildingName: string, floors: readonly number[]): string {
  if (floors.length === 0) return buildingName
  return `${buildingName} ${floors.map(formatFloor).join('·')}`
}

/**
 * 고른 종류의 편의시설을 건물 단위로 묶어 지도 핀 목록으로 만든다.
 * 건물을 못 찾은 항목은 좌표가 없어 뺀다(`unresolvedFacilities` 로 확인할 수 있다).
 */
export function facilityMarkers(
  facilities: readonly Facility[],
  buildings: readonly Building[],
  kind: FacilityKind | null,
): FacilityMarker[] {
  const byName = buildingsByName(buildings)
  const color = kind === null ? '' : facilityKindMeta(kind).color
  const byBuilding = new Map<string, FacilityMarker>()

  const pinned: FacilityMarker[] = []

  filterFacilities(facilities, kind).forEach((facility) => {
    const building = byName.get(facility.buildingName)
    if (!building) return

    // 실측 좌표가 있는 시설은 건물 마커로 합치지 않고 그 지점에 따로 찍는다.
    if (facility.lat !== undefined && facility.lng !== undefined) {
      const floors = facility.floor !== undefined ? [facility.floor] : []
      pinned.push({
        id: `${facility.kind}-${facility.id}`,
        kind: facility.kind,
        buildingName: building.name,
        lat: facility.lat,
        lng: facility.lng,
        floors,
        color,
        label: buildLabel(building.name, floors),
      })
      return
    }

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

  return [...byBuilding.values(), ...pinned]
}
