/**
 * 소식 검색 화면을 아래로 끌어내려 닫는 손동작의 기준. `hooks/news/useSearchSheetDismiss` 가 쓰고
 * `scripts/test/news-search.test.ts` 가 확인한다.
 */

/** iOS: 목록 맨 위에서 이만큼 더 끌어내렸다 놓으면 닫는다(바운스로 늘어난 거리). */
export const PULL_CLOSE_DISTANCE = 70
/** 머리 카드를 이만큼 끌어내리거나 빠르게 튕기면 닫는다. */
export const DRAG_CLOSE_DISTANCE = 120
export const DRAG_CLOSE_VELOCITY = 0.9

/** 아래로, 세로가 확실할 때만 잡는다 — 뒤로 가기·검색창 누르기와 가로 동작은 그대로 둔다. */
export function isDownwardDrag(dx: number, dy: number): boolean {
  return dy > 8 && Math.abs(dy) > Math.abs(dx) * 1.5
}

/** 머리 카드를 놓았을 때 닫을 만큼 내렸거나 빠르게 튕겼는지. */
export function shouldCloseOnRelease(dy: number, vy: number): boolean {
  return dy > DRAG_CLOSE_DISTANCE || vy > DRAG_CLOSE_VELOCITY
}

/** 목록을 놓았을 때 맨 위에서 더 끌어내린 거리로 닫을지. 바운스가 있는 iOS 에서만. */
export function shouldCloseOnPull(platform: string, contentOffsetY: number): boolean {
  return platform === 'ios' && contentOffsetY < -PULL_CLOSE_DISTANCE
}
