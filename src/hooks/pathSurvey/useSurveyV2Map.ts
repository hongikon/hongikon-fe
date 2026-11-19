import { useCallback, useEffect, useRef, useState, type MutableRefObject, type RefObject } from 'react'
import type { NaverMapViewHandle } from '../../components/map/NaverMapView'
import { shortId } from '../../screens/pathSurvey/ids'
import type { LegacyOverlay } from '../../screens/pathSurvey/legacyOverlay'
import type { LegacyToggles } from '../../screens/pathSurvey/LegacyPanel'
import { parseSurveyMessage, SETUP_JS } from '../../screens/pathSurvey/mapBridge'
import { buildSurveyRenderState, type Mode, type Tab } from '../../screens/pathSurvey/screenModel'
import {
  addEdge,
  addNode,
  findModule,
  hasModuleEdge,
  moveNode,
  moveNodeOntoEdge,
  referenceSpecialNode,
  removeEdgeBetween,
  removeNode,
  updateModule,
  type SurveyModule,
  type SurveyStore,
} from '../../utils/pathSurveyStore'

/** v2 화면의 지도 모드·이어 찍기와 선택(지점·간선·잇기 시작점). */
export function useSurveyV2Selection() {
  const [mode, setMode] = useState<Mode>('add')
  const [chain, setChain] = useState(true)
  const [selected, setSelected] = useState<string | null>(null)
  const [pending, setPending] = useState<string | null>(null)
  const [selectedEdge, setSelectedEdge] = useState<string | null>(null)

  const clearSelection = () => {
    setSelected(null)
    setSelectedEdge(null)
    setPending(null)
  }

  return { mode, setMode, chain, setChain, selected, setSelected, pending, setPending, selectedEdge, setSelectedEdge, clearSelection }
}

export type SurveyV2Selection = ReturnType<typeof useSurveyV2Selection>

interface EditOptions {
  storeRef: MutableRefObject<SurveyStore>
  commit: (next: SurveyStore, record?: boolean) => void
  editActive: (fn: (m: SurveyModule) => SurveyModule, record?: boolean) => boolean
  selection: SurveyV2Selection
  setTab: (tab: Tab) => void
  setNotice: (text: string) => void
}

