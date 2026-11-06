import { defaultStorage, normalizeStoreV3, type StorageLike, type StoreV3 } from './store'

/**
 * Named save points. They live under their own key so that a full snapshot list can never break the
 * main save. There are two sets of slots. The save button has its own rolling slots, which reuse the oldest
 * one. Manual points and the protected ones made before a big change (v2 conversion, restore, import) go only
 * when a person deletes them, and the save button can never use up their slots.
 */

export const SNAPSHOTS_KEY = 'hongikon.pathSurvey.v3.snapshots'
export const KEPT_LIMIT = 20
export const ROLLING_LIMIT = 10
/** Rough localStorage budget in characters for the whole site. Browsers allow about 5 million. */
export const STORAGE_WARN_CHARS = 3_000_000
export const STORAGE_REFUSE_CHARS = 4_200_000

export type SnapshotKind = 'manual' | 'protected' | 'rolling'

export interface Snapshot {
  id: string
  name: string
  createdAt: number
  kind: SnapshotKind
  nodes: StoreV3['nodes']
  edges: StoreV3['edges']
  nextNode: number
  nextEdge: number
}

export type SnapshotError = 'limit' | 'storage'

/** Older entries only have auto. Those were either save button points or points made before a big change. */
function kindOf(raw: any): SnapshotKind {
  if (raw.kind === 'manual' || raw.kind === 'protected' || raw.kind === 'rolling') return raw.kind
  if (!raw.auto) return 'manual'
  return typeof raw.name === 'string' && raw.name.startsWith('저장 ') ? 'rolling' : 'protected'
}

export function loadSnapshots(storage: StorageLike | null = defaultStorage()): Snapshot[] {
  try {
    const raw = storage?.getItem(SNAPSHOTS_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed
      .filter((s) => s && typeof s.id === 'string' && Array.isArray(s.nodes) && Array.isArray(s.edges))
      .map(({ auto, ...s }) => ({ ...s, kind: kindOf({ ...s, auto }) }))
  } catch {
    return []
  }
}

/** Characters used by every key of this site. null when the browser does not let us look. */
export function storageUsage(storage: any = defaultStorage()): number | null {
  try {
    if (!storage || typeof storage.length !== 'number' || typeof storage.key !== 'function') return null
    let total = 0
    for (let i = 0; i < storage.length; i += 1) {
      const key = storage.key(i)
      if (key) total += key.length + (storage.getItem(key)?.length ?? 0)
    }
    return total
  } catch {
    return null
  }
}

function write(list: Snapshot[], storage: StorageLike | null): boolean {
  try {
    if (!storage) return false
    storage.setItem(SNAPSHOTS_KEY, JSON.stringify(list))
    return true
  } catch {
    return false
  }
}

const dropOldestRolling = (list: Snapshot[]): Snapshot[] | null => {
  const oldest = list.filter((s) => s.kind === 'rolling').sort((x, y) => x.createdAt - y.createdAt)[0]
  return oldest ? list.filter((s) => s !== oldest) : null
}

const isKept = (s: Snapshot) => s.kind !== 'rolling'

/**
 * Adds a snapshot. Full rolling slots reuse the oldest one. Full kept slots refuse with 'limit'. When the
 * browser is short of space the oldest rolling snapshots go first, and if none are left the error says why.
 */
export function createSnapshot(
  store: StoreV3,
  name: string,
  kind: SnapshotKind,
  storage: StorageLike | null = defaultStorage(),
  now = Date.now(),
): { list: Snapshot[]; snapshot: Snapshot | null; error: SnapshotError | null } {
  const before = loadSnapshots(storage)
  const snapshot: Snapshot = {
    id: `s${now.toString(36)}${Math.floor(Math.random() * 1296).toString(36)}`,
    name: name.trim() || '이름 없음',
    createdAt: now,
    kind,
    nodes: store.nodes,
    edges: store.edges,
    nextNode: store.nextNode,
    nextEdge: store.nextEdge,
  }
  if (kind !== 'rolling' && before.filter(isKept).length >= KEPT_LIMIT) return { list: before, snapshot: null, error: 'limit' }
  let list = before
  while (kind === 'rolling' && list.filter((s) => !isKept(s)).length >= ROLLING_LIMIT) list = dropOldestRolling(list) as Snapshot[]
  // The usage still counts the list as stored, so this write only adds the difference to it.
  const usage = storageUsage(storage)
  const storedLength = storage?.getItem(SNAPSHOTS_KEY)?.length ?? 0
  for (;;) {
    const next = [...list, snapshot]
    const usageAfter = usage === null ? null : usage - storedLength + JSON.stringify(next).length
    if ((usageAfter === null || usageAfter < STORAGE_REFUSE_CHARS) && write(next, storage)) return { list: next, snapshot, error: null }
    const smaller = dropOldestRolling(list)
    if (!smaller) return { list: before, snapshot: null, error: 'storage' }
    list = smaller
  }
}

export function deleteSnapshot(id: string, storage: StorageLike | null = defaultStorage()): Snapshot[] {
  const list = loadSnapshots(storage).filter((s) => s.id !== id)
  write(list, storage)
  return list
}

/** A name a person gave is worth keeping, so a rolling point moves to the kept slots, when one is free. */
export function renameSnapshot(id: string, name: string, storage: StorageLike | null = defaultStorage()): Snapshot[] {
  const before = loadSnapshots(storage)
  const trimmed = name.trim()
  if (!trimmed) return before
  const room = before.filter(isKept).length < KEPT_LIMIT
  const list = before.map((s) => (s.id === id ? { ...s, name: trimmed, kind: s.kind === 'rolling' && room ? ('manual' as const) : s.kind } : s))
  return write(list, storage) ? list : before
}

export function storeFromSnapshot(snapshot: Snapshot, now = Date.now()): StoreV3 {
  return normalizeStoreV3({ nodes: snapshot.nodes, edges: snapshot.edges, nextNode: snapshot.nextNode, nextEdge: snapshot.nextEdge, updatedAt: now }, now)
}
