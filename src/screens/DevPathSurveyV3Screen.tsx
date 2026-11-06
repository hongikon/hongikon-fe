import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native'
import NaverMapView from '../components/map/NaverMapView'
import type { NaverMapViewHandle } from '../components/map/NaverMapView'
import { COLORS } from '../constants/colors'
import { FONTS } from '../constants/typography'
import { useMapData } from '../lib/mapData'
import { buildMapHTML } from '../utils/mapHtml'
import {
  buildBuildingIndex,
  floorChipLabel,
  loadBuildingCache,
  saveBuildingCache,
  type RawBuilding,
} from '../utils/pathSurveyV3/buildings'
import { convertV2, loadConvertReport, saveConvertReport, type ConvertReport, type V2Source } from '../utils/pathSurveyV3/convertV2'
import { createSnapshot } from '../utils/pathSurveyV3/snapshots'
import {
  addEdge,
  addNode,
  findEdge,
  findNode,
  hasEdgeBetween,
  loadStoreV3,
  moveNode,
  moveNodeOntoEdge,
  OUTDOOR_CONTEXT,
  removeEdge,
  removeEdgeBetween,
  removeNode,
  saveStoreV3,
  setEdgeKind,
  STORE_KEY_V3,
  type StoreV3,
} from '../utils/pathSurveyV3/store'
import { buildLegacyOverlay, floorKeyOf } from './pathSurvey/legacyOverlay'
import LegacyPanel, { DEFAULT_LEGACY, type LegacyToggles } from './pathSurvey/LegacyPanel'
import { Btn, Check, confirmAction, Section, ui } from './pathSurvey/ui'
import ConvertPanel from './pathSurveyV3/ConvertPanel'
import { buildDevSample } from './pathSurveyV3/devSample'
import FilterBar from './pathSurveyV3/FilterBar'
import Legend from './pathSurveyV3/Legend'
import { SETUP_JS } from './pathSurveyV3/mapBridge'
import { buildRenderState, isNodeStrong, NO_FILTER, type MapFilter, type MapMode } from './pathSurveyV3/mapState'

type Tab = 'edit' | 'convert' | 'legacy'

const MODES: { key: MapMode; label: string; help: string }[] = [
  { key: 'add', label: '지점 찍기', help: '지도를 누르면 점이 생겨요. 이어 찍기를 켜면 직전 점과 간선으로 이어요.' },
  { key: 'link', label: '간선 잇기', help: '점 두 개를 차례로 누르면 간선이 생겨요. 이어서 누르면 계속 이어지고, 같은 점을 다시 누르면 끊겨요. 이미 있는 간선을 다시 이으면 지워져요.' },
  { key: 'move', label: '위치 옮기기', help: '점을 끌어서 옮겨요. 다른 간선 위에 놓으면 그 간선을 둘로 나눠요.' },
]

const TABS: { key: Tab; label: string }[] = [
  { key: 'edit', label: '편집' },
  { key: 'convert', label: 'v2 변환' },
  { key: 'legacy', label: '기존 자료' },
]

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

const SCOPE_TEXT = { outdoor: '외부', indoor: '내부' } as const
const TYPE_TEXT = { basic: '기본', stairs: '계단', elevator: '엘리베이터', entrance: '출입구' } as const

