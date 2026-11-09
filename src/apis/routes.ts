import { apiRequest } from './client'
import type { Building } from '../types'
import type { RoutePoint } from '../utils/floors'
import { haversineMeters } from '../utils/geo'
import { WALKING_METERS_PER_MINUTE } from '../constants/route'

/**
 * 지도 길찾기(11-09부터 서버가 계산한다 — hongikon-be `walkroute`). 앱에는 경로망·계산 규칙을 두지 않고 결과만 받는다.
 * - 건물 → 건물: `GET /map/routes`
 * - 내 위치 → 건물: 위치를 보내지 않는다. `GET /map/routes/approach` 로 "모든 실외 길 점에서 도착까지의 길"을 받아
 *   휴대폰이 내 위치에서 가까운 길 점을 골라 잇는다(`pickApproachRoute`). 처리방침·공지의 '길찾기 위치는 휴대폰 안에서만' 그대로.
 */

export interface RouteAlternative {
  points: RoutePoint[]
  distanceMeters: number
  totalSeconds: number
  minutes: number
  hasIndoorTransit: boolean
  /** 경로에 계단 구간(경로 조사의 계단 선)이 있다. */
  hasStairs: boolean
  /** 경로망에 아직 없는 건물이라 출입구에서 가장 가까운 길까지 직선으로 이은 구간이 있다. */
  hasLinkSegment: boolean
  /** true면 실측 경로망이 아직 이 구간을 덮지 못해 직선 거리로 대신한 값이다. */
  isEstimate: boolean
  /** 엘리베이터로 층을 옮긴다. */
  usesElevator?: boolean
  /** 건물 안(실내 정점끼리) 걷는 거리(m). */
  indoorMeters?: number
  /** 출발·도착 말고 안으로 지나가는 건물 이름(지나는 순서). */
  viaBuildings?: string[]
  /** 지나는 곳의 조사 메모(지나는 순서). "C동 3층 올라가는 계단", "주말 폐문" 등. */
  notes?: string[]
  /** 길 흐름: "R동 1층 출구", "Z2동 2층 → 3층 통과", "T동 3층 출입구", "엘리베이터로 5층 올라가기". */
  steps?: string[]
  /** 건물 안 구간. 지도에서 점선으로 겹쳐 그린다. */
  indoorSegments?: RoutePoint[][]
}

/** 내 위치 출발용: 길 점(next 를 따라가면 도착, 도착이면 null)과 각 실외 길 점에서 도착까지의 길(points 없음). */
export interface WalkApproach {
  nodes: { id: string; lat: number; lng: number; next: string | null }[]
  starts: { node: string; route: Omit<RouteAlternative, 'points'> }[]
}

const ROUTE_TIMEOUT_MS = 8000

function isPoint(value: unknown): value is RoutePoint {
  const p = value as RoutePoint
  return !!p && Number.isFinite(p.lat) && Number.isFinite(p.lng)
}

function floorParam(name: string, floor: number | null): string {
  return floor === null ? '' : `&${name}=${encodeURIComponent(String(floor))}`
}

/** 건물(층) → 건물(층) 후보(가장 빠른 길이 맨 앞). 서버가 못 덮으면 직선 어림 하나가 온다. 건물 id 가 없으면 던진다. */
export async function fetchWalkRoutes({
  from,
  fromFloor,
  to,
  toFloor,
  signal,
}: {
  from: Building
  fromFloor: number | null
  to: Building
  toFloor: number | null
  signal?: AbortSignal
}): Promise<RouteAlternative[]> {
  if (from.id === undefined || to.id === undefined) throw new Error('건물 id 가 없어 길찾기를 요청할 수 없다')
  const path = `/map/routes?from=${from.id}${floorParam('fromFloor', fromFloor)}&to=${to.id}${floorParam('toFloor', toFloor)}`
  const body = await apiRequest<{ routes?: unknown }>(path, { signal, timeoutMs: ROUTE_TIMEOUT_MS, skipTokenRefresh: true })
  const routes = Array.isArray(body.routes) ? body.routes : []
  return routes.filter(
    (r): r is RouteAlternative =>
      !!r && Array.isArray((r as RouteAlternative).points) && (r as RouteAlternative).points.length >= 2 &&
      (r as RouteAlternative).points.every(isPoint) && Number.isFinite((r as RouteAlternative).totalSeconds),
  )
}

