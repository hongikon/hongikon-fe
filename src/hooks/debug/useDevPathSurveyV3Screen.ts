import { useMemo, useRef, useState } from 'react'
import { ScrollView, useWindowDimensions } from 'react-native'
import type { NaverMapViewHandle } from '../../components/map/NaverMapView'
import { useConvertReport } from '../pathSurveyV3/useConvertReport'
import { useSurveyBuildings, useSurveyDerived, useSurveyPrefs } from '../pathSurveyV3/useSurveyDerived'
import { useSurveyEditActions } from '../pathSurveyV3/useSurveyEditActions'
import { useSurveyFilter } from '../pathSurveyV3/useSurveyFilter'
import { useSurveyFocus } from '../pathSurveyV3/useSurveyFocus'
import { useClickMods, useSurveyKeyboard } from '../pathSurveyV3/useSurveyKeyboard'
import { useSurveyMapRender } from '../pathSurveyV3/useSurveyMapRender'
import { useSurveyReplace } from '../pathSurveyV3/useSurveyReplace'
import { useSurveySave } from '../pathSurveyV3/useSurveySave'
import { useSurveySelection } from '../pathSurveyV3/useSurveySelection'
import { useSurveyStore, useSurveyUndo } from '../pathSurveyV3/useSurveyStore'
import { useMapData } from '../../lib/mapData'
import { buildMapHTML } from '../../utils/map/mapHtml'
import { serverSaveStateOf, serverStatusLine } from '../../utils/pathSurveyV3/serverSave'
import { type LegacyToggles } from '../../screens/pathSurvey/LegacyPanel'
import type { LabelMode } from '../../screens/pathSurveyV3/mapState'
import { clockText } from '../../utils/pathSurveyV3/saveBar'
import { CORRUPT_TEXT, type Tab } from '../../screens/pathSurveyV3/screenModel'
import { initialLoad, LEGACY_OFF } from '../../utils/debug/devPathSurveyV3Screen'

