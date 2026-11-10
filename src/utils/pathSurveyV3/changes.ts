import { sameLevel, type LevelPair, type LevelRef, type SurveyEdgeV3, type SurveyNodeV3 } from './types'
import type { StoreV3 } from './store'

/**
 * What changed between a saved survey (the base) and the current one, point by point and edge by edge.
 * Compares field values only, so a base read back from JSON (other objects, other key order) gives the same result.
 * Nothing here is stored: the base is an existing save point.
 */

export type ChangeKind = 'added' | 'changed' | 'removed'

/** Point aspects: move (lat/lng), scope (outdoor/indoor), type, levels, ties, entrance label, memo. */
export type NodeAspect = 'move' | 'scope' | 'type' | 'levels' | 'ties' | 'entranceLabel' | 'memo'
/** Edge aspects: ends (a/b, either order), kind, pairs, memo. */
export type EdgeAspect = 'ends' | 'kind' | 'pairs' | 'memo'

export interface NodeChange {
  id: string
  kind: ChangeKind
  /** Empty for added and removed. */
  aspects: NodeAspect[]
}

export interface EdgeChange {
  id: string
  kind: ChangeKind
  aspects: EdgeAspect[]
}

export interface ChangeCounts {
  added: number
  changed: number
  removed: number
}

export interface StoreDiff {
  nodes: NodeChange[]
  edges: EdgeChange[]
  /** Points and edges together. */
  total: ChangeCounts
}

type Content = Pick<StoreV3, 'nodes' | 'edges'>

const text = (value: string | undefined) => value ?? ''

/** Same floors in any order, duplicates ignored. */
const sameLevels = (x: readonly LevelRef[] = [], y: readonly LevelRef[] = []) =>
  x.every((l) => y.some((m) => sameLevel(l, m))) && y.every((l) => x.some((m) => sameLevel(l, m)))

const pairKey = (pair: LevelPair) =>
  pair
    .map((l) => `${l.building}@${l.floor}`)
    .sort()
    .join('|')

/** Same pairs in any order, each pair in either direction. Missing and empty are the same. */
const samePairs = (x: readonly LevelPair[] = [], y: readonly LevelPair[] = []) => {
  const a = new Set(x.map(pairKey))
  const b = new Set(y.map(pairKey))
  return a.size === b.size && [...a].every((k) => b.has(k))
}

export function nodeAspects(base: SurveyNodeV3, current: SurveyNodeV3): NodeAspect[] {
  const aspects: NodeAspect[] = []
  if (base.lat !== current.lat || base.lng !== current.lng) aspects.push('move')
  if (base.scope !== current.scope) aspects.push('scope')
  if (base.type !== current.type) aspects.push('type')
  if (!sameLevels(base.levels, current.levels)) aspects.push('levels')
  if (!samePairs(base.ties, current.ties)) aspects.push('ties')
  if (text(base.entranceLabel) !== text(current.entranceLabel)) aspects.push('entranceLabel')
  if (text(base.memo) !== text(current.memo)) aspects.push('memo')
  return aspects
}

const endsKey = (edge: SurveyEdgeV3) => [edge.a, edge.b].sort().join('|')

export function edgeAspects(base: SurveyEdgeV3, current: SurveyEdgeV3): EdgeAspect[] {
  const aspects: EdgeAspect[] = []
  if (endsKey(base) !== endsKey(current)) aspects.push('ends')
  if ((base.kind || 'normal') !== (current.kind || 'normal')) aspects.push('kind')
  if (!samePairs(base.pairs, current.pairs)) aspects.push('pairs')
  if (text(base.memo) !== text(current.memo)) aspects.push('memo')
  return aspects
}

function diffList<T extends { id: string }, A>(base: readonly T[], current: readonly T[], aspectsOf: (b: T, c: T) => A[]) {
  const before = new Map(base.map((item) => [item.id, item]))
  const now = new Set(current.map((item) => item.id))
  const list: { id: string; kind: ChangeKind; aspects: A[] }[] = []
  for (const item of current) {
    const old = before.get(item.id)
    if (!old) list.push({ id: item.id, kind: 'added', aspects: [] })
    else if (old !== item) {
      const aspects = aspectsOf(old, item)
      if (aspects.length) list.push({ id: item.id, kind: 'changed', aspects })
    }
  }
  for (const item of base) if (!now.has(item.id)) list.push({ id: item.id, kind: 'removed', aspects: [] })
  return list
}

export function diffStores(base: Content, current: Content): StoreDiff {
  const nodes = diffList(base.nodes, current.nodes, nodeAspects)
  const edges = diffList(base.edges, current.edges, edgeAspects)
  const total: ChangeCounts = { added: 0, changed: 0, removed: 0 }
  for (const change of [...nodes, ...edges]) total[change.kind] += 1
  return { nodes, edges, total }
}

export const countOf = (changes: readonly { kind: ChangeKind }[], kind: ChangeKind) => changes.filter((c) => c.kind === kind).length

/** Map marks: added or changed, by id. Removed items are not on the map. */
export interface ChangeMarks {
  nodes: ReadonlyMap<string, 'added' | 'changed'>
  edges: ReadonlyMap<string, 'added' | 'changed'>
}

export function changeMarks(diff: StoreDiff): ChangeMarks {
  const marks = (list: readonly { id: string; kind: ChangeKind }[]) =>
    new Map(list.flatMap((c): [string, 'added' | 'changed'][] => (c.kind === 'removed' ? [] : [[c.id, c.kind]])))
  return { nodes: marks(diff.nodes), edges: marks(diff.edges) }
}