/** 내 위치 출발용 길 묶음. 위치는 보내지 않는다(도착 건물·층만). */
export async function fetchWalkApproach({
  to,
  toFloor,
  signal,
}: {
  to: Building
  toFloor: number | null
  signal?: AbortSignal
}): Promise<WalkApproach> {
  if (to.id === undefined) throw new Error('건물 id 가 없어 길찾기를 요청할 수 없다')
  const body = await apiRequest<Partial<WalkApproach>>(`/map/routes/approach?to=${to.id}${floorParam('toFloor', toFloor)}`, {
    signal,
    timeoutMs: ROUTE_TIMEOUT_MS,
    skipTokenRefresh: true,
  })
  return {
    nodes: Array.isArray(body.nodes) ? body.nodes.filter((n) => !!n && typeof n.id === 'string' && isPoint(n)) : [],
    starts: Array.isArray(body.starts)
      ? body.starts.filter((s) => !!s && typeof s.node === 'string' && !!s.route && Number.isFinite(s.route.totalSeconds))
      : [],
  }
}

/** 내 위치를 이을 가까운 길 점 수와 최대 거리. 더 멀면 직선 어림으로 대신한다(서버 WalkRouterApproachParityTest 와 같은 값). */
const MY_LOCATION_LINKS = 3
const MY_LOCATION_MAX_METERS = 150

/**
 * 내 위치에서 가까운 길 점(150m 안, 가까운 3곳)까지 걷는 시간 + 그 점에서 도착까지의 시간이 가장 작은 길. 좌표는 이 계산에만 쓴다.
 * 예전 앱 계산(내 위치를 그 3곳에 잇고 최단 경로)과 같은 길이 나온다. 이을 곳이 없으면 null.
 */
export function pickApproachRoute(approach: WalkApproach, me: RoutePoint): RouteAlternative | null {
  const nodes = new Map(approach.nodes.map((n) => [n.id, n]))
  const near: { start: WalkApproach['starts'][number]; meters: number }[] = []
  for (const start of approach.starts) {
    const node = nodes.get(start.node)
    if (!node) continue
    const meters = haversineMeters(me.lat, me.lng, node.lat, node.lng)
    if (meters <= MY_LOCATION_MAX_METERS) near.push({ start, meters })
  }
  near.sort((a, b) => a.meters - b.meters)
  let best: (typeof near)[number] | null = null
  let bestSeconds = Infinity
  for (const n of near.slice(0, MY_LOCATION_LINKS)) {
    const seconds = (n.meters / WALKING_METERS_PER_MINUTE) * 60 + n.start.route.totalSeconds
    if (seconds < bestSeconds) {
      best = n
      bestSeconds = seconds
    }
  }
  if (!best) return null

  const points: RoutePoint[] = [{ lat: me.lat, lng: me.lng }]
  const seen = new Set<string>()
  for (let id: string | null = best.start.node; id !== null && !seen.has(id); ) {
    seen.add(id)
    const node = nodes.get(id)
    if (!node) break
    const last = points[points.length - 1]
    if (last.lat !== node.lat || last.lng !== node.lng) points.push({ lat: node.lat, lng: node.lng })
    id = node.next
  }
  const route = best.start.route
  return {
    ...route,
    points,
    distanceMeters: Math.round(best.meters + route.distanceMeters),
    totalSeconds: bestSeconds,
    minutes: Math.max(1, Math.round(bestSeconds / 60)),
    isEstimate: false,
  }
}