/** DevPathSurveyV3Screen 의 상태·효과·핸들러. 화면 파일은 이 훅을 불러 그리기만 한다. */
export function useDevPathSurveyV3Screen({ devKey }: Pick<{ devKey?: string }, 'devKey'>) {
  const webViewRef = useRef<NaverMapViewHandle>(null)
  const panelRef = useRef<ScrollView>(null)
  const { buildings, data, status, reload } = useMapData()
  const mapHTML = useMemo(() => buildMapHTML(buildings), [buildings])
  const { width } = useWindowDimensions()
  const wide = width >= 900

  const [boot] = useState(initialLoad)
  const [notice, setNotice] = useState(() => (boot.corrupt ? CORRUPT_TEXT : ''))
  const [tab, setTab] = useState<Tab>('edit')
  // "Show changes" since the last save button point. Screen state only, off on every visit.
  const [showChanges, setShowChanges] = useState(false)
  const [labelMode, setLabelMode] = useState<LabelMode>('full')
  const [legacyToggles, setLegacyToggles] = useState<LegacyToggles>(LEGACY_OFF)

  const { index, overlay } = useSurveyBuildings(buildings)
  const { context, setContext, settings, setSettings } = useSurveyPrefs()
  const selection = useSurveySelection()
  const { mode, setMode, chain, setChain, anchor, selected, setSelected, pending, setPending, selectedEdge, multi, setMulti, clearSelection } = selection
  const edits = useSurveyStore({ boot, anchorRef: selection.anchorRef, setNotice })
  const { store, storeRef, commit, change } = edits
  const { undo, redo } = useSurveyUndo({ edits, selection, setNotice })
  const { filter, setFilter, onlyFilter, selectMany, canEditNode, canEditEdgeId, applyFilter } = useSurveyFilter({ storeRef, selection, setNotice })
  const { focusOn, showRouteLines, scrollPanelTop, focusNode, goToIssue } = useSurveyFocus({ webViewRef, panelRef, storeRef, filter, setFilter, selection })
  const replace = useSurveyReplace({ storeRef, commit, bumpUndoTick: edits.bumpUndoTick, selection, selectMany, setFilter, focusOn, setNotice })
  const { report, updateReport, runConvert, keepOutdoor, makeIndoor } = useConvertReport({
    index,
    storeRef,
    change,
    replaceAll: replace.replaceAll,
    selection,
    filter,
    onlyFilter,
    selectMany,
    focusOn,
    focusNode,
    scrollPanelTop,
    setNotice,
  })
  const save = useSurveySave({
    devKey,
    corrupt: boot.corrupt,
    storeRef,
    blockedRef: edits.blockedRef,
    runRestore: replace.runRestore,
    bumpSnapshotTick: replace.bumpSnapshotTick,
    setNotice,
  })
  const clickMods = useClickMods()
  const actions = useSurveyEditActions({
    index,
    storeRef,
    historyRef: edits.historyRef,
    commit,
    change,
    selection,
    context,
    filter,
    onlyFilter,
    canEditNode,
    canEditEdgeId,
    selectMany,
    clickMods,
    focusOn,
    scrollPanelTop,
    setNotice,
  })
  const { check, fingerprint, used, backupStatus, sampleIds, marks, changeCounts, openManual, allIssues } = useSurveyDerived({
    store,
    index,
    settings,
    backupRecord: replace.backupRecord,
    report,
    showChanges,
    snapshotTick: replace.snapshotTick,
  })
  const { ready, handleReady } = useSurveyMapRender({
    webViewRef,
    store,
    index,
    filter,
    onlyFilter,
    mode,
    tab,
    selected,
    pending,
    selectedEdge,
    multi,
    labelMode,
    legacyToggles,
    overlay,
    chain,
    anchor,
    marks,
    canEditNode,
  })
  useSurveyKeyboard({
    ready,
    tab,
    selected,
    multi,
    historyRef: edits.historyRef,
    worldPxRef: actions.worldPxRef,
    canEditNode,
    undo,
    redo,
    deleteNode: actions.deleteNode,
    nudgeNode: actions.nudgeNode,
  })

  const serverLine = serverStatusLine(
    serverSaveStateOf(save.serverState, fingerprint, { hasKey: !!devKey, blocked: edits.blockedRef.current, saving: save.serverSaving }),
    save.serverState,
    check.errors.length,
    clockText,
  )

  const tabs: { key: Tab; label: string }[] = [
    { key: 'edit', label: '편집' },
    { key: 'check', label: `점검 ${check.errors.length}` },
    { key: 'convert', label: report ? `v2 변환 ${openManual}` : 'v2 변환' },
    { key: 'backup', label: '백업' },
    { key: 'server', label: '서버' },
    { key: 'snapshots', label: '저장 지점' },
    { key: 'legacy', label: '기존 자료' },
  ]
  return {
    webViewRef,
    panelRef,
    buildings,
    data,
    status,
    reload,
    mapHTML,
    wide,
    notice,
    setNotice,
    tab,
    setTab,
    showChanges,
    setShowChanges,
    labelMode,
    setLabelMode,
    legacyToggles,
    setLegacyToggles,
    index,
    overlay,
    context,
    setContext,
    settings,
    setSettings,
    mode,
    setMode,
    chain,
    setChain,
    selected,
    setSelected,
    pending,
    setPending,
    selectedEdge,
    multi,
    setMulti,
    clearSelection,
    edits,
    store,
    storeRef,
    commit,
    change,
    undo,
    redo,
    filter,
    onlyFilter,
    selectMany,
    canEditNode,
    canEditEdgeId,
    applyFilter,
    showRouteLines,
    focusNode,
    goToIssue,
    replace,
    report,
    updateReport,
    runConvert,
    keepOutdoor,
    makeIndoor,
    save,
    actions,
    check,
    fingerprint,
    used,
    backupStatus,
    sampleIds,
    changeCounts,
    allIssues,
    handleReady,
    serverLine,
    tabs,
  }
}
