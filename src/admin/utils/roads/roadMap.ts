import { normalize } from '../../../utils/common/normalize'
import { parseTermInput, termErrors } from '../common/term'
import type {
  AdminWalkGraph,
  AdminWalkRestriction,
  AdminWalkRestrictionInput,
  AdminWalkVertex,
  WalkClosureCause,
  WalkRestrictionKind,
  WalkRestrictionPurpose,
} from '../../types'

/**
 * 길 관리(RoadsScreen)의 계산: 경로망을 그림 좌표로 펴기, 막을 수 있는 출입구·구간 목록, 초안 검증. 순수 함수라 `pnpm test` 에서 돈다.
 * 건물 안 정점(id 에 '@')과 층만 오가는 간선은 같은 자리라 그리지 않는다 — 실외 길과 출입구만.
 */

export const KIND_LABELS: Record<WalkRestrictionKind, string> = {
  ENTRANCE: '출입구 닫기',
  EDGE: '길 구간 막기',
  BUILDING_PASS: '건물 통과 금지',
}

export const PURPOSE_LABELS: Record<WalkRestrictionPurpose, string> = {
  CLOSURE: '임시 통제 (공사·행사)',
  RULE: '상시 길 규칙',
}

export const CAUSE_LABELS: Record<WalkClosureCause, string> = {
  CONSTRUCTION: '공사',
  EVENT: '행사',
  OTHER: '기타',
}

export interface MapPoint {
  x: number
  y: number
}

export interface DrawnEdge {
  key: string
  a: MapPoint
  b: MapPoint
  stairs: boolean
}

export interface DrawnEntrance {
  label: string
  /** 사람이 읽는 이름: '홍문관 R동 1층 출입구'. */
  name: string
  at: MapPoint
}

export interface RoadMap {
  width: number
  height: number
  edges: DrawnEdge[]
  entrances: DrawnEntrance[]
  buildings: { code: string; name: string; at: MapPoint }[]
}

/** 간선 열쇠 — 서버 WalkRestriction.edgeKey 와 같게(작은 쪽 먼저). */
export function edgeKey(a: string, b: string): string {
  return a <= b ? `${a}|${b}` : `${b}|${a}`
}

export function floorText(floor: number | null | undefined): string {
  if (floor === null || floor === undefined) return ''
  return floor < 0 ? `지하 ${-floor}층` : `${floor}층`
}

/**
 * 위경도를 width×maxHeight 안에 들어가는 그림 좌표로(캠퍼스는 남북으로 길어 높이에 맞추는 일이 많다)(경도 1도 = 위도 1도 × cos(위도) — 캠퍼스 크기에선 이 정도면 모양이 맞는다). 위가 북쪽.
 */
export function buildRoadMap(graph: AdminWalkGraph, width: number, maxHeight: number = Infinity): RoadMap {
  const byId = new Map(graph.vertices.map((v) => [v.id, v]))
  const drawn = graph.edges.filter((e) => e.kind === 'normal' || e.kind === 'stairs')
  const used = new Set<string>()
  drawn.forEach((e) => {
    used.add(e.a)
    used.add(e.b)
  })
  const entranceVertices = graph.vertices.filter((v) => v.type === 1 && v.label)
  const points: AdminWalkVertex[] = [...graph.vertices.filter((v) => used.has(v.id)), ...entranceVertices]
  if (points.length === 0) return { width, height: 0, edges: [], entrances: [], buildings: [] }

  const lats = points.map((p) => p.lat)
  const lngs = points.map((p) => p.lng)
  const minLat = Math.min(...lats)
  const maxLat = Math.max(...lats)
  const minLng = Math.min(...lngs)
  const maxLng = Math.max(...lngs)
  const kx = Math.cos(((minLat + maxLat) / 2) * (Math.PI / 180))
  const pad = 16
  const spanX = Math.max((maxLng - minLng) * kx, 1e-9)
  const spanY = Math.max(maxLat - minLat, 1e-9)
  const scale = Math.min((width - pad * 2) / spanX, (maxHeight - pad * 2) / spanY)
  const height = Math.round(spanY * scale + pad * 2)
  width = Math.round(spanX * scale + pad * 2)
  const at = (lat: number, lng: number): MapPoint => ({ x: pad + (lng - minLng) * kx * scale, y: pad + (maxLat - lat) * scale })

  const names = new Map(graph.buildings.map((b) => [b.code, b.name]))
  const seen = new Set<string>()
  const entrances: DrawnEntrance[] = []
  for (const v of entranceVertices) {
    if (!v.label || seen.has(v.label)) continue
    seen.add(v.label)
    entrances.push({ label: v.label, name: entranceName(v, names), at: at(v.lat, v.lng) })
  }

  const edges: DrawnEdge[] = []
  for (const e of drawn) {
    const a = byId.get(e.a)
    const b = byId.get(e.b)
    if (!a || !b) continue
    edges.push({ key: edgeKey(e.a, e.b), a: at(a.lat, a.lng), b: at(b.lat, b.lng), stairs: e.kind === 'stairs' })
  }

  return {
    width,
    height,
    edges,
    entrances,
    buildings: graph.buildings.map((b) => ({ code: b.code, name: b.name, at: at(b.lat, b.lng) })),
  }
}

