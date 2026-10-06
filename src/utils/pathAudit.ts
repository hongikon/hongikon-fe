import { resolveRef } from './routing'
import type { Building, PathEdge, PathWaypoint } from '../types'

/**
 * 실외 보행 경로망(pathNodes.ts) 점검 — 개발용 `/dev/path` 화면이 쓴다.
 * 길찾기(routing.ts)와 같은 규칙(resolveRef)으로 간선 양 끝을 풀어, 길찾기에서 조용히 빠지는 것들을 드러낸다.
 */

export interface AuditPoint {
  id: string
  lat: number
  lng: number
}

export interface PathAudit {
  /** 간선 한쪽 끝을 지점·건물·출입구 어느 것으로도 못 찾은 경우. 길찾기에서 그 간선이 통째로 빠진다. */
  brokenEdges: { index: number; edge: PathEdge; missing: string[] }[]
  /** 어떤 간선에도 안 쓰인 지점(좌표만 받고 연결을 못 받은 것). */
  isolatedWaypoints: AuditPoint[]
  /** 출입구가 하나도 망에 안 이어진 건물(건물 대표 좌표로도 안 이어짐). 길찾기는 직선 추정으로 대체된다. */
  unconnectedBuildings: AuditPoint[]
  /** 건물에 등록됐지만 어떤 간선에도 안 쓰인 출입구. */
  unconnectedEntrances: AuditPoint[]
  /** 망이 여러 덩어리로 끊겨 있으면 가장 큰 덩어리 말고 나머지(서로 오갈 수 없다). */
  detachedGroups: AuditPoint[][]
  /** n1~nMAX 중 비어 있는 번호(지웠거나 아직 안 받은 지점). */
  missingNumbers: string[]
  totals: { waypoints: number; edges: number; buildings: number; entrances: number; groups: number }
}

export function auditPathNetwork(
  waypoints: readonly PathWaypoint[],
  edges: readonly PathEdge[],
  buildings: readonly Building[],
): PathAudit {
  const waypointById = new Map(waypoints.map((w) => [w.id, w]))
  const points = new Map<string, AuditPoint>()
  const adj = new Map<string, Set<string>>()
  const usedRefs = new Set<string>()
  const brokenEdges: PathAudit['brokenEdges'] = []

  const link = (a: string, b: string) => {
    if (!adj.has(a)) adj.set(a, new Set())
    if (!adj.has(b)) adj.set(b, new Set())
    adj.get(a)!.add(b)
    adj.get(b)!.add(a)
  }

  edges.forEach((edge, index) => {
    const resolved = edge.map((ref) => resolveRef(ref, waypointById, buildings))
    const missing = edge.filter((_, i) => resolved[i] === null)
    if (missing.length > 0) {
      brokenEdges.push({ index, edge, missing })
      return
    }
    const [a, b] = resolved as NonNullable<(typeof resolved)[number]>[]
    points.set(a.id, { id: a.id, ...a.point })
    points.set(b.id, { id: b.id, ...b.point })
    usedRefs.add(a.id)
    usedRefs.add(b.id)
    link(a.id, b.id)
  })

  const isolatedWaypoints = waypoints.filter((w) => !usedRefs.has(w.id)).map((w) => ({ id: w.id, lat: w.lat, lng: w.lng }))

  const unconnectedBuildings: AuditPoint[] = []
  const unconnectedEntrances: AuditPoint[] = []
  let entranceCount = 0
  for (const building of buildings) {
    const entrances = building.entrances ?? []
    entranceCount += entrances.length
    const buildingUsed =
      usedRefs.has(building.name) || entrances.some((e) => usedRefs.has(`${building.name}#${e.label}`))
    if (!buildingUsed) unconnectedBuildings.push({ id: building.name, lat: building.lat, lng: building.lng })
    for (const entrance of entrances) {
      const id = `${building.name}#${entrance.label}`
      if (!usedRefs.has(id)) unconnectedEntrances.push({ id, lat: entrance.lat, lng: entrance.lng })
    }
  }

  // 연결 덩어리(BFS). 가장 큰 덩어리를 본망으로 보고 나머지를 끊긴 덩어리로 낸다.
  const seen = new Set<string>()
  const groups: string[][] = []
  for (const start of adj.keys()) {
    if (seen.has(start)) continue
    const group: string[] = []
    const queue = [start]
    seen.add(start)
    while (queue.length > 0) {
      const id = queue.shift()!
      group.push(id)
      for (const next of adj.get(id) ?? []) {
        if (!seen.has(next)) {
          seen.add(next)
          queue.push(next)
        }
      }
    }
    groups.push(group)
  }
  groups.sort((a, b) => b.length - a.length)
  const detachedGroups = groups.slice(1).map((group) => group.map((id) => points.get(id)!).filter(Boolean))

  const numbers = waypoints
    .map((w) => /^n(\d+)$/.exec(w.id))
    .filter((m): m is RegExpExecArray => m !== null)
    .map((m) => Number(m[1]))
  const max = numbers.length > 0 ? Math.max(...numbers) : 0
  const have = new Set(numbers)
  const missingNumbers: string[] = []
  for (let n = 1; n <= max; n += 1) if (!have.has(n)) missingNumbers.push(`n${n}`)

  return {
    brokenEdges,
    isolatedWaypoints,
    unconnectedBuildings,
    unconnectedEntrances,
    detachedGroups,
    missingNumbers,
    totals: {
      waypoints: waypoints.length,
      edges: edges.length,
      buildings: buildings.length,
      entrances: entranceCount,
      groups: groups.length,
    },
  }
}
