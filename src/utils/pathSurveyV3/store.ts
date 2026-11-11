import { edgeKey, round7 } from '../pathSurvey'
import {
  isNodeType,
  sameLevel,
  type EdgeKind,
  type LevelPair,
  type LevelRef,
  type NodeScope,
  type NodeType,
  type SurveyEdgeV3,
  type SurveyNodeV3,
} from './types'

/** Store and pure edits. Every edit returns a new store, or the same object when nothing changed. */

export const STORE_KEY_V3 = 'hongikon.pathSurvey.v3'

export interface StoreV3 {
  version: 3
  nodes: SurveyNodeV3[]
  edges: SurveyEdgeV3[]
  nextNode: number
  nextEdge: number
  updatedAt: number
}

export interface StorageLike {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
  removeItem?(key: string): void
}

export function defaultStorage(): StorageLike | null {
  try {
    return (globalThis as any).localStorage ?? null
  } catch {
    return null
  }
}

export const emptyStoreV3 = (now = Date.now()): StoreV3 => ({ version: 3, nodes: [], edges: [], nextNode: 1, nextEdge: 1, updatedAt: now })

const isObject = (v: unknown): v is Record<string, any> => !!v && typeof v === 'object'

/** Keeps wrong floors (the check reports them) but needs a building string and a number to be a level at all. */
function normalizeLevel(raw: unknown): LevelRef | null {
  if (!isObject(raw) || typeof raw.building !== 'string' || typeof raw.floor !== 'number') return null
  return { building: raw.building, floor: raw.floor }
}

function normalizePairs(raw: unknown): LevelPair[] | undefined {
  if (!Array.isArray(raw)) return undefined
  const pairs = raw.flatMap((p): LevelPair[] => {
    if (!Array.isArray(p) || p.length !== 2) return []
    const x = normalizeLevel(p[0])
    const y = normalizeLevel(p[1])
    return x && y ? [[x, y]] : []
  })
  return pairs.length ? pairs : undefined
}

function normalizeNode(raw: unknown): SurveyNodeV3 | null {
  if (!isObject(raw) || typeof raw.id !== 'string' || !raw.id) return null
  if (typeof raw.lat !== 'number' || !Number.isFinite(raw.lat) || typeof raw.lng !== 'number' || !Number.isFinite(raw.lng)) return null
  const node: SurveyNodeV3 = {
    id: raw.id,
    lat: raw.lat,
    lng: raw.lng,
    scope: raw.scope === 'indoor' ? 'indoor' : 'outdoor',
    type: isNodeType(raw.type) ? raw.type : 'basic',
  }
  if (Array.isArray(raw.levels)) node.levels = raw.levels.map(normalizeLevel).filter((l): l is LevelRef => !!l)
  const ties = normalizePairs(raw.ties)
  if (ties) node.ties = ties
  if (typeof raw.entranceLabel === 'string' && raw.entranceLabel) node.entranceLabel = raw.entranceLabel
  if (typeof raw.memo === 'string' && raw.memo.trim()) node.memo = raw.memo
  if (typeof raw.legacyId === 'string' && raw.legacyId) node.legacyId = raw.legacyId
  return node
}

/** Bad references, self edges, duplicates and unknown kinds stay in so that the check can report them. */
function normalizeEdge(raw: unknown): SurveyEdgeV3 | null {
  if (!isObject(raw) || typeof raw.id !== 'string' || !raw.id || typeof raw.a !== 'string' || typeof raw.b !== 'string') return null
  const edge: SurveyEdgeV3 = { id: raw.id, a: raw.a, b: raw.b, kind: typeof raw.kind === 'string' && raw.kind ? (raw.kind as EdgeKind) : 'normal' }
  if (typeof raw.memo === 'string' && raw.memo.trim()) edge.memo = raw.memo
  const pairs = normalizePairs(raw.pairs)
  if (pairs) edge.pairs = pairs
  return edge
}

const seqOf = (id: string, prefix: string) => {
  const n = id.startsWith(prefix) ? Number(id.slice(prefix.length)) : NaN
  return Number.isInteger(n) ? n : 0
}

