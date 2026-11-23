/**
 * 예시 그림의 가운데 지점(11-02 운영진이 고름, 소코아 홍대점 위치). 상수역 앞 제휴업체가 모인 골목이다. 알림 영역은 가게마다 그린다.
 * 배경 그림이 이 업체를 정가운데에 두고 찍은 것이라, 업체를 바꾸면 그림도 다시 찍어야 한다.
 */
export const CENTER = { name: '소코아 홍대점', lat: 37.548639, lng: 126.920953 } as const

export const IMAGE_CSS_WIDTH = 500

export const IMAGE_ASPECT = 500 / 350

/** 네이버 지도(웹 메르카토르)에서 확대 단계 zoom 의 CSS 1px 당 미터. */
export function metersPerPixel(zoom: number): number {
  return (156543.03392 * Math.cos((CENTER.lat * Math.PI) / 180)) / 2 ** zoom
}

/** 웹 메르카토르에서 확대 단계 zoom 의 화면 좌표(CSS px). 그림 가운데(`CENTER`)와의 차이로 업체 위치를 그림 위에 찍는다. */
export function project(lat: number, lng: number, zoom: number): { x: number; y: number } {
  const world = 256 * 2 ** zoom
  const sin = Math.sin((lat * Math.PI) / 180)
  return { x: ((lng + 180) / 360) * world, y: (0.5 - Math.log((1 + sin) / (1 - sin)) / (4 * Math.PI)) * world }
}
