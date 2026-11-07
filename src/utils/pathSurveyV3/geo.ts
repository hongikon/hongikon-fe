/** Small geometry helpers. Coordinates are [lat, lng]. */

const EARTH_RADIUS_M = 6371008.8
const rad = (deg: number) => (deg * Math.PI) / 180

export function haversineMeters(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const dLat = rad(lat2 - lat1)
  const dLng = rad(lng2 - lng1)
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(dLng / 2) ** 2
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h)))
}

export const roundMeters = (meters: number) => Math.round(meters * 10) / 10

/** Ray casting. A ring needs at least three points. */
export function pointInRing(lat: number, lng: number, ring: readonly (readonly [number, number])[]): boolean {
  if (ring.length < 3) return false
  let inside = false
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [latI, lngI] = ring[i]
    const [latJ, lngJ] = ring[j]
    if (latI > lat !== latJ > lat && lng < ((lngJ - lngI) * (lat - latI)) / (latJ - latI) + lngI) inside = !inside
  }
  return inside
}

/** Distance in meters from a point to the outline of a ring (flat projection, fine at campus scale). */
export function distanceToRingMeters(lat: number, lng: number, ring: readonly (readonly [number, number])[]): number {
  if (ring.length === 0) return Infinity
  const mLat = rad(1) * EARTH_RADIUS_M
  const mLng = mLat * Math.cos(rad(lat))
  const project = ([pLat, pLng]: readonly [number, number]) => [(pLng - lng) * mLng, (pLat - lat) * mLat] as const
  let best = Infinity
  for (let i = 0; i < ring.length; i += 1) {
    const [ax, ay] = project(ring[i])
    const [bx, by] = project(ring[(i + 1) % ring.length])
    const dx = bx - ax
    const dy = by - ay
    const len2 = dx * dx + dy * dy
    const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, -(ax * dx + ay * dy) / len2))
    best = Math.min(best, Math.hypot(ax + t * dx, ay + t * dy))
  }
  return best
}
