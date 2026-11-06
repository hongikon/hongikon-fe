import type { BuildingIndex } from './buildings'
import { checkGraph } from './check'
import { expandGraph, summarizeGraph, type GraphSummary } from './expand'
import { defaultStorage, normalizeStoreV3, type NodeContext, type StorageLike, type StoreV3 } from './store'
import { EXPORT_FORMAT_V3, type LevelRef, type NodeType, type SurveyFileV3 } from './types'

/** Backup files, the graph export for routing work, and the small state the save button needs. */

const two = (n: number) => String(n).padStart(2, '0')

/** YYYYMMDD-HHMM in local time. */
export function fileStamp(now = new Date()): string {
  return `${now.getFullYear()}${two(now.getMonth() + 1)}${two(now.getDate())}-${two(now.getHours())}${two(now.getMinutes())}`
}

export const backupFileName = (now = new Date()) => `path-survey-v3-backup-${fileStamp(now)}.json`
export const graphFileName = (now = new Date()) => `path-survey-v3-graph-${fileStamp(now)}.json`

/** A backup is always allowed, errors or not, and carries no graph. */
export function serializeBackup(store: StoreV3, now = Date.now()): string {
  const file: SurveyFileV3 = { format: EXPORT_FORMAT_V3, version: 3, exportedAt: now, nodes: store.nodes, edges: store.edges }
  return JSON.stringify(file, null, 2)
}

/** Reads a v3 file. A graph in the file is ignored: it is always derived again. Errors carry screen text. */
export function parseBackupText(text: string, now = Date.now()): StoreV3 {
  let raw: any
  try {
    raw = JSON.parse(text)
  } catch {
    throw new Error('JSON 으로 읽지 못했어요. 내용을 그대로 넣었는지 확인해 주세요.')
  }
  if (raw?.format !== EXPORT_FORMAT_V3) throw new Error('경로망 조사 파일이 아니에요.')
  if (raw?.version === 2) throw new Error('v2 파일이에요. "v2 변환" 탭에서 가져와 주세요.')
  if (raw?.version !== 3 || !Array.isArray(raw?.nodes) || !Array.isArray(raw?.edges)) throw new Error('v3 파일 모양이 아니에요.')
  return normalizeStoreV3({ nodes: raw.nodes, edges: raw.edges, updatedAt: now }, now)
}

export function labelsNotOnServer(store: StoreV3, index: BuildingIndex): string[] {
  const labels = store.nodes.flatMap((n) => (n.type === 'entrance' && n.entranceLabel && !index.serverLabels.has(n.entranceLabel) ? [n.entranceLabel] : []))
  return [...new Set(labels)].sort()
}

export interface GraphExport {
  text: string
  summary: GraphSummary
  labelsNotOnServer: string[]
}

/** The expanded graph. Returns null unless the check has zero errors. */
export function buildGraphExport(store: StoreV3, index: BuildingIndex, now = Date.now()): GraphExport | null {
  if (checkGraph(store.nodes, store.edges, index).errors.length > 0) return null
  const { graph } = expandGraph(store.nodes, store.edges)
  const missing = labelsNotOnServer(store, index)
  const file: SurveyFileV3 = {
    format: EXPORT_FORMAT_V3,
    version: 3,
    exportedAt: now,
    nodes: store.nodes,
    edges: store.edges,
    graph,
    report: { labelsNotOnServer: missing },
  }
  return { text: JSON.stringify(file, null, 2), summary: summarizeGraph(store.nodes, store.edges, graph), labelsNotOnServer: missing }
}

/** Short hash of the survey content. Unlike updatedAt it also notices an undo back past the last save. */
export function storeFingerprint(store: Pick<StoreV3, 'nodes' | 'edges'>): string {
  const text = JSON.stringify([store.nodes, store.edges])
  let hash = 0x811c9dc5
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i)
    hash = Math.imul(hash, 0x01000193)
  }
  return `${text.length}:${(hash >>> 0).toString(36)}`
}

export const META_KEY = 'hongikon.pathSurvey.v3.meta'

export interface SaveMeta {
  lastSaveAt: number | null
  lastSaveFingerprint: string | null
}

export const EMPTY_META: SaveMeta = { lastSaveAt: null, lastSaveFingerprint: null }

export function loadSaveMeta(storage: StorageLike | null = defaultStorage()): SaveMeta {
  try {
    const raw = JSON.parse(storage?.getItem(META_KEY) ?? 'null')
    return raw && typeof raw === 'object'
      ? { lastSaveAt: typeof raw.lastSaveAt === 'number' ? raw.lastSaveAt : null, lastSaveFingerprint: typeof raw.lastSaveFingerprint === 'string' ? raw.lastSaveFingerprint : null }
      : EMPTY_META
  } catch {
    return EMPTY_META
  }
}

export function saveSaveMeta(meta: SaveMeta, storage: StorageLike | null = defaultStorage()): void {
  try {
    storage?.setItem(META_KEY, JSON.stringify(meta))
  } catch {
    // Only the status text depends on this.
  }
}

export type SaveState = 'never' | 'needed' | 'saved'

export function saveStateOf(meta: SaveMeta, fingerprint: string): SaveState {
  if (meta.lastSaveAt === null) return 'never'
  return meta.lastSaveFingerprint === fingerprint ? 'saved' : 'needed'
}

export const CONTEXT_KEY = 'hongikon.pathSurvey.v3.context'

/** The work context bar. New points inherit it and it stays set while points are placed. */
export interface WorkContext {
  scope: 'outdoor' | 'indoor'
  type: NodeType
  building: string | null
  floors: number[]
}

export const DEFAULT_CONTEXT: WorkContext = { scope: 'outdoor', type: 'basic', building: null, floors: [] }

export function loadWorkContext(storage: StorageLike | null = defaultStorage()): WorkContext {
  try {
    const raw = JSON.parse(storage?.getItem(CONTEXT_KEY) ?? 'null')
    if (!raw || (raw.scope !== 'indoor' && raw.scope !== 'outdoor')) return DEFAULT_CONTEXT
    return { ...DEFAULT_CONTEXT, ...raw, floors: Array.isArray(raw.floors) ? raw.floors.filter((f: unknown) => typeof f === 'number') : [] }
  } catch {
    return DEFAULT_CONTEXT
  }
}

export function saveWorkContext(context: WorkContext, storage: StorageLike | null = defaultStorage()): void {
  try {
    storage?.setItem(CONTEXT_KEY, JSON.stringify(context))
  } catch {
    // A convenience only.
  }
}

/** Scope and type stay consistent: every type except basic is indoor, an entrance has exactly one floor. */
export function updateWorkContext(context: WorkContext, patch: Partial<WorkContext>): WorkContext {
  const next = { ...context, ...patch }
  if (patch.type && patch.type !== 'basic') next.scope = 'indoor'
  if (patch.scope === 'outdoor') next.type = 'basic'
  if (next.type === 'entrance' && next.floors.length > 1) next.floors = next.floors.slice(0, 1)
  return next
}

export const contextLevels = (context: WorkContext): LevelRef[] =>
  context.scope === 'indoor' && context.building ? context.floors.map((floor) => ({ building: context.building as string, floor })) : []

export const toNodeContext = (context: WorkContext): NodeContext => ({ scope: context.scope, type: context.type, levels: contextLevels(context) })
