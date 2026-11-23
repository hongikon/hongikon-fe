import { useEffect, useState } from 'react'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { useAuth } from '../../../contexts/AuthContext'
import { getNearbySettings, nearbyAlertsAvailable } from '../../../lib/nearbyPartners/background'
import { DISMISSED_KEY } from '../../../utils/map/nearby/nearbyAlertPromo'
import { requestSettingsIntent } from '../../../lib/settingsIntents'
import { navigationRef } from '../../../navigation/navigationRef'

/** NearbyAlertPromo 의 상태·효과·핸들러. 화면 파일은 이 훅을 불러 그리기만 한다. */
export function useNearbyAlertPromo() {
  const { status } = useAuth();
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (!nearbyAlertsAvailable() || status !== "authenticated") return;
    let alive = true;
    void (async () => {
      const dismissed = await AsyncStorage.getItem(DISMISSED_KEY).catch(() => null);
      if (dismissed) return;
      const settings = await getNearbySettings();
      if (alive && !settings.enabled) setShow(true);
    })();
    return () => {
      alive = false;
    };
  }, [status]);

  const dismiss = () => {
    setShow(false);
    AsyncStorage.setItem(DISMISSED_KEY, "1").catch(() => {});
  };

  const open = () => {
    requestSettingsIntent({ type: "openNearbyAlerts" });
    if (navigationRef.isReady()) navigationRef.navigate("Main", { screen: "Settings" });
  };
  return { show, setShow, dismiss, open }
}
