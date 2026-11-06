import { edgeKey } from '../pathSurvey'
import { buildingsContaining, distanceToBuilding, type BuildingIndex } from './buildings'
import { commonLevels, validPairs } from './expand'
import { hasLevel, isEdgeKind, isValidFloor, levelKey, type SurveyEdgeV3, type SurveyNodeV3 } from './types'

/** Graph check. Errors block graph export. Warnings and info never do. Korean strings are screen text. */

export type IssueSeverity = 'error' | 'warning' | 'info'

export interface CheckIssue {
  severity: IssueSeverity
  code: string
  message: string
  nodeId?: string
  edgeId?: string
  /** Building codes suggested by the boundary check. */
  candidates?: string[]
}

export interface Connectivity {
  /** Component sizes, largest first. */
  sizes: number[]
  /** Node ids per component, same order as sizes. */
  components: string[][]
  isolated: string[]
  deadEnds: string[]
}

export interface CheckResult {
  errors: CheckIssue[]
  warnings: CheckIssue[]
  infos: CheckIssue[]
  connectivity: Connectivity
}

/** Entrances sit on the outline and the boundary accuracy is unknown, so they get some slack. */
export const ENTRANCE_BOUNDARY_TOLERANCE_M = 15

export function analyzeConnectivity(nodes: readonly SurveyNodeV3[], edges: readonly SurveyEdgeV3[]): Connectivity {
  const adjacent = new Map<string, Set<string>>(nodes.map((n) => [n.id, new Set<string>()]))
  for (const e of edges) {
    if (e.a === e.b || !adjacent.has(e.a) || !adjacent.has(e.b)) continue
    adjacent.get(e.a)!.add(e.b)
    adjacent.get(e.b)!.add(e.a)
  }
  const seen = new Set<string>()
  const components: string[][] = []
  for (const start of adjacent.keys()) {
    if (seen.has(start)) continue
    const stack = [start]
    const component: string[] = []
    seen.add(start)
    while (stack.length) {
      const id = stack.pop()!
      component.push(id)
      for (const next of adjacent.get(id)!) {
        if (seen.has(next)) continue
        seen.add(next)
        stack.push(next)
      }
    }
    components.push(component)
  }
  components.sort((x, y) => y.length - x.length)
  return {
    sizes: components.map((c) => c.length),
    components,
    isolated: [...adjacent].filter(([, set]) => set.size === 0).map(([id]) => id),
    deadEnds: [...adjacent].filter(([, set]) => set.size === 1).map(([id]) => id),
  }
}

const buildingsOf = (node: SurveyNodeV3) => [...new Set((node.levels ?? []).map((l) => l.building))]

