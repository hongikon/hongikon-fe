/**
 * 다른 화면이 지도 탭에 "이걸 해 달라"고 넘기는 한 번짜리 요청.
 * - pickPartnerLocation: 설정의 제휴 제보 창에서 "지도에서 위치 찍기"를 누르면 지도 탭으로 옮겨 가 핀 고르기를 시작한다.
 * - focusReport: 제보 알림(REPORT_STATUS 승인·REPORT_NEW)이나 내 제보 내역의 "지도에 표시 중" 제보를 누르면 제보 레이어를 켜고 그 제보를 가운데에 띄운다.
 * - previewLocation: 관리 탭 제보 검토의 "지도에서 보기" → 지도 탭으로 옮겨 그 좌표에 임시 핀을 찍고 가운데로(승인 전 제보도 볼 수 있게).
 * - startReport: 내 제보 내역이 비어 있을 때 "지도로 가서 제보하기" → 제보 위치 고르기를 시작한다(게스트면 로그인 안내).
 * 지도 화면은 포커스될 때 요청을 꺼내(consume) 처리한다 — 두 번 처리되지 않는다.
 */
export type MapIntent =
  | { type: 'pickPartnerLocation' }
  | { type: 'focusReport'; reportId: number }
  | { type: 'startReport' }
  | { type: 'previewLocation'; lat: number; lng: number; label?: string }

let pending: MapIntent | null = null
const listeners = new Set<() => void>()

export function requestMapIntent(intent: MapIntent): void {
  pending = intent
  listeners.forEach((listener) => listener())
}

export function consumeMapIntent(): MapIntent | null {
  const intent = pending
  pending = null
  return intent
}

/** 지도 탭이 이미 떠 있는 상태에서 요청이 오면 바로 처리할 수 있게 알린다. */
export function subscribeMapIntent(listener: () => void): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}
