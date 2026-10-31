/**
 * 웹은 근처 알림이 없다(브라우저는 페이지가 닫힌 뒤 위치 경계를 감시할 수 없다). `background.ts` 와 같은 이름만 내보낸다.
 */
import type { NearbyChecklist, NearbyPermission, NearbySettings, NearbySource } from './background'

export type { NearbyChecklist, NearbyPermission, NearbySettings, NearbySource }

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

export async function getNearbySettings(): Promise<NearbySettings> {
  return { enabled: false, affiliation: null, targetCount: 0, quietNight: false, dwellMinutes: { cafe: 2, other: 5 }, muted: [] }
}

export async function getNearbyChecklist(): Promise<NearbyChecklist> {
  return { notifications: false, always: false, precise: null }
}

export async function setNearbyPrefs(): Promise<void> {}

export async function muteNearbyPartners(): Promise<void> {}

export async function unmuteNearbyPartner(): Promise<void> {}

export async function handleNearbyNotificationAction(): Promise<string | null> {
  return null
}

export async function sendNearbyTestAlert(): Promise<string> {
  return '웹에서는 근처 알림을 쓸 수 없어요.'
}

export async function syncNearbyAlerts(): Promise<boolean> {
  return false
}

export async function disableNearbyAlerts(): Promise<void> {}

export async function wipeNearbyAlerts(): Promise<void> {}

export async function resetNearbyHistoryForDebug(): Promise<void> {}

export async function runNotificationScheduleTest(): Promise<void> {}

export async function applyNearbyTestLocation(): Promise<boolean> {
  return false
}

export async function getNearbyOverlay(): Promise<null> {
  return null
}

export function nearbyGeofencingUnsupported(): boolean {
  return false
}

export async function getNearbyDebugInfo(): Promise<null> {
  return null
}
