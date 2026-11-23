import { useDeferredValue, useEffect, useMemo, useState } from 'react'
import { buildLegacyOverlay } from '../../screens/pathSurvey/legacyOverlay'
import { devSampleNodeIds } from '../../screens/pathSurveyV3/devSample'
import { clockText } from '../../utils/pathSurveyV3/saveBar'
import { BACKUP_VIA, latestRollingSnapshot, openManualCount } from '../../screens/pathSurveyV3/screenModel'
import { buildBuildingIndex, loadBuildingCache, saveBuildingCache, type BuildingIndex, type RawBuilding } from '../../utils/pathSurveyV3/buildings'
import { changeMarks, diffStores } from '../../utils/pathSurveyV3/changes'
import { checkGraph } from '../../utils/pathSurveyV3/check'
import type { ConvertReport } from '../../utils/pathSurveyV3/convertV2'
import { usedFloorsByBuilding } from '../../utils/pathSurveyV3/levels'
import { loadSnapshots, type Snapshot } from '../../utils/pathSurveyV3/snapshots'
import type { StoreV3 } from '../../utils/pathSurveyV3/store'
import {
  changesSinceBackup,
  loadSurveySettings,
  loadWorkContext,
  saveSurveySettings,
  saveWorkContext,
  storeFingerprint,
  type BackupRecord,
  type SurveySettings,
  type WorkContext,
} from '../../utils/pathSurveyV3/transfer'
import type { Building } from '../../types'

/** Building list to building index (the cached list when offline) and the old data overlay. A received list is cached. */
export function useSurveyBuildings(buildings: Building[]) {
  const index = useMemo(() => {
    const raw = buildings.length ? (buildings as RawBuilding[]) : loadBuildingCache()
    return buildBuildingIndex(raw)
  }, [buildings])

  useEffect(() => {
    if (buildings.length) saveBuildingCache(buildings as RawBuilding[])
  }, [buildings])

  const overlay = useMemo(() => buildLegacyOverlay(buildings), [buildings])
  return { index, overlay }
}

/** Work settings kept on the device: what a new point gets (building, floors, type) and the check tolerance. Saved on every change. */
export function useSurveyPrefs() {
  const [context, setContext] = useState<WorkContext>(() => loadWorkContext())
  const [settings, setSettings] = useState<SurveySettings>(() => loadSurveySettings())
  useEffect(() => saveWorkContext(context), [context])
  useEffect(() => saveSurveySettings(settings), [settings])
  return { context, setContext, settings, setSettings }
}

interface DerivedOptions {
  store: StoreV3
  index: BuildingIndex
  settings: SurveySettings
  backupRecord: BackupRecord | null
  report: ConvertReport | null
  /** The "show changes" box. Save points are read only while it is on. */
  showChanges: boolean
  /** Bumped whenever the save points change, so the base of "show changes" is read again. */
  snapshotTick: number
}

/** Values computed from the survey: check result, save fingerprint, used floors, backup line, change marks, open manual items. */
export function useSurveyDerived({ store, index, settings, backupRecord, report, showChanges, snapshotTick }: DerivedOptions) {
  // Check and save state run on a deferred copy, so typing a memo is never held up by them.
  const deferredStore = useDeferredValue(store)
  const check = useMemo(() => checkGraph(deferredStore.nodes, deferredStore.edges, index, settings), [deferredStore, index, settings])
  const fingerprint = useMemo(() => storeFingerprint(deferredStore), [deferredStore])
  const used = useMemo(() => usedFloorsByBuilding(deferredStore.nodes), [deferredStore])
  const backupStatus = useMemo(() => {
    if (!backupRecord) return '백업한 적 없어요'
    const changes = changesSinceBackup(deferredStore, backupRecord)
    return `마지막 백업 ${clockText(backupRecord.at)}(${BACKUP_VIA[backupRecord.via]}), 이후 바뀐 점 ${changes.nodes}, 간선 ${changes.edges}`
  }, [deferredStore, backupRecord])
  const sampleIds = useMemo(() => devSampleNodeIds(store, index), [store, index])

  // Base of "show changes": the newest save button point (rolling slot). Read only while the box is on, again after each save.
  const changeBase = useMemo((): Snapshot | null => {
    if (!showChanges) return null
    return latestRollingSnapshot(loadSnapshots())
    // snapshotTick asks for a new read.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showChanges, snapshotTick])
  const changeDiff = useMemo(() => (changeBase ? diffStores(changeBase, deferredStore) : null), [changeBase, deferredStore])
  const marks = useMemo(() => (changeDiff ? changeMarks(changeDiff) : null), [changeDiff])
  // undefined: the box is off. null: no save point to compare with.
  const changeCounts = !showChanges ? undefined : changeDiff ? changeDiff.total : null
  const openManual = useMemo(() => openManualCount(store, report), [store, report])
  const allIssues = useMemo(() => [...check.errors, ...check.warnings], [check])

  return { check, fingerprint, used, backupStatus, sampleIds, marks, changeCounts, openManual, allIssues }
}
