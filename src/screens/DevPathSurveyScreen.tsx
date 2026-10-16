import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ScrollView, StyleSheet, Text, TextInput, useWindowDimensions, View } from 'react-native'
import NaverMapView from '../components/map/NaverMapView'
import type { NaverMapViewHandle } from '../components/map/NaverMapView'
import { buildMapHTML } from '../utils/mapHtml'
import { useMapData } from '../lib/mapData'
import { PATH_WAYPOINTS } from '../constants/pathNodes'
import {
  addCustomColor,
  addEdge,
  addNode,
  createModule,
  darken,
  deleteModule,
  findModule,
  finishModule,
  hasModuleEdge,
  loadStore,
  moveNode,
  removeEdgeBetween,
  removeNode,
  reopenModule,
  saveStore,
  setEdgeMemo,
  setNodeMemo,
  updateModule,
  type SurveyModule,
  type SurveyStore,
} from '../utils/pathSurveyStore'
import { applyImport, describePlan, parseBundle, planImport } from '../utils/pathSurveySync'
import { COLORS } from '../constants/colors'
import { FONTS } from '../constants/typography'
import { buildLegacyOverlay, floorKeyOf } from './pathSurvey/legacyOverlay'
import EdgePanel from './pathSurvey/EdgePanel'
import ModulePanel from './pathSurvey/ModulePanel'
import ModuleProps from './pathSurvey/ModuleProps'
import TransferPanel from './pathSurvey/TransferPanel'
import LegacyPanel, { DEFAULT_LEGACY, type LegacyToggles } from './pathSurvey/LegacyPanel'
import { Btn, Check, confirmAction, Row, Section, shortId, ui } from './pathSurvey/ui'

type Mode = 'add' | 'link' | 'move'
type Tab = 'edit' | 'modules' | 'legacy' | 'transfer'

const MODES: { key: Mode; label: string; help: string }[] = [
  { key: 'add', label: '지점 찍기', help: '지도를 누르면 편집 중인 모듈에 지점이 생겨요. "이어 찍기"를 켜면 직전 지점과 간선까지 같이 만들어요.' },
  { key: 'link', label: '간선 잇기', help: '편집 중인 모듈의 지점 두 개를 차례로 누르면 간선이 생겨요. 이어서 누르면 계속 이어지고, 같은 지점을 다시 누르면 끊겨요. 이미 있는 간선을 또 이으면 지워져요.' },
  { key: 'move', label: '위치 옮기기', help: '편집 중인 모듈의 지점을 끌어서 옮겨요.' },
]

const TABS: { key: Tab; label: string }[] = [
  { key: 'edit', label: '편집' },
  { key: 'modules', label: '모듈' },
  { key: 'legacy', label: '기존 자료' },
  { key: 'transfer', label: '내보내기' },
]

/** 웹뷰/iframe 어느 쪽에서 왔든 같은 모양으로 푼다. 이 화면이 보낸 메시지만 통과시킨다. */
function parseMessage(event: unknown): any | null {
  const e = event as any
  const raw = e?.nativeEvent?.data ?? e?.data ?? e
  try {
    const msg = typeof raw === 'string' ? JSON.parse(raw) : raw
    return msg && msg.src === 'survey' ? msg : null
  } catch {
    return null
  }
}

/**
 * 지도 페이지 전역 `map` 위에 조사용 클릭 이벤트와 그리기 함수를 심는다(지도 페이지 코드는 건드리지 않는다).
 * 그리기 상태 s: legacy(보기 전용 회색 지점·선), modules(모듈별 색·점선·흐리게), selected/pending, mode.
 * 지점·선을 누른 직후의 지도 클릭은 무시한다(겹친 이벤트로 지점이 하나 더 찍히지 않게).
 */