export function normalizeStoreV3(raw: unknown, now = Date.now()): StoreV3 {
  const source = isObject(raw) ? raw : {}
  const nodes: SurveyNodeV3[] = []
  const nodeIds = new Set<string>()
  for (const item of Array.isArray(source.nodes) ? source.nodes : []) {
    const node = normalizeNode(item)
    if (!node || nodeIds.has(node.id)) continue
    nodeIds.add(node.id)
    nodes.push(node)
  }
  const edges: SurveyEdgeV3[] = []
  const edgeIds = new Set<string>()
  for (const item of Array.isArray(source.edges) ? source.edges : []) {
    const edge = normalizeEdge(item)
    if (!edge || edgeIds.has(edge.id)) continue
    edgeIds.add(edge.id)
    edges.push(edge)
  }
  const stored = (v: unknown) => (typeof v === 'number' && Number.isInteger(v) && v > 0 ? v : 1)
  return {
    version: 3,
    nodes,
    edges,
    nextNode: Math.max(stored(source.nextNode), ...nodes.map((n) => seqOf(n.id, 'n') + 1), 1),
    nextEdge: Math.max(stored(source.nextEdge), ...edges.map((e) => seqOf(e.id, 'e') + 1), 1),
    updatedAt: typeof source.updatedAt === 'number' ? source.updatedAt : now,
  }
}

export interface LoadResultV3 {
  store: StoreV3
  /** The key has a value that could not be read. The screen must stop saving so the value is not overwritten. */
  corrupt: boolean
}

export function loadStoreV3(storage: StorageLike | null = defaultStorage(), now = Date.now()): LoadResultV3 {
  let raw: string | null = null
  try {
    raw = storage?.getItem(STORE_KEY_V3) ?? null
  } catch {
    raw = null
  }
  if (raw === null) return { store: emptyStoreV3(now), corrupt: false }
  try {
    const parsed = JSON.parse(raw)
    if (!isObject(parsed) || !Array.isArray(parsed.nodes) || !Array.isArray(parsed.edges)) throw new Error('shape')
    return { store: normalizeStoreV3(parsed, now), corrupt: false }
  } catch {
    return { store: emptyStoreV3(now), corrupt: true }
  }
}

export function saveStoreV3(store: StoreV3, storage: StorageLike | null = defaultStorage()): boolean {
  try {
    if (!storage) return false
    storage.setItem(STORE_KEY_V3, JSON.stringify(store))
    return true
  } catch {
    return false
  }
}

const touch = (store: StoreV3, patch: Partial<StoreV3>, now: number): StoreV3 => ({ ...store, ...patch, updatedAt: Math.max(now, store.updatedAt + 1) })

export const findNode = (store: StoreV3, id: string | null | undefined) => (id ? store.nodes.find((n) => n.id === id) : undefined)
export const findEdge = (store: StoreV3, id: string | null | undefined) => (id ? store.edges.find((e) => e.id === id) : undefined)
export const hasEdgeBetween = (store: StoreV3, a: string, b: string) => {
  const key = edgeKey(a, b)
  return store.edges.some((e) => edgeKey(e.a, e.b) === key)
}

/** What a new point inherits from the work context. */
export interface NodeContext {
  scope: NodeScope
  type?: NodeType
  levels?: LevelRef[]
}

export const OUTDOOR_CONTEXT: NodeContext = { scope: 'outdoor' }

export function addEdge(store: StoreV3, a: string, b: string, kind: EdgeKind = 'normal', now = Date.now()): StoreV3 {
  if (a === b || hasEdgeBetween(store, a, b) || !findNode(store, a) || !findNode(store, b)) return store
  return touch(store, { edges: [...store.edges, { id: `e${store.nextEdge}`, a, b, kind }], nextEdge: store.nextEdge + 1 }, now)
}

