import { useState, type MutableRefObject } from 'react'
import { canEditEdge, editableNodeIds, editableSelection, NO_FILTER, type MapFilter } from '../../screens/pathSurveyV3/mapState'
import { findNode, type StoreV3 } from '../../utils/pathSurveyV3/store'
import type { SurveySelection } from './useSurveySelection'

interface FilterOptions {
  storeRef: MutableRefObject<StoreV3>
  selection: SurveySelection
  setNotice: (text: string) => void
}

/**
 * The floor filter and the "only the filter can be edited" lock. Points and edges outside the filter cannot be picked
 * or edited (the same rule as the map), and a new filter drops the selection that became locked.
 */
export function useSurveyFilter({ storeRef, selection, setNotice }: FilterOptions) {
  const [filter, setFilter] = useState<MapFilter>(NO_FILTER)
  // "Only the filter can be edited". Screen state only, never stored: every visit starts locked as before.
  const [onlyFilter, setOnlyFilter] = useState(true)
  const { anchorRef, selected, setSelected, selectedEdge, setSelectedEdge, pending, setPending, multi, setMulti, multiFromAll, setMultiFromAll } = selection

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

  return { filter, setFilter, onlyFilter, selectMany, canEditNode, canEditEdgeId, applyFilter }
}

export type SurveyFilter = ReturnType<typeof useSurveyFilter>
