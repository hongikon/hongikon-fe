import { loadStoreV3 } from '../pathSurveyV3/store'
import { DEFAULT_LEGACY, type LegacyToggles } from '../../screens/pathSurvey/LegacyPanel'

/** The overlay starts hidden here: the new graph is the main thing on this screen. */
export const LEGACY_OFF: LegacyToggles = {
  ...DEFAULT_LEGACY,
  plainNodes: false,
  namedNodes: false,
  nodeEdges: false,
  anchorEdges: false,
  unconnectedEntrances: false,
}

export const initialLoad = () => loadStoreV3()
