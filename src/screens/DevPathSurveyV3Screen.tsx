import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from 'react'
import { Platform, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native'
import { fetchGraphBackup, listGraphVersions, routeGraphErrorMessage, uploadGraphVersion, type GraphVersion, type GraphVersionSummary } from '../apis/routeGraph'
import NaverMapView from '../components/map/NaverMapView'
import type { NaverMapViewHandle } from '../components/map/NaverMapView'
import { COLORS } from '../constants/colors'
import { FONTS } from '../constants/typography'
import { useMapData } from '../lib/mapData'
import { buildMapHTML } from '../utils/mapHtml'
import { buildBuildingIndex, loadBuildingCache, saveBuildingCache, type RawBuilding } from '../utils/pathSurveyV3/buildings'
import { checkGraph, type CheckIssue } from '../utils/pathSurveyV3/check'
import { convertV2, isManualItemOpen, loadConvertReport, saveConvertReport, type ConvertReport, type V2Source } from '../utils/pathSurveyV3/convertV2'
import { selectionBuildings, usedFloorsByBuilding } from '../utils/pathSurveyV3/levels'
import {
  afterAdopt,
  afterUpload,
  BROWSER_SAVE_FAILED_TEXT,
  checkOnEntry,
  hasUnsentChanges,
  loadServerSaveState,
  offerText,
  overwriteCheck,
  overwriteQuestion,
  pushSurvey,
  saveNoticeText,
  saveServerSaveState,
  serverNoticeText,
  serverSaveStateOf,
  serverStatusLine,
  stateAfter,
  UNSENT_WARNING_TEXT,
  type PushOutcome,
  type ServerOffer,
  type ServerSaveState,
} from '../utils/pathSurveyV3/serverSave'
import { changeMarks, diffStores } from '../utils/pathSurveyV3/changes'
import { createSnapshot, loadSnapshots, storeFromSnapshot, type Snapshot } from '../utils/pathSurveyV3/snapshots'
import {
  addEdge,
  applyBulkToNodes,
  findEdge,
  findNode,
  hasEdgeBetween,
  loadStoreV3,
  moveNode,
  moveNodeOntoEdge,
  removeEdge,
  removeEdgeBetween,
  removeNode,
  saveStoreV3,
  setEdgeMemo,
  setNodeMemo,
  setNodeScope,
  splitEdgeAt,
  STORE_KEY_V3,
  type SplitRefusal,
  type BulkChange,
  type StoreV3,
} from '../utils/pathSurveyV3/store'
import {
  changesSinceBackup,
  contextLevels,
  EMPTY_META,
  loadBackupRecord,
  loadSaveMeta,
  loadSurveySettings,
  loadWorkContext,
  makeBackupRecord,
  parseBackupText,
  saveBackupRecord,
  saveSaveMeta,
  saveStateOf,
  saveSurveySettings,
  saveWorkContext,
  storeFingerprint,
  toNodeContext,
  type BackupRecord,
  type BackupVia,
  type SaveMeta,
  type SurveySettings,
  type WorkContext,
} from '../utils/pathSurveyV3/transfer'
import { buildLegacyOverlay, floorKeyOf } from './pathSurvey/legacyOverlay'
import LegacyPanel, { DEFAULT_LEGACY, type LegacyToggles } from './pathSurvey/LegacyPanel'
import { Btn, confirmAction, ui } from './pathSurvey/ui'
import BackupPanel from './pathSurveyV3/BackupPanel'
import CheckPanel from './pathSurveyV3/CheckPanel'
import ContextBar from './pathSurveyV3/ContextBar'
import { ChainToggle, Chip } from './pathSurveyV3/controls'
import ConvertPanel from './pathSurveyV3/ConvertPanel'
import { addDevSample, devSampleNodeIds, removeDevSample } from './pathSurveyV3/devSample'
import { anchorAfterRedo, anchorAfterUndo, createEditHistory, placeChained, UNDO_LIMIT, type HistoryEntry } from './pathSurveyV3/editHistory'
import EdgeSheet from './pathSurveyV3/EdgeSheet'
import FilterBar from './pathSurveyV3/FilterBar'
import {
  CLICK_HINT,
  hasOpenDialog,
  isShortcutTab,
  isTypingElement,
  keyboardTarget,
  modsAfterKey,
  NO_MODS,
  NUDGE_HINT,
  nudgeCoord,
  resolveClickShortcut,
  resolveShortcut,
  type ClickMods,
  type ClickShortcut,
  type ClickTarget,
  type ShortcutAction,
} from './pathSurveyV3/keyboard'
import Legend from './pathSurveyV3/Legend'
import { SETUP_JS } from './pathSurveyV3/mapBridge'
import {
  buildRenderState,
  canEditEdge,
  editableNodeIds,
  editableSelection,
  isNodeStrong,
  NO_FILTER,
  type LabelMode,
  type MapFilter,
  type MapMode,
} from './pathSurveyV3/mapState'
import MultiPanel from './pathSurveyV3/MultiPanel'
import NodeSheet from './pathSurveyV3/NodeSheet'
import SaveBar, { clockText } from './pathSurveyV3/SaveBar'
import ServerPanel, { type RouteLine } from './pathSurveyV3/ServerPanel'
import SnapshotPanel from './pathSurveyV3/SnapshotPanel'

type Tab = 'edit' | 'check' | 'convert' | 'backup' | 'server' | 'snapshots' | 'legacy'

const MODES: { key: MapMode; label: string; help: string }[] = [
  { key: 'add', label: '점 찍기', help: '지도를 누르면 위의 설정대로 점이 생겨요. 이어 찍기를 켜면 직전 점과 간선으로 이어요.' },
  { key: 'link', label: '잇기', help: '점 두 개를 차례로 누르면 간선이 생겨요. 이어서 누르면 계속 이어지고, 같은 점을 다시 누르면 끊겨요. 이미 있는 간선을 다시 이으면 지워져요.' },
  { key: 'move', label: '옮기기', help: '점을 끌어서 옮겨요. 다른 간선 위에 놓으면 그 간선을 둘로 나눠요.' },
  { key: 'select', label: '여러 점', help: '점을 눌러 여러 개 고른 뒤 같은 건물, 층, 종류를 한 번에 넣어요.' },
]

const LABEL_MODES: { key: LabelMode; label: string }[] = [
  { key: 'none', label: '없음' },
  { key: 'number', label: '번호' },
  { key: 'full', label: '번호+동' },
  { key: 'selected', label: '선택한 점만' },
]

const BACKUP_VIA: Record<BackupVia, string> = { file: '파일', copy: '코드 복사', gist: 'Gist' }

const SPLIT_REFUSED: Record<SplitRefusal, string> = {
  missing: '간선이나 양 끝 점을 찾지 못해 나누지 않았어요.',
  pairs: '층 짝이 있는 간선이라 나누지 않았어요. 점을 따로 찍어 이어 주세요.',
  mixed: '양 끝 점의 위치(외부/내부, 건물, 층)가 달라서 나누지 않았어요. 점을 따로 찍어 이어 주세요.',
  end: '끝점과 같은 자리라 나누지 않았어요.',
}

/** The overlay starts hidden here: the new graph is the main thing on this screen. */
const LEGACY_OFF: LegacyToggles = {
  ...DEFAULT_LEGACY,
  plainNodes: false,
  namedNodes: false,
  nodeEdges: false,
  anchorEdges: false,
  unconnectedEntrances: false,
}

/** Passes only messages sent by this screen's map script. */
function parseMessage(event: unknown): any | null {
  const e = event as any
  const raw = e?.nativeEvent?.data ?? e?.data ?? e
  try {
    const msg = typeof raw === 'string' ? JSON.parse(raw) : raw
    return msg && msg.src === 'surveyV3' ? msg : null
  } catch {
    return null
  }
}

const initialLoad = () => loadStoreV3()

/**
 * Developer screen at /dev/path-survey-v3: survey points and edges in one graph.
 * Every change is kept in localStorage. The save button adds a save point on top of that.
 * The v2 screen and its storage are not touched.
 */
/** @param devKey /dev gate key; the Server tab sends it (X-Dev-Key) to upload and apply route graphs. */
export default function DevPathSurveyV3Screen({ devKey }: { devKey?: string } = {}) {
  const webViewRef = useRef<NaverMapViewHandle>(null)
  const panelRef = useRef<ScrollView>(null)
  const { buildings, data, status, reload } = useMapData()
  const mapHTML = useMemo(() => buildMapHTML(buildings), [buildings])
  const { width } = useWindowDimensions()
  const wide = width >= 900

  const [boot] = useState(initialLoad)
  const [store, setStore] = useState<StoreV3>(boot.store)
  const storeRef = useRef(store)
  const historyRef = useRef(createEditHistory())
  // World width in pixels at the current zoom, reported by the map. Arrow keys wait for it.
  const worldPxRef = useRef(0)
  const blockedRef = useRef(boot.corrupt)
  const [saveFailed, setSaveFailed] = useState(false)
  const [saveMeta, setSaveMeta] = useState<SaveMeta>(() => (boot.corrupt ? EMPTY_META : loadSaveMeta()))
  // Server draft saved by the save button. The ref is read by the upload, which may finish after more edits.
  const serverStateRef = useRef<ServerSaveState>(loadServerSaveState())
  const [serverState, setServerState] = useState<ServerSaveState>(serverStateRef.current)
  const serverBusyRef = useRef(false)
  const [serverSaving, setServerSaving] = useState(false)
  // Newest server version id this tab has seen in a list: the reference for asking before the next save.
  const seenIdRef = useRef<number | null>(null)
  // Offer from the entry check: save this survey as the base, or load a server version. Never acted on by itself.
  const [offer, setOffer] = useState<ServerOffer<GraphVersionSummary> | null>(null)
  // Bumped after each upload so an open Server tab lists the new draft.
  const [serverTick, setServerTick] = useState(0)
  const [context, setContext] = useState<WorkContext>(() => loadWorkContext())
  const [mode, setMode] = useState<MapMode>('add')
  const [tab, setTab] = useState<Tab>('edit')
  const [chain, setChain] = useState(false)
  // The point placed or picked last. It outlives the sheet, so closing the sheet does not cut the chain.
  const [anchor, setAnchorState] = useState<string | null>(null)
  const anchorRef = useRef<string | null>(null)
  const [selected, setSelected] = useState<string | null>(null)
  const [pending, setPending] = useState<string | null>(null)
  const [selectedEdge, setSelectedEdge] = useState<string | null>(null)
  const [multi, setMulti] = useState<string[]>([])
  // A select all button can mix buildings. Selections made point by point or per building never ask.
  const [multiFromAll, setMultiFromAll] = useState(false)
  const [undoCount, setUndoCount] = useState(0)
  const [redoCount, setRedoCount] = useState(0)
  const [snapshotTick, setSnapshotTick] = useState(0)
  const [backupRecord, setBackupRecord] = useState<BackupRecord | null>(() => loadBackupRecord())
  const [settings, setSettings] = useState<SurveySettings>(() => loadSurveySettings())
  const [filter, setFilter] = useState<MapFilter>(NO_FILTER)
  // "Only the filter can be edited". Screen state only, never stored: every visit starts locked as before.
  const [onlyFilter, setOnlyFilter] = useState(true)
  // "Show changes" since the last save button point. Screen state only, off on every visit.
  const [showChanges, setShowChanges] = useState(false)
  const [labelMode, setLabelMode] = useState<LabelMode>('full')
  const [legacyToggles, setLegacyToggles] = useState<LegacyToggles>(LEGACY_OFF)
  const [report, setReport] = useState<ConvertReport | null>(() => loadConvertReport())
  // Bumped by undo so that memo boxes, which keep their own text, show the restored text.
  const [undoTick, setUndoTick] = useState(0)
  const [ready, setReady] = useState(false)
  const [notice, setNotice] = useState(() =>
    boot.corrupt ? '저장된 조사 내용(v3)을 읽지 못했어요. 덮어쓰지 않도록 저장을 멈췄어요. 개발자 도구로 값을 확인해 주세요.' : '',
  )

  const index = useMemo(() => {
    const raw = buildings.length ? (buildings as RawBuilding[]) : loadBuildingCache()
    return buildBuildingIndex(raw)
  }, [buildings])

  useEffect(() => {
    if (buildings.length) saveBuildingCache(buildings as RawBuilding[])
  }, [buildings])

  useEffect(() => saveWorkContext(context), [context])
  useEffect(() => saveSurveySettings(settings), [settings])

  const overlay = useMemo(() => buildLegacyOverlay(buildings), [buildings])

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
    return loadSnapshots()
      .filter((s) => s.kind === 'rolling')
      .reduce<Snapshot | null>((best, s) => (!best || s.createdAt > best.createdAt ? s : best), null)
  }, [showChanges, snapshotTick])
  const changeDiff = useMemo(() => (changeBase ? diffStores(changeBase, deferredStore) : null), [changeBase, deferredStore])
  const marks = useMemo(() => (changeDiff ? changeMarks(changeDiff) : null), [changeDiff])
  // undefined: the box is off. null: no save point to compare with.
  const changeCounts = !showChanges ? undefined : changeDiff ? changeDiff.total : null
  const openManual = useMemo(() => {
    const byId = new Map(store.nodes.map((n) => [n.id, n]))
    return (report?.manual ?? []).filter((item) => isManualItemOpen(item, byId.get(item.nodeId), report?.dismissed)).length
  }, [store, report])

  /** Another tab writing the same key would be overwritten by this tab, so this tab stops saving. */
  useEffect(() => {
    const w = globalThis as any
    if (typeof w.addEventListener !== 'function') return
    const onStorage = (event: any) => {
      if (event?.key !== STORE_KEY_V3) return
      blockedRef.current = true
      setNotice('다른 탭에서 조사 내용을 저장했어요. 서로 덮어쓰지 않도록 이 탭은 저장을 멈췄어요. 새로고침해 주세요.')
    }
    w.addEventListener('storage', onStorage)
    return () => w.removeEventListener('storage', onStorage)
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
  }, [])

  const change = useCallback((fn: (s: StoreV3) => StoreV3) => commit(fn(storeRef.current)), [commit])

  const setAnchor = (id: string | null) => {
    anchorRef.current = id
    setAnchorState(id)
  }

  /** Selects a point and makes it the chain base point. */
  const pickNode = (id: string) => {
    setSelected(id)
    setAnchor(id)
  }

  const clearSelection = () => {
    setSelected(null)
    setSelectedEdge(null)
    setPending(null)
  }

  /** The store an undo or redo brings back: memo boxes redrawn, selections that no longer exist dropped. */
  const applyHistory = (entry: HistoryEntry, anchorNext: string | null, text: string) => {
    const prev = entry.store
    setAnchor(anchorNext)
    commit(prev, false, true)
    // commit skips the same store object, the counts still changed.
    setUndoCount(historyRef.current.size())
    setRedoCount(historyRef.current.redoSize())
    setUndoTick((n) => n + 1)
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

  const focusOn = useCallback((lat: number, lng: number) => {
    webViewRef.current?.injectJavaScript(`window.__surveyV3Focus && window.__surveyV3Focus(${lat}, ${lng}); true;`)
  }, [])

  const focusNode = (id: string) => {
    const node = findNode(storeRef.current, id)
    if (!node) return
    if (!isNodeStrong(node, filter)) setFilter(NO_FILTER)
    pickNode(id)
    setSelectedEdge(null)
    setPending(null)
    focusOn(node.lat, node.lng)
    panelRef.current?.scrollTo({ y: 0, animated: false })
  }

  const focusEdge = (id: string) => {
    const edge = findEdge(storeRef.current, id)
    const a = findNode(storeRef.current, edge?.a)
    const b = findNode(storeRef.current, edge?.b)
    if (!edge || !a || !b) return false
    if (!isNodeStrong(a, filter) || !isNodeStrong(b, filter)) setFilter(NO_FILTER)
    setSelectedEdge(id)
    setSelected(null)
    setPending(null)
    focusOn((a.lat + b.lat) / 2, (a.lng + b.lng) / 2)
    panelRef.current?.scrollTo({ y: 0, animated: false })
    return true
  }

  const goToIssue = (issue: CheckIssue) => {
    if (issue.edgeId && focusEdge(issue.edgeId)) return
    if (issue.nodeId) focusNode(issue.nodeId)
  }

  /** Replaces all data after asking, and keeps a save point of what was there. A warning goes first in the question. */
  const replaceAll = (next: StoreV3, snapshotName: string, summary: string, warning = ''): boolean => {
    const current = storeRef.current
    if (current.nodes.length || current.edges.length) {
      const question = `지금 v3 데이터(지점 ${current.nodes.length}, 간선 ${current.edges.length})를 덮어쓸까요? 저장 지점을 먼저 만들어요.\n\n${summary}`
      if (!confirmAction(warning ? `${warning}\n\n${question}` : question)) return false
      const { error } = createSnapshot(current, snapshotName, 'protected')
      setSnapshotTick((n) => n + 1)
      if (error && !confirmAction('저장 지점을 만들지 못했어요(개수 또는 용량). 그래도 덮어쓸까요?')) return false
    }
    commit(next)
    setUndoTick((n) => n + 1)
    clearSelection()
    setAnchor(null)
    selectMany([])
    setFilter(NO_FILTER)
    return true
  }

  const selectMany = (ids: string[], fromAll = false) => {
    const allowed = editableNodeIds(storeRef.current, ids, filter, onlyFilter)
    setMulti(allowed)
    setMultiFromAll(fromAll && allowed.length > 0)
    if (allowed.length < ids.length) setNotice(`필터 밖 점 ${ids.length - allowed.length}개는 고르지 않았어요`)
  }

  /**
   * The same rule as the map: with "only the filter" on, points outside the filter are locked. The base point
   * (the point placed or picked last) stays editable, so a new point placed outside the filter can still be filled in.
   */
  const canEditNode = (id: string | null | undefined): boolean => {
    if (!id) return false
    if (id === anchorRef.current) return !!findNode(storeRef.current, id)
    return editableNodeIds(storeRef.current, [id], filter, onlyFilter).length > 0
  }
  const canEditEdgeId = (id: string | null | undefined) => canEditEdge(storeRef.current, id ?? null, filter, onlyFilter)

  /** A new filter or box state drops the selection that could no longer be edited. */
  const applyFilter = (nextFilter: MapFilter, nextOnly: boolean) => {
    setFilter(nextFilter)
    setOnlyFilter(nextOnly)
    const kept = editableSelection(storeRef.current, { selected, selectedEdge, pending, multi }, nextFilter, nextOnly)
    const dropped = kept.selected !== selected || kept.selectedEdge !== selectedEdge || kept.pending !== pending || kept.multi.length !== multi.length
    if (!dropped) return
    setSelected(kept.selected)
    setSelectedEdge(kept.selectedEdge)
    setPending(kept.pending)
    setMulti([...kept.multi])
    setMultiFromAll(multiFromAll && kept.multi.length > 0)
    setNotice('필터 밖이 된 선택은 풀었어요')
  }

  const lockedText = "필터 밖이라 고칠 수 없어요. 필터를 바꾸거나 '선택한 필터만 수정'을 꺼 주세요."

  const runConvert = (source: V2Source) => {
    if (index.list.length === 0) return setNotice('건물 목록이 아직 없어요. 온라인에서 한 번 연 뒤 다시 해 주세요.')
    const { store: next, report: result } = convertV2(source.modules, index)
    if (!replaceAll(next, 'v2 변환 직전', `가져올 내용: 지점 ${result.mergedNodes}, 간선 ${result.mergedEdges}`)) return
    setReport(result)
    saveConvertReport(result)
    const first = next.nodes[0]
    if (first) focusOn(first.lat, first.lng)
    setNotice(`v2 에서 가져왔어요. 지점 ${result.mergedNodes}, 간선 ${result.mergedEdges}. 수동 확인 ${result.manual.length}건`)
  }

  /** Draws the Server tab test routes (found by the server) over the survey lines. An empty list clears them. */
  const showRouteLines = useCallback((lines: RouteLine[]) => {
    webViewRef.current?.injectJavaScript(`window.__surveyV3Routes && window.__surveyV3Routes(${JSON.stringify(lines)}); true;`)
    const first = lines[0]?.points[0]
    if (first) webViewRef.current?.injectJavaScript(`window.__surveyV3Focus && window.__surveyV3Focus(${first[0]}, ${first[1]}); true;`)
  }, [])

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

  /**
   * Sends the survey to the server as a draft (never to production). Stops without a key, when this tab's saving is
   * stopped (other tab, damaged data), on the same content as the last draft, or while one upload is going.
   * A failure only changes the server state: the browser save has already happened.
   */
  const recordServerState = useCallback((next: ServerSaveState) => {
    if (next === serverStateRef.current) return
    serverStateRef.current = next
    setServerState(next)
    saveServerSaveState(next)
  }, [])

  /**
   * `check`: the save button path. Before uploading it lists the versions once and asks when another device saved
   * after the newest version this tab knows (see overwriteCheck). The Server tab and the base save do not ask.
   */
  const pushToServer = useCallback(
    async (content: StoreV3, options: { name?: string; check?: boolean } = {}): Promise<PushOutcome<GraphVersion>> => {
      const outcome = await pushSurvey({
        store: content,
        devKey,
        blocked: blockedRef.current,
        state: serverStateRef.current,
        busy: serverBusyRef.current,
        name: options.name,
        begin: () => {
          serverBusyRef.current = true
          setServerSaving(true)
        },
        end: () => {
          serverBusyRef.current = false
          setServerSaving(false)
        },
        beforeUpload:
          options.check && devKey
            ? async () => {
                const result = await overwriteCheck({
                  lastVersionId: serverStateRef.current.lastVersionId,
                  seenId: seenIdRef.current,
                  listVersions: () => listGraphVersions(devKey),
                  confirm: (newer) => confirmAction(overwriteQuestion(newer)),
                })
                seenIdRef.current = result.seenId
                return result.go
              }
            : undefined,
        upload: uploadGraphVersion,
        errorText: (e) => routeGraphErrorMessage(e, '서버에 저장하지 못했어요.'),
      })
      recordServerState(stateAfter(serverStateRef.current, outcome))
      if (outcome.kind === 'uploaded') {
        setServerTick((n) => n + 1)
        setOffer((o) => (o?.kind === 'baseline' ? null : o))
      }
      return outcome
    },
    [devKey, recordServerState],
  )

  /** Tapping the failed status line: the same upload as the save button, without a new save point. */
  const retryServer = () => {
    void pushToServer(storeRef.current, { check: true }).then((outcome) => {
      const text = serverNoticeText(outcome)
      if (text) setNotice(text)
    })
  }

  /** Loads a server version through the usual overwrite question, and records it as what this browser holds. */
  const loadFromServer = async (id: number, version?: GraphVersionSummary) => {
    if (!devKey) return
    const next = parseBackupText(await fetchGraphBackup(devKey, id))
    const warning = hasUnsentChanges(serverStateRef.current, storeRef.current) ? UNSENT_WARNING_TEXT : ''
    if (!runRestore(next, warning)) return
    const fingerprint = storeFingerprint(next)
    recordServerState(version ? afterAdopt(serverStateRef.current, version, fingerprint) : afterUpload(serverStateRef.current, id, fingerprint, Date.now()))
    seenIdRef.current = Math.max(seenIdRef.current ?? id, id)
    setOffer(null)
  }

  const acceptOffer = () => {
    if (!offer) return
    if (offer.kind === 'baseline') {
      void pushToServer(storeRef.current).then((outcome) => {
        const text = serverNoticeText(outcome)
        if (text) setNotice(text)
      })
      return
    }
    loadFromServer(offer.version.id, offer.version).catch((e) => setNotice(routeGraphErrorMessage(e, '서버에서 불러오지 못했어요.')))
  }

  // One list call when the screen opens with a key. Offers only; nothing is uploaded or loaded by itself.
  useEffect(() => {
    if (!devKey || blockedRef.current) return
    let alive = true
    checkOnEntry({
      state: serverStateRef.current,
      store: storeRef.current,
      listVersions: () => listGraphVersions(devKey),
      backupFingerprint: async (id) => storeFingerprint(parseBackupText(await fetchGraphBackup(devKey, id))),
    }).then((result) => {
      if (!alive) return
      seenIdRef.current = result.seenId
      recordServerState(result.state)
      setOffer(result.offer)
    })
    return () => {
      alive = false
    }
  }, [devKey, recordServerState])

  /**
   * Browser save point first, then the server draft. A full browser storage does not stop the server save;
   * a stopped tab or damaged data does (pushSurvey answers blocked).
   */
  const saveNow = () => {
    const current = storeRef.current
    // Save button points roll over on their own, so pressing it often never runs into the limit.
    const { error } = createSnapshot(current, `저장 ${clockText(Date.now())}`, 'rolling')
    setSnapshotTick((n) => n + 1)
    const browserSaved = !error
    if (browserSaved) {
      const meta = { lastSaveAt: Date.now(), lastSaveFingerprint: storeFingerprint(current) }
      setSaveMeta(meta)
      saveSaveMeta(meta)
    }
    if (!blockedRef.current) setNotice(browserSaved ? '저장했어요.' : BROWSER_SAVE_FAILED_TEXT)
    void pushToServer(current, { check: true }).then((outcome) => {
      const text = saveNoticeText(browserSaved, outcome)
      if (text) setNotice(text)
    })
  }

  const updateReport = (fn: (r: ConvertReport) => ConvertReport) => {
    setReport((old) => {
      if (!old) return old
      const next = fn(old)
      saveConvertReport(next)
      return next
    })
  }

  const keepOutdoor = (ids: string[]) => {
    updateReport((r) => ({ ...r, dismissed: [...new Set([...(r.dismissed ?? []), ...ids])] }))
    selectMany(multi.filter((id) => !ids.includes(id)), multiFromAll)
    setNotice(`외부 유지 ${ids.length}건 처리했어요`)
  }

  /** One point opens its sheet with the boundary building ready. Many points go to the bulk panel. */
  const makeIndoor = (all: string[]) => {
    const ids = editableNodeIds(storeRef.current, all, filter, onlyFilter)
    if (ids.length === 0) return setNotice(lockedText)
    if (ids.length === 1) {
      change((s) => setNodeScope(s, ids[0], 'indoor'))
      focusNode(ids[0])
      setNotice(`${ids[0]} 를 내부로 바꿨어요. 층을 골라 주세요.`)
      return
    }
    setMulti(ids)
    setMode('select')
    setSelected(null)
    setSelectedEdge(null)
    setPending(null)
    panelRef.current?.scrollTo({ y: 0, animated: false })
    setNotice(`${ids.length}개를 골랐어요. 위에서 건물과 층을 골라 적용해 주세요.`)
  }

  const applyBulk = (bulk: BulkChange) => {
    const ids = editableNodeIds(storeRef.current, multi, filter, onlyFilter)
    if (ids.length === 0) return setNotice(lockedText)
    const count = ids.length
    const mixed = multiFromAll ? selectionBuildings(storeRef.current.nodes, ids, index) : []
    if (mixed.length > 1 && !confirmAction(`여러 건물의 점이 섞여 있어요. 건물 ${mixed.length}곳, 점 ${count}개에 같은 값을 넣을까요?`)) return
    change((s) => applyBulkToNodes(s, ids, bulk))
    selectMany([])
    const skipped = multi.length - count
    setNotice(`${count}개에 적용했어요${skipped ? `(필터 밖 ${skipped}개는 건너뜀)` : ''}. 되돌리기로 한 번에 취소할 수 있어요.`)
  }

  const onTap = (lat: number, lng: number) => {
    const { store: next, id, from } = placeChained(storeRef.current, lat, lng, toNodeContext(context), chain, anchorRef.current)
    commit(next)
    pickNode(id)
    setSelectedEdge(null)
    const made = findNode(next, id)!
    const crossing = from && (from.scope === 'indoor') !== (made.scope === 'indoor') && (from.scope === 'indoor' ? from : made).type !== 'entrance'
    const notes = [`${id} 추가${from ? `, ${from.id} 와 이었어요` : ''}`]
    if (crossing) notes.push('외부 점과 내부 점은 출입구로만 이을 수 있어 이 간선은 점검에서 오류로 나와요')
    if (made.type === 'entrance') notes.push('아래에서 건물, 층, 이름을 고르세요. 비워 두면 점검 오류로 나와요')
    else if (made.scope === 'indoor' && !made.levels?.length) notes.push('건물과 층이 없어 점검 오류로 나와요')
    if (!isNodeStrong(made, filter)) notes.push(`지금 층 필터 밖의 점이라 흐리게 보여요${onlyFilter ? '. 다른 점을 고르면 이 점은 잠겨요' : ''}`)
    setNotice(notes.join('. '))
    panelRef.current?.scrollTo({ y: 0, animated: false })
  }

  /** Cmd/Ctrl + click and Shift + click on the map. null means the press goes on as usual. */
  const clickShortcut = (target: ClickTarget, mods: ClickMods): ClickShortcut | null =>
    resolveClickShortcut(target, mods, {
      mode,
      selected,
      selectedEdge,
      pending,
      hasEdge: (a, b) => hasEdgeBetween(storeRef.current, a, b),
      canEditNode,
      canEditEdge: canEditEdgeId,
    })

  /** Joins the selected point to the clicked one in one undo step, and moves the selection to the clicked one. */
  const linkByClick = (from: string, to: string) => {
    commit(addEdge(storeRef.current, from, to))
    pickNode(to)
    setSelectedEdge(null)
    setPending(null)
    setNotice(`${from} 와 ${to} 를 이었어요`)
  }

  const onNodePress = (id: string, mods: ClickMods = NO_MODS) => {
    const shortcut = clickShortcut({ kind: 'node', id }, mods)
    if (shortcut?.kind === 'link') return linkByClick(shortcut.from, shortcut.to)
    if (shortcut?.kind === 'blocked') {
      return setNotice(shortcut.why === 'exists' ? `${selected} 와 ${id} 는 이미 이어져 있어요. 지우려면 간선을 눌러 지워 주세요.` : lockedText)
    }
    if (!canEditNode(id)) return
    if (mode === 'select') {
      setMulti((list) => (list.includes(id) ? list.filter((x) => x !== id) : [...list, id]))
      return
    }
    pickNode(id)
    setSelectedEdge(null)
    panelRef.current?.scrollTo({ y: 0, animated: false })
    if (mode !== 'link') return
    if (pending && pending !== id) {
      const current = storeRef.current
      const had = hasEdgeBetween(current, pending, id)
      commit(had ? removeEdgeBetween(current, pending, id) : addEdge(current, pending, id))
      setNotice(`${pending} 와 ${id} 의 간선을 ${had ? '지웠어요' : '이었어요'}`)
    }
    setPending(pending === id ? null : id)
  }

  /**
   * Shift + click on the selected edge: a new point at the clicked spot on the line, splitting the edge, in one
   * undo step. lat/lng come from the map already moved onto the line; null means too close to an end point.
   */
  const splitByClick = (edgeId: string, lat: unknown, lng: unknown) => {
    if (lat === null || lng === null) return setNotice('끝점에 너무 가까워요. 간선 가운데 쪽을 Shift+클릭해 주세요.')
    if (typeof lat !== 'number' || typeof lng !== 'number') return setNotice('클릭한 위치를 알 수 없어 간선을 나누지 못했어요.')
    const result = splitEdgeAt(storeRef.current, edgeId, lat, lng)
    if (!result.id) return setNotice(SPLIT_REFUSED[result.refused ?? 'missing'])
    commit(result.store)
    pickNode(result.id)
    setSelectedEdge(null)
    setPending(null)
    setNotice(`${result.id} 를 만들고 간선을 둘로 나눴어요`)
  }

  const onEdgePress = (id: string, mods: ClickMods = NO_MODS, at: { lat?: unknown; lng?: unknown } = {}) => {
    const shortcut = clickShortcut({ kind: 'edge', id }, mods)
    if (shortcut?.kind === 'split') return splitByClick(shortcut.edgeId, at.lat, at.lng)
    if (shortcut?.kind === 'blocked') return setNotice(lockedText)
    if (mode === 'select' || !canEditEdgeId(id)) return
    setSelectedEdge(id)
    setSelected(null)
    setPending(null)
    panelRef.current?.scrollTo({ y: 0, animated: false })
  }

  const onMove = (msg: any) => {
    if (!Number.isFinite(msg.lat) || !Number.isFinite(msg.lng) || !canEditNode(msg.id)) return
    const current = storeRef.current
    if (msg.edgeId && canEditEdgeId(msg.edgeId)) {
      const result = moveNodeOntoEdge(current, msg.id, msg.edgeId, msg.lat, msg.lng)
      if (result.split) {
        commit(result.store)
        pickNode(msg.id)
        setSelectedEdge(null)
        setNotice(`${msg.id} 를 간선 위로 옮기고 간선을 둘로 나눴어요${result.pairsDropped ? '. 층 짝은 지웠으니 다시 지정해 주세요' : ''}`)
        return
      }
    }
    commit(moveNode(current, msg.id, msg.lat, msg.lng))
    pickNode(msg.id)
    setSelectedEdge(null)
    setNotice(`${msg.id} 의 위치를 옮겼어요`)
  }

  /** Same result as the delete button of the sheet. */
  const deleteNode = (id: string) => {
    commit(removeNode(storeRef.current, id))
    setNotice(`${id} 와 연결 간선을 지웠어요`)
    clearSelection()
    setMulti((list) => list.filter((x) => x !== id))
  }

  /** Same edit as dragging a point, without splitting edges. Presses in a row share one undo step. */
  const nudgeNode = (action: Extract<ShortcutAction, { kind: 'nudge' }>) => {
    const current = storeRef.current
    const node = findNode(current, action.id)
    if (!node) return
    const to = nudgeCoord(node.lat, node.lng, action.dx, action.dy, worldPxRef.current)
    const next = moveNode(current, action.id, to.lat, to.lng)
    if (next === current) return
    historyRef.current.recordNudge({ store: current, anchor: anchorRef.current }, action.id, Date.now())
    commit(next, false)
    setNotice(`${action.id} 를 방향키로 옮기는 중이에요`)
  }

  const keyHandlerRef = useRef<(event: any) => void>(() => {})
  keyHandlerRef.current = (event) => {
    const doc = (globalThis as any).document
    const action = resolveShortcut(event, {
      typing: isTypingElement(event.target) || isTypingElement(doc?.activeElement),
      otherScreen: !isShortcutTab(tab) || hasOpenDialog(doc),
      selected,
      multi,
      canUndo: historyRef.current.size() > 0,
      canRedo: historyRef.current.redoSize() > 0,
      canEdit: canEditNode,
    })
    if (!action || (action.kind === 'nudge' && !worldPxRef.current)) return
    event.preventDefault()
    event.stopPropagation()
    if (action.kind === 'undo') undo()
    else if (action.kind === 'redo') redo()
    else if (action.kind === 'delete') deleteNode(action.id)
    else nudgeNode(action)
  }

  // Modifier keys seen in key events. A map click that carries its own keys (domEvent) wins; this is the fallback.
  const modsRef = useRef<Required<ClickMods>>(NO_MODS)
  const clickMods = (msg: any): ClickMods =>
    typeof msg?.shift === 'boolean' ? { shift: msg.shift, ctrl: !!msg.ctrl, meta: !!msg.meta } : modsRef.current
  useEffect(() => {
    const w = globalThis as any
    if (Platform.OS !== 'web' || typeof w.addEventListener !== 'function') return
    const onModKey = (event: any) => {
      modsRef.current = modsAfterKey(modsRef.current, event)
    }
    // A key released in another window never reaches this one.
    const onBlur = () => {
      modsRef.current = NO_MODS
    }
    w.addEventListener('keydown', onModKey, true)
    w.addEventListener('keyup', onModKey, true)
    w.addEventListener('blur', onBlur)
    return () => {
      w.removeEventListener('keydown', onModKey, true)
      w.removeEventListener('keyup', onModKey, true)
      w.removeEventListener('blur', onBlur)
    }
  }, [])

  // Registered only while the map is up, in the capture phase so that the map does not also act on the key.
  useEffect(() => {
    const w = globalThis as any
    if (!ready || Platform.OS !== 'web' || typeof w.addEventListener !== 'function') return
    const onKey = (event: any) => keyHandlerRef.current(event)
    w.addEventListener('keydown', onKey, true)
    return () => w.removeEventListener('keydown', onKey, true)
  }, [ready])

  // The map's own arrow key panning is off only while the arrow keys move a point.
  const keysLocked = ready && isShortcutTab(tab) && !!findNode(store, keyboardTarget(selected, multi)) && canEditNode(keyboardTarget(selected, multi))
  const keysLockedRef = useRef(keysLocked)
  keysLockedRef.current = keysLocked
  useEffect(() => {
    if (ready) webViewRef.current?.injectJavaScript(`window.__surveyV3KeyLock && window.__surveyV3KeyLock(${keysLocked}); true;`)
  }, [ready, keysLocked])

  // Events from the map. The ref always sees the latest state.
  const handlerRef = useRef<(event: unknown) => void>(() => {})
  handlerRef.current = (event) => {
    const msg = parseMessage(event)
    if (!msg) return
    if (msg.type === 'scale') {
      if (Number.isFinite(msg.worldPx) && msg.worldPx > 0) worldPxRef.current = msg.worldPx
    } else if (msg.type === 'tap' && mode === 'add') onTap(msg.lat, msg.lng)
    else if (msg.type === 'node') onNodePress(msg.id, clickMods(msg))
    else if (msg.type === 'edge') onEdgePress(msg.id, clickMods(msg), msg)
    else if (msg.type === 'move' && mode === 'move') onMove(msg)
  }

  const lastRenderRef = useRef('')
  const handleReady = useCallback(() => {
    webViewRef.current?.injectJavaScript(SETUP_JS)
    webViewRef.current?.injectJavaScript(`window.__surveyV3KeyLock && window.__surveyV3KeyLock(${keysLockedRef.current}); true;`)
    lastRenderRef.current = ''
    setReady(true)
  }, [])

  // Redraw when something the map shows has changed. Typing a memo does not change the drawn state, so it does not redraw.
  useEffect(() => {
    if (!ready) return
    const t = legacyToggles
    const legacy = {
      nodes: [
        ...(t.plainNodes ? overlay.plainNodes.map((n) => ({ id: n.id, lat: n.lat, lng: n.lng, label: n.id })) : []),
        ...(t.namedNodes
          ? overlay.namedNodes
              .filter((n) => t.namedFloors[floorKeyOf(n.floor)] !== false)
              .map((n) => ({ id: n.id, lat: n.lat, lng: n.lng, label: `${n.id} (${floorKeyOf(n.floor)})` }))
          : []),
        ...(t.unconnectedEntrances ? overlay.unconnectedEntrances.map((n) => ({ id: n.id, lat: n.lat, lng: n.lng, label: n.id })) : []),
      ],
      lines: [
        ...(t.nodeEdges ? overlay.nodeEdges.map((l) => [...l, 0]) : []),
        ...(t.anchorEdges ? overlay.anchorEdges.flatMap((e) => (e.line ? [[...e.line, 1]] : [])) : []),
      ],
    }
    const drawn = buildRenderState(store, { index, filter, mode, selected, pending, selectedEdge, multi, labelMode, anchor: chain && mode === 'add' ? anchor : null, onlyFilter, changes: marks })
    const state = JSON.stringify({ legacy, ...drawn })
    if (state === lastRenderRef.current) return
    lastRenderRef.current = state
    webViewRef.current?.injectJavaScript(`window.__surveyV3Render && window.__surveyV3Render(${state}); true;`)
  }, [ready, store, index, filter, mode, selected, pending, selectedEdge, multi, labelMode, legacyToggles, overlay, chain, anchor, onlyFilter, marks])

  const selectedNode = findNode(store, selected)
  const edge = findEdge(store, selectedEdge)
  const activeMode = MODES.find((m) => m.key === mode)!
  const allIssues = useMemo(() => [...check.errors, ...check.warnings], [check])
  const nodeIssues = selectedNode ? allIssues.filter((i) => i.nodeId === selectedNode.id && !i.edgeId) : []
  const edgeIssues = edge ? allIssues.filter((i) => i.edgeId === edge.id) : []
  const nodeManual = selectedNode ? (report?.manual ?? []).filter((m) => m.nodeId === selectedNode.id) : []
  const boundaryOpen = nodeManual.some((m) => m.kind === 'boundary' && isManualItemOpen(m, selectedNode, report?.dismissed))

  const serverLine = serverStatusLine(
    serverSaveStateOf(serverState, fingerprint, { hasKey: !!devKey, blocked: blockedRef.current, saving: serverSaving }),
    serverState,
    check.errors.length,
    clockText,
  )

  const topBar = (
    <View style={styles.topBar}>
      <SaveBar
        state={saveStateOf(saveMeta, fingerprint)}
        lastSaveAt={saveMeta.lastSaveAt}
        errors={check.errors.length}
        warnings={check.warnings.length}
        onSave={saveNow}
        undoCount={undoCount}
        onUndo={undo}
        redoCount={redoCount}
        onRedo={redo}
        onShowCheck={() => setTab('check')}
        server={serverLine}
        onServerRetry={retryServer}
      />
      {offer ? (
        <View style={styles.offer}>
          <Text style={styles.offerText}>{offerText(offer)}</Text>
          <View style={styles.offerRow}>
            <Btn label={offer.kind === 'baseline' ? '서버에 저장' : '서버에서 불러오기'} kind="primary" onPress={acceptOffer} disabled={serverSaving} />
            <Btn label="닫기" onPress={() => setOffer(null)} />
          </View>
        </View>
      ) : null}
      <View style={styles.modeRow}>
        {MODES.map((m) => (
          <Btn
            key={m.key}
            label={m.label}
            kind={mode === m.key ? 'active' : 'default'}
            onPress={() => {
              setMode(m.key)
              setPending(null)
              if (m.key === 'select') setSelected(null)
            }}
            style={{ flex: 1 }}
          />
        ))}
      </View>
      <ChainToggle visible={mode === 'add'} on={chain} onToggle={() => setChain((v) => !v)} />
      <ContextBar index={index} context={context} used={used} closeSignal={selected ?? selectedEdge} onChange={setContext} />
    </View>
  )

  const editTab = (
    <>
      <Text style={ui.hint}>{activeMode.help}</Text>
      {mode === 'link' && pending ? <Text style={styles.pending}>{`${pending} 에서 시작, 이을 점을 누르세요`}</Text> : null}
      <FilterBar
        nodes={store.nodes}
        index={index}
        filter={filter}
        onChange={(next) => applyFilter(next, onlyFilter)}
        onlyFilter={onlyFilter}
        onToggleOnlyFilter={() => applyFilter(filter, !onlyFilter)}
        showChanges={showChanges}
        onToggleShowChanges={() => setShowChanges((v) => !v)}
        changeCounts={changeCounts}
      />
      <View style={styles.labelRow}>
        <Text style={ui.sectionHelp}>{'라벨 보기'}</Text>
        {LABEL_MODES.map((m) => (
          <Chip key={m.key} label={m.label} on={labelMode === m.key} onPress={() => setLabelMode(m.key)} />
        ))}
      </View>
      <Text style={ui.sectionHelp}>{`되돌리기와 다시(되돌리기 취소)는 ${UNDO_LIMIT}단계까지이고, 새로고침하면 기록이 사라져요. 되돌린 뒤 새로 고치면 다시 기록은 지워져요.`}</Text>
      <Legend index={index} />
      {__DEV__ ? (
        <Btn
          label="표시 확인용 예시 넣기(개발 전용)"
          onPress={() => {
            const next = addDevSample(storeRef.current, index)
            if (!next) return setNotice('예시를 만들 건물 정보가 없어요.')
            commit(next)
            const first = next.nodes[next.nodes.length - 7]
            focusOn(first.lat, first.lng)
            setNotice('예시 점을 넣었어요. 지금 데이터는 그대로예요. 아래 "예시 점 제거"로 뺄 수 있어요.')
          }}
        />
      ) : null}
      {sampleIds.length ? (
        <Btn
          label={`예시 점 제거 (${sampleIds.length}개)`}
          kind="danger"
          onPress={() => {
            commit(removeDevSample(storeRef.current, index))
            clearSelection()
            setMulti((list) => list.filter((id) => !sampleIds.includes(id)))
            setNotice('예시 점과 거기 이어진 간선을 지웠어요.')
          }}
        />
      ) : null}
    </>
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

  const panel = (
    <ScrollView ref={panelRef} style={wide ? styles.panelWide : styles.panelNarrow} contentContainerStyle={styles.panelBody} keyboardShouldPersistTaps="handled">
      <Text style={styles.summary}>{`경로망 조사 v3, 지점 ${store.nodes.length}, 간선 ${store.edges.length}`}</Text>
      <Text style={styles.summary}>{backupStatus}</Text>
      {Platform.OS === 'web' ? <Text style={ui.sectionHelp}>{NUDGE_HINT}</Text> : null}
      {Platform.OS === 'web' ? <Text style={ui.sectionHelp}>{CLICK_HINT}</Text> : null}
      {saveFailed ? <Text style={ui.error}>{'브라우저에 보관하지 못했어요(용량 또는 브라우저 제한). 지금 내용은 이 탭에만 있으니 백업 파일을 내려받아 주세요.'}</Text> : null}
      {notice ? <Text style={styles.notice}>{notice}</Text> : null}
      {mode === 'select' ? (
        <MultiPanel
          nodes={store.nodes}
          index={index}
          used={used}
          selected={multi}
          onSelect={selectMany}
          onApply={applyBulk}
          onExit={() => {
            setMode('add')
            selectMany([])
          }}
        />
      ) : null}
      {selectedNode && mode !== 'select' && canEditNode(selectedNode.id) ? (
        <NodeSheet
          key={`${selectedNode.id}:${undoTick}`}
          node={selectedNode}
          store={store}
          index={index}
          used={used}
          issues={nodeIssues}
          candidates={nodeManual.flatMap((m) => m.candidates)}
          contextLevels={contextLevels(context)}
          onChange={change}
          onMemo={(text, first) => commit(setNodeMemo(storeRef.current, selectedNode.id, text), first)}
          onSelect={focusNode}
          onDelete={() => deleteNode(selectedNode.id)}
          onClose={clearSelection}
        />
      ) : null}
      {selectedNode && boundaryOpen && mode !== 'select' && selectedNode.scope === 'outdoor' ? <Btn label="이 점은 외부 유지" onPress={() => keepOutdoor([selectedNode.id])} /> : null}
      {edge && mode !== 'select' && canEditEdgeId(edge.id) ? (
        <EdgeSheet
          key={`${edge.id}:${undoTick}`}
          edge={edge}
          a={findNode(store, edge.a)}
          b={findNode(store, edge.b)}
          index={index}
          issues={edgeIssues}
          onChange={change}
          onMemo={(text, first) => commit(setEdgeMemo(storeRef.current, edge.id, text), first)}
          onDelete={() => {
            commit(removeEdge(storeRef.current, edge.id))
            clearSelection()
            setNotice('간선을 지웠어요')
          }}
          onClose={clearSelection}
        />
      ) : null}
      <View style={styles.tabRow}>
        {tabs.map((t) => (
          <Btn key={t.key} label={t.label} kind={tab === t.key ? 'active' : 'default'} onPress={() => setTab(t.key)} style={styles.tab} />
        ))}
      </View>
      {tab === 'edit' ? editTab : null}
      {tab === 'check' ? (
        <CheckPanel check={check} tolerance={settings.entranceToleranceM} onTolerance={(entranceToleranceM) => setSettings({ entranceToleranceM })} onGo={goToIssue} />
      ) : null}
      {tab === 'convert' ? (
        <ConvertPanel
          store={store}
          index={index}
          report={report}
          multi={multi}
          selected={selected}
          onConvert={runConvert}
          onFocus={focusNode}
          onNotice={setNotice}
          onToggleMulti={(id) => {
            if (!multi.includes(id) && !canEditNode(id)) return setNotice(lockedText)
            setMulti((list) => (list.includes(id) ? list.filter((x) => x !== id) : [...list, id]))
          }}
          onSelectMany={selectMany}
          onKeepOutdoor={keepOutdoor}
          onResetKept={() => updateReport((r) => ({ ...r, dismissed: [] }))}
          onMakeIndoor={makeIndoor}
        />
      ) : null}
      {tab === 'backup' ? (
        <BackupPanel
          store={store}
          index={index}
          tolerance={settings.entranceToleranceM}
          backupStatus={backupStatus}
          onBackedUp={markBackedUp}
          onRestore={runRestore}
          onPulled={runGistPull}
          onNotice={setNotice}
        />
      ) : null}
      {tab === 'server' ? (
        <ServerPanel
          devKey={devKey}
          buildings={buildings}
          onLoadVersion={(id) => loadFromServer(id)}
          onRouteLines={showRouteLines}
          onNotice={setNotice}
          onUpload={(name) => pushToServer(storeRef.current, { name })}
          tick={serverTick}
        />
      ) : null}
      {tab === 'snapshots' ? (
        <SnapshotPanel store={store} tick={snapshotTick} onRestore={runSnapshotRestore} onChanged={() => setSnapshotTick((n) => n + 1)} onNotice={setNotice} />
      ) : null}
      {tab === 'legacy' ? <LegacyPanel overlay={overlay} toggles={legacyToggles} onChange={setLegacyToggles} /> : null}
    </ScrollView>
  )

  return (
    <View style={styles.container}>
      {topBar}
      <View style={[styles.main, wide && styles.mainWide]}>
        <View style={styles.mapArea}>
          {!data ? (
            <Text style={styles.loading} onPress={status === 'error' ? reload : undefined}>
              {status === 'error' ? '지도 정보를 불러오지 못했어요. 다시 시도' : '지도 정보를 불러오는 중이에요'}
            </Text>
          ) : (
            <NaverMapView key={data.version} ref={webViewRef} html={mapHTML} onReady={handleReady} onMessage={(event: unknown) => handlerRef.current(event)} />
          )}
        </View>
        {panel}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.white },
  topBar: { paddingHorizontal: 12, paddingVertical: 8, gap: 6, borderBottomWidth: 1, borderBottomColor: COLORS.border, backgroundColor: COLORS.white },
  main: { flex: 1, minHeight: 0 },
  mainWide: { flexDirection: 'row' },
  mapArea: { flex: 1, minHeight: 200 },
  loading: { padding: 20, fontFamily: FONTS.medium, color: COLORS.textSecondary },
  panelWide: { width: 420, flexGrow: 0, borderLeftWidth: 1, borderLeftColor: COLORS.border },
  panelNarrow: { maxHeight: '50%', borderTopWidth: 1, borderTopColor: COLORS.border },
  panelBody: { padding: 12, gap: 10 },
  summary: { fontFamily: FONTS.medium, fontSize: 12, color: COLORS.textSecondary },
  modeRow: { flexDirection: 'row', gap: 6 },
  labelRow: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  tabRow: { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
  tab: { minWidth: '30%' },
  pending: { fontFamily: FONTS.semibold, fontSize: 12.5, color: '#EA580C' },
  notice: { fontFamily: FONTS.medium, fontSize: 12.5, color: '#1D4ED8' },
  offer: { padding: 8, gap: 6, borderRadius: 8, backgroundColor: '#EFF6FF', borderWidth: 1, borderColor: '#BFDBFE' },
  offerText: { fontFamily: FONTS.medium, fontSize: 12.5, color: '#1E3A8A' },
  offerRow: { flexDirection: 'row', gap: 6 },
})
