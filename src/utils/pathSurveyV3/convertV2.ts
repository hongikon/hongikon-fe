import { edgeKey } from '../pathSurvey'
import { normalizeStore, STORE_KEY, type SurveyEdge, type SurveyModule, type SurveyNode } from '../pathSurveyStore'
import { EXPORT_FORMAT, parseBundle } from '../pathSurveySync'
import {
  buildingsContaining,
  ENTRANCE_LABEL,
  parseEntranceLabel,
  parseFloorToken,
  serverLabelFor,
  type BuildingIndex,
} from './buildings'
import { analyzeConnectivity } from './check'
import type { StorageLike, StoreV3 } from './store'
import { defaultStorage } from './store'
import type { LevelRef, SurveyEdgeV3, SurveyNodeV3 } from './types'

/**
 * v2 to v3 conversion. The v2 data is only read: the v2 loadStore() is not used here because it can write
 * to the v2 key. Running it again gives the same result, so nothing is lost by importing twice.
 */

export type ManualKind = 'entrance' | 'elevator' | 'boundary'

export interface ManualCandidate {
  building: string
  floors?: number[]
  label?: string
}

export interface ManualItem {
  nodeId: string
  kind: ManualKind
  /** Screen text. */
  reason: string
  /** First memo line, shown so the surveyor can see what the old note said. */
  source?: string
  candidates: ManualCandidate[]
}

export interface ConvertReport {
  rawNodes: number
  mergedNodes: number
  rawEdges: number
  mergedEdges: number
  stairsEdges: number
  /** Old kind counts after merging: basic, intersection, entrance, elevator, stairs. */
  oldKinds: Record<string, number>
  autoEntrances: number
  manualEntrances: number
  autoElevators: number
  manualElevators: number
  boundaryCandidates: number
  components: number
  largestComponent: number
  isolated: number
  /** Entrance pairs joined directly whose memos name two buildings with "=". */
  bridgePairs: number
  /** Entrance pairs joined directly whose first labels name different buildings (includes bridgePairs). */
  crossBuildingPairs: number
  labelsNotOnServer: string[]
  manual: ManualItem[]
}

export interface ConvertResult {
  store: StoreV3
  report: ConvertReport
}

const firstLine = (memo: string | undefined) => (memo ?? '').split('\n')[0].trim()

/** Memo words that mean a person has to look: even, odd, needs another survey. */
const COMPLEX_ELEVATOR_WORDS = ['\uC9DD\uC218', '\uD640\uC218', '\uBCF4\uC644\uC870\uC0AC']

const ELEVATOR_LABEL = /^HI_([A-Z0-9]+?)(?:_\d+)?_ELEVATOR$/

/** 1F~10F or B4F~10F. Floors without a floor 0. null when the text is anything else. */
export function parseFloorRange(text: string): number[] | null {
  const m = /^([A-Z0-9]+)~([A-Z0-9]+)$/.exec(text.trim())
  if (!m) return null
  const from = parseFloorToken(m[1])
  const to = parseFloorToken(m[2])
  if (from === null || to === null || from > to || !Number.isInteger(from) || !Number.isInteger(to)) return null
  const floors: number[] = []
  for (let f = from; f <= to; f += 1) if (f !== 0) floors.push(f)
  return floors
}

/** Buildings and floors named by an elevator memo, used as hints even when a person must decide. */
function elevatorCandidates(memo: string, index: BuildingIndex): ManualCandidate[] {
  const lines = memo.split('\n').map((l) => l.trim())
  const floors = parseFloorRange(lines[1] ?? '') ?? undefined
  const out: ManualCandidate[] = []
  for (const part of (lines[0] ?? '').split('=')) {
    const letter = ELEVATOR_LABEL.exec(part.trim())?.[1]
    const entry = letter ? index.byLetter.get(letter) : undefined
    if (entry) out.push({ building: entry.code, ...(floors ? { floors } : {}) })
  }
  return out
}

function entranceCandidates(label: string, index: BuildingIndex): ManualCandidate[] {
  return label.split('=').flatMap((part): ManualCandidate[] => {
    const text = part.trim()
    const parsed = parseEntranceLabel(text)
    const entry = parsed ? index.byLetter.get(parsed.letter) : undefined
    return parsed && entry ? [{ building: entry.code, floors: [parsed.floor], label: serverLabelFor(index, text) ?? text }] : []
  })
}

const letterOf = (label: string) => /^HI_([A-Z0-9]+)_/.exec(label)?.[1] ?? null

