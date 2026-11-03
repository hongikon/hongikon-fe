import { SURVEY_EDGES, SURVEY_ENTRANCES, SURVEY_WAYPOINTS } from '../constants/surveyPaths'
import { PATH_EDGES, PATH_WAYPOINTS } from '../constants/pathNodes'
import { FLOOR_TRANSIT_SECONDS, WALKING_METERS_PER_MINUTE } from '../constants/route'
import type { Building } from '../types'
import { entranceTransitSeconds, levelIndex, resolveEntrancePoint } from './floors'
import type { RoutePoint } from './floors'
import { haversineMeters } from './geo'

export interface RouteAlternative {
  points: RoutePoint[]
  distanceMeters: number
  totalSeconds: number
  minutes: number
  hasIndoorTransit: boolean
  /** 경로에 계단 구간(경로 조사의 계단 선)이 있다. */
  hasStairs: boolean
  /** true면 실측 경로망이 아직 이 구간을 덮지 못해 직선 거리로 대신한 값이다. */
  isEstimate: boolean
}

interface GraphEdge {
  to: string
  seconds: number
  meters: number
  stairs?: boolean
}

interface Graph {
  nodes: Map<string, RoutePoint>
  /** 층 이동을 나타내는 합성 노드. 지도에는 그리지 않는다(출입구와 좌표가 같다). */
  floorNodeIds: Set<string>
  adj: Map<string, GraphEdge[]>
  /** 건물 이름 → 경로망에 이어진 출입구(앵커 id 와 그 출입구 층). */
  entrancesByBuilding: Map<string, { id: string; floor: number }[]>
}

interface PathResult {
  nodeIds: string[]
  seconds: number
}

function pushAdj(graph: Graph, id: string, edge: GraphEdge): void {
  const list = graph.adj.get(id)
  if (list) list.push(edge)
  else graph.adj.set(id, [edge])
}

function addEdge(
  graph: Graph,
  aId: string,
  aPoint: RoutePoint,
  bId: string,
  bPoint: RoutePoint,
  stairs = false,
): void {
  graph.nodes.set(aId, aPoint)
  graph.nodes.set(bId, bPoint)
  const meters = haversineMeters(aPoint.lat, aPoint.lng, bPoint.lat, bPoint.lng)
  const seconds = (meters / WALKING_METERS_PER_MINUTE) * 60
  pushAdj(graph, aId, { to: bId, seconds, meters, stairs })
  pushAdj(graph, bId, { to: aId, seconds, meters, stairs })
}

/**
 * PATH_EDGES 의 한쪽 끝을 실제 좌표로 푼다. PathWaypoint.id 이거나,
 * '건물명' 또는 '건물명#출입구라벨' 문자열이다. 못 찾으면 null — 오타가 있는
 * 간선은 조용히 건너뛴다(전체 그래프를 무너뜨리지 않는다).
 */
export function resolveRef(
  ref: string,
  waypointById: Map<string, { id: string; lat: number; lng: number }>,
  buildings: readonly Building[],
): { id: string; point: RoutePoint } | null {
  const waypoint = waypointById.get(ref)
  if (waypoint) return { id: waypoint.id, point: { lat: waypoint.lat, lng: waypoint.lng } }

  const hashIndex = ref.indexOf('#')
  if (hashIndex === -1) {
    const building = buildings.find((b) => b.name === ref)
    if (!building) return null
    return { id: building.name, point: { lat: building.lat, lng: building.lng } }
  }

  const buildingName = ref.slice(0, hashIndex)
  const label = ref.slice(hashIndex + 1)
  const building = buildings.find((b) => b.name === buildingName)
  const entrance = building?.entrances?.find((e) => e.label === label)
  if (!building || !entrance) return null
  return { id: ref, point: { lat: entrance.lat, lng: entrance.lng } }
}

/**
 * 출입구 이름의 건물 코드(HI_R_… 의 'R') → 건물. 서버 지도 데이터의 출입구 이름 앞부분으로 찾는다 —
 * 경로 조사에서 새로 생긴 출입구 이름(서버에 아직 없는 것)도 같은 건물에 붙일 수 있다.
 */