export function addNode(
  store: StoreV3,
  lat: number,
  lng: number,
  context: NodeContext = OUTDOOR_CONTEXT,
  linkFrom?: string | null,
  now = Date.now(),
): { store: StoreV3; id: string } {
  const id = `n${store.nextNode}`
  const indoor = context.scope === 'indoor'
  const type = indoor ? (context.type ?? 'basic') : 'basic'
  const node: SurveyNodeV3 = { id, lat: round7(lat), lng: round7(lng), scope: context.scope, type }
  // An entrance has exactly one floor.
  const levels = type === 'entrance' ? context.levels?.slice(0, 1) : context.levels
  if (indoor && levels?.length) node.levels = levels.map((l) => ({ ...l }))
  let next = touch(store, { nodes: [...store.nodes, node], nextNode: store.nextNode + 1 }, now)
  if (linkFrom) next = addEdge(next, linkFrom, id, 'normal', now)
  return { store: next, id }
}

const mapNode = (store: StoreV3, id: string, fn: (n: SurveyNodeV3) => SurveyNodeV3, now: number): StoreV3 => {
  const old = findNode(store, id)
  if (!old) return store
  const edited = fn(old)
  return edited === old ? store : touch(store, { nodes: store.nodes.map((n) => (n.id === id ? edited : n)) }, now)
}

const mapEdge = (store: StoreV3, id: string, fn: (e: SurveyEdgeV3) => SurveyEdgeV3, now: number): StoreV3 => {
  const old = findEdge(store, id)
  if (!old) return store
  const edited = fn(old)
  return edited === old ? store : touch(store, { edges: store.edges.map((e) => (e.id === id ? edited : e)) }, now)
}

export const moveNode = (store: StoreV3, id: string, lat: number, lng: number, now = Date.now()): StoreV3 =>
  mapNode(store, id, (n) => ({ ...n, lat: round7(lat), lng: round7(lng) }), now)

export function removeNode(store: StoreV3, id: string, now = Date.now()): StoreV3 {
  if (!findNode(store, id)) return store
  return touch(store, { nodes: store.nodes.filter((n) => n.id !== id), edges: store.edges.filter((e) => e.a !== id && e.b !== id) }, now)
}

export function removeEdge(store: StoreV3, id: string, now = Date.now()): StoreV3 {
  if (!findEdge(store, id)) return store
  return touch(store, { edges: store.edges.filter((e) => e.id !== id) }, now)
}

export function removeEdgeBetween(store: StoreV3, a: string, b: string, now = Date.now()): StoreV3 {
  const key = edgeKey(a, b)
  const edges = store.edges.filter((e) => edgeKey(e.a, e.b) !== key)
  return edges.length === store.edges.length ? store : touch(store, { edges }, now)
}

/**
 * Moves a node onto an edge and splits the edge in two. Both halves keep the memo and kind.
 * pairs are dropped (pairsDropped tells the screen) because they described the old end points.
 */
export function moveNodeOntoEdge(
  store: StoreV3,
  id: string,
  edgeId: string,
  lat: number,
  lng: number,
  now = Date.now(),
): { store: StoreV3; split: boolean; pairsDropped: boolean } {
  const edge = findEdge(store, edgeId)
  const unchanged = { store, split: false, pairsDropped: false }
  if (!edge || edge.a === id || edge.b === id || !findNode(store, id) || !Number.isFinite(lat) || !Number.isFinite(lng)) return unchanged
  const a = findNode(store, edge.a)
  const b = findNode(store, edge.b)
  if (!a || !b) return unchanged
  const point = { lat: round7(lat), lng: round7(lng) }
  if ([a, b].some((n) => n.lat === point.lat && n.lng === point.lng)) return unchanged

  const pieces = [edgeKey(edge.a, id), edgeKey(id, edge.b)]
  let next = moveNode(store, id, point.lat, point.lng, now)
  next = removeEdge(next, edgeId, now)
  next = addEdge(addEdge(next, edge.a, id, edge.kind, now), id, edge.b, edge.kind, now)
  next = {
    ...next,
    edges: next.edges.map((e) => {
      if (!pieces.includes(edgeKey(e.a, e.b))) return e
      const memo = [...new Set([e.memo, edge.memo].filter(Boolean))].join('\n')
      return { ...e, kind: edge.kind, ...(memo ? { memo } : {}) }
    }),
  }
  return { store: next, split: true, pairsDropped: !!edge.pairs?.length }
}

