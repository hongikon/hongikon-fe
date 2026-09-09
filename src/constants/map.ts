/**
 * 지도 페이지(map.html)를 호스팅하는 주소. iOS WKWebView는 인라인 HTML을
 * baseUrl과 함께 넣어도 실제 요청 origin이 비어, 도메인 기반인 네이버 지도
 * 인증이 항상 실패한다(2026-08-10 확인). 그래서 실제 도메인에서 정적으로
 * 서빙하고 원격 URL로 불러온다. scripts/generate-map-html.ts로 생성해
 * 이 주소(Netlify)에 배포한 것과 항상 같은 내용이어야 한다.
 */
export const MAP_PAGE_URL = 'https://hongmap12.netlify.app/map.html'

/** 캠퍼스 중심. 지도 초기 위치이자 제휴 마커 화면 맞춤의 기준점이다. */
export const CAMPUS_CENTER = { lat: 37.5508, lng: 126.9237 } as const

/** 지도 초기 줌 레벨. 캠퍼스 전체가 한 화면에 들어온다. */
export const DEFAULT_ZOOM = 17

/**
 * 제휴 마커를 화면에 맞출 때 기준이 되는 반경(m).
 * 이 밖의 지점(구로·강남·성수·방화·은평 등)은 지도에 찍히되 화면 맞춤 계산에서는 뺀다.
 * 빼지 않으면 칩 하나를 누를 때마다 지도가 서울 전체로 줌아웃된다.
 */
export const PARTNER_FOCUS_RADIUS_METERS = 2000

/** 화면 맞춤 시 마커가 가장자리에 붙지 않도록 두는 여유 위·경도. */
export const PARTNER_BOUNDS_PADDING_DEGREES = 0.0008

/**
 * 제휴 마커 아이콘 배지의 한 변(px). 네이버 기본 지도 라벨처럼
 * 배지(위) + 상호명(아래)으로 쌓는다.
 * 미터가 아니라 화면 픽셀이라, 줌을 아무리 당기고 밀어도 같은 크기로 보인다.
 */
export const PARTNER_BADGE_SIZE_PX = 26

/** 선택된 업체의 배지 한 변(px). 살짝만 키워 어느 것을 골랐는지 알린다. */
export const PARTNER_BADGE_SIZE_SELECTED_PX = 30

/**
 * 건물 핀의 가로 폭(px). 물방울 모양이라 세로는 이 값의 1.32배가 된다.
 * 제휴 배지(둥근 사각형)와 모양을 다르게 둬, 둘을 같이 켜 놔도 섞이지 않는다.
 * 제휴 배지처럼 미터가 아니라 화면 픽셀이라 줌과 무관하게 같은 크기로 보인다.
 */
export const BUILDING_PIN_WIDTH_PX = 22

/** 선택된 건물의 핀 폭(px). 어느 것을 골랐는지 알리는 정도로만 키운다. */
export const BUILDING_PIN_WIDTH_SELECTED_PX = 27

/**
 * 마커를 누른 직후 이 시간(ms) 안에 들어온 지도 배경 클릭은 무시한다.
 * 네이버 지도는 마커 클릭이 지도 클릭으로도 전달되는 경우가 있어,
 * 제휴 마커를 눌렀는데 건물 배너가 같이 뜨는 것을 막는다.
 */
export const MARKER_CLICK_GUARD_MS = 350

/**
 * 제휴 마커 배지 중심끼리 이 거리(화면 px) 안이면 "겹친 것"으로 본다.
 * 홍대 골목처럼 가게가 촘촘한 곳은 실거리 10~20m가 흔한 줌 레벨에서
 * 배지 하나 폭(px)보다 가깝게 찍혀, 위에 그려진 마커가 아래 것의
 * 탭을 계속 가로챈다. 그런 겹침을 감지해 같은 자리를 다시 누를 때마다
 * 겹친 업체를 순서대로 보여주는 데 쓴다(`selectPartner` 참고).
 */
export const PARTNER_OVERLAP_CYCLE_PX = 40