function buildingsByCode(buildings: readonly Building[]): Map<string, Building> {
  const byCode = new Map<string, Building>()
  for (const building of buildings) {
    for (const entrance of building.entrances ?? []) {
      const code = entrance.label.match(/^HI_([A-Z0-9]+)_/)?.[1]
      if (code && !byCode.has(code)) byCode.set(code, building)
    }
  }
  return byCode
}

/**
 * 경로 조사 자료(surveyPaths.ts, 11-03)로 만든 경로망. 출입구는 '건물명#출입구이름' 앵커로 그 점에 0m 로 잇는다.
 * 9월 자료(pathNodes.ts)는 개발용 점검 화면만 쓴다.
 */
function buildBaseGraph(buildings: readonly Building[]): Graph {
  const graph: Graph = { nodes: new Map(), floorNodeIds: new Set(), adj: new Map(), entrancesByBuilding: new Map() }
  const waypointById = new Map(SURVEY_WAYPOINTS.map((w) => [w.id, w]))

  for (const [aId, bId, stairs] of SURVEY_EDGES) {
    const a = waypointById.get(aId)
    const b = waypointById.get(bId)
    if (!a || !b) continue
    addEdge(graph, a.id, a, b.id, b, stairs === true)
  }

  const byCode = buildingsByCode(buildings)
  for (const entrance of SURVEY_ENTRANCES) {
    const building = byCode.get(entrance.code)
    const point = graph.nodes.get(entrance.node)
    if (!building || !point) continue
    const anchor = `${building.name}#${entrance.label}`
    addEdge(graph, anchor, point, entrance.node, point)
    const list = graph.entrancesByBuilding.get(building.name) ?? []
    list.push({ id: anchor, floor: entrance.floor })
    graph.entrancesByBuilding.set(building.name, list)
  }

  addLegacyFill(graph, buildings)
  return graph
}

/** 9월 경로망 점을 11-03 경로망 점에 이을 최대 거리. 두 자료는 같은 점을 공유하지 않아 가까운 점끼리 잇는다(대략). */
const LEGACY_BRIDGE_METERS = 20

/**
 * 11-03 조사 자료에 아직 없는 건물(중앙도서관 H동 등)만 9월 자료(pathNodes.ts)로 채운다(11-03 운영진 요청, 대략적인 임시 방법).
 * - 11-03 자료에 출입구가 있는 건물에 닿는 9월 선은 넣지 않는다(새 자료를 우선).
 * - 9월 점 id 는 'old:' 를 붙여 새 점과 겹치지 않게 하고, 새 점과 20m 안이면 이어 붙인다.
 * 조사를 더 해서 그 건물이 새 자료에 들어오면 저절로 9월 자료 대신 새 자료를 쓴다.
 */
function addLegacyFill(graph: Graph, buildings: readonly Building[]): void {
  const covered = new Set(graph.entrancesByBuilding.keys())
  const waypointById = new Map(PATH_WAYPOINTS.map((w) => [w.id, w]))
  const newPoints = SURVEY_WAYPOINTS.filter((w) => graph.nodes.has(w.id))
  const legacyPoints = new Set<string>()

  const resolve = (ref: string) => {
    const resolved = resolveRef(ref, waypointById, buildings)
    if (!resolved) return null
    if (waypointById.has(ref)) {
      legacyPoints.add(`old:${resolved.id}`)
      return { id: `old:${resolved.id}`, point: resolved.point, building: null as Building | null, label: null as string | null }
    }
    const hash = ref.indexOf('#')
    const name = hash === -1 ? ref : ref.slice(0, hash)
    const building = buildings.find((b) => b.name === name) ?? null
    return { id: resolved.id, point: resolved.point, building, label: hash === -1 ? null : ref.slice(hash + 1) }
  }

  for (const [aRef, bRef] of PATH_EDGES) {
    const a = resolve(aRef)
    const b = resolve(bRef)
    if (!a || !b) continue
    if ((a.building && covered.has(a.building.name)) || (b.building && covered.has(b.building.name))) continue
    addEdge(graph, a.id, a.point, b.id, b.point)
    for (const end of [a, b]) {
      if (!end.building) continue
      const list = graph.entrancesByBuilding.get(end.building.name) ?? []
      if (list.some((e) => e.id === end.id)) continue
      const entrance = end.label ? end.building.entrances?.find((e) => e.label === end.label) : undefined
      list.push({ id: end.id, floor: entrance ? entrance.minFloor : 1 })
      graph.entrancesByBuilding.set(end.building.name, list)
    }
  }

  for (const id of legacyPoints) {
    const point = graph.nodes.get(id)
    if (!point) continue
    let best: { id: string; meters: number } | null = null
    for (const w of newPoints) {
      const meters = haversineMeters(point.lat, point.lng, w.lat, w.lng)
      if (meters <= LEGACY_BRIDGE_METERS && (!best || meters < best.meters)) best = { id: w.id, meters }
    }
    if (best) addEdge(graph, id, point, best.id, graph.nodes.get(best.id)!)
  }
}

