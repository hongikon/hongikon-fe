import { useRef, useState } from 'react'
import type { MapMode } from '../../screens/pathSurveyV3/mapState'

/**
 * Map mode and selection of the v3 survey screen: picked point and edge, link start, many points, the chain base point (anchor).
 * State only; the filter lock rules are in useSurveyFilter.
 */
export function useSurveySelection() {
  const [mode, setMode] = useState<MapMode>('add')
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

  return {
    mode,
    setMode,
    chain,
    setChain,
    anchor,
    anchorRef,
    setAnchor,
    selected,
    setSelected,
    pending,
    setPending,
    selectedEdge,
    setSelectedEdge,
    multi,
    setMulti,
    multiFromAll,
    setMultiFromAll,
    pickNode,
    clearSelection,
  }
}

export type SurveySelection = ReturnType<typeof useSurveySelection>
