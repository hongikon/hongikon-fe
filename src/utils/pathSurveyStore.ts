import type { PathWaypoint } from '../types'
import { edgeKey, parseV1Draft, round7 } from './pathSurvey'

/**
 * 경로망 현장 조사(`/dev/path-survey`)의 모듈 저장소 — 모델, localStorage 저장, v1 초안 변환.
 *
 * 모듈 하나는 한 층위(같은 높이에서 걸어 다니는 길 묶음)다. places 에 적은 건물/층이 서로 달라도 같은 층위로 보고,
 * 층 번호가 맞는지는 따지지 않는다. 기존 경로망(pathNodes.ts)은 보기 전용 오버레이라 모듈 간선이 기존 지점에 붙지 않는다.
 * React Native 를 가져오지 않아 Node 단위 테스트(scripts/path-survey/test-store.mjs)에서 그대로 읽힌다.
 */

export interface SurveyNode {
  /** '모듈id-n순번'. 전체 모듈에서 유일하다(v1 에서 변환한 지점은 원래 id 를 그대로 쓴다). */
  id: string
  lat: number
  lng: number
  memo?: string
  /** v1 초안에서 기존 지점(pathNodes.ts)에 이었던 간선·메모를 보존하려고 복사해 온 지점이면 그 원래 id. */
  ref?: string
}

export interface SurveyEdge {
  id: string
  a: string
  b: string
  memo?: string
}

export interface SurveyPlace {
  /** useMapData 건물에서 골랐으면 서버 건물 id. 직접 입력이면 없다. */
  buildingId?: number
  buildingName: string
  /** 지상 1, 2, ... / 지하 -1, -2, ... (formatFloor 규칙, 0층 없음). */
  floor: number
  label?: string
}

export type ModuleStatus = 'draft' | 'done'

export interface SurveyModule {
  id: string
  name: string
  status: ModuleStatus
  color: string
  nodes: SurveyNode[]
  edges: SurveyEdge[]
  places: SurveyPlace[]
  memo: string
  createdAt: number
  updatedAt: number
}

export interface SurveyStore {
  version: 2
  modules: SurveyModule[]
  activeModuleId: string | null
  customColors: string[]
  updatedAt: number
}

export const STORE_KEY = 'hongikon.pathSurvey.v2'
export const V1_KEY = 'hongikon.pathSurvey.v1'
export const UNSORTED_NAME = '미분류'

/** 기본 12색. 서로 잘 구분되고 흰 지도 위에서 읽히는 진한 색만 골랐다. */
export const PALETTE = [
  '#2563EB',
  '#DC2626',
  '#16A34A',
  '#9333EA',
  '#EA580C',
  '#0891B2',
  '#DB2777',
  '#65A30D',
  '#CA8A04',
  '#4F46E5',
  '#0D9488',
  '#78716C',
] as const

export interface StorageLike {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
}

export function emptyStore(now = Date.now()): SurveyStore {
  return { version: 2, modules: [], activeModuleId: null, customColors: [], updatedAt: now }
}

export const isHexColor = (value: unknown): value is string => typeof value === 'string' && /^#[0-9a-fA-F]{6}$/.test(value)

/** 같은 색을 어둡게(검정과 섞어) — 지도에서 지점 원의 채움색. */
export function darken(hex: string, amount = 0.35): string {
  if (!isHexColor(hex)) return hex
  const n = parseInt(hex.slice(1), 16)
  const ch = (shift: number) => Math.round(((n >> shift) & 0xff) * (1 - amount))
  return `#${[ch(16), ch(8), ch(0)].map((v) => v.toString(16).padStart(2, '0')).join('')}`.toUpperCase()
}

// ── id ──

/** 모듈 id. 기기 두 대에서 따로 만들어도 겹치지 않게 시각 + 난수로 만든다. */
export function newModuleId(now = Date.now(), rand: () => number = Math.random): string {
  const tail = Math.floor(rand() * 36 * 36)
    .toString(36)
    .padStart(2, '0')
  return `m${now.toString(36)}${tail}`
}

function nextSeq(ids: readonly string[], prefix: string): number {
  let max = 0
  for (const id of ids) {
    if (!id.startsWith(prefix)) continue
    const n = Number(id.slice(prefix.length))
    if (Number.isInteger(n)) max = Math.max(max, n)
  }
  return max + 1
}