/** 지도에서 하는 편집: 지점 찍기(이어 찍기), 간선 잇기·끊기, 다른 모듈 특수 지점 참조, 옮기기(간선 위면 나누기), 지우기. */
export function useSurveyV2Edits({ storeRef, commit, editActive, selection, setTab, setNotice }: EditOptions) {
  const { mode, chain, selected, setSelected, pending, setPending, setSelectedEdge } = selection

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

  const onNodePress = (id: string, moduleId: string) => {
    const current = storeRef.current
    if (!current.activeModuleId) return
    const wasPlain = moduleId !== current.activeModuleId && !findModule(current, moduleId)?.nodes.find((n) => n.id === id)?.kind
    const referenced = referenceSpecialNode(current, current.activeModuleId, moduleId, id, Date.now(), mode === 'link')
    if (!referenced) return
    let next = referenced.store
    const localId = referenced.id
    setSelected(localId)
    setSelectedEdge(null)
    setTab('edit')
    if (mode === 'link') {
      if (pending && pending !== localId) {
        next = updateModule(next, current.activeModuleId, (m) => {
          if (!m.nodes.some((n) => n.id === pending)) return m
          return hasModuleEdge(m, pending, localId) ? removeEdgeBetween(m, pending, localId) : addEdge(m, pending, localId)
        })
        setNotice(`${shortId(pending)} — ${shortId(localId)} 간선을 변경했어요`)
      } else if (next !== current && wasPlain) setNotice('다른 모듈의 지점을 계단 끝으로 표시하고 이 모듈에서 참조해요. 다음 지점을 눌러 잇고, 그 간선을 계단으로 바꾸세요.')
      else if (next !== current) setNotice('특수 지점을 이 모듈에서 참조해요. 다음 지점을 누르면 간선으로 이어져요.')
      setPending(pending === localId ? null : localId)
    }
    commit(next)
  }

  const deleteSelected = () => {
    if (!selected) return
    editActive((m) => removeNode(m, selected))
    setNotice(`${shortId(selected)}의 지점 또는 참조와 이 모듈의 연결 간선을 지웠어요`)
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

  // 지도에서 온 이벤트. 최신 상태를 보게 매번 갱신한 함수를 ref 로 부른다.
  const handlerRef = useRef<(event: unknown) => void>(() => {})
  handlerRef.current = (event) => {
    const msg = parseSurveyMessage(event)
    if (!msg) return
    if (msg.type === 'tap' && mode === 'add') onTap(msg.lat, msg.lng)
    else if (msg.type === 'node') onNodePress(msg.id, msg.moduleId ?? storeRef.current.activeModuleId)
    else if (msg.type === 'edge') onEdgePress(msg.id)
    else if (msg.type === 'move' && mode === 'move' && Number.isFinite(msg.lat) && Number.isFinite(msg.lng)) {
      const current = storeRef.current
      if (!current.activeModuleId) return
      const referenced = referenceSpecialNode(current, current.activeModuleId, msg.moduleId ?? current.activeModuleId, msg.id)
      if (!referenced) return
      const id = referenced.id
      let split = false
      const next = updateModule(referenced.store, current.activeModuleId, (m) => {
        if (msg.edgeId) {
          const result = moveNodeOntoEdge(m, id, msg.edgeId, msg.lat, msg.lng)
          split = result !== m
          if (split) return result
        }
        return moveNode(m, id, msg.lat, msg.lng)
      })
      commit(next)
      setSelected(id)
      setSelectedEdge(null)
      setPending(null)
      setNotice(split ? `${shortId(id)}를 간선 위로 옮기고 간선을 둘로 나눴어요` : `${shortId(id)}의 위치를 옮겼어요${referenced.store.modules.find((m) => m.id === current.activeModuleId)?.nodes.find((n) => n.id === id)?.sharedId ? ' · 공유 모듈에도 반영했어요' : ''}`)
    }
  }

  return { handlerRef, deleteSelected, deleteEdge }
}

interface RenderOptions {
  webViewRef: RefObject<NaverMapViewHandle | null>
  store: SurveyStore
  active: SurveyModule | undefined
  hidden: Record<string, boolean>
  legacyToggles: LegacyToggles
  overlay: LegacyOverlay
  selected: string | null
  pending: string | null
  selectedEdge: string | null
  mode: Mode
}

/** 지도가 뜨면 조사 스크립트(SETUP_JS)를 넣고, 그릴 내용이 바뀔 때만 다시 그린다. */
export function useSurveyV2MapRender({ webViewRef, store, active, hidden, legacyToggles, overlay, selected, pending, selectedEdge, mode }: RenderOptions) {
  const [ready, setReady] = useState(false)
  const lastRenderRef = useRef('')
  const handleReady = useCallback(() => {
    webViewRef.current?.injectJavaScript(SETUP_JS)
    lastRenderRef.current = ''
    setReady(true)
    // webViewRef is a ref.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // 상태가 바뀔 때마다 지도에 다시 그린다.
  useEffect(() => {
    if (!ready) return
    const state = JSON.stringify(buildSurveyRenderState({ store, active, hidden, legacyToggles, overlay, selected, pending, selectedEdge, mode }))
    // 메모·이름을 칠 때마다 저장소가 바뀌지만 지도에 그릴 내용은 그대로라 다시 그리지 않는다(폰에서 글자 입력이 끊기지 않게).
    if (state === lastRenderRef.current) return
    lastRenderRef.current = state
    webViewRef.current?.injectJavaScript(`window.__surveyRender && window.__surveyRender(${state}); true;`)
    // active is derived from store; webViewRef is a ref.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, store, selected, pending, selectedEdge, mode, hidden, legacyToggles, overlay])

  return { handleReady }
}

/** 웹에서 검색엔진에 안 잡히게(noindex) 하고 탭 제목을 바꾼다. 화면을 떠나면 meta 를 거둔다. */
export function useNoIndexPage(title: string) {
  useEffect(() => {
    if (typeof document === 'undefined') return
    const meta = document.createElement('meta')
    meta.name = 'robots'
    meta.content = 'noindex, nofollow'
    document.head.appendChild(meta)
    document.title = title
    return () => {
      meta.remove()
    }
    // Set once on entry, as before.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
}
