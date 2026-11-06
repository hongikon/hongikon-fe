import { edgeKey } from '../pathSurvey'
import { haversineMeters, roundMeters } from './geo'
import { hasLevel, sameLevel, vertexId, type GraphEdge, type GraphVertex, type LevelRef, type SurveyEdgeV3, type SurveyGraph, type SurveyNodeV3 } from './types'

/**
 * Expands the survey into the routing graph. Never throws on bad input: anything it cannot expand is
 * listed in skipped, and the check reports the cause. Export only happens with zero check errors.
 */

export interface SkippedEdge {
  edgeId: string
  reason: 'missing_node' | 'self' | 'duplicate' | 'needs_entrance' | 'no_levels' | 'needs_pairs'
}

export interface ExpandResult {
  graph: SurveyGraph
  skipped: SkippedEdge[]
}

const distinctLevels = (node: SurveyNodeV3): LevelRef[] => {
  const levels = node.levels ?? []
  return levels.filter((l, i) => levels.findIndex((o) => sameLevel(o, l)) === i)
}

export const commonLevels = (a: SurveyNodeV3, b: SurveyNodeV3): LevelRef[] => distinctLevels(a).filter((l) => hasLevel(b.levels, l))

/** Pairs that really point at a level of each end. */
export const validPairs = (edge: SurveyEdgeV3, a: SurveyNodeV3, b: SurveyNodeV3) =>
  (edge.pairs ?? []).filter(([x, y]) => hasLevel(a.levels, x) && hasLevel(b.levels, y))

export function expandGraph(nodes: readonly SurveyNodeV3[], edges: readonly SurveyEdgeV3[]): ExpandResult {
  const byId = new Map(nodes.map((n) => [n.id, n]))
  const vertices: GraphVertex[] = []
  const known = new Set<string>()
  const out: GraphEdge[] = []
  const seenEdges = new Set<string>()
  const skipped: SkippedEdge[] = []

  const pushEdge = (edge: GraphEdge) => {
    if (edge.a === edge.b || !known.has(edge.a) || !known.has(edge.b)) return
    const key = edgeKey(edge.a, edge.b)
    if (seenEdges.has(key)) return
    seenEdges.add(key)
    out.push(edge)
  }

  for (const node of nodes) {
    if (node.scope !== 'indoor') {
      vertices.push({ id: node.id, node: node.id, lat: node.lat, lng: node.lng, type: node.type })
      known.add(node.id)
      continue
    }
    for (const level of distinctLevels(node)) {
      const id = vertexId(node.id, level)
      vertices.push({ id, node: node.id, building: level.building, floor: level.floor, lat: node.lat, lng: node.lng, type: node.type })
      known.add(id)
    }
  }

  // Rules 1 to 4: survey edges.
  const seenSurvey = new Set<string>()
  for (const edge of edges) {
    const a = byId.get(edge.a)
    const b = byId.get(edge.b)
    if (!a || !b) {
      skipped.push({ edgeId: edge.id, reason: 'missing_node' })
      continue
    }
    if (a.id === b.id) {
      skipped.push({ edgeId: edge.id, reason: 'self' })
      continue
    }
    const key = edgeKey(a.id, b.id)
    if (seenSurvey.has(key)) {
      skipped.push({ edgeId: edge.id, reason: 'duplicate' })
      continue
    }
    seenSurvey.add(key)
    const meters = roundMeters(haversineMeters(a.lat, a.lng, b.lat, b.lng))
    const link = (x: string, y: string) => pushEdge({ a: x, b: y, kind: edge.kind, meters })

    if (a.scope !== 'indoor' && b.scope !== 'indoor') {
      link(a.id, b.id)
      continue
    }
    if (a.scope !== 'indoor' || b.scope !== 'indoor') {
      const outdoor = a.scope === 'indoor' ? b : a
      const indoor = a.scope === 'indoor' ? a : b
      const levels = distinctLevels(indoor)
      if (indoor.type !== 'entrance' || levels.length !== 1) {
        skipped.push({ edgeId: edge.id, reason: 'needs_entrance' })
        continue
      }
      link(outdoor.id, vertexId(indoor.id, levels[0]))
      continue
    }
    const levelsA = distinctLevels(a)
    const levelsB = distinctLevels(b)
    if (levelsA.length === 0 || levelsB.length === 0) {
      skipped.push({ edgeId: edge.id, reason: 'no_levels' })
      continue
    }
    const common = commonLevels(a, b)
    if (common.length > 0) {
      for (const level of common) link(vertexId(a.id, level), vertexId(b.id, level))
      continue
    }
    if (levelsA.length === 1 && levelsB.length === 1) {
      link(vertexId(a.id, levelsA[0]), vertexId(b.id, levelsB[0]))
      continue
    }
    const pairs = validPairs(edge, a, b)
    if (pairs.length === 0) {
      skipped.push({ edgeId: edge.id, reason: 'needs_pairs' })
      continue
    }
    for (const [x, y] of pairs) link(vertexId(a.id, x), vertexId(b.id, y))
  }

  // Rule 5: vertical links and ties. Weights are left to the routing algorithm.
  for (const node of nodes) {
    if (node.scope !== 'indoor' || (node.type !== 'stairs' && node.type !== 'elevator')) continue
    const byBuilding = new Map<string, LevelRef[]>()
    for (const level of distinctLevels(node)) byBuilding.set(level.building, [...(byBuilding.get(level.building) ?? []), level])
    for (const levels of byBuilding.values()) {
      const sorted = [...levels].sort((x, y) => x.floor - y.floor)
      if (node.type === 'stairs') {
        for (let i = 0; i + 1 < sorted.length; i += 1) {
          pushEdge({ a: vertexId(node.id, sorted[i]), b: vertexId(node.id, sorted[i + 1]), kind: 'stairs_vertical' })
        }
      } else {
        for (let i = 0; i < sorted.length; i += 1) {
          for (let j = i + 1; j < sorted.length; j += 1) {
            pushEdge({ a: vertexId(node.id, sorted[i]), b: vertexId(node.id, sorted[j]), kind: 'elevator_vertical' })
          }
        }
      }
    }
    for (const [x, y] of node.ties ?? []) {
      if (!hasLevel(node.levels, x) || !hasLevel(node.levels, y)) continue
      pushEdge({ a: vertexId(node.id, x), b: vertexId(node.id, y), kind: 'tie', meters: 0 })
    }
  }

  return { graph: { vertices, edges: out }, skipped }
}

export interface GraphSummary {
  nodes: number
  edges: number
  vertices: number
  graphEdges: number
  outdoorVertices: number
  byLevel: { building: string; floor: number; count: number }[]
}

/** Numbers for the preview shown before an export. */
export function summarizeGraph(nodes: readonly SurveyNodeV3[], edges: readonly SurveyEdgeV3[], graph: SurveyGraph): GraphSummary {
  const counts = new Map<string, { building: string; floor: number; count: number }>()
  let outdoorVertices = 0
  for (const v of graph.vertices) {
    if (v.building === undefined || v.floor === undefined) {
      outdoorVertices += 1
      continue
    }
    const key = `${v.building}:${v.floor}`
    const entry = counts.get(key)
    if (entry) entry.count += 1
    else counts.set(key, { building: v.building, floor: v.floor, count: 1 })
  }
  return {
    nodes: nodes.length,
    edges: edges.length,
    vertices: graph.vertices.length,
    graphEdges: graph.edges.length,
    outdoorVertices,
    byLevel: [...counts.values()].sort((x, y) => x.building.localeCompare(y.building) || x.floor - y.floor),
  }
}
