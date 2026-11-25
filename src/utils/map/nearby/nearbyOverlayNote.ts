import { requestSettingsIntent } from '../../../lib/settingsIntents'
import { navigationRef } from '../../../navigation/navigationRef'

/** 등록 전 안내의 바로가기: 설정 > 근처 제휴 알림 창으로(제휴 시트의 안내와 같은 길, 11-09). */
export function openNearbyAlertSettings() {
  requestSettingsIntent({ type: 'openNearbyAlerts' })
  if (navigationRef.isReady()) navigationRef.navigate('Main', { screen: 'Settings' })
}
