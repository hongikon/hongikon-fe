import { useMemo, useRef, useState } from 'react'
import { useWindowDimensions } from 'react-native'
import type { NaverMapViewHandle } from '../../components/map/NaverMapView'
import { buildMapHTML } from '../../utils/map/mapHtml'
import { useMapData } from '../../lib/mapData'
import { findModule } from '../../utils/pathSurvey/store'
import { useGistSync } from '../pathSurvey/useGistSync'
import { useModuleActions } from '../pathSurvey/useModuleActions'
import { useNoIndexPage, useSurveyV2Edits, useSurveyV2MapRender, useSurveyV2Selection } from '../pathSurvey/useSurveyV2Map'
import { useSurveyV2Store } from '../pathSurvey/useSurveyV2Store'
import { buildLegacyOverlay } from '../../screens/pathSurvey/legacyOverlay'
import { DEFAULT_LEGACY, type LegacyToggles } from '../../screens/pathSurvey/LegacyPanel'
import { bootNotice, type Tab } from '../../screens/pathSurvey/screenModel'
import { initialLoad } from '../../utils/debug/devPathSurveyScreen'

/** DevPathSurveyScreen 의 상태·효과·핸들러. 화면 파일은 이 훅을 불러 그리기만 한다. */
export function useDevPathSurveyScreen() {
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

  const detailModule = findModule(store, detailId)
  return {
    webViewRef,
    buildings,
    data,
    status,
    reload,
    mapHTML,
    wide,
    tab,
    setTab,
    legacyToggles,
    setLegacyToggles,
    notice,
    setNotice,
    store,
    storeRef,
    commit,
    editActive,
    undo,
    mode,
    setMode,
    chain,
    setChain,
    setSelected,
    pending,
    setPending,
    selectedEdge,
    setSelectedEdge,
    modules,
    hidden,
    detailId,
    sync,
    overlay,
    active,
    handlerRef,
    deleteSelected,
    deleteEdge,
    handleReady,
    selectedNode,
    detailModule,
  }
}
