/**
 * 도보 속도. 직선거리를 이 값으로 나눠 소요 시간을 추정한다.
 * TODO: 출처 미확인 값 — 실제 캠퍼스 보행 속도로 검증 필요.
 */
export const WALKING_METERS_PER_MINUTE = 80

/** 한 개 층을 오르내리는 데 걸리는 시간(초). */
export const FLOOR_TRANSIT_SECONDS = 20

/**
 * 길찾기 기능 공개 여부. 꺼져 있으면 지도 길찾기 버튼과 건물 시트의 출발/도착을 아예 그리지 않는다
 * ("다음 업데이트" 같은 미완성 안내는 심사 2.1 거절 사유라 띄우지 않는다).
 * 11-03 켬: 경로 조사 자료(surveyPaths.ts)로 17개 건물 사이는 실측 경로, 나머지는 직선 거리 어림으로 보여 준다.
 */
export const ROUTE_FINDING_ENABLED = true

/**
 * 지도 메뉴 "내 위치 켜기"를 보이기 시작하는 날(한국 시간, YYYY-MM-DD). 이 기능을 더한 개인정보 처리방침(11-16판)이
 * 적용되는 날이다 — 처리방침은 바꾸면 적용일 7일 전부터 공지한다(11-06 공지, 운영 OTA). 날짜를 옮기면 legalText.ts 와 공지(id 7)도 같이 옮긴다.
 */
export const MY_LOCATION_BUTTON_FROM = '2026-11-16'