export function checkGraph(nodes: readonly SurveyNodeV3[], edges: readonly SurveyEdgeV3[], index?: BuildingIndex): CheckResult {
  const errors: CheckIssue[] = []
  const warnings: CheckIssue[] = []
  const infos: CheckIssue[] = []
  const nodeError = (node: SurveyNodeV3, code: string, message: string) => errors.push({ severity: 'error', code, message: `${node.id}: ${message}`, nodeId: node.id })
  const edgeError = (edge: SurveyEdgeV3, code: string, message: string, nodeId?: string) =>
    errors.push({ severity: 'error', code, message: `${edge.id}: ${message}`, edgeId: edge.id, ...(nodeId ? { nodeId } : {}) })

  const byId = new Map(nodes.map((n) => [n.id, n]))

  for (const node of nodes) {
    const levels = node.levels ?? []
    if (node.scope === 'outdoor' && levels.length > 0) nodeError(node, 'outdoor_has_levels', '외부 점인데 층이 있어요')
    for (const level of levels) {
      if (!level.building) nodeError(node, 'level_no_building', '건물이 비어 있는 층이 있어요')
      if (!isValidFloor(level.floor)) nodeError(node, 'bad_floor', `층 값 ${level.floor} 이 0.5 단위가 아니에요`)
    }

    if (node.type === 'basic' && node.scope === 'indoor' && levels.length === 0) nodeError(node, 'indoor_no_levels', '내부 점인데 층이 없어요')

    if (node.type === 'stairs' || node.type === 'elevator') {
      const name = node.type === 'stairs' ? '계단' : '엘리베이터'
      if (node.scope !== 'indoor') nodeError(node, 'vertical_outdoor', `${name}는 내부 점이어야 해요`)
      if (levels.length < 2) nodeError(node, 'vertical_few_levels', `${name}는 층이 2개 이상이어야 해요`)
      const buildings = buildingsOf(node)
      for (const [x, y] of node.ties ?? []) {
        if (!hasLevel(levels, x) || !hasLevel(levels, y)) nodeError(node, 'tie_bad_level', `층 짝 ${levelKey(x)} = ${levelKey(y)} 이 이 점에 없는 층을 가리켜요`)
        else if (x.building === y.building) nodeError(node, 'tie_same_building', `층 짝 ${levelKey(x)} = ${levelKey(y)} 은 같은 건물이에요`)
      }
      if (buildings.length >= 2) {
        const ties = (node.ties ?? []).filter(([x, y]) => hasLevel(levels, x) && hasLevel(levels, y))
        if (ties.length === 0) nodeError(node, 'ties_missing', `건물이 ${buildings.length}개인데 같은 높이 층 짝이 없어요`)
        else {
          const reached = new Set([buildings[0]])
          for (let changed = true; changed; ) {
            changed = false
            for (const [x, y] of ties) {
              if (reached.has(x.building) !== reached.has(y.building)) {
                reached.add(x.building)
                reached.add(y.building)
                changed = true
              }
            }
          }
          if (reached.size < buildings.length) nodeError(node, 'ties_incomplete', '층 짝으로 이어지지 않은 건물이 있어요')
        }
      }
    } else if (node.ties?.length) {
      warnings.push({ severity: 'warning', code: 'ties_ignored', message: `${node.id}: 계단이나 엘리베이터가 아니라 층 짝을 쓰지 않아요`, nodeId: node.id })
    }

    if (node.type === 'entrance') {
      if (node.scope !== 'indoor') nodeError(node, 'entrance_outdoor', '출입구는 내부 점이어야 해요')
      if (levels.length !== 1) nodeError(node, 'entrance_levels', `출입구는 건물과 층이 정확히 1개여야 해요(지금 ${levels.length}개)`)
      if (!node.entranceLabel) nodeError(node, 'entrance_no_label', '출입구 라벨이 없어요')
    }
  }

  const seenEdges = new Map<string, string>()
  for (const edge of edges) {
    if (!isEdgeKind(edge.kind)) edgeError(edge, 'edge_kind', `모르는 간선 종류 ${String(edge.kind)}`)
    const a = byId.get(edge.a)
    const b = byId.get(edge.b)
    if (!a || !b) {
      edgeError(edge, 'edge_missing_node', `없는 점을 가리켜요(${!a ? edge.a : edge.b})`, a?.id ?? b?.id)
      continue
    }
    if (a.id === b.id) {
      edgeError(edge, 'edge_self', '자기 자신으로 이어져요', a.id)
      continue
    }
    const key = edgeKey(a.id, b.id)
    const first = seenEdges.get(key)
    if (first) {
      edgeError(edge, 'edge_duplicate', `${first} 와 같은 두 점을 이어요(${a.id}, ${b.id})`, a.id)
      continue
    }
    seenEdges.set(key, edge.id)

    if ((a.scope === 'indoor') !== (b.scope === 'indoor')) {
      const indoor = a.scope === 'indoor' ? a : b
      if (indoor.type !== 'entrance') edgeError(edge, 'edge_outdoor_indoor', `외부 점과 내부 점은 출입구로만 이어요(${a.id}, ${b.id})`, indoor.id)
      continue
    }
    if (a.scope !== 'indoor') continue

    const levelsA = a.levels ?? []
    const levelsB = b.levels ?? []
    // A node with no levels already has its own error.
    if (levelsA.length === 0 || levelsB.length === 0) continue
    const common = commonLevels(a, b)
    const bothSingle = levelsA.length === 1 && levelsB.length === 1
    const usable = validPairs(edge, a, b)
    for (const [x, y] of edge.pairs ?? []) {
      if (!hasLevel(levelsA, x) || !hasLevel(levelsB, y)) edgeError(edge, 'pair_bad_level', `층 짝 ${levelKey(x)} = ${levelKey(y)} 이 양 끝에 없는 층을 가리켜요`, a.id)
    }
    if (common.length === 0 && !bothSingle && usable.length === 0) {
      edgeError(edge, 'edge_needs_pairs', `공통 층이 없어 층 짝이 필요해요(${a.id}, ${b.id})`, a.id)
    }
    if ((common.length > 0 || bothSingle) && edge.pairs?.length) {
      warnings.push({ severity: 'warning', code: 'pairs_ignored', message: `${edge.id}: 층 대응이 이미 정해져 층 짝을 쓰지 않아요`, edgeId: edge.id, nodeId: a.id })
    }
    if (common.length === 0 && bothSingle && levelsA[0].building === levelsB[0].building && edge.kind !== 'stairs') {
      warnings.push({
        severity: 'warning',
        code: 'same_building_direct',
        message: `${edge.id}: 같은 건물의 다른 층을 바로 이었어요. 계단이면 간선을 계단으로 바꿔 주세요(${a.id}, ${b.id})`,
        edgeId: edge.id,
        nodeId: a.id,
      })
    }
  }

  // Duplicate entrance labels in one building.
  const labels = new Map<string, SurveyNodeV3[]>()
  for (const node of nodes) {
    if (node.type !== 'entrance' || !node.entranceLabel) continue
    const key = `${node.levels?.[0]?.building ?? ''}|${node.entranceLabel}`
    labels.set(key, [...(labels.get(key) ?? []), node])
  }
  for (const group of labels.values()) {
    if (group.length < 2) continue
    for (const node of group) {
      warnings.push({
        severity: 'warning',
        code: 'duplicate_label',
        message: `${node.id}: 같은 건물에 라벨 ${node.entranceLabel} 이 ${group.length}개 있어요`,
        nodeId: node.id,
      })
    }
  }

  if (index) {
    for (const node of nodes) {
      if (node.scope === 'outdoor') {
        const inside = buildingsContaining(index, node.lat, node.lng)
        if (inside.length) {
          infos.push({
            severity: 'info',
            code: 'outdoor_in_boundary',
            message: `${node.id}: 외부 점인데 ${inside.map((b) => b.name).join(', ')} 경계 안이에요`,
            nodeId: node.id,
            candidates: inside.map((b) => b.code),
          })
        }
        continue
      }
      const codes = buildingsOf(node)
      for (const code of codes) {
        if (!index.byCode.has(code)) infos.push({ severity: 'info', code: 'unknown_building', message: `${node.id}: 서버 목록에 없는 건물 ${code}`, nodeId: node.id })
      }
      const distances = codes.map((code) => (index.byCode.has(code) ? distanceToBuilding(index.byCode.get(code)!, node.lat, node.lng) : null))
      const known = distances.filter((d): d is number => d !== null)
      const tolerance = node.type === 'entrance' ? ENTRANCE_BOUNDARY_TOLERANCE_M : 0
      if (known.length > 0 && Math.min(...known) > tolerance) {
        warnings.push({
          severity: 'warning',
          code: 'indoor_out_of_boundary',
          message: `${node.id}: 내부 점인데 건물 경계에서 ${Math.round(Math.min(...known))}m 밖이에요`,
          nodeId: node.id,
        })
      }
      if (node.type === 'entrance' && node.entranceLabel && !index.serverLabels.has(node.entranceLabel)) {
        infos.push({ severity: 'info', code: 'label_not_on_server', message: `${node.id}: 서버에 없는 라벨 ${node.entranceLabel}`, nodeId: node.id })
      }
    }
  }

  const connectivity = analyzeConnectivity(nodes, edges)
  if (nodes.length > 0) {
    const preview = connectivity.sizes.slice(0, 8).join(', ')
    infos.push({
      severity: 'info',
      code: 'components',
      message: `연결 덩어리 ${connectivity.sizes.length}개, 크기 ${preview}${connectivity.sizes.length > 8 ? ' ...' : ''}`,
    })
  }
  for (const id of connectivity.isolated) infos.push({ severity: 'info', code: 'isolated', message: `${id}: 간선이 하나도 없어요`, nodeId: id })
  for (const id of connectivity.deadEnds) infos.push({ severity: 'info', code: 'dead_end', message: `${id}: 막다른 점이에요`, nodeId: id })

  return { errors, warnings, infos, connectivity }
}