const SETUP_JS = `(function(){
  if (typeof map === 'undefined' || !window.naver) return;
  map.setOptions({ minZoom: 10, maxBounds: null });
  function post(m){
    m.src = 'survey';
    var s = JSON.stringify(m);
    if (window.ReactNativeWebView) window.ReactNativeWebView.postMessage(s);
    else if (window.parent && window.parent !== window) window.parent.postMessage(s, '*');
  }
  function esc(t){ return String(t).replace(/[&<>]/g, function(c){ return {'&':'&amp;','<':'&lt;','>':'&gt;'}[c]; }); }
  function ll(a, b){ return new naver.maps.LatLng(a, b); }
  var lastHit = 0;
  function hit(){ lastHit = Date.now(); }
  if (window.__surveyClick) naver.maps.Event.removeListener(window.__surveyClick);
  window.__surveyClick = naver.maps.Event.addListener(map, 'click', function(e){
    if (Date.now() - lastHit < 350) return;
    post({ type: 'tap', lat: e.coord.lat(), lng: e.coord.lng() });
  });
  window.__surveyObjs = [];
  function label(text, color){
    return '<span style="font:700 11px sans-serif;color:' + color + ';background:rgba(255,255,255,.92);padding:1px 4px;border-radius:4px">' + esc(text) + '</span>';
  }
  function dot(size, fill, ring, ringWidth, text, textColor){
    return '<div style="transform:translate(-' + size / 2 + 'px,-' + size / 2 + 'px);display:flex;align-items:center;gap:4px;white-space:nowrap">'
      + '<span style="box-sizing:border-box;flex:none;width:' + size + 'px;height:' + size + 'px;border-radius:50%;background:' + fill
      + ';border:' + ringWidth + 'px solid ' + ring + ';box-shadow:0 0 3px rgba(0,0,0,.45)"></span>' + (text ? label(text, textColor) : '') + '</div>';
  }
  window.__surveyRender = function(s){
    window.__surveyObjs.forEach(function(o){ o.setMap(null); });
    window.__surveyObjs = [];
    var objs = window.__surveyObjs;
    s.legacy.lines.forEach(function(l){
      objs.push(new naver.maps.Polyline({ map: map, zIndex: 200, clickable: false, strokeColor: '#94A3B8', strokeWeight: 3, strokeOpacity: 0.7,
        strokeStyle: l[4] ? 'shortdash' : 'solid', path: [ll(l[0], l[1]), ll(l[2], l[3])] }));
    });
    s.legacy.nodes.forEach(function(n){
      objs.push(new naver.maps.Marker({ position: ll(n.lat, n.lng), map: map, zIndex: 400, clickable: false, title: n.id,
        icon: { content: dot(9, '#94A3B8', '#fff', 2, n.label, '#475569') } }));
    });
    s.modules.forEach(function(m){
      var op = m.dim ? 0.3 : 0.9;
      m.edges.forEach(function(e){
        var path = [ll(e.p[0], e.p[1]), ll(e.p[2], e.p[3])];
        var sel = m.active && e.id === s.selectedEdge;
        objs.push(new naver.maps.Polyline({ map: map, zIndex: m.active ? 320 : 300, clickable: false, strokeColor: m.color,
          strokeWeight: sel ? 8 : (m.active ? 5 : 4), strokeOpacity: op, strokeStyle: m.dashed ? 'shortdash' : 'solid', strokeLineCap: 'round', path: path }));
        if (!m.active) return;
        var hitLine = new naver.maps.Polyline({ map: map, zIndex: 330, clickable: true, strokeColor: m.color, strokeWeight: 22, strokeOpacity: 0.01, path: path });
        naver.maps.Event.addListener(hitLine, 'click', function(){ hit(); post({ type: 'edge', id: e.id }); });
        objs.push(hitLine);
        if (e.memo) {
          var mid = new naver.maps.Marker({ position: ll((e.p[0] + e.p[2]) / 2, (e.p[1] + e.p[3]) / 2), map: map, zIndex: 650, title: e.id,
            icon: { content: '<div style="transform:translate(-9px,-9px);width:18px;height:18px;border-radius:50%;background:#fff;border:2px solid ' + m.color
              + ';font:700 11px sans-serif;color:' + m.color + ';display:flex;align-items:center;justify-content:center">\\u270E</div>' } });
          naver.maps.Event.addListener(mid, 'click', function(){ hit(); post({ type: 'edge', id: e.id }); });
          objs.push(mid);
        }
      });
      m.nodes.forEach(function(n){
        var ring = '#fff', ringWidth = 2;
        if (m.active && n.id === s.selected) { ring = '#111827'; ringWidth = 3; }
        else if (m.active && n.id === s.pending) { ring = '#F97316'; ringWidth = 3; }
        var size = m.active ? 18 : 11;
        var showLabel = m.active && (n.label || n.id === s.selected || n.id === s.pending);
        var text = showLabel ? n.short + (n.memo ? ' \\u270E' : '') : '';
        var mk = new naver.maps.Marker({
          position: ll(n.lat, n.lng), map: map, zIndex: m.active ? 700 : 500, title: n.id, clickable: m.active,
          draggable: m.active && s.mode === 'move',
          icon: { content: '<div style="opacity:' + (m.dim ? 0.4 : 1) + '">' + dot(size, m.dark, ring, ringWidth, text, m.dark) + '</div>' }
        });
        if (m.active) {
          naver.maps.Event.addListener(mk, 'click', function(){ hit(); post({ type: 'node', id: n.id }); });
          naver.maps.Event.addListener(mk, 'dragend', function(){
            hit();
            var p = mk.getPosition();
            post({ type: 'move', id: n.id, lat: p.lat(), lng: p.lng() });
          });
        }
        objs.push(mk);
      });
    });
  };
})(); true;`

