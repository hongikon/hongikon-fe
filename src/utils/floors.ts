import { FLOOR_TRANSIT_SECONDS } from '../constants/route'
import type { Building, BuildingEntrance } from '../types'

export interface RoutePoint {
  lat: number
  lng: number
}

/**
 * 층 번호 표기 규칙
 * 양수는 지상(1 → '1F'), 음수는 지하(-1 → 'B1'). 0층은 존재하지 않는다.
 */
export interface FloorOption {
  label: string
  value: number
}

export function formatFloor(floor: number): string {
  return floor > 0 ? `${floor}F` : `B${Math.abs(floor)}`
}

/** 층 정보가 있어 다이얼을 띄울 수 있는 건물인지 판별한다. */
export function hasFloorData(building: Building): boolean {
  return building.floors !== undefined && building.floors > 0
}

/** 지하 최하층부터 지상 최상층까지의 선택지를 만든다. */
export function buildFloorOptions(building: Building): FloorOption[] {
  const { floors, basementFloors } = building
  if (floors === undefined || floors <= 0) return []

  const options: FloorOption[] = []

  for (let level = basementFloors ?? 0; level >= 1; level -= 1) {
    options.push({ label: formatFloor(-level), value: -level })
  }
  for (let level = 1; level <= floors; level += 1) {
    options.push({ label: formatFloor(level), value: level })
  }

  return options
}

/**
 * 해당 층에서 건물 출입구(1층)까지 오르내려야 하는 층 수.
 * 3F는 2개 층, B1은 1개 층을 이동한다.
 */
function levelsFromGround(floor: number): number {
  return floor > 0 ? floor - 1 : Math.abs(floor)
}

/**
 * 출발 층에서 나와 도착 층까지 올라가는 데 드는 시간(초).
 * 층을 고르지 않은 쪽은 0으로 계산한다.
 */
export function floorTransitSeconds(
  fromFloor: number | null,
  toFloor: number | null,
): number {
  const fromLevels = fromFloor === null ? 0 : levelsFromGround(fromFloor)
  const toLevels = toFloor === null ? 0 : levelsFromGround(toFloor)
  return (fromLevels + toLevels) * FLOOR_TRANSIT_SECONDS
}

/**
 * 고른 층이 속하는 출입구. `src/utils/routing.ts` 도 이걸로 앵커 노드를
 * 정해, 경로가 실제로 잇는 출입구와 배너에 뜨는 좌표가 항상 같게 한다.
 */
export function matchEntrance(
  building: Building,
  floor: number | null,
): BuildingEntrance | undefined {
  if (floor === null || !building.entrances) return undefined
  return building.entrances.find(
    (entrance) => floor >= entrance.minFloor && floor <= entrance.maxFloor,
  )
}

/**
 * 경로 시작/끝 지점의 좌표를 정한다. 고른 층이 `entrances` 의 어느 범위에
 * 속하면 그 출입구 좌표를, 아니면 건물 대표 좌표(`lat`/`lng`)를 쓴다.
 *
 * 층을 고르지 않았거나(null) 그 건물에 출입구별 좌표가 없으면 항상 대표
 * 좌표로 떨어진다 — 지금은 대부분의 건물이 여기 해당한다.
 */
export function resolveEntrancePoint(
  building: Building,
  floor: number | null,
): RoutePoint {
  const match = matchEntrance(building, floor)
  if (match) return { lat: match.lat, lng: match.lng }
  return { lat: building.lat, lng: building.lng }
}
