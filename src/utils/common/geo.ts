const EARTH_RADIUS_METERS = 6371000
const DEGREES_TO_RADIANS = Math.PI / 180

/** 두 좌표 사이의 대권 거리(m). */
export function haversineMeters(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  const dLat = (lat2 - lat1) * DEGREES_TO_RADIANS
  const dLng = (lng2 - lng1) * DEGREES_TO_RADIANS
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * DEGREES_TO_RADIANS) *
      Math.cos(lat2 * DEGREES_TO_RADIANS) *
      Math.sin(dLng / 2) ** 2
  return EARTH_RADIUS_METERS * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}