const initialLoad = () => loadStore(PATH_WAYPOINTS)

/**
 * 개발용 `/dev/path-survey` — 현장에서 지도를 보며 경로망을 '모듈'(한 층위의 지점·간선 묶음) 단위로 찍는다.
 * 기존 경로망(pathNodes.ts)은 보기 전용 회색 오버레이다. 편집 중인 모듈만 진하게, 나머지는 흐리게 그린다.
 * 조사 내용은 웹 localStorage(hongikon.pathSurvey.v2)에 자동 저장된다. 예전 v1 초안은 처음 열 때 '미분류' 모듈로 옮겨진다.
 */
export default function DevPathSurveyScreen() {
  const webViewRef = useRef<NaverMapViewHandle>(null)
  const { buildings, data, status, reload } = useMapData()
  const mapHTML = useMemo(() => buildMapHTML(buildings), [buildings])
  const { width } = useWindowDimensions()
  const wide = width >= 900

  const [boot] = useState(initialLoad)
  const [store, setStore] = useState<SurveyStore>(boot.store)
  const storeRef = useRef(store)
  const historyRef = useRef<SurveyStore[]>([])
  const [mode, setMode] = useState<Mode>('add')
  const [tab, setTab] = useState<Tab>('edit')
  const [chain, setChain] = useState(true)
  const [selected, setSelected] = useState<string | null>(null)
  const [pending, setPending] = useState<string | null>(null)
  const [selectedEdge, setSelectedEdge] = useState<string | null>(null)
  const [hidden, setHidden] = useState<Record<string, boolean>>({})
  const [detailId, setDetailId] = useState<string | null>(() => boot.store.activeModuleId ?? boot.store.modules[0]?.id ?? null)
  const [legacyToggles, setLegacyToggles] = useState<LegacyToggles>(DEFAULT_LEGACY)
  const [ready, setReady] = useState(false)
  const [notice, setNotice] = useState(() => {
    if (boot.corrupt) return '저장된 조사 내용(v2)을 읽지 못했어요. 덮어쓰지 않도록 저장을 멈췄어요 — 내보내기 전에 개발자 도구로 값을 확인해 주세요.'
    const r = boot.migrated
    if (!r) return ''
    return `예전 초안(v1)을 '미분류' 모듈로 옮겼어요 · 지점 ${r.nodes}/${r.v1Nodes} · 간선 ${r.edges}/${r.v1Edges} · 메모 ${r.memos}/${r.v1Memos}${
      r.refNodes ? ` · 기존 지점 복사 ${r.refNodes}` : ''
    }${r.renamed.length ? ` · id 바꿈 ${r.renamed.join(', ')}` : ''}`
  })
  /** v2 를 읽지 못했으면 이 탭에서는 저장하지 않는다(사람이 확인하기 전에 덮어쓰지 않게). */
  const saveBlocked = boot.corrupt

  useEffect(() => {
    if (typeof document === 'undefined') return
    const meta = document.createElement('meta')
    meta.name = 'robots'
    meta.content = 'noindex, nofollow'
    document.head.appendChild(meta)
    document.title = '경로망 조사 | 홍익온'
    return () => {
      meta.remove()
    }
  }, [])

  const overlay = useMemo(() => buildLegacyOverlay(buildings), [buildings])
  const active = findModule(store, store.activeModuleId)

  /** 되돌리기 기록을 남기며 저장소를 바꾼다. */
  const commit = useCallback(
    (next: SurveyStore, record = true) => {
      if (next === storeRef.current) return
      if (record) historyRef.current = [...historyRef.current.slice(-49), storeRef.current]
      storeRef.current = next
      setStore(next)
      if (!saveBlocked) saveStore(next)
    },
    [saveBlocked],
  )

  /** 편집 중인 모듈만 바꾼다. 없으면 안내만 한다. */
  const editActive = (fn: (m: SurveyModule) => SurveyModule, record = true): boolean => {
    const s = storeRef.current
    if (!findModule(s, s.activeModuleId)) {
      setNotice('편집 중인 모듈이 없어요. "모듈" 탭에서 새 모듈을 시작하거나 이어서 편집할 모듈을 고르세요.')
      return false
    }
    commit(updateModule(s, s.activeModuleId!, fn), record)
    return true
  }

  const undo = () => {
    const prev = historyRef.current.pop()
    if (!prev) return setNotice('되돌릴 게 없어요')
    commit(prev, false)
    setNotice('')
  }

  const onTap = (lat: number, lng: number) => {
    let newId = ''
    const linkFrom = chain ? selected : null
    const ok = editActive((m) => {
      const r = addNode(m, lat, lng, linkFrom)
      newId = r.id
      return r.module
    })
    if (!ok) return
    setSelected(newId)
    setSelectedEdge(null)
    setNotice(`${shortId(newId)} 추가${linkFrom ? ` · ${shortId(linkFrom)}와 이었어요` : ''}`)
  }

  const toggleEdge = (a: string, b: string) => {
    const m = findModule(storeRef.current, storeRef.current.activeModuleId)
    if (!m) return
    if (hasModuleEdge(m, a, b)) {
      editActive((mm) => removeEdgeBetween(mm, a, b))
      return setNotice(`${shortId(a)} — ${shortId(b)} 간선을 지웠어요`)
    }
    editActive((mm) => addEdge(mm, a, b))
    setNotice(`${shortId(a)} — ${shortId(b)} 간선 추가`)
  }

  const onNodePress = (id: string) => {
    setSelected(id)
    setSelectedEdge(null)
    if (mode !== 'link') return
    if (!pending) return setPending(id)
    if (pending === id) return setPending(null)
    toggleEdge(pending, id)
    setPending(id)
  }

  const deleteSelected = () => {
    if (!selected) return
    editActive((m) => removeNode(m, selected))
    setNotice(`${shortId(selected)} 와 연결된 간선을 지웠어요`)
    setSelected(null)
    setPending(null)
  }

  const onEdgePress = (id: string) => {
    setSelectedEdge(id)
    setSelected(null)
    setPending(null)
    setTab('edit')
  }

  const deleteEdge = (id: string) => {
    editActive((m) => ({ ...m, edges: m.edges.filter((e) => e.id !== id) }))
    setSelectedEdge(null)
    setNotice('간선을 지웠어요')
  }

  const clearSelection = () => {
    setSelected(null)
    setSelectedEdge(null)
    setPending(null)
  }

  const startModule = () => {
    const { store: next, module } = createModule(storeRef.current)
    commit(next)
    clearSelection()
    setDetailId(module.id)
    setTab('edit')
    setNotice(`'${module.name}' 를 시작했어요. 지도를 눌러 지점을 찍으세요. 이름·장소는 "모듈" 탭에서 정해요.`)
  }

  /** 모듈 마치기: 이어 찍기를 끊고(선택 해제) done 으로. 장소가 없으면 바꾸지 않고 이유를 알린다. */
  const finish = (id: string) => {
    const { store: next, problems } = finishModule(storeRef.current, id)
    if (problems.length) {
      setDetailId(id)
      setTab('modules')
      return setNotice(`아직 마칠 수 없어요 · ${problems.join(' · ')}`)
    }
    commit(next)
    clearSelection()
    setNotice(`'${findModule(next, id)?.name}' 를 마쳤어요. 고치려면 "다시 편집"을 누르세요.`)
  }

  const reopen = (id: string) => {
    commit(reopenModule(storeRef.current, id))
    setHidden((h) => ({ ...h, [id]: false }))
    clearSelection()
    setDetailId(id)
    setNotice(`'${findModule(storeRef.current, id)?.name}' 를 편집해요`)
  }

  const rename = (id: string, name: string) => commit(updateModule(storeRef.current, id, (m) => ({ ...m, name })), false)

  const removeModule = (id: string) => {
    const m = findModule(storeRef.current, id)
    if (!m) return
    if (!confirmAction(`'${m.name}' 모듈을 지울까요? 지점 ${m.nodes.length} · 간선 ${m.edges.length} 이 함께 지워져요. (되돌리기로 살릴 수 있어요)`)) return
    const wasActive = id === storeRef.current.activeModuleId
    commit(deleteModule(storeRef.current, id))
    if (wasActive) clearSelection()
    setDetailId(storeRef.current.modules[0]?.id ?? null)
    setNotice(`'${m.name}' 를 지웠어요`)
  }

  /** 가져오기: 새 모듈은 추가, 같은 id 가 더 최신이면 덮어쓰기 전에 묻는다(취소하면 새 모듈만). */
  const runImport = (text: string) => {
    let incoming
    try {
      incoming = parseBundle(text)
    } catch (e) {
      return setNotice(`가져오지 못했어요 · ${(e as Error).message}`)
    }
    const plan = planImport(storeRef.current, incoming)
    if (plan.added.length === 0 && plan.newer.length === 0) return setNotice(`가져올 새 내용이 없어요 · ${describePlan(plan)}`)
    const overwrite =
      plan.newer.length > 0 &&
      confirmAction(`${describePlan(plan)}

더 최신인 모듈로 이 기기의 같은 모듈을 덮어쓸까요? 취소하면 새 모듈만 추가해요.`)
    const next = applyImport(storeRef.current, plan, overwrite)
    if (!findModule(next, next.activeModuleId)) clearSelection()
    commit(next)
    setNotice(`가져왔어요 · 새 모듈 ${plan.added.length}${plan.newer.length ? ` · 덮어쓴 모듈 ${overwrite ? plan.newer.length : 0}` : ''}`)
  }

  // 지도에서 온 이벤트. 최신 상태를 보게 매번 갱신한 함수를 ref 로 부른다.
  const handlerRef = useRef<(event: unknown) => void>(() => {})
  handlerRef.current = (event) => {
    const msg = parseMessage(event)
    if (!msg) return
    if (msg.type === 'tap' && mode === 'add') onTap(msg.lat, msg.lng)
    else if (msg.type === 'node') onNodePress(msg.id)
    else if (msg.type === 'edge') onEdgePress(msg.id)
    else if (msg.type === 'move') editActive((m) => moveNode(m, msg.id, msg.lat, msg.lng))
  }

  const handleReady = useCallback(() => {
    webViewRef.current?.injectJavaScript(SETUP_JS)
    setReady(true)
  }, [])

  // 상태가 바뀔 때마다 지도에 다시 그린다.
  useEffect(() => {
    if (!ready) return
    const t = legacyToggles
    const legacyNodes = [
      ...(t.plainNodes ? overlay.plainNodes.map((n) => ({ id: n.id, lat: n.lat, lng: n.lng, label: n.id })) : []),
      ...(t.namedNodes
        ? overlay.namedNodes
            .filter((n) => t.namedFloors[floorKeyOf(n.floor)] !== false)
            .map((n) => ({ id: n.id, lat: n.lat, lng: n.lng, label: `${n.id} (${floorKeyOf(n.floor)}, id 기반 추정)` }))
        : []),
    ]
    const legacyLines = [
      ...(t.nodeEdges ? overlay.nodeEdges.map((l) => [...l, 0]) : []),
      ...(t.anchorEdges ? overlay.anchorEdges.flatMap((e) => (e.line ? [[...e.line, 1]] : [])) : []),
    ]
    const modules = store.modules
      .filter((m) => !hidden[m.id] || m.id === store.activeModuleId)
      .map((m) => {
        const isActive = m.id === store.activeModuleId
        const byId = new Map(m.nodes.map((n) => [n.id, n]))
        return {
          id: m.id,
          color: m.color,
          dark: darken(m.color),
          dashed: m.status === 'draft',
          active: isActive,
          dim: !isActive,
          nodes: m.nodes.map((n) => ({ id: n.id, lat: n.lat, lng: n.lng, short: n.ref ? `${shortId(n.id)}(기존)` : shortId(n.id), memo: !!n.memo, label: isActive })),
          edges: m.edges.flatMap((e) => {
            const A = byId.get(e.a)
            const B = byId.get(e.b)
            return A && B ? [{ id: e.id, p: [A.lat, A.lng, B.lat, B.lng], memo: !!e.memo }] : []
          }),
        }
      })
      // 편집 중인 모듈을 맨 나중에 그려 위로 올린다.
      .sort((x, y) => Number(x.active) - Number(y.active))
    const state = { legacy: { nodes: legacyNodes, lines: legacyLines }, modules, selected, pending, selectedEdge, mode }
    webViewRef.current?.injectJavaScript(`window.__surveyRender && window.__surveyRender(${JSON.stringify(state)}); true;`)
  }, [ready, store, selected, pending, selectedEdge, mode, hidden, legacyToggles, overlay])

  const selectedNode = active && selected ? active.nodes.find((n) => n.id === selected) : undefined
  const activeMode = MODES.find((m) => m.key === mode)!

  const editTab = (
    <>
      {!active ? <Text style={ui.warn}>편집 중인 모듈이 없어요. 아래 "새 모듈 시작"을 누르거나 "모듈" 탭에서 이어서 편집할 모듈을 고르세요.</Text> : null}
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
      {mode === 'add' ? <Check label="이어 찍기 (직전에 고른 지점과 간선으로 잇기)" checked={chain} onToggle={() => setChain((v) => !v)} /> : null}
      {mode === 'link' && pending ? <Text style={styles.pending}>{`${shortId(pending)} 에서 시작 — 이을 지점을 누르세요`}</Text> : null}

      <Section title={selectedNode ? `선택 지점: ${shortId(selectedNode.id)}` : '선택한 지점 없음'}>
        {selectedNode ? (
          <>
            <Text style={ui.sectionHelp}>{`${selectedNode.id} · ${selectedNode.lat.toFixed(7)}, ${selectedNode.lng.toFixed(7)}${
              selectedNode.ref ? ` · 기존 지점 ${selectedNode.ref} 복사본(v1 변환)` : ''
            }`}</Text>
            <TextInput
              key={selectedNode.id}
              defaultValue={selectedNode.memo ?? ''}
              onChangeText={(text) => editActive((m) => setNodeMemo(m, selectedNode.id, text), false)}
              placeholder="메모 (예: 계단 5칸, 휠체어 불가, 공사 중)"
              multiline
              style={ui.memoInput}
            />
            <Btn label="이 지점과 연결 간선 지우기" kind="danger" onPress={deleteSelected} />
          </>
        ) : (
          <Text style={ui.empty}>편집 중인 모듈의 점을 누르면 메모를 달 수 있어요</Text>
        )}
      </Section>
      <Row>
        <Btn label="되돌리기" onPress={undo} />
        {active ? <Btn label="모듈 마치기" onPress={() => finish(active.id)} /> : null}
        <Btn label="새 모듈 시작" onPress={startModule} />
      </Row>
      {active ? (
        <EdgePanel
          module={active}
          selectedEdge={selectedEdge}
          onSelect={(id) => {
            setSelectedEdge(id)
            if (id) setSelected(null)
          }}
          onMemo={(id, text) => editActive((m) => setEdgeMemo(m, id, text), false)}
          onDelete={deleteEdge}
        />
      ) : null}
    </>
  )

  const detailModule = findModule(store, detailId)
  const modulesTab = (
    <ModulePanel
      store={store}
      hidden={hidden}
      detailId={detailId}
      onDetail={setDetailId}
      onToggleHidden={(id) => setHidden((h) => ({ ...h, [id]: !h[id] }))}
      onStart={startModule}
      onFinish={finish}
      onReopen={reopen}
      onRename={rename}
      onDelete={removeModule}
    >
      {detailModule ? (
        <ModuleProps
          key={detailModule.id}
          module={detailModule}
          customColors={store.customColors}
          buildings={buildings}
          onChange={(fn, record = true) => commit(updateModule(storeRef.current, detailModule.id, fn), record)}
          onAddColor={(color) => commit(addCustomColor(storeRef.current, color), false)}
          onNotice={setNotice}
        />
      ) : null}
    </ModulePanel>
  )

  const panel = (
    <ScrollView style={wide ? styles.panelWide : styles.panelNarrow} contentContainerStyle={styles.panelBody} keyboardShouldPersistTaps="handled">
      <Text style={styles.title}>경로망 조사 (/dev/path-survey)</Text>
      <Text style={styles.summary}>
        {active ? `편집 중: ${active.name} · 지점 ${active.nodes.length} · 간선 ${active.edges.length}` : `편집 중인 모듈 없음 · 모듈 ${store.modules.length}`}
      </Text>
      <View style={styles.tabRow}>
        {TABS.map((t) => (
          <Btn key={t.key} label={t.label} kind={tab === t.key ? 'active' : 'default'} onPress={() => setTab(t.key)} style={{ flex: 1 }} />
        ))}
      </View>
      {notice ? <Text style={styles.notice}>{notice}</Text> : null}
      {tab === 'edit' ? editTab : null}
      {tab === 'modules' ? modulesTab : null}
      {tab === 'legacy' ? <LegacyPanel overlay={overlay} toggles={legacyToggles} onChange={setLegacyToggles} /> : null}
      {tab === 'transfer' ? <TransferPanel store={store} initialModuleId={detailId ?? store.activeModuleId} onImport={runImport} onNotice={setNotice} /> : null}
    </ScrollView>
  )

  return (
    <View style={[styles.container, wide && styles.containerWide]}>
      <View style={styles.mapArea}>
        {!data ? (
          <Text style={styles.loading} onPress={status === 'error' ? reload : undefined}>
            {status === 'error' ? '지도 정보를 불러오지 못했어요 · 다시 시도' : '지도 정보를 불러오는 중이에요'}
          </Text>
        ) : (
          <NaverMapView
            key={data.version}
            ref={webViewRef}
            html={mapHTML}
            onReady={handleReady}
            onMessage={(event: unknown) => handlerRef.current(event)}
          />
        )}
      </View>
      {data ? panel : null}
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
  tabRow: { flexDirection: 'row', gap: 4, flexWrap: 'wrap' },
  pending: { fontFamily: FONTS.semibold, fontSize: 12.5, color: '#EA580C' },
  notice: { fontFamily: FONTS.medium, fontSize: 12.5, color: '#1D4ED8' },
  })
