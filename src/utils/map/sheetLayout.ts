/** 시트가 잰 높이가 이만큼(dp) 이내로만 바뀌면 무시한다. */
export const LAYOUT_JITTER_DP = 2

/**
 * 시트 머리줄·본문이 잰 높이를 상태에 넣기 전에 다듬는다(11-27).
 *
 * 내용이 짧은 시트는 본문 높이에 맞춰 시트 높이를 정하고, 시트 높이가 바뀌면 본문을 다시 잰다. 갤럭시 S22 처럼 화면 배율이
 * 소수(2.8125)인 기기에서는 이 값이 반올림 때문에 1dp 씩 오락가락해, 시트가 두 높이 사이를 계속 오가며 위아래로 떨렸다
 * (사용자 영상: 시트만 3px = 1dp 씩 -3/+3 반복). 그래서 정수 dp 로 올리고, 이전 값과 `tolerance` 이내면 이전 값을 그대로 둔다
 * — 같은 값이면 React 가 다시 그리지 않아 되먹임이 멈춘다.
 */
export function settleLayoutSize(prev: number | null, measured: number, tolerance = LAYOUT_JITTER_DP): number {
  const next = Math.ceil(measured)
  if (prev != null && Math.abs(next - prev) <= tolerance) return prev
  return next
}