function entranceName(v: AdminWalkVertex, names: Map<string, string>): string {
  const building = (v.building && names.get(v.building)) || v.building || ''
  return `${building} ${floorText(v.floor)} 출입구`.replace(/\s+/g, ' ').trim()
}

/** 점에서 선분까지 거리(그림 좌표). */
function segmentDistance(p: MapPoint, a: MapPoint, b: MapPoint): number {
  const dx = b.x - a.x
  const dy = b.y - a.y
  const len2 = dx * dx + dy * dy
  const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2))
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy))
}

export type MapPick = { kind: 'ENTRANCE'; label: string } | { kind: 'EDGE'; key: string } | null

/**
 * 누른 자리에서 가장 가까운 출입구(먼저, 8px 안) 또는 길 구간(12px 안). 없으면 null.
 * 지도 전체에 누름 하나를 두고 여기서 고른다 — react-native-svg 도형의 onPress 는 웹에서 동작하지 않는다.
 */
export function pickAt(map: RoadMap, x: number, y: number): MapPick {
  const p = { x, y }
  let entrance: DrawnEntrance | null = null
  let best = 8
  for (const e of map.entrances) {
    const d = Math.hypot(e.at.x - x, e.at.y - y)
    if (d <= best) {
      best = d
      entrance = e
    }
  }
  if (entrance) return { kind: 'ENTRANCE', label: entrance.label }
  let edge: DrawnEdge | null = null
  best = 12
  for (const e of map.edges) {
    const d = segmentDistance(p, e.a, e.b)
    if (d <= best) {
      best = d
      edge = e
    }
  }
  return edge ? { kind: 'EDGE', key: edge.key } : null
}

/** 출입구 고르기 목록: 이름·라벨로 거른다. */
export function filterEntrances(entrances: readonly DrawnEntrance[], query: string): DrawnEntrance[] {
  const q = normalize(query)
  const list = q ? entrances.filter((e) => normalize(e.name).includes(q) || normalize(e.label).includes(q)) : entrances
  return [...list].sort((a, b) => a.name.localeCompare(b.name, 'ko'))
}

/** 지금 막혀 있는(기간 안의) 대상 — 그림에서 빨갛게 칠한다. 예정·끝난 것은 칠하지 않는다. */
export function activeTargets(
  restrictions: readonly AdminWalkRestriction[],
  kind: WalkRestrictionKind,
  purpose: WalkRestrictionPurpose,
): Set<string> {
  return new Set(restrictions.filter((r) => r.active && r.kind === kind && r.purpose === purpose).map((r) => r.target))
}

export interface RoadDraft {
  purpose: WalkRestrictionPurpose
  /** 임시 통제 이유(RULE 은 쓰지 않는다). */
  cause: WalkClosureCause
  kind: WalkRestrictionKind
  target: string | null
  reason: string
  /** '2026-12-01' · '2026-12-01 09:00' · 빈 글자(지금부터). */
  startsAt: string
  /** '2026-12-01' · '2026-12-01 18:00' · 빈 글자(풀 때까지). */
  endsAt: string
}

export function emptyRoadDraft(kind: WalkRestrictionKind = 'EDGE', purpose: WalkRestrictionPurpose = 'CLOSURE'): RoadDraft {
  return { purpose, cause: 'CONSTRUCTION', kind, target: null, reason: '', startsAt: '', endsAt: '' }
}

/** 화면 검증. 통과하면 요청 본문, 아니면 오류 문구. */
export function buildRoadInput(draft: RoadDraft, today: Date = new Date()): { input?: AdminWalkRestrictionInput; errors: string[] } {
  const errors: string[] = []
  if (!draft.target) errors.push(draft.kind === 'EDGE' ? '지도에서 막을 길 구간을 눌러 고르세요.' : '막을 대상을 골라 주세요.')
  if (draft.reason.trim().length > 100) errors.push('사유는 100자까지 쓸 수 있어요.')
  const rule = draft.purpose === 'RULE'
  // 상시 규칙은 기간이 없다(입력칸도 숨긴다).
  const startsAt = rule ? null : parseTermInput(draft.startsAt, 'start')
  const endsAt = rule ? null : parseTermInput(draft.endsAt, 'end')
  errors.push(...termErrors(startsAt, endsAt, today))
  if (errors.length || !draft.target || startsAt === 'invalid' || endsAt === 'invalid') return { errors }
  return {
    errors,
    input: {
      purpose: draft.purpose,
      cause: rule ? undefined : draft.cause,
      kind: draft.kind,
      target: draft.target,
      reason: draft.reason.trim() || undefined,
      startsAt: startsAt ?? undefined,
      endsAt: endsAt ?? undefined,
    },
  }
}
