import { useMemo, useRef, useState } from 'react'
import { ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native'
import NaverMapView from '../components/map/NaverMapView'
import type { NaverMapViewHandle } from '../components/map/NaverMapView'
import { buildMapHTML } from '../utils/mapHtml'
import { useMapData } from '../lib/mapData'
import { PATH_WAYPOINTS } from '../constants/pathNodes'
import { addCustomColor, findModule, loadStore, setEdgeKind, setEdgeMemo, setNodeKind, setNodeMemo, updateModule } from '../utils/pathSurveyStore'
import { COLORS } from '../constants/colors'
import { FONTS } from '../constants/typography'
import { useGistSync } from '../hooks/pathSurvey/useGistSync'
import { useModuleActions } from '../hooks/pathSurvey/useModuleActions'
import { useNoIndexPage, useSurveyV2Edits, useSurveyV2MapRender, useSurveyV2Selection } from '../hooks/pathSurvey/useSurveyV2Map'
import { useSurveyV2Store } from '../hooks/pathSurvey/useSurveyV2Store'
import { buildLegacyOverlay } from './pathSurvey/legacyOverlay'
import EditTab from './pathSurvey/EditTab'
import ModulePanel from './pathSurvey/ModulePanel'
import ModuleProps from './pathSurvey/ModuleProps'
import TransferPanel from './pathSurvey/TransferPanel'
import GistPanel from './pathSurvey/GistPanel'
import LegacyPanel, { DEFAULT_LEGACY, type LegacyToggles } from './pathSurvey/LegacyPanel'
import { bootNotice, TABS, type Tab } from './pathSurvey/screenModel'
import { Btn } from './pathSurvey/ui'

const initialLoad = () => loadStore(PATH_WAYPOINTS)

/**
 * 개발용 `/dev/path-survey` — 현장에서 지도를 보며 경로망을 '모듈'(한 층위의 지점·간선 묶음) 단위로 찍는다.
 * 기존 경로망(pathNodes.ts)은 보기 전용 회색 오버레이다. 편집 중인 모듈만 진하게, 나머지는 흐리게 그린다.
 * 조사 내용은 웹 localStorage(hongikon.pathSurvey.v2)에 자동 저장된다. 예전 v1 초안은 처음 열 때 '미분류' 모듈로 옮겨진다.
 * 상태와 핸들러는 hooks/pathSurvey/* 에, 지도 스크립트·그리기 상태는 pathSurvey/mapBridge·screenModel 에 있다.
 */
export default function DevPathSurveyScreen() {
  const webViewRef = useRef<NaverMapViewHandle>(null)
  const { buildings, data, status, reload } = useMapData()
  const mapHTML = useMemo(() => buildMapHTML(buildings), [buildings])
  const { width } = useWindowDimensions()
  const wide = width >= 900

  const [boot] = useState(initialLoad)
  const [tab, setTab] = useState<Tab>('edit')
  const [legacyToggles, setLegacyToggles] = useState<LegacyToggles>(DEFAULT_LEGACY)
  const [notice, setNotice] = useState(() => bootNotice(boot))

  const { store, storeRef, commit, editActive, undo } = useSurveyV2Store({ boot, setNotice })
  const selection = useSurveyV2Selection()
  const { mode, setMode, chain, setChain, selected, setSelected, pending, setPending, selectedEdge, setSelectedEdge, clearSelection } = selection
  const modules = useModuleActions({
    storeRef,
    commit,
    initialDetailId: boot.store.activeModuleId ?? boot.store.modules[0]?.id ?? null,
    clearSelection,
    setTab,
    setNotice,
  })
  const { hidden, detailId } = modules
  const sync = useGistSync({ store, storeRef, commit, clearSelection, setNotice })

  useNoIndexPage('경로망 조사 | 홍익온')

  const overlay = useMemo(() => buildLegacyOverlay(buildings), [buildings])
  const active = findModule(store, store.activeModuleId)

  const { handlerRef, deleteSelected, deleteEdge } = useSurveyV2Edits({ storeRef, commit, editActive, selection, setTab, setNotice })
  const { handleReady } = useSurveyV2MapRender({ webViewRef, store, active, hidden, legacyToggles, overlay, selected, pending, selectedEdge, mode })

  const selectedNode = active && selected ? active.nodes.find((n) => n.id === selected) : undefined

  const editTab = (
    <EditTab
      active={active}
      mode={mode}
      onMode={(key) => {
        setMode(key)
        setPending(null)
      }}
      chain={chain}
      onToggleChain={() => setChain((v) => !v)}
      pending={pending}
      selectedNode={selectedNode}
      onNodeMemo={(id, text) => editActive((m) => setNodeMemo(m, id, text), false)}
      onNodeKind={(id, kind) => editActive((m) => setNodeKind(m, id, kind))}
      onDeleteSelected={deleteSelected}
      onUndo={undo}
      onFinish={modules.finish}
      onStart={modules.startModule}
      selectedEdge={selectedEdge}
      onSelectEdge={(id) => {
        setSelectedEdge(id)
        if (id) setSelected(null)
      }}
      onEdgeMemo={(id, text) => editActive((m) => setEdgeMemo(m, id, text), false)}
      onEdgeKind={(id, kind) => {
        if (editActive((m) => setEdgeKind(m, id, kind))) setNotice(kind === 'stairs' ? '계단 간선으로 바꿨어요(되돌리기 가능)' : '일반 간선으로 바꿨어요(되돌리기 가능)')
      }}
      onDeleteEdge={deleteEdge}
    />
  )

  const detailModule = findModule(store, detailId)
  const modulesTab = (
    <ModulePanel
      store={store}
      hidden={hidden}
      detailId={detailId}
      onDetail={modules.setDetailId}
      onToggleHidden={modules.toggleHidden}
      onStart={modules.startModule}
      onFinish={modules.finish}
      onReopen={modules.reopen}
      onRename={modules.rename}
      onDelete={modules.removeModule}
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
          <Btn key={t.key} label={t.label} kind={tab === t.key ? 'active' : 'default'} onPress={() => setTab(t.key)} style={styles.tab} />
        ))}
      </View>
      {notice ? <Text style={styles.notice}>{notice}</Text> : null}
      {tab === 'edit' ? editTab : null}
      {tab === 'modules' ? modulesTab : null}
      {tab === 'legacy' ? <LegacyPanel overlay={overlay} toggles={legacyToggles} onChange={setLegacyToggles} /> : null}
      {tab === 'sync' ? (
        <GistPanel
          settings={sync.gistSettings}
          meta={sync.gistMeta}
          online={sync.online}
          dirty={sync.dirty}
          busy={sync.gistBusy}
          status={sync.gistStatus}
          error={sync.gistError}
          onSaveSettings={sync.saveSettings}
          onPush={sync.pushGist}
          onPull={sync.pullGist}
        />
      ) : null}
      {tab === 'transfer' ? <TransferPanel store={store} initialModuleId={detailId ?? store.activeModuleId} onImport={sync.runImport} onNotice={setNotice} /> : null}
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
  tabRow: { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
  /** 폰에서 탭 다섯 개가 한 줄에 끼면 글자가 잘려 3 + 2 줄로 나눈다. */
  tab: { minWidth: '30%' },
  notice: { fontFamily: FONTS.medium, fontSize: 12.5, color: '#1D4ED8' },
})
