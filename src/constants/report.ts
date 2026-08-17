/**
 * 지도를 이만큼 길게 누르면 제보 작성이 열린다.
 *
 * 짧으면 지도를 탭해 건물 배너를 볼 때마다 작성창이 튀어나오고, 길면 눌러도
 * 반응이 없는 것으로 느껴진다. 2초는 그 사이에서 고른 값이다.
 */
export const REPORT_LONG_PRESS_MS = 2000

/**
 * 길게 누르는 동안 손가락이 이만큼(px) 넘게 움직이면 취소한다.
 * 지도를 끌어 옮기려던 동작이 제보 작성으로 오인되는 것을 막는다.
 */
export const REPORT_LONG_PRESS_MOVE_TOLERANCE_PX = 10

/** `docs/report-api-spec.md` §4.1 기준 상한. 서버 검증과 같은 값을 쓴다. */
export const REPORT_TITLE_MAX_LENGTH = 100
export const REPORT_CONTENT_MAX_LENGTH = 500

/**
 * 제보가 지도에 남아 있는 시간 선택지(시간 단위).
 *
 * `docs/report-api-spec.md` §3-4 "`ends_at` 상한"은 아직 서버와 확정되지 않았다.
 * 여기 최댓값(6시간)이 앱이 보내는 사실상의 상한이며, 확정되면 이 배열과
 * 스펙 문서를 함께 고친다. 상한이 없으면 끝난 제보가 지도를 덮는다.
 */
export const REPORT_DURATION_OPTIONS_HOURS: readonly number[] = [1, 2, 3, 6]

/** 작성창을 열었을 때 미리 골라져 있는 지속 시간. */
export const REPORT_DEFAULT_DURATION_HOURS = 2