/** Same floors in any order. Duplicates do not count. */
const sameLevels = (x: readonly LevelRef[], y: readonly LevelRef[]) => x.every((l) => y.some((m) => sameLevel(l, m))) && y.every((l) => x.some((m) => sameLevel(l, m)))

/**
 * Where a point placed on the edge between a and b would be: both outdoor, or both indoor with exactly the same
 * buildings and floors (a stairs or entrance point next to a basic one is fine). The new point is always basic.
 * null when the two ends disagree, or are indoor without any floor (the new point would be a check error).
 */
export function splitContext(a: SurveyNodeV3, b: SurveyNodeV3): NodeContext | null {
  if (a.scope !== b.scope) return null
  if (a.scope === 'outdoor') return OUTDOOR_CONTEXT
  const levels = a.levels ?? []
  if (!levels.length || !sameLevels(levels, b.levels ?? [])) return null
  const unique = levels.filter((l, i) => levels.findIndex((m) => sameLevel(l, m)) === i)
  return { scope: 'indoor', type: 'basic', levels: unique.map((l) => ({ ...l })) }
}

export type SplitRefusal = 'missing' | 'pairs' | 'mixed' | 'end'

/**
 * Adds a point on an edge at lat/lng and splits the edge in two, as one edit (moveNodeOntoEdge keeps kind and memo
 * on both halves). The point takes its place from the two ends (splitContext). Edges with floor pairs are refused,
 * because the pairs would be lost. Any refusal returns the same store, so no number is used up.
 */
export function splitEdgeAt(
  store: StoreV3,
  edgeId: string,
  lat: number,
  lng: number,
  now = Date.now(),
): { store: StoreV3; id: string | null; refused: SplitRefusal | null } {
  const edge = findEdge(store, edgeId)
  const a = findNode(store, edge?.a)
  const b = findNode(store, edge?.b)
  if (!edge || !a || !b || a === b || !Number.isFinite(lat) || !Number.isFinite(lng)) return { store, id: null, refused: 'missing' }
  if (edge.pairs?.length) return { store, id: null, refused: 'pairs' }
  const context = splitContext(a, b)
  if (!context) return { store, id: null, refused: 'mixed' }
  const placed = addNode(store, lat, lng, context, null, now)
  const result = moveNodeOntoEdge(placed.store, placed.id, edgeId, lat, lng, now)
  return result.split ? { store: result.store, id: placed.id, refused: null } : { store, id: null, refused: 'end' }
}

const withMemo = <T extends { memo?: string }>(item: T, memo: string): T => {
  if ((item.memo ?? '') === memo) return item
  const next = { ...item }
  if (memo.trim()) next.memo = memo
  else delete next.memo
  return next
}

export const setNodeMemo = (store: StoreV3, id: string, memo: string, now = Date.now()) => mapNode(store, id, (n) => withMemo(n, memo), now)
export const setEdgeMemo = (store: StoreV3, id: string, memo: string, now = Date.now()) => mapEdge(store, id, (e) => withMemo(e, memo), now)
export const setEdgeKind = (store: StoreV3, id: string, kind: EdgeKind, now = Date.now()) =>
  mapEdge(store, id, (e) => (e.kind === kind ? e : { ...e, kind }), now)

export function setEdgePairs(store: StoreV3, id: string, pairs: LevelPair[] | undefined, now = Date.now()): StoreV3 {
  return mapEdge(
    store,
    id,
    (e) => {
      const next = { ...e }
      if (pairs?.length) next.pairs = pairs
      else delete next.pairs
      return next
    },
    now,
  )
}

const toOutdoor = (node: SurveyNodeV3): SurveyNodeV3 => {
  const { levels: _levels, ties: _ties, entranceLabel: _label, ...rest } = node
  return { ...rest, scope: 'outdoor', type: 'basic' }
}

/** Going outdoor clears everything that only makes sense indoors, including the node type. */
export function setNodeScope(store: StoreV3, id: string, scope: NodeScope, context: LevelRef[] = [], now = Date.now()): StoreV3 {
  return mapNode(
    store,
    id,
    (n) => {
      if (n.scope === scope) return n
      if (scope === 'outdoor') return toOutdoor(n)
      return { ...n, scope: 'indoor', ...(context.length ? { levels: context.map((l) => ({ ...l })) } : {}) }
    },
    now,
  )
}

