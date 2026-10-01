/**
 * 도보 속도. 직선거리를 이 값으로 나눠 소요 시간을 추정한다.
 * TODO: 출처 미확인 값 — 실제 캠퍼스 보행 속도로 검증 필요.
 */
export const WALKING_METERS_PER_MINUTE = 80

/** 한 개 층을 오르내리는 데 걸리는 시간(초). */
export const FLOOR_TRANSIT_SECONDS = 20

/**
 * 길찾기 기능 공개 여부. 실측 경로망(pathNodes.ts)이 캠퍼스 전체를 덮기 전까지는
 * 첫 출시에서 막는다. 꺼져 있으면 지도 길찾기 버튼과 건물 시트의 출발/도착을 아예
 * 그리지 않는다("다음 업데이트" 같은 미완성 안내는 심사 2.1 거절 사유라 띄우지 않는다).
 * 경로 데이터가 채워지면 true 로 바꾸면 그대로 살아난다.
 */
export const ROUTE_FINDING_ENABLED = false