const baseGraphCache = new WeakMap<readonly Building[], Graph>()

function getBaseGraph(buildings: readonly Building[]): Graph {
  let graph = baseGraphCache.get(buildings)
  if (!graph) {
    graph = buildBaseGraph(buildings)
    baseGraphCache.set(buildings, graph)
  }
  return graph
}

function cloneGraph(graph: Graph): Graph {
  const adj = new Map<string, GraphEdge[]>()
  graph.adj.forEach((edges, id) => adj.set(id, [...edges]))
  return { nodes: new Map(graph.nodes), floorNodeIds: new Set(graph.floorNodeIds), adj, entrancesByBuilding: graph.entrancesByBuilding }
}

/**
 * 고른 건물·층에서 출발(도착)하는 합성 노드를 붙인다. 그 건물의 경로망에 이어진 출입구 모두와 잇고,
 * 층 차이만큼 시간을 더한다(건물 안에서 계단·엘리베이터로 오르내려 그 출입구로 나간다고 본다).
 * 그래서 목적지 쪽으로 가장 빠른 출입구를 길찾기가 고른다. 층을 안 골랐으면 모든 출입구가 0초다.
 * 그 건물이 아직 경로망에 없으면 그래프에 없는 id 를 돌려줘 호출부가 직선 추정으로 대신하게 한다.
 */
function attachFloorNode(graph: Graph, building: Building, floor: number | null): string {
  const entrances = graph.entrancesByBuilding.get(building.name)
  const floorNodeId = `${building.name}::${floor ?? 'any'}`
  if (!entrances || entrances.length === 0) return floorNodeId

  graph.nodes.set(floorNodeId, graph.nodes.get(entrances[0].id)!)
  graph.floorNodeIds.add(floorNodeId)
  for (const entrance of entrances) {
    const seconds = floor === null ? 0 : Math.abs(levelIndex(floor) - levelIndex(entrance.floor)) * FLOOR_TRANSIT_SECONDS
    pushAdj(graph, floorNodeId, { to: entrance.id, seconds, meters: 0 })
    pushAdj(graph, entrance.id, { to: floorNodeId, seconds, meters: 0 })
  }
  return floorNodeId
}