export function convertV2(modules: readonly SurveyModule[], index: BuildingIndex, now = Date.now()): ConvertResult {
  // Merge by shared id. Position comes from the latest sharedUpdatedAt, memos are kept.
  interface Merged {
    key: string
    lat: number
    lng: number
    updatedAt: number
    kind: SurveyNode['kind']
    memos: string[]
  }
  const canonical = new Map<string, string>()
  const merged = new Map<string, Merged>()
  let rawNodes = 0
  for (const module of modules) {
    for (const node of module.nodes) {
      rawNodes += 1
      const key = node.sharedId ?? node.id
      canonical.set(node.id, key)
      const updatedAt = node.sharedUpdatedAt ?? -1
      const memo = node.memo?.trim() ? node.memo : null
      const old = merged.get(key)
      if (!old) {
        merged.set(key, { key, lat: node.lat, lng: node.lng, updatedAt, kind: node.kind, memos: memo ? [memo] : [] })
        continue
      }
      if (updatedAt > old.updatedAt) {
        old.lat = node.lat
        old.lng = node.lng
        old.updatedAt = updatedAt
      }
      if (!old.kind) old.kind = node.kind
      if (memo && !old.memos.includes(memo)) old.memos.push(memo)
    }
  }

  // New ids in first seen order so that the same input always gives the same numbers.
  const idOf = new Map<string, string>()
  const nodes: SurveyNodeV3[] = []
  const manual: ManualItem[] = []
  const labelsNotOnServer = new Set<string>()
  const oldKinds: Record<string, number> = { basic: 0, intersection: 0, entrance: 0, elevator: 0, stairs: 0 }
  let autoEntrances = 0
  let manualEntrances = 0
  let autoElevators = 0
  let manualElevators = 0

  for (const item of merged.values()) {
    const id = `n${nodes.length + 1}`
    idOf.set(item.key, id)
    oldKinds[item.kind ?? 'basic'] += 1
    const memo = item.memos.join('\n')
    const node: SurveyNodeV3 = { id, lat: item.lat, lng: item.lng, scope: 'outdoor', type: 'basic', legacyId: item.key }
    if (memo) node.memo = memo

    if (item.kind === 'entrance') {
      node.scope = 'indoor'
      node.type = 'entrance'
      const label = firstLine(memo)
      const parsed = ENTRANCE_LABEL.test(label) ? parseEntranceLabel(label) : null
      const entry = parsed ? index.byLetter.get(parsed.letter) : undefined
      if (parsed && entry) {
        const level: LevelRef = { building: entry.code, floor: parsed.floor }
        const serverLabel = serverLabelFor(index, label)
        node.levels = [level]
        node.entranceLabel = serverLabel ?? label
        if (!serverLabel) labelsNotOnServer.add(label)
        const rest = memo.split('\n').slice(1).join('\n').trim()
        if (rest) node.memo = rest
        else delete node.memo
        autoEntrances += 1
      } else {
        manualEntrances += 1
        const reason = label.includes('=') ? '두 건물이 적혀 있어요' : label ? '라벨 형식이 달라요' : '메모에 라벨이 없어요'
        manual.push({ nodeId: id, kind: 'entrance', reason, source: label, candidates: entranceCandidates(label, index) })
      }
    } else if (item.kind === 'elevator') {
      node.scope = 'indoor'
      node.type = 'elevator'
      const lines = memo.split('\n').map((l) => l.trim())
      const letter = ELEVATOR_LABEL.exec(lines[0] ?? '')?.[1]
      const entry = letter ? index.byLetter.get(letter) : undefined
      const floors = parseFloorRange(lines[1] ?? '')
      const complex = COMPLEX_ELEVATOR_WORDS.some((word) => memo.includes(word))
      if (entry && floors && floors.length >= 2 && !complex) {
        node.levels = floors.map((floor) => ({ building: entry.code, floor }))
        autoElevators += 1
      } else {
        manualElevators += 1
        const reason = (lines[0] ?? '').includes('=')
          ? '두 건물에 걸쳐 있어요'
          : complex
            ? '짝수층, 홀수층 분리나 보완조사 메모가 있어요'
            : '건물이나 층 범위를 읽지 못했어요'
        manual.push({ nodeId: id, kind: 'elevator', reason, source: lines[0], candidates: elevatorCandidates(memo, index) })
      }
    }
    nodes.push(node)
  }

  // Boundary hints only. The floor stays manual and nothing is changed on the node.
  let boundaryCandidates = 0
  for (const node of nodes) {
    if (node.scope !== 'outdoor') continue
    const inside = buildingsContaining(index, node.lat, node.lng)
    if (!inside.length) continue
    boundaryCandidates += 1
    manual.push({
      nodeId: node.id,
      kind: 'boundary',
      reason: '건물 경계 안의 외부 점이에요. 내부 점이면 층을 골라 주세요',
      source: firstLine(node.memo),
      candidates: inside.map((b) => ({ building: b.code })),
    })
  }

  // Edges: undirected, merged, stairs when any copy is stairs.
  const edgeByKey = new Map<string, { a: string; b: string; stairs: boolean; memos: string[] }>()
  let rawEdges = 0
  for (const module of modules) {
    for (const edge of module.edges as SurveyEdge[]) {
      rawEdges += 1
      const a = canonical.get(edge.a)
      const b = canonical.get(edge.b)
      if (!a || !b || a === b) continue
      const key = edgeKey(a, b)
      const old = edgeByKey.get(key)
      const memo = edge.memo?.trim() ? edge.memo : null
      if (!old) {
        edgeByKey.set(key, { a, b, stairs: edge.kind === 'stairs', memos: memo ? [memo] : [] })
        continue
      }
      old.stairs = old.stairs || edge.kind === 'stairs'
      if (memo && !old.memos.includes(memo)) old.memos.push(memo)
    }
  }
  const edges: SurveyEdgeV3[] = []
  for (const item of edgeByKey.values()) {
    const edge: SurveyEdgeV3 = { id: `e${edges.length + 1}`, a: idOf.get(item.a)!, b: idOf.get(item.b)!, kind: item.stairs ? 'stairs' : 'normal' }
    if (item.memos.length) edge.memo = item.memos.join('\n')
    edges.push(edge)
  }

  // Report the old direct links between buildings, from the memos of both ends.
  let bridgePairs = 0
  let crossBuildingPairs = 0
  const mergedByNew = new Map([...merged.values()].map((m) => [idOf.get(m.key)!, m]))
  for (const edge of edges) {
    const a = mergedByNew.get(edge.a)!
    const b = mergedByNew.get(edge.b)!
    if (a.kind !== 'entrance' || b.kind !== 'entrance') continue
    const labelA = firstLine(a.memos[0])
    const labelB = firstLine(b.memos[0])
    const letterA = letterOf(labelA)
    const letterB = letterOf(labelB)
    if (!letterA || !letterB || letterA === letterB) continue
    crossBuildingPairs += 1
    if (labelA.includes('=') && labelB.includes('=')) bridgePairs += 1
  }

  const connectivity = analyzeConnectivity(nodes, edges)
  return {
    store: { version: 3, nodes, edges, nextNode: nodes.length + 1, nextEdge: edges.length + 1, updatedAt: now },
    report: {
      rawNodes,
      mergedNodes: nodes.length,
      rawEdges,
      mergedEdges: edges.length,
      stairsEdges: edges.filter((e) => e.kind === 'stairs').length,
      oldKinds,
      autoEntrances,
      manualEntrances,
      autoElevators,
      manualElevators,
      boundaryCandidates,
      components: connectivity.sizes.length,
      largestComponent: connectivity.sizes[0] ?? 0,
      isolated: connectivity.isolated.length,
      bridgePairs,
      crossBuildingPairs,
      labelsNotOnServer: [...labelsNotOnServer].sort(),
      manual,
    },
  }
}

