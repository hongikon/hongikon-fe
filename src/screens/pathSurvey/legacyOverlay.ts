import { PATH_EDGES, PATH_WAYPOINTS } from '../../constants/pathNodes'
import type { Building } from '../../types'
import { formatFloor } from '../../utils/floors'
import { resolveRef } from '../../utils/routing'

/**
 * 기존 경로망(pathNodes.ts)을 조사 화면에 겹쳐 보이기 위한 목록. 보기 전용 — 조사 모듈은 여기 지점에 잇거나 붙지 않는다.
 * - 지점 n*: 번호로 찍은 실외 지점
 * - 이름 지점 HI_*: 흡연장·다리 끝처럼 이름을 붙인 지점. 층은 id 의 '_2F_' 같은 조각에서 읽은 추정값이다(데이터에 층 칸이 따로 없다).
 * - 지점-지점 간선 / 출입구 앵커 간선('건물명#라벨'): 앵커는 routing.ts 의 resolveRef 로 지도 데이터의 건물·출입구에서 푼다.
 */

export interface LegacyNode {
  id: string
  lat: number
  lng: number
  /** 이름 지점이면 id 에서 읽은 층(모르면 null). n* 지점은 undefined. */
  floor?: number | null
}

export interface LegacyAnchorEdge {
  a: string
  b: string
  /** 양 끝을 모두 풀었으면 [latA, lngA, latB, lngB], 못 풀었으면 null(목록에만 보인다). */
  line: [number, number, number, number] | null
}

export interface LegacyOverlay {
  plainNodes: LegacyNode[]
  namedNodes: LegacyNode[]
  /** 이름 지점 층 토글 키(formatFloor 순서, 모르는 층은 맨 끝). */
  namedFloorKeys: string[]
  nodeEdges: [number, number, number, number][]
  anchorEdges: LegacyAnchorEdge[]
}

export const UNKNOWN_FLOOR_KEY = '층 모름'

/** 'HI_D2_1F_흡연장' → 1, 'HI_X_B2F_...' → -2. 층 조각이 없으면 null. */
export function floorFromNamedId(id: string): number | null {
  const m = /_(B?)(\d+)F(?=_|$)/.exec(id)
  if (!m) return null
  const n = Number(m[2])
  if (!n) return null
  return m[1] ? -n : n
}

export const floorKeyOf = (floor: number | null | undefined) => (floor ? formatFloor(floor) : UNKNOWN_FLOOR_KEY)

export function buildLegacyOverlay(buildings: readonly Building[]): LegacyOverlay {
  const byId = new Map(PATH_WAYPOINTS.map((w) => [w.id, w]))
  const plainNodes: LegacyNode[] = []
  const namedNodes: LegacyNode[] = []
  for (const w of PATH_WAYPOINTS) {
    if (/^n\d+$/.test(w.id)) plainNodes.push({ id: w.id, lat: w.lat, lng: w.lng })
    else namedNodes.push({ id: w.id, lat: w.lat, lng: w.lng, floor: floorFromNamedId(w.id) })
  }
  const floors = [...new Set(namedNodes.map((n) => n.floor ?? null))]
  const known = floors.filter((f): f is number => f !== null).sort((x, y) => x - y)
  const namedFloorKeys = [...known.map(formatFloor), ...(floors.includes(null) ? [UNKNOWN_FLOOR_KEY] : [])]

  const nodeEdges: [number, number, number, number][] = []
  const anchorEdges: LegacyAnchorEdge[] = []
  for (const [a, b] of PATH_EDGES) {
    const A = byId.get(a)
    const B = byId.get(b)
    if (A && B) {
      nodeEdges.push([A.lat, A.lng, B.lat, B.lng])
      continue
    }
    const ra = resolveRef(a, byId, buildings)
    const rb = resolveRef(b, byId, buildings)
    anchorEdges.push({ a, b, line: ra && rb ? [ra.point.lat, ra.point.lng, rb.point.lat, rb.point.lng] : null })
  }
  return { plainNodes, namedNodes, namedFloorKeys, nodeEdges, anchorEdges }
}