function dijkstra(
  graph: Graph,
  sourceId: string,
  targetId: string,
  excludedNodes: ReadonlySet<string> = new Set(),
  excludedEdges: ReadonlySet<string> = new Set(),
): PathResult | null {
  const dist = new Map<string, number>([[sourceId, 0]])
  const prev = new Map<string, string>()
  const visited = new Set<string>()

  for (;;) {
    let currentId: string | null = null
    let currentDist = Infinity
    for (const [id, d] of dist) {
      if (!visited.has(id) && d < currentDist) {
        currentDist = d
        currentId = id
      }
    }
    if (currentId === null || currentId === targetId) break
    visited.add(currentId)

    for (const edge of graph.adj.get(currentId) ?? []) {
      if (excludedNodes.has(edge.to) || excludedEdges.has(`${currentId}->${edge.to}`)) continue
      const next = currentDist + edge.seconds
      if (next < (dist.get(edge.to) ?? Infinity)) {
        dist.set(edge.to, next)
        prev.set(edge.to, currentId)
      }
    }
  }

  if (!dist.has(targetId)) return null

  const nodeIds: string[] = [targetId]
  for (let cursor = targetId; cursor !== sourceId; ) {
    const p = prev.get(cursor)
    if (p === undefined) return null
    nodeIds.push(p)
    cursor = p
  }
  nodeIds.reverse()
  return { nodeIds, seconds: dist.get(targetId)! }
}

function pathSeconds(graph: Graph, nodeIds: string[]): number {
  let total = 0
  for (let i = 0; i < nodeIds.length - 1; i++) {
    const edge = (graph.adj.get(nodeIds[i]) ?? []).find((e) => e.to === nodeIds[i + 1])
    if (edge) total += edge.seconds
  }
  return total
}

function arraysEqual(a: string[], b: string[]): boolean {
  return a.length === b.length && a.every((v, i) => v === b[i])
}

function pathKey(nodeIds: string[]): string {
  return nodeIds.join('>')
}

/** Yen's algorithm — 루프 없는 k 개의 최단 경로 후보. */
function yenKShortestPaths(graph: Graph, sourceId: string, targetId: string, k: number): PathResult[] {
  const first = dijkstra(graph, sourceId, targetId)
  if (!first) return []

  const A: PathResult[] = [first]
  const seen = new Set<string>([pathKey(first.nodeIds)])
  const B: PathResult[] = []

  for (let i = 1; i < k; i++) {
    const prevPath = A[i - 1].nodeIds

    for (let spurIndex = 0; spurIndex < prevPath.length - 1; spurIndex++) {
      const spurNode = prevPath[spurIndex]
      const rootPath = prevPath.slice(0, spurIndex + 1)

      const excludedEdges = new Set<string>()
      for (const path of A) {
        if (
          path.nodeIds.length > spurIndex &&
          arraysEqual(path.nodeIds.slice(0, spurIndex + 1), rootPath)
        ) {
          excludedEdges.add(`${path.nodeIds[spurIndex]}->${path.nodeIds[spurIndex + 1]}`)
        }
      }
      const excludedNodes = new Set(rootPath.slice(0, -1))

      const spurResult = dijkstra(graph, spurNode, targetId, excludedNodes, excludedEdges)
      if (!spurResult) continue

      const totalNodeIds = rootPath.slice(0, -1).concat(spurResult.nodeIds)
      const key = pathKey(totalNodeIds)
      if (seen.has(key)) continue
      seen.add(key)
      B.push({ nodeIds: totalNodeIds, seconds: pathSeconds(graph, rootPath) + spurResult.seconds })
    }

    if (B.length === 0) break
    B.sort((a, b) => a.seconds - b.seconds)
    A.push(B.shift()!)
  }

  return A
}

function edgeSet(nodeIds: string[]): Set<string> {
  const set = new Set<string>()
  for (let i = 0; i < nodeIds.length - 1; i++) set.add(`${nodeIds[i]}-${nodeIds[i + 1]}`)
  return set
}

function overlapRatio(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0
  let shared = 0
  for (const edge of a) if (b.has(edge)) shared++
  return shared / Math.min(a.size, b.size)
}

/**
 * 후보 중 서로 많이 겹치지 않는 것만 고른다. 실제로 다른 길이 하나뿐이면
 * 억지로 여러 개를 만들지 않고 하나만 돌려준다.
 */
