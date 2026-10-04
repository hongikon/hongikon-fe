import { navigationRef } from '../navigation/navigationRef'

/**
 * 관리자 알림(ADMIN_*, 승인 대기 리마인드 ADMIN_REPORT_REMINDER 포함)을 탭했을 때 관리 탭에 넘기는 한 번짜리 요청 — `mapIntents` 와 같은 방식.
 * - reports: 제보 검토 섹션을 그 필터(승인 대기 / 숨김)로 열고, reportId 가 있으면 그 제보를 맨 위에 강조한다.
 * - feedback: 문의 섹션을 열고, feedbackId 가 있으면 그 문의를 맨 위에 강조한다.
 *
 * 관리 탭(`AdminTabScreen`)이 포커스될 때(또는 이미 떠 있으면 바로) 꺼내(consume) 처리한다.
 * 관리자인지 아직 모를 때(콜드 스타트 — 관리 탭은 서버 확인 뒤에 붙는다)는 `AdminAccessProvider` 가
 * 확인이 끝날 때까지 기다렸다가 관리 탭을 열거나, 관리자가 아니면 지도 탭으로 보내고 안내한다.
 * 이 파일은 관리 화면 코드를 불러오지 않는다(관리 탭은 처음 열 때 불러온다).
 */
export type AdminIntent =
  | { section: 'reports'; reportFilter: 'PENDING' | 'HIDDEN'; reportId: number | null }
  | { section: 'feedback'; feedbackId: number | null }
  /** 정지 이력 회원 재가입(ADMIN_MEMBER_REJOINED) — 회원 화면을 그 회원 id 로 검색해 연다. */
  | { section: 'users'; userId: number | null }

let pending: AdminIntent | null = null
const intentListeners = new Set<() => void>()
const receivedListeners = new Set<() => void>()

export function requestAdminIntent(intent: AdminIntent): void {
  pending = intent
  intentListeners.forEach((listener) => listener())
}

export function peekAdminIntent(): AdminIntent | null {
  return pending
}

export function consumeAdminIntent(): AdminIntent | null {
  const intent = pending
  pending = null
  return intent
}

export function subscribeAdminIntent(listener: () => void): () => void {
  intentListeners.add(listener)
  return () => {
    intentListeners.delete(listener)
  }
}

/** 앱이 켜져 있을 때 관리자 알림이 도착했다 — 관리 탭 배지·대시보드 수치를 다시 받게 알린다. */
export function notifyAdminAlertReceived(): void {
  receivedListeners.forEach((listener) => listener())
}

export function subscribeAdminAlertReceived(listener: () => void): () => void {
  receivedListeners.add(listener)
  return () => {
    receivedListeners.delete(listener)
  }
}

/** 하단 탭에 관리 탭이 붙어 있으면 그리로 옮기고 true. 아직 없으면(관리자 확인 전·관리자 아님) false. */
export function navigateToAdminTab(): boolean {
  if (!navigationRef.isReady()) return false
  const main = navigationRef.getRootState()?.routes.find((route) => route.name === 'Main')
  const routeNames = (main?.state as { routeNames?: string[] } | undefined)?.routeNames
  if (!routeNames?.includes('Admin')) return false
  navigationRef.navigate('Main', { screen: 'Admin' })
  return true
}
