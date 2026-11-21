import { useCallback, useEffect, useRef, useState, type MutableRefObject } from 'react'
import { anchorAfterRedo, anchorAfterUndo, createEditHistory, type HistoryEntry } from '../../screens/pathSurveyV3/editHistory'
import { OTHER_TAB_TEXT } from '../../screens/pathSurveyV3/screenModel'
import { findEdge, findNode, saveStoreV3, STORE_KEY_V3, type LoadResultV3, type StoreV3 } from '../../utils/pathSurveyV3/store'
import type { SurveySelection } from './useSurveySelection'

interface StoreOptions {
  /** The stored survey read once on entry (loadStoreV3). When it could not be read (corrupt), saving is stopped from the start. */
  boot: LoadResultV3
  anchorRef: MutableRefObject<string | null>
  setNotice: (text: string) => void
}

/**
 * The survey data (store) and the edit history. Every change goes through commit, is kept in localStorage at once
 * and becomes an undo step. When another tab writes the same key, this tab stops saving (blockedRef).
 */
export function useSurveyStore({ boot, anchorRef, setNotice }: StoreOptions) {
  const [store, setStore] = useState<StoreV3>(boot.store)
  const storeRef = useRef(store)
  const historyRef = useRef(createEditHistory())
  const blockedRef = useRef(boot.corrupt)
  const [saveFailed, setSaveFailed] = useState(false)
  const [undoCount, setUndoCount] = useState(0)
  const [redoCount, setRedoCount] = useState(0)
  // Bumped by undo so that memo boxes, which keep their own text, show the restored text.
  const [undoTick, setUndoTick] = useState(0)

  /** Another tab writing the same key would be overwritten by this tab, so this tab stops saving. */
  useEffect(() => {
    const w = globalThis as any
    if (typeof w.addEventListener !== 'function') return
    const onStorage = (event: any) => {
      if (event?.key !== STORE_KEY_V3) return
      blockedRef.current = true
      setNotice(OTHER_TAB_TEXT)
    }
    w.addEventListener('storage', onStorage)
    return () => w.removeEventListener('storage', onStorage)
    // setNotice is a state setter of the screen: stable.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  /**
   * record: a new undo step (and the redo steps end). fromHistory: the change is an undo or a redo itself, the
   * only case that keeps the redo steps. Any other unrecorded change (typing on in a memo, arrow presses) ends them.
   */
  const commit = useCallback((next: StoreV3, record = true, fromHistory = false) => {
    if (next === storeRef.current) return
    if (record) historyRef.current.record({ store: storeRef.current, anchor: anchorRef.current })
    else if (!fromHistory) historyRef.current.clearRedo()
    setUndoCount(historyRef.current.size())
    setRedoCount(historyRef.current.redoSize())
    storeRef.current = next
    setStore(next)
    if (blockedRef.current) return
    setSaveFailed(!saveStoreV3(next))
    // anchorRef is a ref.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const change = useCallback((fn: (s: StoreV3) => StoreV3) => commit(fn(storeRef.current)), [commit])

  const syncHistoryCounts = () => {
    setUndoCount(historyRef.current.size())
    setRedoCount(historyRef.current.redoSize())
  }

  const bumpUndoTick = () => setUndoTick((n) => n + 1)

  return {
    store,
    storeRef,
    historyRef,
    blockedRef,
    saveFailed,
    undoCount,
    redoCount,
    undoTick,
    bumpUndoTick,
    syncHistoryCounts,
    commit,
    change,
  }
}

export type SurveyStore = ReturnType<typeof useSurveyStore>

interface UndoOptions {
  edits: SurveyStore
  selection: SurveySelection
  setNotice: (text: string) => void
}

/** Undo and redo. Selections missing from the restored data are dropped, and memo boxes are redrawn with the restored text. */
export function useSurveyUndo({ edits, selection, setNotice }: UndoOptions) {
  const { storeRef, historyRef, commit, syncHistoryCounts, bumpUndoTick } = edits
  const { anchorRef, setAnchor, selected, setSelected, selectedEdge, setSelectedEdge, setPending } = selection

  /** The store an undo or redo brings back: memo boxes redrawn, selections that no longer exist dropped. */
  const applyHistory = (entry: HistoryEntry, anchorNext: string | null, text: string) => {
    const prev = entry.store
    setAnchor(anchorNext)
    commit(prev, false, true)
    // commit skips the same store object, the counts still changed.
    syncHistoryCounts()
    bumpUndoTick()
    setPending(null)
    if (selected && !findNode(prev, selected)) setSelected(null)
    if (selectedEdge && !findEdge(prev, selectedEdge)) setSelectedEdge(null)
    setNotice(text)
  }

  const undo = () => {
    const entry = historyRef.current.undo({ store: storeRef.current, anchor: anchorRef.current })
    if (!entry) return setNotice('되돌릴 게 없어요')
    applyHistory(entry, anchorAfterUndo(anchorRef.current, entry), '되돌렸어요')
  }

  const redo = () => {
    const entry = historyRef.current.redo({ store: storeRef.current, anchor: anchorRef.current })
    if (!entry) return setNotice('다시 적용할 게 없어요')
    applyHistory(entry, anchorAfterRedo(anchorRef.current, entry), '다시 적용했어요')
  }

  return { undo, redo }
}
