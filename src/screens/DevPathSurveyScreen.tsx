import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Pressable, ScrollView, Share, StyleSheet, Text, TextInput, useWindowDimensions, View } from 'react-native'
import NaverMapView from '../components/map/NaverMapView'
import type { NaverMapViewHandle } from '../components/map/NaverMapView'
import { buildMapHTML } from '../utils/mapHtml'
import { useMapData } from '../lib/mapData'
import { PATH_EDGES, PATH_WAYPOINTS } from '../constants/pathNodes'
import {
  edgeKey,
  formatExport,
  hasEdge,
  loadDraft,
  nextNodeId,
  round7,
  saveDraft,
  type SurveyDraft,
} from '../utils/pathSurvey'
import type { PathEdge } from '../types'
import { COLORS } from '../constants/colors'
import { FONTS } from '../constants/typography'

type Mode = 'add' | 'link' | 'move'

const MODES: { key: Mode; label: string; help: string }[] = [
  { key: 'add', label: '지점 찍기', help: '지도를 누르면 지점이 생겨요. "이어 찍기"를 켜면 직전 지점과 간선까지 같이 만들어요.' },
  { key: 'link', label: '간선 잇기', help: '지점 두 개를 차례로 누르면 간선이 생겨요. 이어서 누르면 계속 이어지고, 같은 지점을 다시 누르면 끊겨요. 이미 있는 새 간선을 또 이으면 지워져요.' },
  { key: 'move', label: '위치 옮기기', help: '새로 찍은 파란 지점을 끌어서 옮겨요. 기존 지점은 옮길 수 없어요.' },
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

/** 지도 페이지 전역 `map` 위에 조사용 클릭 이벤트와 그리기 함수를 심는다(지도 페이지 코드는 건드리지 않는다). */
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
  if (window.__surveyClick) naver.maps.Event.removeListener(window.__surveyClick);
  window.__surveyClick = naver.maps.Event.addListener(map, 'click', function(e){
    post({ type: 'tap', lat: e.coord.lat(), lng: e.coord.lng() });
  });
  window.__surveyObjs = [];
  window.__surveyRender = function(s){
    window.__surveyObjs.forEach(function(o){ o.setMap(null); });
    window.__surveyObjs = [];
    s.lines.forEach(function(l){
      window.__surveyObjs.push(new naver.maps.Polyline({
        map: map, zIndex: 300, strokeColor: '#2563EB', strokeWeight: 4, strokeOpacity: 0.85,
        path: [new naver.maps.LatLng(l[0], l[1]), new naver.maps.LatLng(l[2], l[3])]
      }));
    });
    function addNode(n, isNew){
      var size = isNew ? 16 : 10;
      var color = isNew ? '#2563EB' : '#64748B';
      var ring = n.id === s.selected ? '#05014A' : (n.id === s.pending ? '#F97316' : '#fff');
      var memo = s.memos[n.id];
      var showLabel = isNew || n.id === s.selected || n.id === s.pending || !!memo;
      var label = showLabel
        ? '<span style="font:700 11px sans-serif;color:' + (isNew ? '#1D4ED8' : '#334155') + ';background:rgba(255,255,255,.92);padding:1px 4px;border-radius:4px">'
          + esc(n.id) + (memo ? ' \\u270E' : '') + '</span>'
        : '';
      var m = new naver.maps.Marker({
        position: new naver.maps.LatLng(n.lat, n.lng), map: map,
        zIndex: isNew ? 600 : 500, title: n.id,
        draggable: isNew && s.mode === 'move',
        icon: { content: '<div style="transform:translate(-' + size / 2 + 'px,-' + size / 2 + 'px);display:flex;align-items:center;gap:4px;white-space:nowrap">'
          + '<span style="box-sizing:border-box;width:' + size + 'px;height:' + size + 'px;border-radius:50%;background:' + color
          + ';border:3px solid ' + ring + ';box-shadow:0 0 3px rgba(0,0,0,.5)"></span>' + label + '</div>' }
      });
      naver.maps.Event.addListener(m, 'click', function(){ post({ type: 'node', id: n.id }); });
      naver.maps.Event.addListener(m, 'dragend', function(){
        var p = m.getPosition();
        post({ type: 'move', id: n.id, lat: p.lat(), lng: p.lng() });
      });
      window.__surveyObjs.push(m);
    }
    s.existing.forEach(function(n){ addNode(n, false); });
    s.nodes.forEach(function(n){ addNode(n, true); });
  };
})(); true;`

/**
 * 개발용 `/dev/path-survey` — 현장에서 지도를 보며 지점·간선을 찍고 메모를 단다.
 * 기존 경로망(pathNodes.ts)은 회색 점으로 함께 보이고, 새로 찍은 것은 파란색이다.
 * 결과는 pathNodes.ts 에 붙여 넣을 코드 조각으로 내보낸다. 조사 중에는 웹 localStorage 에 자동 저장된다.
 */
export default function DevPathSurveyScreen() {
  const webViewRef = useRef<NaverMapViewHandle>(null)
  const { buildings, data, status, reload } = useMapData()
  const mapHTML = useMemo(() => buildMapHTML(buildings, 'nodes'), [buildings])
  const { width } = useWindowDimensions()
  const wide = width >= 900

  const [draft, setDraft] = useState<SurveyDraft>(loadDraft)
  const draftRef = useRef(draft)
  const historyRef = useRef<SurveyDraft[]>([])
  const [mode, setMode] = useState<Mode>('add')
  const [chain, setChain] = useState(true)
  const [selected, setSelected] = useState<string | null>(null)
  const [pending, setPending] = useState<string | null>(null)
  const [ready, setReady] = useState(false)
  const [showExport, setShowExport] = useState(false)
  const [notice, setNotice] = useState('')

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

  const existingById = useMemo(() => new Map(PATH_WAYPOINTS.map((w) => [w.id, w])), [])
  const lookup = useCallback(
    (id: string) => draftRef.current.nodes.find((n) => n.id === id) ?? existingById.get(id),
    [existingById],
  )

  /** 되돌리기 기록을 남기며 초안을 바꾼다. */
  const commit = useCallback((next: SurveyDraft, record = true) => {
    if (record) historyRef.current = [...historyRef.current.slice(-49), draftRef.current]
    draftRef.current = next
    setDraft(next)
    saveDraft(next)
  }, [])

  const undo = () => {
    const prev = historyRef.current.pop()
    if (!prev) return setNotice('되돌릴 게 없어요')
    commit(prev, false)
    setNotice('')
  }

  const addNode = (lat: number, lng: number) => {
    const d = draftRef.current
    const id = nextNodeId(PATH_WAYPOINTS, d.nodes)
    const linkFrom = chain && selected ? selected : null
    const edges =
      linkFrom && !hasEdge(PATH_EDGES, linkFrom, id) && !hasEdge(d.edges, linkFrom, id)
        ? [...d.edges, [linkFrom, id] as PathEdge]
        : d.edges
    commit({ ...d, nodes: [...d.nodes, { id, lat: round7(lat), lng: round7(lng) }], edges })
    setSelected(id)
    setNotice(`${id} 추가${linkFrom ? ` · ${linkFrom}와 이었어요` : ''}`)
  }

  const toggleEdge = (a: string, b: string) => {
    const d = draftRef.current
    if (hasEdge(PATH_EDGES, a, b)) return setNotice(`${a} — ${b} 은 이미 pathNodes.ts 에 있는 간선이에요`)
    if (hasEdge(d.edges, a, b)) {
      const key = edgeKey(a, b)
      commit({ ...d, edges: d.edges.filter(([x, y]) => edgeKey(x, y) !== key) })
      return setNotice(`${a} — ${b} 간선을 지웠어요`)
    }
    commit({ ...d, edges: [...d.edges, [a, b] as PathEdge] })
    setNotice(`${a} — ${b} 간선 추가`)
  }

  const onNodePress = (id: string) => {
    setSelected(id)
    if (mode !== 'link') return
    if (!pending) return setPending(id)
    if (pending === id) return setPending(null)
    toggleEdge(pending, id)
    setPending(id)
  }

  const moveNode = (id: string, lat: number, lng: number) => {
    const d = draftRef.current
    if (!d.nodes.some((n) => n.id === id)) return
    commit({ ...d, nodes: d.nodes.map((n) => (n.id === id ? { ...n, lat: round7(lat), lng: round7(lng) } : n)) })
  }

  const deleteSelected = () => {
    const d = draftRef.current
    if (!selected || !d.nodes.some((n) => n.id === selected)) return
    const memos = { ...d.memos }
    delete memos[selected]
    commit({
      nodes: d.nodes.filter((n) => n.id !== selected),
      edges: d.edges.filter(([a, b]) => a !== selected && b !== selected),
      memos,
    })
    setNotice(`${selected} 와 연결된 간선을 지웠어요`)
    setSelected(null)
    setPending(null)
  }

  const setMemo = (id: string, text: string) => {
    const d = draftRef.current
    const memos = { ...d.memos }
    if (text) memos[id] = text
    else delete memos[id]
    commit({ ...d, memos }, false)
  }

  const resetAll = () => {
    if (typeof window !== 'undefined' && typeof window.confirm === 'function' && !window.confirm('찍은 지점과 간선을 모두 지울까요?')) return
    historyRef.current = []
    commit({ nodes: [], edges: [], memos: {} }, false)
    setSelected(null)
    setPending(null)
  }

  const exportText = useMemo(() => formatExport(draft), [draft])
  const copyExport = async () => {
    try {
      const clip = (globalThis as any).navigator?.clipboard
      if (clip?.writeText) {
        await clip.writeText(exportText)
        return setNotice('복사했어요. pathNodes.ts 에 붙여 넣으세요')
      }
    } catch {
      // 클립보드가 막혀 있으면 공유창으로 대신한다.
    }
    await Share.share({ message: exportText })
  }

  // 지도에서 온 이벤트. 최신 상태를 보게 매번 갱신한 함수를 ref 로 부른다.
  const handlerRef = useRef<(event: unknown) => void>(() => {})
  handlerRef.current = (event) => {
    const msg = parseMessage(event)
    if (!msg) return
    if (msg.type === 'tap' && mode === 'add') addNode(msg.lat, msg.lng)
    else if (msg.type === 'node') onNodePress(msg.id)
    else if (msg.type === 'move') moveNode(msg.id, msg.lat, msg.lng)
  }

  const handleReady = useCallback(() => {
    webViewRef.current?.injectJavaScript(SETUP_JS)
    setReady(true)
  }, [])

  // 상태가 바뀔 때마다 지도에 다시 그린다.
  useEffect(() => {
    if (!ready) return
    const lines = draft.edges.flatMap(([a, b]) => {
      const A = lookup(a)
      const B = lookup(b)
      return A && B ? [[A.lat, A.lng, B.lat, B.lng]] : []
    })
    const state = { existing: PATH_WAYPOINTS, nodes: draft.nodes, lines, memos: draft.memos, selected, pending, mode }
    webViewRef.current?.injectJavaScript(`window.__surveyRender && window.__surveyRender(${JSON.stringify(state)}); true;`)
  }, [ready, draft, selected, pending, mode, lookup])

  const selectedNode = selected ? lookup(selected) : undefined
  const selectedIsNew = !!selected && draft.nodes.some((n) => n.id === selected)
  const activeMode = MODES.find((m) => m.key === mode)!

  const panel = (
    <ScrollView style={wide ? styles.panelWide : styles.panelNarrow} contentContainerStyle={styles.panelBody}>
      <Text style={styles.title}>경로망 조사 (/dev/path-survey)</Text>
      <Text style={styles.summary}>{`새 지점 ${draft.nodes.length} · 새 간선 ${draft.edges.length} · 기존 지점 ${PATH_WAYPOINTS.length}`}</Text>

      <View style={styles.modeRow}>
        {MODES.map((m) => (
          <Pressable
            key={m.key}
            onPress={() => {
              setMode(m.key)
              setPending(null)
            }}
            style={[styles.modeBtn, mode === m.key && styles.modeBtnActive]}
            accessibilityRole="button"
          >
            <Text style={[styles.modeText, mode === m.key && styles.modeTextActive]}>{m.label}</Text>
          </Pressable>
        ))}
      </View>
      <Text style={styles.hint}>{activeMode.help}</Text>

      {mode === 'add' ? (
        <Pressable onPress={() => setChain((v) => !v)} style={styles.checkRow} accessibilityRole="checkbox" accessibilityState={{ checked: chain }}>
          <View style={[styles.check, chain && styles.checkOn]} />
          <Text style={styles.rowText}>이어 찍기 (직전에 고른 지점과 간선으로 잇기)</Text>
        </Pressable>
      ) : null}
      {mode === 'link' && pending ? <Text style={styles.pending}>{`${pending} 에서 시작 — 이을 지점을 누르세요`}</Text> : null}
      {notice ? <Text style={styles.notice}>{notice}</Text> : null}

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{selected ? `선택: ${selected}` : '선택한 지점 없음'}</Text>
        {selectedNode ? (
          <>
            <Text style={styles.sectionHelp}>{`${selectedNode.lat.toFixed(7)}, ${selectedNode.lng.toFixed(7)}${selectedIsNew ? ' (새 지점)' : ' (기존 지점)'}`}</Text>
            <TextInput
              key={selected}
              defaultValue={draft.memos[selected!] ?? ''}
              onChangeText={(text) => setMemo(selected!, text)}
              placeholder="메모 (예: 계단 5칸, 휠체어 불가, 공사 중)"
              multiline
              style={styles.memoInput}
            />
            {selectedIsNew ? (
              <Pressable onPress={deleteSelected} style={styles.dangerBtn} accessibilityRole="button">
                <Text style={styles.dangerText}>이 지점과 연결 간선 지우기</Text>
              </Pressable>
            ) : null}
          </>
        ) : (
          <Text style={styles.empty}>지도의 점을 누르면 메모를 달 수 있어요</Text>
        )}
      </View>

      <View style={styles.btnRow}>
        <Pressable onPress={undo} style={styles.btn} accessibilityRole="button">
          <Text style={styles.btnText}>되돌리기</Text>
        </Pressable>
        <Pressable onPress={() => setShowExport((v) => !v)} style={styles.btn} accessibilityRole="button">
          <Text style={styles.btnText}>{showExport ? '내보내기 닫기' : '내보내기'}</Text>
        </Pressable>
        <Pressable onPress={resetAll} style={styles.btn} accessibilityRole="button">
          <Text style={styles.btnText}>모두 지우기</Text>
        </Pressable>
      </View>

      {showExport ? (
        <View style={styles.section}>
          <Text style={styles.sectionHelp}>pathNodes.ts 의 PATH_WAYPOINTS / PATH_EDGES 끝에 붙여 넣으세요.</Text>
          <TextInput value={exportText} multiline editable={false} selectTextOnFocus style={styles.exportBox} />
          <Pressable onPress={copyExport} style={styles.btnPrimary} accessibilityRole="button">
            <Text style={styles.btnPrimaryText}>복사하기</Text>
          </Pressable>
        </View>
      ) : null}
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
  hint: { fontFamily: FONTS.regular, fontSize: 12, color: COLORS.textTertiary },
  modeRow: { flexDirection: 'row', gap: 6 },
  modeBtn: { flex: 1, paddingVertical: 9, borderRadius: 8, borderWidth: 1, borderColor: COLORS.border, alignItems: 'center' },
  modeBtnActive: { backgroundColor: '#05014A', borderColor: '#05014A' },
  modeText: { fontFamily: FONTS.medium, fontSize: 12.5, color: COLORS.textPrimary },
  modeTextActive: { color: '#FFFFFF' },
  checkRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 4 },
  check: { width: 16, height: 16, borderRadius: 4, borderWidth: 1.5, borderColor: COLORS.border },
  checkOn: { backgroundColor: '#2563EB', borderColor: '#2563EB' },
  pending: { fontFamily: FONTS.semibold, fontSize: 12.5, color: '#EA580C' },
  notice: { fontFamily: FONTS.medium, fontSize: 12.5, color: '#1D4ED8' },
  section: { gap: 6 },
  sectionTitle: { fontFamily: FONTS.bold, fontSize: 13.5, color: COLORS.textPrimary },
  sectionHelp: { fontFamily: FONTS.regular, fontSize: 11.5, color: COLORS.textTertiary },
  empty: { fontFamily: FONTS.regular, fontSize: 12.5, color: COLORS.textTertiary },
  rowText: { flex: 1, fontFamily: FONTS.medium, fontSize: 12.5, color: COLORS.textPrimary },
  memoInput: {
    minHeight: 64,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 8,
    padding: 10,
    fontFamily: FONTS.regular,
    fontSize: 13,
    color: COLORS.textPrimary,
    textAlignVertical: 'top',
  },
  btnRow: { flexDirection: 'row', gap: 6 },
  btn: { flex: 1, paddingVertical: 9, borderRadius: 8, backgroundColor: COLORS.fill, alignItems: 'center' },
  btnText: { fontFamily: FONTS.medium, fontSize: 12.5, color: COLORS.textPrimary },
  btnPrimary: { paddingVertical: 10, borderRadius: 8, backgroundColor: '#05014A', alignItems: 'center' },
  btnPrimaryText: { fontFamily: FONTS.semibold, fontSize: 13, color: '#FFFFFF' },
  dangerBtn: { paddingVertical: 9, borderRadius: 8, borderWidth: 1, borderColor: '#DC2626', alignItems: 'center' },
  dangerText: { fontFamily: FONTS.medium, fontSize: 12.5, color: '#DC2626' },
  exportBox: {
    minHeight: 140,
    maxHeight: 260,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 8,
    padding: 10,
    fontFamily: FONTS.regular,
    fontSize: 11.5,
    color: COLORS.textPrimary,
    textAlignVertical: 'top',
  },
})
