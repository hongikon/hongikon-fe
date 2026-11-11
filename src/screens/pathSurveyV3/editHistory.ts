import { addNode, findNode, type NodeContext, type StoreV3 } from '../../utils/pathSurveyV3/store'

/** Undo history and the chain base point of the survey screen. Pure apart from the list it keeps. */

export const UNDO_LIMIT = 50
/** Arrow presses closer together than this are one undo step. */
export const NUDGE_GROUP_MS = 600

export interface HistoryEntry {
  store: StoreV3
  /** Chain base point before the edit. */
  anchor: string | null
}

export interface EditHistory {
  size(): number
  /** Steps that an undo took back and a redo can apply again. */
  redoSize(): number
  /** Starts a new undo step. Also ends any group of arrow presses, and drops the redo steps. */
  record(entry: HistoryEntry): void
  /** Starts a new undo step only when this press does not continue the current group. Drops the redo steps. */
  recordNudge(entry: HistoryEntry, id: string, now: number): void
  /** Takes the last undo step without keeping anything for redo. */
  pop(): HistoryEntry | undefined
  /** Takes the last undo step and keeps the current state (before the undo) as the next redo step. */
  undo(current: HistoryEntry): HistoryEntry | undefined
  /** Takes the last redo step and keeps the current state as an undo step again. Other redo steps stay. */
  redo(current: HistoryEntry): HistoryEntry | undefined
  /** A new edit that was not recorded as its own step (typing on in a memo) still ends the redo steps. */
  clearRedo(): void
}

export function createEditHistory(limit = UNDO_LIMIT): EditHistory {
  let entries: HistoryEntry[] = []
  let redoEntries: HistoryEntry[] = []
  let group: { id: string; at: number } | null = null
  const push = (entry: HistoryEntry) => {
    entries = [...entries.slice(-(limit - 1)), entry]
  }
  const pop = () => {
    group = null
    const entry = entries[entries.length - 1]
    entries = entries.slice(0, -1)
    return entry
  }
  return {
    size: () => entries.length,
    redoSize: () => redoEntries.length,
    record(entry) {
      group = null
      redoEntries = []
      push(entry)
    },
    recordNudge(entry, id, now) {
      redoEntries = []
      if (!group || group.id !== id || now - group.at >= NUDGE_GROUP_MS) push(entry)
      group = { id, at: now }
    },
    pop,
    undo(current) {
      const entry = pop()
      if (entry) redoEntries = [...redoEntries.slice(-(limit - 1)), current]
      return entry
    },
    redo(current) {
      group = null
      const entry = redoEntries[redoEntries.length - 1]
      if (!entry) return undefined
      redoEntries = redoEntries.slice(0, -1)
      push(current)
      return entry
    },
    clearRedo() {
      redoEntries = []
    },
  }
}

/** After a redo the base point of that moment comes back when it exists, otherwise the current one stays if it can. */
export function anchorAfterRedo(current: string | null, entry: HistoryEntry): string | null {
  if (findNode(entry.store, entry.anchor)) return entry.anchor
  return findNode(entry.store, current) ? current : null
}

/** The base point stays when it survived the undo. Otherwise the one from before the undone edit comes back. */
export function anchorAfterUndo(current: string | null, entry: HistoryEntry): string | null {
  if (findNode(entry.store, current)) return current
  return findNode(entry.store, entry.anchor) ? entry.anchor : null
}

/** A new point, joined to the base point by a normal edge when chaining is on. The new point is the next base point. */
export function placeChained(store: StoreV3, lat: number, lng: number, context: NodeContext, chain: boolean, anchor: string | null, now = Date.now()) {
  const from = chain ? findNode(store, anchor) : undefined
  const { store: next, id } = addNode(store, lat, lng, context, from?.id, now)
  return { store: next, id, from }
}

export const chainToggleLabel = (on: boolean) => (on ? '이어 찍기 켜짐 - 직전 점과 연결 중' : '이어 찍기 꺼짐')
