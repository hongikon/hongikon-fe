import { useCallback, useEffect, useRef, useState, type RefObject } from 'react'
import type { NaverMapViewHandle } from '../../components/map/NaverMapView'
import type { LegacyOverlay } from '../../screens/pathSurvey/legacyOverlay'
import type { LegacyToggles } from '../../screens/pathSurvey/LegacyPanel'
import { isShortcutTab, keyboardTarget } from '../../screens/pathSurveyV3/keyboard'
import { SETUP_JS } from '../../screens/pathSurveyV3/mapBridge'
import { buildRenderState, type LabelMode, type MapFilter, type MapMode } from '../../screens/pathSurveyV3/mapState'
import { legacyRenderPayload, type Tab } from '../../screens/pathSurveyV3/screenModel'
import type { BuildingIndex } from '../../utils/pathSurveyV3/buildings'
import type { ChangeMarks } from '../../utils/pathSurveyV3/changes'
import { findNode, type StoreV3 } from '../../utils/pathSurveyV3/store'

interface MapRenderOptions {
  webViewRef: RefObject<NaverMapViewHandle | null>
  store: StoreV3
  index: BuildingIndex
  filter: MapFilter
  onlyFilter: boolean
  mode: MapMode
  tab: Tab
  selected: string | null
  pending: string | null
  selectedEdge: string | null
  multi: string[]
  labelMode: LabelMode
  legacyToggles: LegacyToggles
  overlay: LegacyOverlay
  chain: boolean
  anchor: string | null
  marks: ChangeMarks | null
  canEditNode: (id: string | null | undefined) => boolean
}

/**
 * Drawing on the map page: the survey script (SETUP_JS) goes in once the map is up, and the map redraws only when
 * the drawn state changed. The map's own arrow key panning is off while the arrow keys move a point (keysLocked).
 */
export function useSurveyMapRender(options: MapRenderOptions) {
  const { webViewRef, store, index, filter, onlyFilter, mode, tab, selected, pending, selectedEdge, multi, labelMode, legacyToggles, overlay, chain, anchor, marks, canEditNode } = options
  const [ready, setReady] = useState(false)

  // The map's own arrow key panning is off only while the arrow keys move a point.
  const keysLocked = ready && isShortcutTab(tab) && !!findNode(store, keyboardTarget(selected, multi)) && canEditNode(keyboardTarget(selected, multi))
  const keysLockedRef = useRef(keysLocked)
  keysLockedRef.current = keysLocked
  useEffect(() => {
    if (ready) webViewRef.current?.injectJavaScript(`window.__surveyV3KeyLock && window.__surveyV3KeyLock(${keysLocked}); true;`)
    // webViewRef is a ref.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, keysLocked])

  const lastRenderRef = useRef('')
  const handleReady = useCallback(() => {
    webViewRef.current?.injectJavaScript(SETUP_JS)
    webViewRef.current?.injectJavaScript(`window.__surveyV3KeyLock && window.__surveyV3KeyLock(${keysLockedRef.current}); true;`)
    lastRenderRef.current = ''
    setReady(true)
    // webViewRef is a ref.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Redraw when something the map shows has changed. Typing a memo does not change the drawn state, so it does not redraw.
  useEffect(() => {
    if (!ready) return
    const legacy = legacyRenderPayload(overlay, legacyToggles)
    const drawn = buildRenderState(store, { index, filter, mode, selected, pending, selectedEdge, multi, labelMode, anchor: chain && mode === 'add' ? anchor : null, onlyFilter, changes: marks })
    const state = JSON.stringify({ legacy, ...drawn })
    if (state === lastRenderRef.current) return
    lastRenderRef.current = state
    webViewRef.current?.injectJavaScript(`window.__surveyV3Render && window.__surveyV3Render(${state}); true;`)
    // webViewRef is a ref.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, store, index, filter, mode, selected, pending, selectedEdge, multi, labelMode, legacyToggles, overlay, chain, anchor, onlyFilter, marks])

  return { ready, handleReady }
}
