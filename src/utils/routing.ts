import { BUILDINGS } from '../constants/buildings'
import { PATH_EDGES, PATH_WAYPOINTS } from '../constants/pathNodes'
import { WALKING_METERS_PER_MINUTE } from '../constants/route'
import type { Building } from '../types'
import { floorTransitSeconds, matchEntrance, resolveEntrancePoint } from './floors'
import type { RoutePoint } from './floors'
import { haversineMeters } from './geo'

export interface RouteAlternative {
  points: RoutePoint[]
  distanceMeters: number
  totalSeconds: number
  minutes: number
  hasIndoorTransit: boolean
  /** true면 실측 경로망이 아직 이 구간을 덮지 못해 직선 거리로 대신한 값이다. */
  isEstimate: boolean
}

interface GraphEdge {
  to: string
  seconds: number
  meters: number
}

interface Graph {
  nodes: Map<string, RoutePoint>
  /** 층 이동을 나타내는 합성 노드. 지도에는 그리지 않는다(출입구와 좌표가 같다). */
  floorNodeIds: Set<string>
  adj: Map<string, GraphEdge[]>
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

function addEdge(graph: Graph, aId: string, aPoint: RoutePoint, bId: string, bPoint: RoutePoint): void {
  graph.nodes.set(aId, aPoint)
  graph.nodes.set(bId, bPoint)
  const meters = haversineMeters(aPoint.lat, aPoint.lng, bPoint.lat, bPoint.lng)
  const seconds = (meters / WALKING_METERS_PER_MINUTE) * 60
  pushAdj(graph, aId, { to: bId, seconds, meters })
  pushAdj(graph, bId, { to: aId, seconds, meters })
}

/**
 * PATH_EDGES 의 한쪽 끝을 실제 좌표로 푼다. PathWaypoint.id 이거나,
 * '건물명' 또는 '건물명#출입구라벨' 문자열이다. 못 찾으면 null — 오타가 있는
 * 간선은 조용히 건너뛴다(전체 그래프를 무너뜨리지 않는다).
 */
function resolveRef(
  ref: string,
  waypointById: Map<string, { id: string; lat: number; lng: number }>,
): { id: string; point: RoutePoint } | null {
  const waypoint = waypointById.get(ref)
  if (waypoint) return { id: waypoint.id, point: { lat: waypoint.lat, lng: waypoint.lng } }

  const hashIndex = ref.indexOf('#')
  if (hashIndex === -1) {
    const building = BUILDINGS.find((b) => b.name === ref)
    if (!building) return null
    return { id: building.name, point: { lat: building.lat, lng: building.lng } }
  }

  const buildingName = ref.slice(0, hashIndex)
  const label = ref.slice(hashIndex + 1)
  const building = BUILDINGS.find((b) => b.name === buildingName)
  const entrance = building?.entrances?.find((e) => e.label === label)
  if (!building || !entrance) return null
  return { id: ref, point: { lat: entrance.lat, lng: entrance.lng } }
}

function buildBaseGraph(): Graph {
  const waypointById = new Map(PATH_WAYPOINTS.map((w) => [w.id, w]))
  const graph: Graph = { nodes: new Map(), floorNodeIds: new Set(), adj: new Map() }

  for (const [aRef, bRef] of PATH_EDGES) {
    const a = resolveRef(aRef, waypointById)
    const b = resolveRef(bRef, waypointById)
    if (!a || !b) continue
    addEdge(graph, a.id, a.point, b.id, b.point)
  }

  return graph
}

let baseGraphCache: Graph | null = null

function getBaseGraph(): Graph {
  if (!baseGraphCache) baseGraphCache = buildBaseGraph()
  return baseGraphCache
}

function cloneGraph(graph: Graph): Graph {
  const adj = new Map<string, GraphEdge[]>()
  graph.adj.forEach((edges, id) => adj.set(id, [...edges]))
  return { nodes: new Map(graph.nodes), floorNodeIds: new Set(graph.floorNodeIds), adj }
}

function anchorId(building: Building, floor: number | null): string {
  const entrance = matchEntrance(building, floor)
  return entrance ? `${building.name}#${entrance.label}` : building.name
}

/**
 * 고른 층으로 가는 합성 노드를 그래프에 붙인다. 그 건물이 아직 경로망에
 * 없으면(출입구 앵커가 그래프에 없으면) 존재하지 않는 id 를 그대로 돌려줘
 * 호출부가 "이 구간은 아직 못 덮는다"를 감지하게 한다.
 */
function attachFloorNode(graph: Graph, building: Building, floor: number | null): string {
  const anchor = anchorId(building, floor)
  if (floor === null || !graph.nodes.has(anchor)) return anchor

  const floorNodeId = `${building.name}::${floor}`
  const point = graph.nodes.get(anchor)!
  graph.nodes.set(floorNodeId, point)
  graph.floorNodeIds.add(floorNodeId)

  const seconds = floorTransitSeconds(null, floor)
  pushAdj(graph, floorNodeId, { to: anchor, seconds, meters: 0 })
  pushAdj(graph, anchor, { to: floorNodeId, seconds, meters: 0 })

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
  let hasIndoorTransit = false

  for (const id of path.nodeIds) {
    if (graph.floorNodeIds.has(id)) {
      hasIndoorTransit = true
      continue
    }
    const point = graph.nodes.get(id)
    if (point) points.push(point)
  }

  let distanceMeters = 0
  for (let i = 0; i < path.nodeIds.length - 1; i++) {
    const edge = (graph.adj.get(path.nodeIds[i]) ?? []).find((e) => e.to === path.nodeIds[i + 1])
    if (edge) distanceMeters += edge.meters
  }

  return {
    points,
    distanceMeters: Math.round(distanceMeters),
    totalSeconds: path.seconds,
    minutes: Math.max(1, Math.round(path.seconds / 60)),
    hasIndoorTransit,
    isEstimate: false,
  }
}

/**
 * 실측 경로망을 따라 계산한 대안 경로들. 어느 한쪽 건물이 아직 경로망에
 * 없으면(그래프에 앵커가 없으면) 빈 배열을 돌려준다 — 호출부는
 * straightLineFallback 으로 대신해야 한다.
 */
export function findRoutes(
  from: { building: Building; floor: number | null },
  to: { building: Building; floor: number | null },
  maxAlternatives = 3,
): RouteAlternative[] {
  const graph = cloneGraph(getBaseGraph())
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
  const totalSeconds = walkSeconds + floorTransitSeconds(fromFloor, toFloor)

  return {
    points: [fromPoint, toPoint],
    distanceMeters: Math.round(meters),
    totalSeconds,
    minutes: Math.max(1, Math.round(totalSeconds / 60)),
    hasIndoorTransit: fromFloor !== null || toFloor !== null,
    isEstimate: true,
  }
}