/** Every type except basic is indoor only, so choosing one also makes the node indoor. */
export function setNodeType(store: StoreV3, id: string, type: NodeType, context: LevelRef[] = [], now = Date.now()): StoreV3 {
  return mapNode(
    store,
    id,
    (n) => {
      if (n.type === type) return n
      const next: SurveyNodeV3 = { ...n, type }
      if (type !== 'basic' && n.scope === 'outdoor') {
        next.scope = 'indoor'
        if (context.length) next.levels = context.map((l) => ({ ...l }))
      }
      if (type !== 'entrance') delete next.entranceLabel
      else if (next.levels && next.levels.length > 1) next.levels = next.levels.slice(0, 1)
      if (type !== 'stairs' && type !== 'elevator') delete next.ties
      return next
    },
    now,
  )
}

export function setNodeLevels(store: StoreV3, id: string, levels: LevelRef[], now = Date.now()): StoreV3 {
  return mapNode(
    store,
    id,
    (n) => {
      const unique = levels.filter((l, i) => levels.findIndex((o) => sameLevel(o, l)) === i)
      const next: SurveyNodeV3 = { ...n, levels: unique }
      // A tie that points at a removed floor would only turn into a confusing error later.
      if (next.ties) {
        const ties = next.ties.filter(([x, y]) => unique.some((l) => sameLevel(l, x)) && unique.some((l) => sameLevel(l, y)))
        if (ties.length) next.ties = ties
        else delete next.ties
      }
      return next
    },
    now,
  )
}

export function setNodeTies(store: StoreV3, id: string, ties: LevelPair[], now = Date.now()): StoreV3 {
  return mapNode(
    store,
    id,
    (n) => {
      const next = { ...n }
      if (ties.length) next.ties = ties
      else delete next.ties
      return next
    },
    now,
  )
}

export function setEntranceLabel(store: StoreV3, id: string, label: string | undefined, now = Date.now()): StoreV3 {
  return mapNode(
    store,
    id,
    (n) => {
      const next = { ...n }
      if (label) next.entranceLabel = label
      else delete next.entranceLabel
      return next
    },
    now,
  )
}

export interface BulkChange {
  scope?: NodeScope
  type?: NodeType
  levels?: LevelRef[]
}

/** One undo step for many points. Follows the same rules as the single point edits. */
export function applyBulkToNodes(store: StoreV3, ids: readonly string[], change: BulkChange, now = Date.now()): StoreV3 {
  let next = store
  for (const id of ids) {
    if (change.scope === 'outdoor') {
      next = setNodeScope(next, id, 'outdoor', [], now)
      continue
    }
    if (change.scope === 'indoor') next = setNodeScope(next, id, 'indoor', [], now)
    if (change.type) next = setNodeType(next, id, change.type, [], now)
    if (change.levels) {
      const node = findNode(next, id)
      const levels = node?.type === 'entrance' ? change.levels.slice(0, 1) : change.levels
      next = setNodeScope(next, id, 'indoor', [], now)
      next = setNodeLevels(next, id, levels, now)
    }
  }
  return next
}

/** Bulk assignment used by multi select: all given nodes become indoor with these levels, in one undo step. */
export function assignLevelsToNodes(store: StoreV3, ids: readonly string[], levels: LevelRef[], now = Date.now()): StoreV3 {
  const targets = new Set(ids)
  if (!store.nodes.some((n) => targets.has(n.id))) return store
  const nodes = store.nodes.map((n): SurveyNodeV3 => (targets.has(n.id) ? { ...n, scope: 'indoor', levels: levels.map((l) => ({ ...l })) } : n))
  return touch(store, { nodes }, now)
}

/** Bulk return to outdoor. Types other than basic are reset, same as setNodeScope. */
export function assignOutdoorToNodes(store: StoreV3, ids: readonly string[], now = Date.now()): StoreV3 {
  const targets = new Set(ids)
  if (!store.nodes.some((n) => targets.has(n.id))) return store
  return touch(store, { nodes: store.nodes.map((n) => (targets.has(n.id) ? toOutdoor(n) : n)) }, now)
}
