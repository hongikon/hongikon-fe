import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from 'react'
import { ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native'
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
import { createSnapshot, storeFromSnapshot, type Snapshot } from '../utils/pathSurveyV3/snapshots'
import {
  addEdge,
  addNode,
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
  STORE_KEY_V3,
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
import { Btn, Check, confirmAction, ui } from './pathSurvey/ui'
import BackupPanel from './pathSurveyV3/BackupPanel'
import CheckPanel from './pathSurveyV3/CheckPanel'
import ContextBar from './pathSurveyV3/ContextBar'
import { Chip } from './pathSurveyV3/controls'
import ConvertPanel from './pathSurveyV3/ConvertPanel'
import { addDevSample, devSampleNodeIds, removeDevSample } from './pathSurveyV3/devSample'
import EdgeSheet from './pathSurveyV3/EdgeSheet'
import FilterBar from './pathSurveyV3/FilterBar'
import Legend from './pathSurveyV3/Legend'
import { SETUP_JS } from './pathSurveyV3/mapBridge'
import { buildRenderState, isNodeStrong, NO_FILTER, type LabelMode, type MapFilter, type MapMode } from './pathSurveyV3/mapState'
import MultiPanel from './pathSurveyV3/MultiPanel'
import NodeSheet from './pathSurveyV3/NodeSheet'
import SaveBar, { clockText } from './pathSurveyV3/SaveBar'
import SnapshotPanel from './pathSurveyV3/SnapshotPanel'

type Tab = 'edit' | 'check' | 'convert' | 'backup' | 'snapshots' | 'legacy'

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

const UNDO_LIMIT = 50

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
export default function DevPathSurveyV3Screen() {
  const webViewRef = useRef<NaverMapViewHandle>(null)
  const panelRef = useRef<ScrollView>(null)
  const { buildings, data, status, reload } = useMapData()
  const mapHTML = useMemo(() => buildMapHTML(buildings), [buildings])
  const { width } = useWindowDimensions()
  const wide = width >= 900

  const [boot] = useState(initialLoad)
  const [store, setStore] = useState<StoreV3>(boot.store)
  const storeRef = useRef(store)
  const historyRef = useRef<StoreV3[]>([])
  const blockedRef = useRef(boot.corrupt)
  const [saveFailed, setSaveFailed] = useState(false)
  const [saveMeta, setSaveMeta] = useState<SaveMeta>(() => (boot.corrupt ? EMPTY_META : loadSaveMeta()))
  const [context, setContext] = useState<WorkContext>(() => loadWorkContext())
  const [mode, setMode] = useState<MapMode>('add')
  const [tab, setTab] = useState<Tab>('edit')
  const [chain, setChain] = useState(true)
  const [selected, setSelected] = useState<string | null>(null)
  const [pending, setPending] = useState<string | null>(null)
  const [selectedEdge, setSelectedEdge] = useState<string | null>(null)
  const [multi, setMulti] = useState<string[]>([])
  // A select all button can mix buildings. Selections made point by point or per building never ask.
  const [multiFromAll, setMultiFromAll] = useState(false)
  const [undoCount, setUndoCount] = useState(0)
  const [snapshotTick, setSnapshotTick] = useState(0)
  const [backupRecord, setBackupRecord] = useState<BackupRecord | null>(() => loadBackupRecord())
  const [settings, setSettings] = useState<SurveySettings>(() => loadSurveySettings())
  const [filter, setFilter] = useState<MapFilter>(NO_FILTER)
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

  const commit = useCallback((next: StoreV3, record = true) => {
    if (next === storeRef.current) return
    if (record) historyRef.current = [...historyRef.current.slice(-(UNDO_LIMIT - 1)), storeRef.current]
    setUndoCount(historyRef.current.length)
    storeRef.current = next
    setStore(next)
    if (blockedRef.current) return
    setSaveFailed(!saveStoreV3(next))
  }, [])

  const change = useCallback((fn: (s: StoreV3) => StoreV3) => commit(fn(storeRef.current)), [commit])

  const clearSelection = () => {
    setSelected(null)
    setSelectedEdge(null)
    setPending(null)
  }

  const undo = () => {
    const prev = historyRef.current.pop()
    if (!prev) return setNotice('되돌릴 게 없어요')
    commit(prev, false)
    setUndoTick((n) => n + 1)
    setPending(null)
    if (selected && !findNode(prev, selected)) setSelected(null)
    if (selectedEdge && !findEdge(prev, selectedEdge)) setSelectedEdge(null)
    setNotice('되돌렸어요')
  }

  const focusOn = useCallback((lat: number, lng: number) => {
    webViewRef.current?.injectJavaScript(`window.__surveyV3Focus && window.__surveyV3Focus(${lat}, ${lng}); true;`)
  }, [])

  const focusNode = (id: string) => {
    const node = findNode(storeRef.current, id)
    if (!node) return
    if (!isNodeStrong(node, filter)) setFilter(NO_FILTER)
    setSelected(id)
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

  /** Replaces all data after asking, and keeps a save point of what was there. */
  const replaceAll = (next: StoreV3, snapshotName: string, summary: string): boolean => {
    const current = storeRef.current
    if (current.nodes.length || current.edges.length) {
      if (!confirmAction(`지금 v3 데이터(지점 ${current.nodes.length}, 간선 ${current.edges.length})를 덮어쓸까요? 저장 지점을 먼저 만들어요.\n\n${summary}`)) return false
      const { error } = createSnapshot(current, snapshotName, 'protected')
      setSnapshotTick((n) => n + 1)
      if (error && !confirmAction('저장 지점을 만들지 못했어요(개수 또는 용량). 그래도 덮어쓸까요?')) return false
    }
    commit(next)
    setUndoTick((n) => n + 1)
    clearSelection()
    selectMany([])
    setFilter(NO_FILTER)
    return true
  }

  const selectMany = (ids: string[], fromAll = false) => {
    setMulti(ids)
    setMultiFromAll(fromAll && ids.length > 0)
  }

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

  const runRestore = (next: StoreV3) => {
    if (!replaceAll(next, '불러오기 직전', `불러올 내용: 지점 ${next.nodes.length}, 간선 ${next.edges.length}`)) return
    const first = next.nodes[0]
    if (first) focusOn(first.lat, first.lng)
    setNotice(`불러왔어요. 지점 ${next.nodes.length}, 간선 ${next.edges.length}`)
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

  const saveNow = () => {
    const current = storeRef.current
    // Save button points roll over on their own, so pressing it often never runs into the limit.
    const { error } = createSnapshot(current, `저장 ${clockText(Date.now())}`, 'rolling')
    setSnapshotTick((n) => n + 1)
    if (error) return setNotice('저장 지점을 만들지 못했어요(저장 공간 부족). 저장 지점 탭에서 필요 없는 것을 지워 주세요. 지금 내용은 이 브라우저에 있어요.')
    const meta = { lastSaveAt: Date.now(), lastSaveFingerprint: storeFingerprint(current) }
    setSaveMeta(meta)
    saveSaveMeta(meta)
    setNotice('저장했어요.')
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
  const makeIndoor = (ids: string[]) => {
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
    const count = multi.length
    const mixed = multiFromAll ? selectionBuildings(storeRef.current.nodes, multi, index) : []
    if (mixed.length > 1 && !confirmAction(`여러 건물의 점이 섞여 있어요. 건물 ${mixed.length}곳, 점 ${count}개에 같은 값을 넣을까요?`)) return
    change((s) => applyBulkToNodes(s, multi, bulk))
    selectMany([])
    setNotice(`${count}개에 적용했어요. 되돌리기로 한 번에 취소할 수 있어요.`)
  }

  const onTap = (lat: number, lng: number) => {
    const current = storeRef.current
    const from = chain ? findNode(current, selected) : undefined
    const { store: next, id } = addNode(current, lat, lng, toNodeContext(context), from?.id)
    commit(next)
    setSelected(id)
    setSelectedEdge(null)
    const made = findNode(next, id)!
    const crossing = from && (from.scope === 'indoor') !== (made.scope === 'indoor') && (from.scope === 'indoor' ? from : made).type !== 'entrance'
    const notes = [`${id} 추가${from ? `, ${from.id} 와 이었어요` : ''}`]
    if (crossing) notes.push('외부 점과 내부 점은 출입구로만 이을 수 있어 이 간선은 점검에서 오류로 나와요')
    if (made.type === 'entrance') notes.push('아래에서 건물, 층, 이름을 고르세요. 비워 두면 점검 오류로 나와요')
    else if (made.scope === 'indoor' && !made.levels?.length) notes.push('건물과 층이 없어 점검 오류로 나와요')
    setNotice(notes.join('. '))
    panelRef.current?.scrollTo({ y: 0, animated: false })
  }

  const onNodePress = (id: string) => {
    if (mode === 'select') {
      setMulti((list) => (list.includes(id) ? list.filter((x) => x !== id) : [...list, id]))
      return
    }
    setSelected(id)
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

  const onEdgePress = (id: string) => {
    if (mode === 'select') return
    setSelectedEdge(id)
    setSelected(null)
    setPending(null)
    panelRef.current?.scrollTo({ y: 0, animated: false })
  }

  const onMove = (msg: any) => {
    if (!Number.isFinite(msg.lat) || !Number.isFinite(msg.lng)) return
    const current = storeRef.current
    if (msg.edgeId) {
      const result = moveNodeOntoEdge(current, msg.id, msg.edgeId, msg.lat, msg.lng)
      if (result.split) {
        commit(result.store)
        setSelected(msg.id)
        setSelectedEdge(null)
        setNotice(`${msg.id} 를 간선 위로 옮기고 간선을 둘로 나눴어요${result.pairsDropped ? '. 층 짝은 지웠으니 다시 지정해 주세요' : ''}`)
        return
      }
    }
    commit(moveNode(current, msg.id, msg.lat, msg.lng))
    setSelected(msg.id)
    setSelectedEdge(null)
    setNotice(`${msg.id} 의 위치를 옮겼어요`)
  }

  // Events from the map. The ref always sees the latest state.
  const handlerRef = useRef<(event: unknown) => void>(() => {})
  handlerRef.current = (event) => {
    const msg = parseMessage(event)
    if (!msg) return
    if (msg.type === 'tap' && mode === 'add') onTap(msg.lat, msg.lng)
    else if (msg.type === 'node') onNodePress(msg.id)
    else if (msg.type === 'edge') onEdgePress(msg.id)
    else if (msg.type === 'move' && mode === 'move') onMove(msg)
  }

  const lastRenderRef = useRef('')
  const handleReady = useCallback(() => {
    webViewRef.current?.injectJavaScript(SETUP_JS)
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
    const drawn = buildRenderState(store, { index, filter, mode, selected, pending, selectedEdge, multi, labelMode })
    const state = JSON.stringify({ legacy, ...drawn })
    if (state === lastRenderRef.current) return
    lastRenderRef.current = state
    webViewRef.current?.injectJavaScript(`window.__surveyV3Render && window.__surveyV3Render(${state}); true;`)
  }, [ready, store, index, filter, mode, selected, pending, selectedEdge, multi, labelMode, legacyToggles, overlay])

  const selectedNode = findNode(store, selected)
  const edge = findEdge(store, selectedEdge)
  const activeMode = MODES.find((m) => m.key === mode)!
  const allIssues = useMemo(() => [...check.errors, ...check.warnings], [check])
  const nodeIssues = selectedNode ? allIssues.filter((i) => i.nodeId === selectedNode.id && !i.edgeId) : []
  const edgeIssues = edge ? allIssues.filter((i) => i.edgeId === edge.id) : []
  const nodeManual = selectedNode ? (report?.manual ?? []).filter((m) => m.nodeId === selectedNode.id) : []
  const boundaryOpen = nodeManual.some((m) => m.kind === 'boundary' && isManualItemOpen(m, selectedNode, report?.dismissed))

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
        onShowCheck={() => setTab('check')}
      />
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
      <ContextBar index={index} context={context} used={used} closeSignal={selected ?? selectedEdge} onChange={setContext} />
    </View>
  )

  const editTab = (
    <>
      <Text style={ui.hint}>{activeMode.help}</Text>
      {mode === 'add' ? <Check label="이어 찍기 (직전에 고른 점과 간선으로 잇기)" checked={chain} onToggle={() => setChain((v) => !v)} /> : null}
      {mode === 'link' && pending ? <Text style={styles.pending}>{`${pending} 에서 시작, 이을 점을 누르세요`}</Text> : null}
      <FilterBar nodes={store.nodes} index={index} filter={filter} onChange={setFilter} />
      <View style={styles.labelRow}>
        <Text style={ui.sectionHelp}>{'라벨 보기'}</Text>
        {LABEL_MODES.map((m) => (
          <Chip key={m.key} label={m.label} on={labelMode === m.key} onPress={() => setLabelMode(m.key)} />
        ))}
      </View>
      <Text style={ui.sectionHelp}>{`되돌리기는 ${UNDO_LIMIT}단계까지이고, 새로고침하면 기록이 사라져요.`}</Text>
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
    { key: 'snapshots', label: '저장 지점' },
    { key: 'legacy', label: '기존 자료' },
  ]

  const panel = (
    <ScrollView ref={panelRef} style={wide ? styles.panelWide : styles.panelNarrow} contentContainerStyle={styles.panelBody} keyboardShouldPersistTaps="handled">
      <Text style={styles.summary}>{`경로망 조사 v3, 지점 ${store.nodes.length}, 간선 ${store.edges.length}`}</Text>
      <Text style={styles.summary}>{backupStatus}</Text>
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
      {selectedNode && mode !== 'select' ? (
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
          onDelete={() => {
            commit(removeNode(storeRef.current, selectedNode.id))
            setNotice(`${selectedNode.id} 와 연결 간선을 지웠어요`)
            clearSelection()
          }}
          onClose={clearSelection}
        />
      ) : null}
      {selectedNode && boundaryOpen && mode !== 'select' && selectedNode.scope === 'outdoor' ? <Btn label="이 점은 외부 유지" onPress={() => keepOutdoor([selectedNode.id])} /> : null}
      {edge && mode !== 'select' ? (
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
          onToggleMulti={(id) => setMulti((list) => (list.includes(id) ? list.filter((x) => x !== id) : [...list, id]))}
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
})