export const nextNodeId = (module: SurveyModule) => `${module.id}-n${nextSeq(module.nodes.map((n) => n.id), `${module.id}-n`)}`
export const nextEdgeId = (module: SurveyModule) => `${module.id}-e${nextSeq(module.edges.map((e) => e.id), `${module.id}-e`)}`

// ── 정리(불러온 값 검증) ──

const num = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null)
const str = (v: unknown): string => (typeof v === 'string' ? v : '')
const optStr = (v: unknown): string | undefined => (typeof v === 'string' && v.trim() ? v : undefined)

function normalizePlace(raw: any): SurveyPlace | null {
  if (!raw || typeof raw !== 'object') return null
  const floor = num(raw.floor)
  const buildingName = str(raw.buildingName).trim()
  if (!buildingName || floor === null || !Number.isInteger(floor) || floor === 0) return null
  const place: SurveyPlace = { buildingName, floor }
  const buildingId = num(raw.buildingId)
  if (buildingId !== null) place.buildingId = buildingId
  const label = optStr(raw.label)
  if (label) place.label = label
  return place
}

/** 바깥(저장소·가져온 파일·Gist)에서 온 모듈을 모양에 맞게 고친다. 못 쓰는 값이면 null. */
export function normalizeModule(raw: any, fallbackNow = Date.now()): SurveyModule | null {
  if (!raw || typeof raw !== 'object' || typeof raw.id !== 'string' || !raw.id) return null
  const nodes: SurveyNode[] = []
  const nodeIds = new Set<string>()
  for (const n of Array.isArray(raw.nodes) ? raw.nodes : []) {
    const lat = num(n?.lat)
    const lng = num(n?.lng)
    if (typeof n?.id !== 'string' || !n.id || lat === null || lng === null || nodeIds.has(n.id)) continue
    const node: SurveyNode = { id: n.id, lat, lng }
    const memo = optStr(n.memo)
    if (memo) node.memo = memo
    const ref = optStr(n.ref)
    if (ref) node.ref = ref
    nodes.push(node)
    nodeIds.add(n.id)
  }
  const edges: SurveyEdge[] = []
  const keys = new Set<string>()
  const edgeIds = new Set<string>()
  for (const e of Array.isArray(raw.edges) ? raw.edges : []) {
    if (typeof e?.id !== 'string' || typeof e?.a !== 'string' || typeof e?.b !== 'string') continue
    if (!e.id || e.a === e.b || edgeIds.has(e.id)) continue
    const key = edgeKey(e.a, e.b)
    if (keys.has(key)) continue
    const edge: SurveyEdge = { id: e.id, a: e.a, b: e.b }
    const memo = optStr(e.memo)
    if (memo) edge.memo = memo
    edges.push(edge)
    keys.add(key)
    edgeIds.add(e.id)
  }
  const createdAt = num(raw.createdAt) ?? fallbackNow
  return {
    id: raw.id,
    name: str(raw.name).trim() || '이름 없는 모듈',
    status: raw.status === 'done' ? 'done' : 'draft',
    color: isHexColor(raw.color) ? raw.color.toUpperCase() : PALETTE[0],
    nodes,
    edges,
    places: (Array.isArray(raw.places) ? raw.places : []).map(normalizePlace).filter((p: SurveyPlace | null): p is SurveyPlace => !!p),
    memo: str(raw.memo),
    createdAt,
    updatedAt: num(raw.updatedAt) ?? createdAt,
  }
}

export function normalizeStore(raw: any, now = Date.now()): SurveyStore {
  const store = emptyStore(now)
  if (!raw || typeof raw !== 'object') return store
  const seen = new Set<string>()
  for (const m of Array.isArray(raw.modules) ? raw.modules : []) {
    const module = normalizeModule(m, now)
    if (!module || seen.has(module.id)) continue
    seen.add(module.id)
    store.modules.push(module)
  }
  store.activeModuleId =
    typeof raw.activeModuleId === 'string' && store.modules.some((m) => m.id === raw.activeModuleId && m.status === 'draft')
      ? raw.activeModuleId
      : null
  const colors: unknown[] = Array.isArray(raw.customColors) ? raw.customColors : []
  store.customColors = [...new Set(colors.filter(isHexColor).map((c) => c.toUpperCase()))]
  store.updatedAt = num(raw.updatedAt) ?? now
  return store
}

