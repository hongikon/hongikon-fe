import { useEffect, useMemo } from 'react'
import { AppState } from 'react-native'
import { partnersNear } from '../../../lib/nearbyPartners/rules'
import { canLocate, getLocationPermission, locateOnce } from '../../../lib/nearbyPartners/platform'
import { NEARBY_RADIUS_METERS, NEARBY_LIMIT } from '../../../utils/map/partner/nearbyPartners'
import type { NearbyPartnersProps } from '../../../components/map/partner/NearbyPartners'

/** NearbyPartners 의 상태·효과·핸들러. 화면 파일은 이 훅을 불러 그리기만 한다. */
export function useNearbyPartners({ partners, state, onStateChange }: Pick<NearbyPartnersProps, 'partners' | 'state' | 'onStateChange'>) {
  const available = useMemo(() => canLocate(), []);

  const located = state.kind === "done" && state.result.status === "ok" ? state.result : null;
  const nearby = useMemo(
    () => (located ? partnersNear(partners, located.lat, located.lng, NEARBY_RADIUS_METERS, NEARBY_LIMIT) : []),
    [partners, located],
  );
  // 500m 안에 없으면 가장 가까운 한 곳이라도 보여 준다(캠퍼스에서 먼 곳에서 "없어요"로 끝나지 않게).
  const closest = useMemo(
    () => (located && nearby.length === 0 ? partnersNear(partners, located.lat, located.lng, Infinity, 1)[0] ?? null : null),
    [partners, located, nearby.length],
  );

  const locate = async () => {
    onStateChange({ kind: "locating" });
    const result = await locateOnce("nearby");
    // 위치 정보 사용 안내에서 '동의하지 않음' — 처음 상태로(버튼을 다시 누를 수 있게).
    onStateChange(result.status === "declined" ? { kind: "idle" } : { kind: "done", result });
  };

  // 휴대폰 설정에서 권한·위치를 켜고 돌아오면 다시 누르지 않아도 바로 찾는다.
  const waitingForSettings =
    state.kind === "done" && (state.result.status === "denied" || state.result.status === "servicesOff");
  useEffect(() => {
    if (!waitingForSettings) return;
    const sub = AppState.addEventListener("change", async (next) => {
      if (next !== "active") return;
      const permission = await getLocationPermission();
      if (permission?.status === "granted") void locate();
    });
    return () => sub.remove();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [waitingForSettings]);
  return { available, located, nearby, closest, locate }
}
