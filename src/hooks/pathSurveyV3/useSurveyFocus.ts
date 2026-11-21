import { useCallback, type MutableRefObject, type RefObject } from 'react'
import type { ScrollView } from 'react-native'
import type { NaverMapViewHandle } from '../../components/map/NaverMapView'
import type { RouteLine } from '../../screens/pathSurveyV3/ServerPanel'
import { isNodeStrong, NO_FILTER, type MapFilter } from '../../screens/pathSurveyV3/mapState'
import type { CheckIssue } from '../../utils/pathSurveyV3/check'
import { findEdge, findNode, type StoreV3 } from '../../utils/pathSurveyV3/store'
import type { SurveySelection } from './useSurveySelection'

interface FocusOptions {
  webViewRef: RefObject<NaverMapViewHandle | null>
  panelRef: RefObject<ScrollView | null>
  storeRef: MutableRefObject<StoreV3>
  filter: MapFilter
  setFilter: (filter: MapFilter) => void
  selection: SurveySelection
}

/**
 * Moving the map to a point, an edge or a check item, drawing the Server tab test routes, scrolling the panel to the top.
 * A point outside the filter clears the filter.
 */
export function useSurveyFocus({ webViewRef, panelRef, storeRef, filter, setFilter, selection }: FocusOptions) {
  const { pickNode, setSelected, setSelectedEdge, setPending } = selection

  const focusOn = useCallback((lat: number, lng: number) => {
    webViewRef.current?.injectJavaScript(`window.__surveyV3Focus && window.__surveyV3Focus(${lat}, ${lng}); true;`)
    // webViewRef is a ref.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  /** Draws the Server tab test routes (found by the server) over the survey lines. An empty list clears them. */
  const showRouteLines = useCallback((lines: RouteLine[]) => {
    webViewRef.current?.injectJavaScript(`window.__surveyV3Routes && window.__surveyV3Routes(${JSON.stringify(lines)}); true;`)
    const first = lines[0]?.points[0]
    if (first) webViewRef.current?.injectJavaScript(`window.__surveyV3Focus && window.__surveyV3Focus(${first[0]}, ${first[1]}); true;`)
    // webViewRef is a ref.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const scrollPanelTop = () => panelRef.current?.scrollTo({ y: 0, animated: false })

  const focusNode = (id: string) => {
    const node = findNode(storeRef.current, id)
    if (!node) return
    if (!isNodeStrong(node, filter)) setFilter(NO_FILTER)
    pickNode(id)
    setSelectedEdge(null)
    setPending(null)
    focusOn(node.lat, node.lng)
    scrollPanelTop()
  }

  const focusEdge = (id: string) => {
    const edge = findEdge(storeRef.current, id)
    const a = findNode(storeRef.current, edge?.a)
    const b = findNode(storeRef.current, edge?.b)
    if (!edge || !a || !b) return false
    if (!isNodeStrong(a, filter) || !isNodeStrong(b, filter)) setFilter(NO_FILTER)
    setSelectedEdge(id)
    setSelected(null)
    setPending(null)
    focusOn((a.lat + b.lat) / 2, (a.lng + b.lng) / 2)
    scrollPanelTop()
    return true
  }

  const goToIssue = (issue: CheckIssue) => {
    if (issue.edgeId && focusEdge(issue.edgeId)) return
    if (issue.nodeId) focusNode(issue.nodeId)
  }

  return { focusOn, showRouteLines, scrollPanelTop, focusNode, goToIssue }
}