// ── v1 초안 변환 ──

export interface MigrationReport {
  /** v1 에서 새로 찍은 지점 수 / 변환된 모듈의 v1 지점 수(ref 복사본 제외). */
  v1Nodes: number
  nodes: number
  v1Edges: number
  edges: number
  v1Memos: number
  /** 지점 메모 + 위치를 몰라 모듈 메모로 옮긴 메모. */
  memos: number
  /** 기존 지점(pathNodes.ts)을 복사해 온 지점 수. */
  refNodes: number
  /** pathNodes.ts 의 id 와 겹쳐 접두사를 붙인 v1 지점 id. */
  renamed: string[]
}

/**
 * v1 초안(SurveyDraft)을 '미분류' draft 모듈 하나로 바꾼다.
 * - v1 지점 id 는 그대로 둔다. 다만 지금 pathNodes.ts 에 같은 id 가 있으면 '모듈id-' 접두사를 붙인다.
 * - v1 간선이 기존 지점에 붙어 있었으면 그 기존 지점을 모듈 안에 복사(id 는 '모듈id-원래id', ref 에 원래 id)해 간선을 살린다.
 * - 기존 지점에 단 메모는 그 복사본 메모로, 위치를 모르는 id 의 메모는 모듈 메모에 줄로 남긴다.
 */
export function migrateV1(
  rawV1: unknown,
  existing: readonly PathWaypoint[],
  now = Date.now(),
  moduleId = newModuleId(now),
): { module: SurveyModule; report: MigrationReport } | null {
  const draft = parseV1Draft(rawV1)
  const memoEntries = Object.entries(draft.memos).filter(([, memo]) => typeof memo === 'string' && memo.trim())
  if (draft.nodes.length === 0 && draft.edges.length === 0 && memoEntries.length === 0) return null

  const existingById = new Map(existing.map((w) => [w.id, w]))
  const idMap = new Map<string, string>()
  const renamed: string[] = []
  const nodes: SurveyNode[] = []
  for (const n of draft.nodes) {
    if (idMap.has(n.id)) continue
    const id = existingById.has(n.id) ? `${moduleId}-${n.id}` : n.id
    if (id !== n.id) renamed.push(n.id)
    idMap.set(n.id, id)
    nodes.push({ id, lat: round7(n.lat), lng: round7(n.lng) })
  }

  /** v1 이 가리킨 id 를 모듈 안 id 로. 기존 지점이면 복사본을 만든다. 모르는 id 면 그대로. */
  const resolve = (v1Id: string): string => {
    const mapped = idMap.get(v1Id)
    if (mapped) return mapped
    const w = existingById.get(v1Id)
    if (!w) return v1Id
    const id = `${moduleId}-${v1Id}`
    idMap.set(v1Id, id)
    nodes.push({ id, lat: w.lat, lng: w.lng, ref: v1Id })
    return id
  }

  const edges: SurveyEdge[] = []
  const keys = new Set<string>()
  let seq = 0
  for (const [rawA, rawB] of draft.edges) {
    const a = resolve(rawA)
    const b = resolve(rawB)
    const key = edgeKey(a, b)
    if (a === b || keys.has(key)) continue
    keys.add(key)
    seq += 1
    edges.push({ id: `${moduleId}-e${seq}`, a, b })
  }

  const orphanLines: string[] = []
  for (const [v1Id, memo] of memoEntries) {
    const id = idMap.has(v1Id) || existingById.has(v1Id) ? resolve(v1Id) : null
    const node = id ? nodes.find((n) => n.id === id) : undefined
    if (node) node.memo = memo
    else orphanLines.push(`${v1Id}: ${memo}`)
  }

  const module: SurveyModule = {
    id: moduleId,
    name: UNSORTED_NAME,
    status: 'draft',
    color: PALETTE[PALETTE.length - 1],
    nodes,
    edges,
    places: [],
    memo: orphanLines.length ? `v1 초안에서 위치를 모르는 지점 메모\n${orphanLines.join('\n')}` : '',
    createdAt: now,
    updatedAt: now,
  }
  const refNodes = nodes.filter((n) => n.ref).length
  return {
    module,
    report: {
      v1Nodes: draft.nodes.length,
      nodes: nodes.length - refNodes,
      v1Edges: draft.edges.length,
      edges: edges.length,
      v1Memos: memoEntries.length,
      memos: nodes.filter((n) => n.memo).length + orphanLines.length,
      refNodes,
      renamed,
    },
  }
}

