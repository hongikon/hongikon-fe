import { FLOOR_TRANSIT_SECONDS } from '../constants/route'
import type { Building, BuildingEntrance } from '../types'

export interface RoutePoint {
  lat: number
  lng: number
}

/**
 * 층 번호 표기 규칙
 * 양수는 지상(1 → '1F'), 음수는 지하(-1 → 'B1'). 0층은 존재하지 않는다.
 * 홍문관 R동의 1.5층처럼 중간층 출입구가 있으면 소수로 표기한다('1.5F').
 */
export interface FloorOption {
  label: string
  value: number
}

export function formatFloor(floor: number): string {
  return floor > 0 ? `${floor}F` : `B${Math.abs(floor)}`
}

/**
 * 층을 오르내린 횟수를 셀 수 있는 연속 눈금으로 바꾼다.
 * 0층이 없어 B1(-1)과 1F(1) 사이가 한 개 층이 되도록 지상층을 하나씩 내린다.
 */
function levelIndex(floor: number): number {
  return floor > 0 ? floor - 1 : floor
}

/**
 * 고를 수 있는 층 목록(지하 최하층 → 지상 최상층).
 *
 * `floors`/`basementFloors` 가 확인된 건물은 그 값을 쓴다. 아직 층수가 확인되지
 * 않은 건물도 `entrances` 에 층별 출입구가 있으면, 그 출입구들이 걸친 가장 낮은
 * 층부터 가장 높은 층까지를 선택지로 삼는다 — 출입구가 없는 사이 층(예: 1F·4F
 * 출입구만 있는 건물의 2F·3F)도 건물 안에서 가까운 출입구로 걸어 나가면 되므로
 * 포함한다. 1.5F 같은 중간층 출입구는 그 층 그대로 끼워 넣는다.
 */
export function buildFloorOptions(building: Building): FloorOption[] {
  const { floors, basementFloors, entrances } = building

  let lowest: number
  let highest: number
  const extraFloors: number[] = []

  if (floors !== undefined && floors > 0) {
    lowest = basementFloors ? -basementFloors : 1
    highest = floors
  } else if (entrances && entrances.length > 0) {
    lowest = Math.min(1, ...entrances.map((entrance) => entrance.minFloor))
    highest = Math.max(1, ...entrances.map((entrance) => entrance.maxFloor))
    for (const entrance of entrances) {
      for (const bound of [entrance.minFloor, entrance.maxFloor]) {
        if (!Number.isInteger(bound)) extraFloors.push(bound)
      }
    }
  } else {
    return []
  }

  const values = new Set<number>(extraFloors)
  for (let level = Math.ceil(lowest); level <= Math.floor(highest); level += 1) {
    if (level !== 0) values.add(level)
  }

  return [...values]
    .sort((a, b) => a - b)
    .map((value) => ({ label: formatFloor(value), value }))
}

/** 층을 고를 수 있는 건물인지 판별한다. */
export function hasFloorData(building: Building): boolean {
  return buildFloorOptions(building).length > 0
}

/**
 * 고른 층에서 드나들 출입구. `src/utils/routing.ts` 도 이걸로 앵커 노드를
 * 정해, 경로가 실제로 잇는 출입구와 배너에 뜨는 좌표가 항상 같게 한다.
 *
 * 그 층에 걸친 출입구가 있으면 그것을, 없으면 층 차이가 가장 적은 출입구를
 * 고른다(건물 안에서 계단으로 오르내려 그 출입구로 나간다고 본다). 차이가
 * 같으면 지상 1층에 가까운 쪽을 택한다.
 */
export function matchEntrance(
  building: Building,
  floor: number | null,
): BuildingEntrance | undefined {
  if (floor === null || !building.entrances || building.entrances.length === 0) return undefined

  const exact = building.entrances.find(
    (entrance) => floor >= entrance.minFloor && floor <= entrance.maxFloor,
  )
  if (exact) return exact

  let best: BuildingEntrance | undefined
  let bestDistance = Infinity
  let bestGroundDistance = Infinity
  for (const entrance of building.entrances) {
    const entranceFloor = nearestFloorOf(entrance, floor)
    const distance = Math.abs(levelIndex(floor) - levelIndex(entranceFloor))
    const groundDistance = Math.abs(levelIndex(entranceFloor))
    if (distance < bestDistance || (distance === bestDistance && groundDistance < bestGroundDistance)) {
      best = entrance
      bestDistance = distance
      bestGroundDistance = groundDistance
    }
  }
  return best
}

/** 출입구의 층 범위 안에서 `floor` 에 가장 가까운 층. */
function nearestFloorOf(entrance: BuildingEntrance, floor: number): number {
  return Math.min(Math.max(floor, entrance.minFloor), entrance.maxFloor)
}

/**
 * 고른 층과 그 층이 쓰는 출입구 사이를 오르내리는 데 드는 시간(초).
 *
 * 출입구가 매칭되면 그 출입구 층까지의 층 수로, 층별 출입구 정보가 없는
 * 건물이면 지상 1층 출입구를 기준으로 센다. 층을 고르지 않았으면 0.
 */
export function entranceTransitSeconds(building: Building, floor: number | null): number {
  if (floor === null) return 0
  const entrance = matchEntrance(building, floor)
  const entranceFloor = entrance ? nearestFloorOf(entrance, floor) : 1
  return Math.abs(levelIndex(floor) - levelIndex(entranceFloor)) * FLOOR_TRANSIT_SECONDS
}

/**
 * 경로 시작/끝 지점의 좌표를 정한다. 고른 층의 출입구(`matchEntrance`) 좌표를,
 * 없으면 건물 대표 좌표(`lat`/`lng`)를 쓴다.
 *
 * 층을 고르지 않았거나(null) 그 건물에 출입구별 좌표가 없으면 항상 대표
 * 좌표로 떨어진다.
 */
export function resolveEntrancePoint(
  building: Building,
  floor: number | null,
): RoutePoint {
  const match = matchEntrance(building, floor)
  if (match) return { lat: match.lat, lng: match.lng }
  return { lat: building.lat, lng: building.lng }
}
