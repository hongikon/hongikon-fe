import { defaultStorage, normalizeStoreV3, type StorageLike, type StoreV3 } from './store'

/**
 * Named save points. They live under their own key so that a full snapshot list can never break the
 * main save. Manual snapshots are never removed automatically; automatic ones make room first.
 */

export const SNAPSHOTS_KEY = 'hongikon.pathSurvey.v3.snapshots'
export const SNAPSHOT_LIMIT = 20
/** Rough localStorage budget in characters for the whole site. Browsers allow about 5 million. */
export const STORAGE_WARN_CHARS = 3_000_000
export const STORAGE_REFUSE_CHARS = 4_200_000

export interface Snapshot {
  id: string
  name: string
  createdAt: number
  auto: boolean
  nodes: StoreV3['nodes']
  edges: StoreV3['edges']
  nextNode: number
  nextEdge: number
}

export type SnapshotError = 'limit' | 'storage'

export function loadSnapshots(storage: StorageLike | null = defaultStorage()): Snapshot[] {
  try {
    const raw = storage?.getItem(SNAPSHOTS_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed.filter((s) => s && typeof s.id === 'string' && Array.isArray(s.nodes) && Array.isArray(s.edges)) : []
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

const dropOldestAuto = (list: Snapshot[]): Snapshot[] | null => {
  const oldest = list.filter((s) => s.auto).sort((x, y) => x.createdAt - y.createdAt)[0]
  return oldest ? list.filter((s) => s !== oldest) : null
}

/**
 * Adds a snapshot. At the limit or when the browser refuses the write, the oldest automatic snapshots go
 * first. If only manual ones are left, nothing is removed and the error says why.
 */
export function createSnapshot(
  store: StoreV3,
  name: string,
  auto: boolean,
  storage: StorageLike | null = defaultStorage(),
  now = Date.now(),
): { list: Snapshot[]; snapshot: Snapshot | null; error: SnapshotError | null } {
  const before = loadSnapshots(storage)
  const snapshot: Snapshot = {
    id: `s${now.toString(36)}${Math.floor(Math.random() * 1296).toString(36)}`,
    name: name.trim() || '이름 없음',
    createdAt: now,
    auto,
    nodes: store.nodes,
    edges: store.edges,
    nextNode: store.nextNode,
    nextEdge: store.nextEdge,
  }
  let list = before
  while (list.length >= SNAPSHOT_LIMIT) {
    const smaller = dropOldestAuto(list)
    if (!smaller) return { list: before, snapshot: null, error: 'limit' }
    list = smaller
  }
  for (;;) {
    const next = [...list, snapshot]
    const usage = storageUsage(storage)
    const size = JSON.stringify(next).length - JSON.stringify(list).length
    if ((usage === null || usage + size < STORAGE_REFUSE_CHARS) && write(next, storage)) return { list: next, snapshot, error: null }
    const smaller = dropOldestAuto(list)
    if (!smaller) return { list: before, snapshot: null, error: 'storage' }
    list = smaller
  }
}

export function deleteSnapshot(id: string, storage: StorageLike | null = defaultStorage()): Snapshot[] {
  const list = loadSnapshots(storage).filter((s) => s.id !== id)
  write(list, storage)
  return list
}

export function storeFromSnapshot(snapshot: Snapshot, now = Date.now()): StoreV3 {
  return normalizeStoreV3({ nodes: snapshot.nodes, edges: snapshot.edges, nextNode: snapshot.nextNode, nextEdge: snapshot.nextEdge, updatedAt: now }, now)
}