// ── 저장 ──

function defaultStorage(): StorageLike | null {
  try {
    return (globalThis as any).localStorage ?? null
  } catch {
    return null
  }
}

export function saveStore(store: SurveyStore, storage: StorageLike | null = defaultStorage()): boolean {
  try {
    storage?.setItem(STORE_KEY, JSON.stringify(store))
    return !!storage
  } catch {
    return false
  }
}

export interface LoadResult {
  store: SurveyStore
  /** 이번에 v1 초안을 변환했으면 그 결과. */
  migrated: MigrationReport | null
  /** v2 값이 있었지만 읽지 못했으면 true(덮어쓰지 않는다). */
  corrupt: boolean
}

/**
 * v2 저장값을 읽는다. v2 가 아예 없을 때만 v1 초안을 '미분류' 모듈로 변환하고 곧바로 v2 에 저장한다 —
 * 그래서 변환은 한 번만 일어나고, 그 뒤 '미분류'를 지우거나 고쳐도 v1 이 다시 합쳐지지 않는다. v1 키는 지우지 않는다.
 */
export function loadStore(
  existing: readonly PathWaypoint[],
  storage: StorageLike | null = defaultStorage(),
  now = Date.now(),
): LoadResult {
  let raw: string | null = null
  try {
    raw = storage?.getItem(STORE_KEY) ?? null
  } catch {
    raw = null
  }
  if (raw !== null) {
    try {
      return { store: normalizeStore(JSON.parse(raw), now), migrated: null, corrupt: false }
    } catch {
      return { store: emptyStore(now), migrated: null, corrupt: true }
    }
  }

  const store = emptyStore(now)
  let migrated: MigrationReport | null = null
  try {
    const v1 = storage?.getItem(V1_KEY)
    const result = v1 ? migrateV1(JSON.parse(v1), existing, now) : null
    if (result) {
      store.modules.push(result.module)
      migrated = result.report
    }
  } catch {
    // v1 이 깨져 있으면 변환하지 않고 빈 저장소로 시작한다(v1 키는 그대로 남는다).
  }
  saveStore(store, storage)
  return { store, migrated, corrupt: false }
}

// ── 편집(모두 새 객체를 돌려준다) ──

export function updateModule(store: SurveyStore, id: string, fn: (m: SurveyModule) => SurveyModule, now = Date.now()): SurveyStore {
  let changed = false
  const modules = store.modules.map((m) => {
    if (m.id !== id) return m
    changed = true
    return { ...fn(m), updatedAt: now }
  })
  return changed ? { ...store, modules, updatedAt: now } : store
}

export const findModule = (store: SurveyStore, id: string | null | undefined) => (id ? store.modules.find((m) => m.id === id) : undefined)

export function nextPaletteColor(store: SurveyStore): string {
  const used = new Set(store.modules.map((m) => m.color.toUpperCase()))
  return PALETTE.find((c) => !used.has(c)) ?? PALETTE[store.modules.length % PALETTE.length]
}

export function createModule(store: SurveyStore, name?: string, now = Date.now()): { store: SurveyStore; module: SurveyModule } {
  let id = newModuleId(now)
  while (store.modules.some((m) => m.id === id)) id = newModuleId(now)
  const module: SurveyModule = {
    id,
    name: name?.trim() || `모듈 ${store.modules.length + 1}`,
    status: 'draft',
    color: nextPaletteColor(store),
    nodes: [],
    edges: [],
    places: [],
    memo: '',
    createdAt: now,
    updatedAt: now,
  }
  return { store: { ...store, modules: [...store.modules, module], activeModuleId: id, updatedAt: now }, module }
}

export function hasModuleEdge(module: SurveyModule, a: string, b: string): boolean {
  const key = edgeKey(a, b)
  return module.edges.some((e) => edgeKey(e.a, e.b) === key)
}

/** 같은 쌍이 이미 있거나 양 끝이 같으면 그대로 돌려준다(중복 간선 금지). */
export function addEdge(module: SurveyModule, a: string, b: string): SurveyModule {
  if (a === b || hasModuleEdge(module, a, b)) return module
  return { ...module, edges: [...module.edges, { id: nextEdgeId(module), a, b }] }
}

