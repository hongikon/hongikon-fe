/**
 * 다른 화면(알림 탭 등)이 설정 탭에 "이 창을 열어 달라"고 넘기는 한 번짜리 요청. `mapIntents` 와 같은 방식이다.
 * - openMyReports: 반려 알림을 탭하면 내 제보 내역을 열고 그 제보를 맨 위로 강조한다(반려된 제보는 지도에 없다).
 * 설정 화면은 포커스될 때(또는 이미 떠 있으면 즉시) 요청을 꺼내 처리한다 — 두 번 처리되지 않는다.
 */
export type SettingsIntent =
  | { type: 'openMyReports'; reportId: number | null }
  /** 제휴 시트의 "근처에 있을 때 알려 드릴까요?" → 설정 > 근처 제휴 알림 창. */
  | { type: 'openNearbyAlerts' }
  /** 물어보기 '알림 설정 어떻게 해'(11-09) → 설정 > 알림 묶음을 펼친다. */
  | { type: 'openAlerts' }
  /** 물어보기 '구독 어떻게 해'(11-09) → 구독 관리 창. */
  | { type: 'openSubscriptions' }

let pending: SettingsIntent | null = null
const listeners = new Set<() => void>()

export function requestSettingsIntent(intent: SettingsIntent): void {
  pending = intent
  listeners.forEach((listener) => listener())
}

export function consumeSettingsIntent(): SettingsIntent | null {
  const intent = pending
  pending = null
  return intent
}

export function subscribeSettingsIntent(listener: () => void): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}