const timeText = (at: number) => {
  const d = new Date(at)
  const two = (n: number) => String(n).padStart(2, '0')
  return `${two(d.getHours())}:${two(d.getMinutes())}:${two(d.getSeconds())}`
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
 * Saved to localStorage on every change. The v2 screen and its storage are not touched.
 */
export default function DevPathSurveyV3Screen() {
  const webViewRef = useRef<NaverMapViewHandle>(null)
  const { buildings, data, status, reload } = useMapData()
  const mapHTML = useMemo(() => buildMapHTML(buildings), [buildings])
  const { width } = useWindowDimensions()
  const wide = width >= 900

  const [boot] = useState(initialLoad)
  const [store, setStore] = useState<StoreV3>(boot.store)
  const storeRef = useRef(store)
  const historyRef = useRef<StoreV3[]>([])
  const blockedRef = useRef(boot.corrupt)
  const [savedAt, setSavedAt] = useState<number | null>(null)
  const [saveFailed, setSaveFailed] = useState(false)
  const [mode, setMode] = useState<MapMode>('add')
  const [tab, setTab] = useState<Tab>('edit')
  const [chain, setChain] = useState(true)
  const [selected, setSelected] = useState<string | null>(null)
  const [pending, setPending] = useState<string | null>(null)
  const [selectedEdge, setSelectedEdge] = useState<string | null>(null)
  const [filter, setFilter] = useState<MapFilter>(NO_FILTER)
  const [legacyToggles, setLegacyToggles] = useState<LegacyToggles>(LEGACY_OFF)
  const [report, setReport] = useState<ConvertReport | null>(() => loadConvertReport())
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

  const overlay = useMemo(() => buildLegacyOverlay(buildings), [buildings])

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
    storeRef.current = next
    setStore(next)
    if (blockedRef.current) return
    const ok = saveStoreV3(next)
    setSaveFailed(!ok)
    if (ok) setSavedAt(Date.now())
  }, [])

  const clearSelection = () => {
    setSelected(null)
    setSelectedEdge(null)
    setPending(null)
  }

  const undo = () => {
    const prev = historyRef.current.pop()
    if (!prev) return setNotice('되돌릴 게 없어요')
    commit(prev, false)
    clearSelection()
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
  }

  /** Replaces all data after asking, and keeps a snapshot of what was there. */
  const replaceAll = (next: StoreV3, snapshotName: string, summary: string): boolean => {
    const current = storeRef.current
    if (current.nodes.length || current.edges.length) {
      if (!confirmAction(`지금 v3 데이터(지점 ${current.nodes.length}, 간선 ${current.edges.length})를 덮어쓸까요? 저장 지점을 먼저 만들어요.\n\n${summary}`)) return false
      const { error } = createSnapshot(current, snapshotName, true)
      if (error && !confirmAction('저장 지점을 만들지 못했어요(개수 또는 용량). 그래도 덮어쓸까요?')) return false
    }
    commit(next)
    clearSelection()
    setFilter(NO_FILTER)
    return true
  }

  const runConvert = (source: V2Source) => {
    if (index.list.length === 0) return setNotice('건물 목록이 아직 없어요. 온라인에서 한 번 연 뒤 다시 해 주세요.')
    const { store: next, report: result } = convertV2(source.modules, index)
    const summary = `가져올 내용: 지점 ${result.mergedNodes}, 간선 ${result.mergedEdges}`
    if (!replaceAll(next, 'v2 변환 직전', summary)) return
    setReport(result)
    saveConvertReport(result)
    const first = next.nodes[0]
    if (first) focusOn(first.lat, first.lng)
    setNotice(`v2 에서 가져왔어요. 지점 ${result.mergedNodes}, 간선 ${result.mergedEdges}. 수동 확인 ${result.manual.length}건`)
  }

  const loadSample = () => {
    const next = buildDevSample(index)
    if (!next) return setNotice('예시를 만들 건물 정보가 없어요.')
    if (!replaceAll(next, '예시 넣기 직전', '가져올 내용: 표시 확인용 예시')) return
    focusOn(next.nodes[3].lat, next.nodes[3].lng)
    setNotice('표시 확인용 예시를 넣었어요.')
  }

  const onTap = (lat: number, lng: number) => {
    const current = storeRef.current
    const from = chain ? findNode(current, selected) : undefined
    const { store: next, id } = addNode(current, lat, lng, OUTDOOR_CONTEXT, from?.id)
    commit(next)
    setSelected(id)
    setSelectedEdge(null)
    if (from && from.scope === 'indoor' && from.type !== 'entrance') {
      setNotice(`${id} 추가. 외부 점과 내부 점은 출입구로만 이을 수 있어 ${from.id} 와의 간선은 점검에서 오류로 나와요.`)
    } else {
      setNotice(`${id} 추가${from ? `, ${from.id} 와 이었어요` : ''}`)
    }
  }

  const onNodePress = (id: string) => {
    setSelected(id)
    setSelectedEdge(null)
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
    setSelectedEdge(id)
    setSelected(null)
    setPending(null)
    setTab('edit')
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
    const drawn = buildRenderState(store, { index, filter, mode, selected, pending, selectedEdge })
    const state = JSON.stringify({ legacy, ...drawn })
    if (state === lastRenderRef.current) return
    lastRenderRef.current = state
    webViewRef.current?.injectJavaScript(`window.__surveyV3Render && window.__surveyV3Render(${state}); true;`)
  }, [ready, store, index, filter, mode, selected, pending, selectedEdge, legacyToggles, overlay])

  const selectedNode = findNode(store, selected)
  const edge = findEdge(store, selectedEdge)
  const activeMode = MODES.find((m) => m.key === mode)!

  const levelText = (node: NonNullable<typeof selectedNode>) =>
    (node.levels ?? []).map((l) => `${index.byCode.get(l.building)?.name ?? l.building} ${floorChipLabel(l.floor)}`).join(', ')

  const editTab = (
    <>
      <View style={styles.modeRow}>
        {MODES.map((m) => (
          <Btn
            key={m.key}
            label={m.label}
            kind={mode === m.key ? 'active' : 'default'}
            onPress={() => {
              setMode(m.key)
              setPending(null)
            }}
            style={{ flex: 1 }}
          />
        ))}
      </View>
      <Text style={ui.hint}>{activeMode.help}</Text>
      {mode === 'add' ? <Check label="이어 찍기 (직전에 고른 점과 간선으로 잇기)" checked={chain} onToggle={() => setChain((v) => !v)} /> : null}
      {mode === 'link' && pending ? <Text style={styles.pending}>{`${pending} 에서 시작, 이을 점을 누르세요`}</Text> : null}

      <FilterBar nodes={store.nodes} index={index} filter={filter} onChange={setFilter} />

      {selectedNode ? (
        <Section title={`선택한 점: ${selectedNode.id}`}>
          <Text style={ui.sectionHelp}>{`${SCOPE_TEXT[selectedNode.scope]}, ${TYPE_TEXT[selectedNode.type]}, ${selectedNode.lat.toFixed(7)}, ${selectedNode.lng.toFixed(7)}`}</Text>
          {selectedNode.levels?.length ? <Text style={ui.hint}>{levelText(selectedNode)}</Text> : null}
          {selectedNode.entranceLabel ? <Text style={ui.hint}>{`라벨 ${selectedNode.entranceLabel}`}</Text> : null}
          {selectedNode.memo ? <Text style={ui.hint}>{`메모: ${selectedNode.memo}`}</Text> : null}
          {selectedNode.legacyId ? <Text style={ui.sectionHelp}>{`옛 id ${selectedNode.legacyId}`}</Text> : null}
          <Btn
            label="이 점과 연결 간선 지우기"
            kind="danger"
            onPress={() => {
              commit(removeNode(storeRef.current, selectedNode.id))
              setNotice(`${selectedNode.id} 와 연결 간선을 지웠어요`)
              clearSelection()
            }}
          />
        </Section>
      ) : null}

      {edge ? (
        <Section title={`선택한 간선: ${edge.id} (${edge.a}, ${edge.b})`}>
          <View style={styles.modeRow}>
            <Btn label="일반" kind={edge.kind === 'normal' ? 'active' : 'default'} onPress={() => commit(setEdgeKind(storeRef.current, edge.id, 'normal'))} style={styles.bigBtn} />
            <Btn label="계단" kind={edge.kind === 'stairs' ? 'active' : 'default'} onPress={() => commit(setEdgeKind(storeRef.current, edge.id, 'stairs'))} style={styles.bigBtn} />
          </View>
          {edge.memo ? <Text style={ui.hint}>{`메모: ${edge.memo}`}</Text> : null}
          <Btn
            label="이 간선 지우기"
            kind="danger"
            onPress={() => {
              commit(removeEdge(storeRef.current, edge.id))
              clearSelection()
              setNotice('간선을 지웠어요')
            }}
          />
        </Section>
      ) : null}

      <Btn label="되돌리기" onPress={undo} />
      <Text style={ui.sectionHelp}>{`되돌리기는 ${UNDO_LIMIT}단계까지이고, 새로고침하면 기록이 사라져요.`}</Text>
      <Legend index={index} />
      {__DEV__ ? <Btn label="표시 확인용 예시 넣기(개발 전용)" onPress={loadSample} /> : null}
    </>
  )

  const panel = (
    <ScrollView style={wide ? styles.panelWide : styles.panelNarrow} contentContainerStyle={styles.panelBody} keyboardShouldPersistTaps="handled">
      <Text style={styles.title}>{'경로망 조사 v3'}</Text>
      <Text style={styles.summary}>{`지점 ${store.nodes.length}, 간선 ${store.edges.length}${savedAt ? `, 저장됨 ${timeText(savedAt)}` : ''}`}</Text>
      {saveFailed ? <Text style={ui.error}>{'저장하지 못했어요(용량 또는 브라우저 제한). 지금 내용은 이 탭에만 있어요.'}</Text> : null}
      <View style={styles.tabRow}>
        {TABS.map((t) => (
          <Btn key={t.key} label={t.label} kind={tab === t.key ? 'active' : 'default'} onPress={() => setTab(t.key)} style={styles.tab} />
        ))}
      </View>
      {notice ? <Text style={styles.notice}>{notice}</Text> : null}
      {tab === 'edit' ? editTab : null}
      {tab === 'convert' ? <ConvertPanel store={store} index={index} report={report} onConvert={runConvert} onFocus={focusNode} onNotice={setNotice} /> : null}
      {tab === 'legacy' ? <LegacyPanel overlay={overlay} toggles={legacyToggles} onChange={setLegacyToggles} /> : null}
    </ScrollView>
  )

  return (
    <View style={[styles.container, wide && styles.containerWide]}>
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
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.white },
  containerWide: { flexDirection: 'row' },
  mapArea: { flex: 1, minHeight: 320 },
  loading: { padding: 20, fontFamily: FONTS.medium, color: COLORS.textSecondary },
  panelWide: { width: 400, flexGrow: 0, borderLeftWidth: 1, borderLeftColor: COLORS.border },
  panelNarrow: { maxHeight: '45%', borderTopWidth: 1, borderTopColor: COLORS.border },
  panelBody: { padding: 16, gap: 12 },
  title: { fontFamily: FONTS.bold, fontSize: 16, color: COLORS.textPrimary },
  summary: { fontFamily: FONTS.medium, fontSize: 12.5, color: COLORS.textSecondary, marginTop: -6 },
  modeRow: { flexDirection: 'row', gap: 6 },
  bigBtn: { flex: 1, minHeight: 52 },
  tabRow: { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
  tab: { minWidth: '30%' },
  pending: { fontFamily: FONTS.semibold, fontSize: 12.5, color: '#EA580C' },
  notice: { fontFamily: FONTS.medium, fontSize: 12.5, color: '#1D4ED8' },
})