export function removeEdgeBetween(module: SurveyModule, a: string, b: string): SurveyModule {
  const key = edgeKey(a, b)
  return { ...module, edges: module.edges.filter((e) => edgeKey(e.a, e.b) !== key) }
}

export function addNode(module: SurveyModule, lat: number, lng: number, linkFrom?: string | null): { module: SurveyModule; id: string } {
  const id = nextNodeId(module)
  let next: SurveyModule = { ...module, nodes: [...module.nodes, { id, lat: round7(lat), lng: round7(lng) }] }
  if (linkFrom && module.nodes.some((n) => n.id === linkFrom)) next = addEdge(next, linkFrom, id)
  return { module: next, id }
}

export function moveNode(module: SurveyModule, id: string, lat: number, lng: number): SurveyModule {
  return { ...module, nodes: module.nodes.map((n) => (n.id === id ? { ...n, lat: round7(lat), lng: round7(lng) } : n)) }
}

export function removeNode(module: SurveyModule, id: string): SurveyModule {
  return { ...module, nodes: module.nodes.filter((n) => n.id !== id), edges: module.edges.filter((e) => e.a !== id && e.b !== id) }
}

const withMemo = <T extends { memo?: string }>(item: T, memo: string): T => {
  const next = { ...item }
  if (memo.trim()) next.memo = memo
  else delete next.memo
  return next
}

export const setNodeMemo = (module: SurveyModule, id: string, memo: string): SurveyModule => ({
  ...module,
  nodes: module.nodes.map((n) => (n.id === id ? withMemo(n, memo) : n)),
})

export const setEdgeMemo = (module: SurveyModule, id: string, memo: string): SurveyModule => ({
  ...module,
  edges: module.edges.map((e) => (e.id === id ? withMemo(e, memo) : e)),
})

// ── 확정(done) ──

/** done 으로 바꿀 수 없는 이유. 빈 배열이면 바꿀 수 있다. */
export function doneProblems(module: SurveyModule): string[] {
  const problems: string[] = []
  if (!module.name.trim()) problems.push('모듈 이름이 비어 있어요')
  if (module.places.length === 0) problems.push('이 모듈이 지나는 건물/층(places)을 1개 이상 적어 주세요')
  module.places.forEach((p, i) => {
    if (!p.buildingName.trim()) problems.push(`장소 ${i + 1}: 건물 이름이 비어 있어요`)
    if (!Number.isInteger(p.floor) || p.floor === 0) problems.push(`장소 ${i + 1}: 층은 1, 2, ... 또는 지하 -1, -2, ... 로 적어 주세요`)
  })
  return problems
}

/** 모듈 마치기: draft → done. 문제가 있으면 바꾸지 않고 이유를 돌려준다. 활성 모듈이었으면 활성을 푼다. */
export function finishModule(store: SurveyStore, id: string, now = Date.now()): { store: SurveyStore; problems: string[] } {
  const module = findModule(store, id)
  if (!module) return { store, problems: ['모듈을 찾지 못했어요'] }
  const problems = doneProblems(module)
  if (problems.length) return { store, problems }
  const next = updateModule(store, id, (m) => ({ ...m, status: 'done' }), now)
  return { store: { ...next, activeModuleId: next.activeModuleId === id ? null : next.activeModuleId }, problems: [] }
}

/** 다시 편집: done 이면 draft 로 되돌리고, 어느 쪽이든 활성 모듈로 만든다. */
export function reopenModule(store: SurveyStore, id: string, now = Date.now()): SurveyStore {
  const module = findModule(store, id)
  if (!module) return store
  const next = module.status === 'done' ? updateModule(store, id, (m) => ({ ...m, status: 'draft' }), now) : store
  return { ...next, activeModuleId: id, updatedAt: now }
}

export function deleteModule(store: SurveyStore, id: string, now = Date.now()): SurveyStore {
  return {
    ...store,
    modules: store.modules.filter((m) => m.id !== id),
    activeModuleId: store.activeModuleId === id ? null : store.activeModuleId,
    updatedAt: now,
  }
}

export function addCustomColor(store: SurveyStore, color: string, now = Date.now()): SurveyStore {
  if (!isHexColor(color)) return store
  const c = color.toUpperCase()
  if ((PALETTE as readonly string[]).includes(c) || store.customColors.includes(c)) return store
  return { ...store, customColors: [...store.customColors, c].slice(-24), updatedAt: now }
}
