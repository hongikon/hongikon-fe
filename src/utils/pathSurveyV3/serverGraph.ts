import { expandGraph } from './expand'

/**
 * Survey backup (or graph export) to the server route graph JSON (hongikon-be walkroute SurveyGraph shape).
 * Shared by scripts/path/import-survey-v3.mjs (writes a file) and the Server tab upload (sends it to the server).
 * - A file with `graph` (graph export) is used as is; a backup is expanded with the same expandGraph the tool uses.
 * - Only vertices used by an edge are kept (unconnected points cannot be routed).
 * - Indoor vertex ids are `n12@hongik_k:-1` (point@building:floor). Vertical and tie edge times are set by the server.
 */

/** [id, lat, lng, building code (null outdoors), floor (null outdoors), type (0 basic, 1 entrance, 2 elevator, 3 stairs), entrance label]. */
export type ServerVertex = [string, number, number, string | null, number | null, number, string | null]
/** [vertex a, vertex b, kind, meters (none for vertical edges)]. */
export type ServerEdge = [string, string, string] | [string, string, string, number]

export interface ServerGraph {
  exportedAt: string
  vertices: ServerVertex[]
  edges: ServerEdge[]
  nodeMemos: Record<string, string>
  edgeMemos: Record<string, string>
}

export interface ServerGraphResult {
  graph: ServerGraph
  /** Readable lines for what could not be expanded (edges, points, levels, ties). */
  skipped: string[]
  entranceCount: number
  buildingCount: number
}

const TYPE_CODE: Record<string, number> = { basic: 0, entrance: 1, elevator: 2, stairs: 3 }
const round7 = (n: number) => Math.round(n * 1e7) / 1e7

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function buildServerGraph(data: any): ServerGraphResult {
  if (!data || data.format !== 'hongikon.pathSurvey' || data.version !== 3 || !Array.isArray(data.nodes) || !Array.isArray(data.edges)) {
    throw new Error('경로망 조사 v3(format hongikon.pathSurvey, version 3) 자료가 아니다')
  }
  let graph = data.graph
  const skipped: string[] = []
  if (!graph) {
    const result = expandGraph(data.nodes, data.edges)
    graph = result.graph
    for (const s of result.skipped) skipped.push(`간선 제외 ${s.edgeId}: ${s.reason}`)
    for (const s of result.skippedNodes) skipped.push(`점 제외 ${s.nodeId}: ${s.reason}`)
    for (const s of result.skippedLevels) skipped.push(`층 제외 ${s.nodeId} ${s.building}:${s.floor}: ${s.reason}`)
    for (const s of result.skippedTies) skipped.push(`tie 제외 ${s.nodeId}: ${s.reason}`)
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const nodeById = new Map<string, any>(data.nodes.map((n: any) => [n.id, n]))
  const used = new Set<string>()
  for (const e of graph.edges) {
    used.add(e.a)
    used.add(e.b)
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const usedVertices = graph.vertices.filter((v: any) => used.has(v.id))
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const vertices: ServerVertex[] = usedVertices.map((v: any) => {
    const label = v.type === 'entrance' ? nodeById.get(v.node)?.entranceLabel ?? null : null
    return [v.id, round7(v.lat), round7(v.lng), v.building ?? null, v.floor ?? null, TYPE_CODE[v.type] ?? 0, label]
  })
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const edges: ServerEdge[] = graph.edges.map((e: any) => (e.meters === undefined ? [e.a, e.b, e.kind] : [e.a, e.b, e.kind, e.meters]))

  // Survey memos: point memos by original point id, edge memos by 'a|b' (smaller id first). They become route card notes.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const usedNodes = new Set(usedVertices.map((v: any) => v.node).filter(Boolean))
  const nodeMemos = Object.fromEntries(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    data.nodes.filter((n: any) => usedNodes.has(n.id) && typeof n.memo === 'string' && n.memo.trim()).map((n: any) => [n.id, n.memo.trim()]),
  )
  const edgeMemos = Object.fromEntries(
    data.edges
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .filter((e: any) => usedNodes.has(e.a) && usedNodes.has(e.b) && typeof e.memo === 'string' && e.memo.trim())
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .map((e: any) => [[e.a, e.b].sort().join('|'), e.memo.trim()]),
  )
  return {
    graph: { exportedAt: new Date(data.exportedAt).toISOString(), vertices, edges, nodeMemos, edgeMemos },
    skipped,
    entranceCount: vertices.filter((v) => v[5] === 1).length,
    buildingCount: new Set(vertices.filter((v) => v[3]).map((v) => v[3])).size,
  }
}
