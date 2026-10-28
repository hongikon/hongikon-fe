/**
 * 웹은 근처 알림이 없다(브라우저는 페이지가 닫힌 뒤 위치 경계를 감시할 수 없다). `background.ts` 와 같은 이름만 내보낸다.
 */
import type { NearbyPermission, NearbySource } from './background'
import type { PartnerAffiliation } from '../../types'

export type { NearbyPermission, NearbySource }

export const NEARBY_TASK = 'hongikon-nearby-partners'
export const NEARBY_CHANNEL_ID = 'nearby-partner'

export function nearbyAlertsAvailable(): boolean {
  return false
}

export async function getNearbyPermission(): Promise<NearbyPermission> {
  return { status: 'unavailable' }
}

export async function requestNearbyPermission(): Promise<NearbyPermission> {
  return { status: 'unavailable' }
}

export async function getNearbySettings(): Promise<{ enabled: boolean; affiliation: PartnerAffiliation | null; targetCount: number }> {
  return { enabled: false, affiliation: null, targetCount: 0 }
}

export async function syncNearbyAlerts(): Promise<boolean> {
  return false
}

export async function disableNearbyAlerts(): Promise<void> {}

export async function wipeNearbyAlerts(): Promise<void> {}

export async function resetNearbyHistoryForDebug(): Promise<void> {}

export async function getNearbyOverlay(): Promise<null> {
  return null
}

export function nearbyGeofencingUnsupported(): boolean {
  return false
}

export async function getNearbyDebugInfo(): Promise<null> {
  return null
}
