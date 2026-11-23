import { PATH_WAYPOINTS } from '../../constants/pathNodes'
import { loadStore } from '../pathSurvey/store'

export const initialLoad = () => loadStore(PATH_WAYPOINTS)
