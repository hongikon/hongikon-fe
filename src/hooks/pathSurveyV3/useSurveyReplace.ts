import { useState, type MutableRefObject } from 'react'
import { NO_FILTER, type MapFilter } from '../../screens/pathSurveyV3/mapState'
import { confirmAction } from '../../utils/pathSurvey/ui'
import { createSnapshot, storeFromSnapshot, type Snapshot } from '../../utils/pathSurveyV3/snapshots'
import type { StoreV3 } from '../../utils/pathSurveyV3/store'
import { loadBackupRecord, makeBackupRecord, saveBackupRecord, type BackupRecord, type BackupVia } from '../../utils/pathSurveyV3/transfer'
import type { SurveySelection } from './useSurveySelection'

interface ReplaceOptions {
  storeRef: MutableRefObject<StoreV3>
  commit: (next: StoreV3, record?: boolean, fromHistory?: boolean) => void
  bumpUndoTick: () => void
  selection: SurveySelection
  selectMany: (ids: string[], fromAll?: boolean) => void
  setFilter: (filter: MapFilter) => void
  focusOn: (lat: number, lng: number) => void
  setNotice: (text: string) => void
}

/**
 * Replacing all data (backup file, Gist, save point restore), the backup record, and the save point reload signal
 * (snapshotTick). It always asks first and keeps a save point of what was there. One undo step takes it back.
 */
export function useSurveyReplace({ storeRef, commit, bumpUndoTick, selection, selectMany, setFilter, focusOn, setNotice }: ReplaceOptions) {
  const [snapshotTick, setSnapshotTick] = useState(0)
  const [backupRecord, setBackupRecord] = useState<BackupRecord | null>(() => loadBackupRecord())
  const { clearSelection, setAnchor } = selection

  const bumpSnapshotTick = () => setSnapshotTick((n) => n + 1)

  /** Replaces all data after asking, and keeps a save point of what was there. A warning goes first in the question. */
  const replaceAll = (next: StoreV3, snapshotName: string, summary: string, warning = ''): boolean => {
    const current = storeRef.current
    if (current.nodes.length || current.edges.length) {
      const question = `지금 v3 데이터(지점 ${current.nodes.length}, 간선 ${current.edges.length})를 덮어쓸까요? 저장 지점을 먼저 만들어요.\n\n${summary}`
      if (!confirmAction(warning ? `${warning}\n\n${question}` : question)) return false
      const { error } = createSnapshot(current, snapshotName, 'protected')
      bumpSnapshotTick()
      if (error && !confirmAction('저장 지점을 만들지 못했어요(개수 또는 용량). 그래도 덮어쓸까요?')) return false
    }
    commit(next)
    bumpUndoTick()
    clearSelection()
    setAnchor(null)
    selectMany([])
    setFilter(NO_FILTER)
    return true
  }

  const runRestore = (next: StoreV3, warning = ''): boolean => {
    if (!replaceAll(next, '불러오기 직전', `불러올 내용: 지점 ${next.nodes.length}, 간선 ${next.edges.length}`, warning)) return false
    const first = next.nodes[0]
    if (first) focusOn(first.lat, first.lng)
    setNotice(`불러왔어요. 지점 ${next.nodes.length}, 간선 ${next.edges.length}`)
    return true
  }

  const runSnapshotRestore = (snapshot: Snapshot) => {
    const next = storeFromSnapshot(snapshot)
    if (!replaceAll(next, '복원 직전', `복원할 내용: "${snapshot.name}", 지점 ${next.nodes.length}, 간선 ${next.edges.length}`)) return
    const first = next.nodes[0]
    if (first) focusOn(first.lat, first.lng)
    setNotice(`"${snapshot.name}" 으로 복원했어요. 지점 ${next.nodes.length}, 간선 ${next.edges.length}. 되돌리기로 취소할 수 있어요.`)
  }

  const markBackedUp = (via: BackupVia, content: StoreV3 = storeRef.current) => {
    const record = makeBackupRecord(content, via)
    setBackupRecord(record)
    saveBackupRecord(record)
  }

  const runGistPull = (next: StoreV3): boolean => {
    if (!replaceAll(next, 'Gist 불러오기 직전', `Gist 내용: 지점 ${next.nodes.length}, 간선 ${next.edges.length}`)) return false
    markBackedUp('gist', next)
    const first = next.nodes[0]
    if (first) focusOn(first.lat, first.lng)
    setNotice(`Gist 에서 불러왔어요. 지점 ${next.nodes.length}, 간선 ${next.edges.length}`)
    return true
  }

  return { snapshotTick, bumpSnapshotTick, backupRecord, replaceAll, runRestore, runSnapshotRestore, markBackedUp, runGistPull }
}
