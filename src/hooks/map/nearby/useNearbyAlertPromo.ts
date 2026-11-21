import { useEffect, useState } from 'react'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { useAuth } from '../../../contexts/AuthContext'
import { getNearbySettings, nearbyAlertsAvailable } from '../../../lib/nearbyPartners/background'
import { DISMISSED_KEY } from '../../../utils/map/nearby/nearbyAlertPromo'

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
  return { show, setShow }
}
