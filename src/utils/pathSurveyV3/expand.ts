import { edgeKey } from '../pathSurvey'
import { haversineMeters, roundMeters } from './geo'
import { hasLevel, isEdgeKind, isValidFloor, sameLevel, vertexId, type GraphEdge, type GraphVertex, type LevelRef, type SurveyEdgeV3, type SurveyGraph, type SurveyNodeV3 } from './types'

/**
 * Expands the survey into the routing graph. Never throws on bad input: anything it cannot expand stays out
 * of the graph and is listed with a reason, and the check reports the cause. With zero check errors all the
 * lists are empty, and the graph may be exported in any state.
 */

export interface SkippedEdge {
  edgeId: string
  reason: 'missing_node' | 'self' | 'duplicate' | 'bad_kind' | 'needs_entrance' | 'no_levels' | 'needs_pairs'
}

/** An indoor point that gives no graph point at all. */
export interface SkippedNode {
  nodeId: string
  reason: 'no_levels' | 'no_usable_levels'
}

/** One level of a point that cannot be a graph point. The other levels of that point still can. */
export interface SkippedLevel {
  nodeId: string
  building: string
  floor: number
  reason: 'bad_floor' | 'no_building'
}

export interface SkippedTie {
  nodeId: string
  a: LevelRef
  b: LevelRef
  reason: 'missing_level' | 'same_building'
}

export interface ExpandResult {
  graph: SurveyGraph
  skipped: SkippedEdge[]
  skippedNodes: SkippedNode[]
  skippedLevels: SkippedLevel[]
  skippedTies: SkippedTie[]
}

const distinctLevels = (node: SurveyNodeV3): LevelRef[] => {
  const levels = node.levels ?? []
  return levels.filter((l, i) => levels.findIndex((o) => sameLevel(o, l)) === i)
}

export const commonLevels = (a: SurveyNodeV3, b: SurveyNodeV3): LevelRef[] => distinctLevels(a).filter((l) => hasLevel(b.levels, l))

/** Pairs that really point at a level of each end. */
export const validPairs = (edge: SurveyEdgeV3, a: SurveyNodeV3, b: SurveyNodeV3) =>
  (edge.pairs ?? []).filter(([x, y]) => hasLevel(a.levels, x) && hasLevel(b.levels, y))

/** Levels that can become graph points. */
const usableLevels = (node: SurveyNodeV3): LevelRef[] => distinctLevels(node).filter((l) => !!l.building && isValidFloor(l.floor))

export function expandGraph(nodes: readonly SurveyNodeV3[], edges: readonly SurveyEdgeV3[]): ExpandResult {
  const byId = new Map(nodes.map((n) => [n.id, n]))
  const vertices: GraphVertex[] = []
  const known = new Set<string>()
  const out: GraphEdge[] = []
  const seenEdges = new Set<string>()
  const skipped: SkippedEdge[] = []
  const skippedNodes: SkippedNode[] = []
  const skippedLevels: SkippedLevel[] = []
  const skippedTies: SkippedTie[] = []

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
    const usable = usableLevels(node)
    for (const level of distinctLevels(node)) {
      if (usable.includes(level)) continue
      skippedLevels.push({ nodeId: node.id, building: level.building, floor: level.floor, reason: level.building ? 'bad_floor' : 'no_building' })
    }
    if (usable.length === 0) skippedNodes.push({ nodeId: node.id, reason: distinctLevels(node).length ? 'no_usable_levels' : 'no_levels' })
    for (const level of usable) {
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
    if (!isEdgeKind(edge.kind)) {
      skipped.push({ edgeId: edge.id, reason: 'bad_kind' })
      continue
    }
    const meters = roundMeters(haversineMeters(a.lat, a.lng, b.lat, b.lng))
    const link = (x: string, y: string) => pushEdge({ a: x, b: y, kind: edge.kind, meters })

    if (a.scope !== 'indoor' && b.scope !== 'indoor') {
      link(a.id, b.id)
      continue
    }
    if (a.scope !== 'indoor' || b.scope !== 'indoor') {
      const outdoor = a.scope === 'indoor' ? b : a
      const indoor = a.scope === 'indoor' ? a : b
      const levels = usableLevels(indoor)
      if (indoor.type !== 'entrance' || levels.length !== 1) {
        skipped.push({ edgeId: edge.id, reason: 'needs_entrance' })
        continue
      }
      link(outdoor.id, vertexId(indoor.id, levels[0]))
      continue
    }
    const levelsA = usableLevels(a)
    const levelsB = usableLevels(b)
    if (levelsA.length === 0 || levelsB.length === 0) {
      skipped.push({ edgeId: edge.id, reason: 'no_levels' })
      continue
    }
    const common = levelsA.filter((l) => hasLevel(levelsB, l))
    if (common.length > 0) {
      for (const level of common) link(vertexId(a.id, level), vertexId(b.id, level))
      continue
    }
    if (levelsA.length === 1 && levelsB.length === 1) {
      link(vertexId(a.id, levelsA[0]), vertexId(b.id, levelsB[0]))
      continue
    }
    const pairs = validPairs(edge, a, b).filter(([x, y]) => hasLevel(levelsA, x) && hasLevel(levelsB, y))
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
    for (const level of usableLevels(node)) byBuilding.set(level.building, [...(byBuilding.get(level.building) ?? []), level])
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
      const usable = usableLevels(node)
      if (!hasLevel(usable, x) || !hasLevel(usable, y)) {
        skippedTies.push({ nodeId: node.id, a: x, b: y, reason: 'missing_level' })
        continue
      }
      if (x.building === y.building) {
        skippedTies.push({ nodeId: node.id, a: x, b: y, reason: 'same_building' })
        continue
      }
      pushEdge({ a: vertexId(node.id, x), b: vertexId(node.id, y), kind: 'tie', meters: 0 })
    }
  }

  return { graph: { vertices, edges: out }, skipped, skippedNodes, skippedLevels, skippedTies }
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