function pickDiverseRoutes(
  candidates: PathResult[],
  maxResults: number,
  overlapThreshold = 0.6,
): PathResult[] {
  const sorted = [...candidates].sort((a, b) => a.seconds - b.seconds)
  const picked: PathResult[] = []
  const pickedEdgeSets: Set<string>[] = []

  for (const candidate of sorted) {
    if (picked.length >= maxResults) break
    const candidateEdges = edgeSet(candidate.nodeIds)
    const overlapsExisting = pickedEdgeSets.some(
      (existing) => overlapRatio(candidateEdges, existing) >= overlapThreshold,
    )
    if (overlapsExisting) continue
    picked.push(candidate)
    pickedEdgeSets.push(candidateEdges)
  }

  return picked
}

function toRouteAlternative(graph: Graph, path: PathResult): RouteAlternative {
  const points: RoutePoint[] = []
  for (const id of path.nodeIds) {
    if (graph.floorNodeIds.has(id)) continue
    const point = graph.nodes.get(id)
    if (point) points.push(point)
  }

  let distanceMeters = 0
  let hasIndoorTransit = false
  let hasStairs = false
  for (let i = 0; i < path.nodeIds.length - 1; i++) {
    const edge = (graph.adj.get(path.nodeIds[i]) ?? []).find((e) => e.to === path.nodeIds[i + 1])
    if (!edge) continue
    distanceMeters += edge.meters
    if (edge.stairs) hasStairs = true
    // 건물 안 층 이동(합성 노드와 출입구 사이 시간이 있는 간선).
    if (edge.meters === 0 && edge.seconds > 0 && (graph.floorNodeIds.has(path.nodeIds[i]) || graph.floorNodeIds.has(edge.to))) {
      hasIndoorTransit = true
    }
  }

  return {
    points,
    distanceMeters: Math.round(distanceMeters),
    totalSeconds: path.seconds,
    minutes: Math.max(1, Math.round(path.seconds / 60)),
    hasIndoorTransit,
    hasStairs,
    isEstimate: false,
  }
}

/**
 * 실측 경로망을 따라 계산한 대안 경로들. 어느 한쪽 건물이 아직 경로망에
 * 없으면(그래프에 앵커가 없으면) 빈 배열을 돌려준다 — 호출부는
 * straightLineFallback 으로 대신해야 한다.
 */
export function findRoutes(
  buildings: readonly Building[],
  from: { building: Building; floor: number | null },
  to: { building: Building; floor: number | null },
  maxAlternatives = 3,
): RouteAlternative[] {
  const graph = cloneGraph(getBaseGraph(buildings))
  const sourceId = attachFloorNode(graph, from.building, from.floor)
  const targetId = attachFloorNode(graph, to.building, to.floor)
  if (!graph.nodes.has(sourceId) || !graph.nodes.has(targetId)) return []

  const k = Math.max(6, maxAlternatives * 2)
  const candidates = yenKShortestPaths(graph, sourceId, targetId, k)
  if (candidates.length === 0) return []

  return pickDiverseRoutes(candidates, maxAlternatives).map((path) => toRouteAlternative(graph, path))
}

/**
 * 경로망이 아직 이 구간을 덮지 못할 때 쓰는 대체값. 출입구 간 직선거리 +
 * 층 이동 시간으로 추정한다(기존 routeMinutes 와 같은 계산).
 */
export function straightLineFallback(
  fromBuilding: Building,
  fromFloor: number | null,
  toBuilding: Building,
  toFloor: number | null,
): RouteAlternative {
  const fromPoint = resolveEntrancePoint(fromBuilding, fromFloor)
  const toPoint = resolveEntrancePoint(toBuilding, toFloor)
  const meters = haversineMeters(fromPoint.lat, fromPoint.lng, toPoint.lat, toPoint.lng)
  const walkSeconds = (meters / WALKING_METERS_PER_MINUTE) * 60
  const totalSeconds =
    walkSeconds + entranceTransitSeconds(fromBuilding, fromFloor) + entranceTransitSeconds(toBuilding, toFloor)

  return {
    points: [fromPoint, toPoint],
    distanceMeters: Math.round(meters),
    totalSeconds,
    minutes: Math.max(1, Math.round(totalSeconds / 60)),
    hasIndoorTransit: fromFloor !== null || toFloor !== null,
    hasStairs: false,
    isEstimate: true,
  }
}
