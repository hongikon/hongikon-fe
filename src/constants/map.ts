/** 캠퍼스 중심. 지도 초기 위치이자 제휴 마커 화면 맞춤의 기준점이다. */
export const CAMPUS_CENTER = { lat: 37.5508, lng: 126.9237 } as const

/** 지도 초기 줌 레벨. 캠퍼스 전체가 한 화면에 들어온다. */
export const DEFAULT_ZOOM = 17

/**
 * 지도 배경(라벨 포함) 아무 곳이나 탭했을 때, 이 반경(m) 안에서 가장 가까운
 * 건물을 찾아 정보 배너를 띄운다.
 */
export const TAP_RADIUS_METERS = 15

/**
 * 제휴 마커를 화면에 맞출 때 기준이 되는 반경(m).
 * 이 밖의 지점(구로·강남·성수·방화·은평 등)은 지도에 찍히되 화면 맞춤 계산에서는 뺀다.
 * 빼지 않으면 칩 하나를 누를 때마다 지도가 서울 전체로 줌아웃된다.
 */
export const PARTNER_FOCUS_RADIUS_METERS = 2000

/** 화면 맞춤 시 마커가 가장자리에 붙지 않도록 두는 여유 위·경도. */
export const PARTNER_BOUNDS_PADDING_DEGREES = 0.0008

/**
 * 제휴 업체 점의 지름(px).
 * 미터가 아니라 화면 픽셀이라, 줌을 아무리 당기고 밀어도 같은 크기로 보인다.
 */
export const PARTNER_DOT_SIZE_PX = 12

/** 선택된 업체의 점 지름(px). 살짝만 키워 어느 것을 골랐는지 알린다. */
export const PARTNER_DOT_SIZE_SELECTED_PX = 15

/**
 * 좌표 위에 두는 투명한 탭 영역의 지름(px).
 * 점이 12px라 그대로는 누르기 어려워, 실제 터치 판정은 이 영역이 받는다.
 */
export const PARTNER_HIT_AREA_PX = 24

/**
 * 마커를 누른 직후 이 시간(ms) 안에 들어온 지도 배경 클릭은 무시한다.
 * 네이버 지도는 마커 클릭이 지도 클릭으로도 전달되는 경우가 있어,
 * 제휴 마커를 눌렀는데 건물 배너가 같이 뜨는 것을 막는다.
 */
export const MARKER_CLICK_GUARD_MS = 350
