import {
  CAMPUS_CENTER,
  CAMPUS_VIEW_RADIUS_METERS,
  FAR_PARTNER_VIEW_RADIUS_METERS,
  MAP_MIN_ZOOM,
  PARTNER_BOUNDS_PADDING_DEGREES,
  PARTNER_FOCUS_RADIUS_METERS,
} from '../constants/map'
import { haversineMeters } from './geo'

/** 지도를 끌어 옮길 수 있는 사각 범위(위·경도). */
export interface ViewBox {
  south: number
  west: number
  north: number
  east: number
}

const METERS_PER_DEGREE_LAT = 111_320

/** center 에서 동서남북 radiusMeters 까지의 사각 범위. 캠퍼스 일대(수 km)라 평면 근사로 충분하다. */
export function boxAround(center: { lat: number; lng: number }, radiusMeters: number): ViewBox {
  const dLat = radiusMeters / METERS_PER_DEGREE_LAT
  const dLng = radiusMeters / (METERS_PER_DEGREE_LAT * Math.cos((center.lat * Math.PI) / 180))
  return { south: center.lat - dLat, west: center.lng - dLng, north: center.lat + dLat, east: center.lng + dLng }
}

export const CAMPUS_VIEW_BOX = boxAround(CAMPUS_CENTER, CAMPUS_VIEW_RADIUS_METERS)

/** 캠퍼스 범위 밖이라 검색으로만 찾아가는 지점인가(제휴 화면 맞춤에서 빼는 기준과 같다). */
export function isFarFromCampus(point: { lat: number; lng: number }): boolean {
  return haversineMeters(CAMPUS_CENTER.lat, CAMPUS_CENTER.lng, point.lat, point.lng) > PARTNER_FOCUS_RADIUS_METERS
}

/** 먼 지점 하나를 볼 때의 범위 — 그 지점 둘레만. */
export function farPointViewBox(point: { lat: number; lng: number }): ViewBox {
  return boxAround(point, FAR_PARTNER_VIEW_RADIUS_METERS)
}

/**
 * 지도 페이지에 넣는 스크립트. 페이지 전역 `map`(네이버 지도)의 이동 범위·최소 줌을 바꾼다 — 이미 배포된 원격 map.html 에도
 * 그대로 먹히게 새 메시지 타입 대신 전역을 직접 만진다(학사모 버튼과 같은 방식). 지도가 아직 없으면 아무것도 하지 않는다.
 */
export function viewBoundsScript(box: ViewBox): string {
  const values = [box.south, box.west, box.north, box.east].map((value) => Number(value.toFixed(7)))
  return (
    'if (window.map && window.naver) { map.setOptions({ minZoom: ' +
    MAP_MIN_ZOOM +
    ', maxBounds: new naver.maps.LatLngBounds(new naver.maps.LatLng(' +
    values[0] +
    ', ' +
    values[1] +
    '), new naver.maps.LatLng(' +
    values[2] +
    ', ' +
    values[3] +
    ')) }); } true;'
  )
}

/**
 * 홍익대 중심이 화면 가운데에 오도록, 중심에서 위아래·좌우로 같은 만큼 넓힌 범위(10-08 요청 — 편의시설 칩).
 * 주어진 지점이 모두 들어오는 가장 작은 대칭 범위에 여백을 더한다. 지점이 없으면 null.
 */
export function campusCenteredBounds(
  points: readonly { lat: number; lng: number }[],
): { swLat: number; swLng: number; neLat: number; neLng: number } | null {
  if (points.length === 0) return null
  const dLat = Math.max(...points.map((p) => Math.abs(p.lat - CAMPUS_CENTER.lat))) + PARTNER_BOUNDS_PADDING_DEGREES
  const dLng = Math.max(...points.map((p) => Math.abs(p.lng - CAMPUS_CENTER.lng))) + PARTNER_BOUNDS_PADDING_DEGREES
  return {
    swLat: CAMPUS_CENTER.lat - dLat,
    swLng: CAMPUS_CENTER.lng - dLng,
    neLat: CAMPUS_CENTER.lat + dLat,
    neLng: CAMPUS_CENTER.lng + dLng,
  }
}
