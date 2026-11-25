import { useRef, type MutableRefObject } from 'react'
import { confirmAction } from '../../utils/pathSurvey/ui'
import { addDevSample, removeDevSample } from '../../screens/pathSurveyV3/devSample'
import { placeChained, type EditHistory } from '../../screens/pathSurveyV3/editHistory'
import { NO_MODS, nudgeCoord, resolveClickShortcut, type ClickMods, type ClickShortcut, type ClickTarget, type ShortcutAction } from '../../screens/pathSurveyV3/keyboard'
import { editableNodeIds, isNodeStrong, type MapFilter } from '../../screens/pathSurveyV3/mapState'
import { LOCKED_TEXT, parseSurveyMessage, placedNotice, SPLIT_REFUSED } from '../../screens/pathSurveyV3/screenModel'
import type { BuildingIndex } from '../../utils/pathSurveyV3/buildings'
import { selectionBuildings } from '../../utils/pathSurveyV3/levels'
import {
  addEdge,
  applyBulkToNodes,
  findNode,
  hasEdgeBetween,
  moveNode,
  moveNodeOntoEdge,
  removeEdgeBetween,
  removeNode,
  splitEdgeAt,
  type BulkChange,
  type StoreV3,
} from '../../utils/pathSurveyV3/store'
import { toNodeContext, type WorkContext } from '../../utils/pathSurveyV3/transfer'
import type { SurveySelection } from './useSurveySelection'

interface EditActionOptions {
  index: BuildingIndex
  storeRef: MutableRefObject<StoreV3>
  historyRef: MutableRefObject<EditHistory>
  commit: (next: StoreV3, record?: boolean, fromHistory?: boolean) => void
  change: (fn: (s: StoreV3) => StoreV3) => void
  selection: SurveySelection
  context: WorkContext
  filter: MapFilter
  onlyFilter: boolean
  canEditNode: (id: string | null | undefined) => boolean
  canEditEdgeId: (id: string | null | undefined) => boolean
  selectMany: (ids: string[], fromAll?: boolean) => void
  /** Modifier keys of a map click (from key events when the click has none). See useClickMods. */
  clickMods: (msg: any) => ClickMods
  focusOn: (lat: number, lng: number) => void
  scrollPanelTop: () => void
  setNotice: (text: string) => void
}

/**
 * Edits made on the map: placing, linking, moving and picking many points, the Cmd/Ctrl and Shift click shortcuts
 * (link, split an edge), arrow key moves, deleting a point, bulk values. Map messages (handlerRef) are dispatched here.
 */
export function useSurveyEditActions(options: EditActionOptions) {
  const { index, storeRef, historyRef, commit, change, selection, context, filter, onlyFilter, canEditNode, canEditEdgeId, selectMany, clickMods, focusOn, scrollPanelTop, setNotice } = options
  const { mode, chain, anchorRef, selected, setSelected, pending, setPending, selectedEdge, setSelectedEdge, multi, setMulti, multiFromAll, pickNode, clearSelection } = selection
  // World width in pixels at the current zoom, reported by the map. Arrow keys wait for it.
  const worldPxRef = useRef(0)

  const onTap = (lat: number, lng: number) => {
    const { store: next, id, from } = placeChained(storeRef.current, lat, lng, toNodeContext(context), chain, anchorRef.current)
    commit(next)
    pickNode(id)
    setSelectedEdge(null)
    const made = findNode(next, id)!
    setNotice(placedNotice(made, from, isNodeStrong(made, filter), onlyFilter))
    scrollPanelTop()
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
      return setNotice(shortcut.why === 'exists' ? `${selected} 와 ${id} 는 이미 이어져 있어요. 지우려면 간선을 눌러 지워 주세요.` : LOCKED_TEXT)
    }
    if (!canEditNode(id)) return
    if (mode === 'select') {
      setMulti((list) => (list.includes(id) ? list.filter((x) => x !== id) : [...list, id]))
      return
    }
    pickNode(id)
    setSelectedEdge(null)
    scrollPanelTop()
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
    if (shortcut?.kind === 'blocked') return setNotice(LOCKED_TEXT)
    if (mode === 'select' || !canEditEdgeId(id)) return
    setSelectedEdge(id)
    setSelected(null)
    setPending(null)
    scrollPanelTop()
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

  const applyBulk = (bulk: BulkChange) => {
    const ids = editableNodeIds(storeRef.current, multi, filter, onlyFilter)
    if (ids.length === 0) return setNotice(LOCKED_TEXT)
    const count = ids.length
    const mixed = multiFromAll ? selectionBuildings(storeRef.current.nodes, ids, index) : []
    if (mixed.length > 1 && !confirmAction(`여러 건물의 점이 섞여 있어요. 건물 ${mixed.length}곳, 점 ${count}개에 같은 값을 넣을까요?`)) return
    change((s) => applyBulkToNodes(s, ids, bulk))
    selectMany([])
    const skipped = multi.length - count
    setNotice(`${count}개에 적용했어요${skipped ? `(필터 밖 ${skipped}개는 건너뜀)` : ''}. 되돌리기로 한 번에 취소할 수 있어요.`)
  }

  /** Development only: sample points that show every drawing style. The current data stays. */
  const addSample = () => {
    const next = addDevSample(storeRef.current, index)
    if (!next) return setNotice('예시를 만들 건물 정보가 없어요.')
    commit(next)
    const first = next.nodes[next.nodes.length - 7]
    focusOn(first.lat, first.lng)
    setNotice('예시 점을 넣었어요. 지금 데이터는 그대로예요. 아래 "예시 점 제거"로 뺄 수 있어요.')
  }

  const removeSample = (sampleIds: string[]) => {
    commit(removeDevSample(storeRef.current, index))
    clearSelection()
    setMulti((list) => list.filter((id) => !sampleIds.includes(id)))
    setNotice('예시 점과 거기 이어진 간선을 지웠어요.')
  }

  // Events from the map. The ref always sees the latest state.
  const handlerRef = useRef<(event: unknown) => void>(() => {})
  handlerRef.current = (event) => {
    const msg = parseSurveyMessage(event)
    if (!msg) return
    if (msg.type === 'scale') {
      if (Number.isFinite(msg.worldPx) && msg.worldPx > 0) worldPxRef.current = msg.worldPx
    } else if (msg.type === 'tap' && mode === 'add') onTap(msg.lat, msg.lng)
    else if (msg.type === 'node') onNodePress(msg.id, clickMods(msg))
    else if (msg.type === 'edge') onEdgePress(msg.id, clickMods(msg), msg)
    else if (msg.type === 'move' && mode === 'move') onMove(msg)
  }

  return { worldPxRef, handlerRef, deleteNode, nudgeNode, applyBulk, addSample, removeSample }
}