export type V2Source = { modules: SurveyModule[] }

/** Reads the v2 value of this browser. Read only. null when there is nothing to read. */
export function readV2FromStorage(storage: StorageLike | null = defaultStorage()): V2Source | null {
  let raw: string | null = null
  try {
    raw = storage?.getItem(STORE_KEY) ?? null
  } catch {
    return null
  }
  if (!raw) return null
  try {
    const store = normalizeStore(JSON.parse(raw))
    return store.modules.length ? { modules: store.modules } : null
  } catch {
    return null
  }
}

/** Parses an exported v2 file or pasted text. Throws an Error with a screen message when it is not one. */
export function parseV2Text(text: string): V2Source {
  let raw: any
  try {
    raw = JSON.parse(text)
  } catch {
    throw new Error('JSON 으로 읽지 못했어요. 내보낸 내용을 그대로 넣었는지 확인해 주세요.')
  }
  if (raw?.format !== EXPORT_FORMAT || raw?.version !== 2) throw new Error('v2 내보내기 파일이 아니에요(format, version 2 확인).')
  return { modules: parseBundle(text).modules }
}

export const CONVERT_REPORT_KEY = 'hongikon.pathSurvey.v3.convert'

/** The manual list has to survive a reload, because fixing it takes several trips. */
export function saveConvertReport(report: ConvertReport, storage: StorageLike | null = defaultStorage()): boolean {
  try {
    storage?.setItem(CONVERT_REPORT_KEY, JSON.stringify(report))
    return !!storage
  } catch {
    return false
  }
}

export function loadConvertReport(storage: StorageLike | null = defaultStorage()): ConvertReport | null {
  try {
    const raw = storage?.getItem(CONVERT_REPORT_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    return parsed && Array.isArray(parsed.manual) ? (parsed as ConvertReport) : null
  } catch {
    return null
  }
}

/** Whether a manual item is still open, judged from the node as it is now. */
export function isManualItemOpen(item: ManualItem, node: SurveyNodeV3 | undefined): boolean {
  if (!node) return false
  if (item.kind === 'boundary') return node.scope === 'outdoor'
  if (item.kind === 'entrance') return node.type === 'entrance' && !(node.levels?.length === 1 && node.entranceLabel)
  return node.type === 'elevator' && (node.levels?.length ?? 0) < 2
}
