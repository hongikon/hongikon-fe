/**
 * 도보 속도. 직선거리를 이 값으로 나눠 소요 시간을 추정한다.
 * TODO: 출처 미확인 값 — 실제 캠퍼스 보행 속도로 검증 필요.
 */
export const WALKING_METERS_PER_MINUTE = 80

/** 한 개 층을 오르내리는 데 걸리는 시간(초). 계단 수직 간선과, 조사되지 않은 층의 출입구 어림에 쓴다. */
export const FLOOR_TRANSIT_SECONDS = 20

/** 엘리베이터를 한 번 타는 데 드는 고정 시간(기다림·타고 내림, 초). TODO: 실측 필요. */
export const ELEVATOR_WAIT_SECONDS = 30

/** 엘리베이터가 한 층 움직이는 데 걸리는 시간(초). TODO: 실측 필요. */
export const ELEVATOR_SECONDS_PER_FLOOR = 4

/**
 * 길찾기 기능 공개 여부. 꺼져 있으면 지도 길찾기 버튼과 건물 시트의 출발/도착을 아예 그리지 않는다
 * ("다음 업데이트" 같은 미완성 안내는 심사 2.1 거절 사유라 띄우지 않는다).
 * 11-03 켬: 경로 조사 자료(surveyPaths.ts)로 17개 건물 사이는 실측 경로, 나머지는 직선 거리 어림으로 보여 준다.
 * 11-08: 경로망 조사 v3(건물 23곳·실내 층·엘리베이터·계단)로 바꿈.
 * 11-09: 길찾기 계산을 서버로 옮김(GET /map/routes, hongikon-be walkroute). 앱에는 경로망을 두지 않는다.
 */
export const ROUTE_FINDING_ENABLED = true

/**
 * 지도 메뉴 "내 위치 켜기"를 보이기 시작하는 날(한국 시간, YYYY-MM-DD). 이 기능을 더한 개인정보 처리방침(11-16판)이
 * 적용되는 날이다 — 처리방침은 바꾸면 적용일 7일 전부터 공지한다(11-06 공지, 운영 OTA). 날짜를 옮기면 legalText.ts 와 공지(id 7)도 같이 옮긴다.
 */
export const MY_LOCATION_BUTTON_FROM = '2026-11-16'

/**
 * 길찾기 결과 카드에 길 설명 글(흐름 "R동 1층 출구 → T동 3층 출입구 …"·지나는 곳 조사 메모)을 보여 줄지.
 * 11-11 끔(사용자 요청): 설명이 아직 정확하지 않아 지도 위 경로 선·시간·거리만 보여 준다.
 * 서버는 steps·notes 를 그대로 보내고 앱도 받아 두니, 설명을 다듬은 뒤 true 로 돌리면 된다.
 */
export const ROUTE_DIRECTIONS_TEXT_ENABLED = false
