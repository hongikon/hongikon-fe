import { SURVEY_V3_EDGES, SURVEY_V3_EDGE_MEMOS, SURVEY_V3_NODE_MEMOS, SURVEY_V3_VERTICES } from '../constants/surveyGraphV3'
import { PATH_EDGES, PATH_WAYPOINTS } from '../constants/pathNodes'
import {
  ELEVATOR_SECONDS_PER_FLOOR,
  ELEVATOR_WAIT_SECONDS,
  FLOOR_TRANSIT_SECONDS,
  WALKING_METERS_PER_MINUTE,
} from '../constants/route'
import type { Building } from '../types'
import { shortBuildingName } from './routeLabels'
import { entranceTransitSeconds, levelIndex, resolveEntrancePoint } from './floors'
import type { RoutePoint } from './floors'
import { haversineMeters } from './geo'

export interface RouteAlternative {
  points: RoutePoint[]
  distanceMeters: number
  totalSeconds: number
  minutes: number
  hasIndoorTransit: boolean
  /** 경로에 계단 구간(경로 조사의 계단 선)이 있다. */
  hasStairs: boolean
  /** 경로망에 아직 없는 건물이라 출입구에서 가장 가까운 길까지 직선으로 이은 구간이 있다. */
  hasLinkSegment: boolean
  /** true면 실측 경로망이 아직 이 구간을 덮지 못해 직선 거리로 대신한 값이다. */
  isEstimate: boolean
  /** 엘리베이터로 층을 옮긴다(경로망 조사 v3 엘리베이터 수직 간선). */
  usesElevator?: boolean
  /** 건물 안(실내 정점끼리) 걷는 거리(m). */
  indoorMeters?: number
  /** 출발·도착 말고 안으로 지나가는 건물 이름(지나는 순서). */
  viaBuildings?: string[]
  /** 지나는 곳의 조사 메모(지나는 순서, 읽기 쉽게 고친 것). "C동 3층 올라가는 계단", "주말 폐문" 등. */
  notes?: string[]
  /** 길 흐름(11-09): "R동 1층 출구", "Z2동 2층 → 3층 통과", "T동 3층 출입구", "엘리베이터로 5층". */
  steps?: string[]
  /** 건물 안 구간(건물 가운데 ↔ 계단·엘리베이터 ↔ 출입구). 지도에서 점선으로 겹쳐 그린다. */
  indoorSegments?: RoutePoint[][]
}

/** 출입구·엘리베이터 이름표(HI_T_3F_ENTER)를 사람이 읽는 말로. */
function readableCode(code: string): string {
  const entrance = code.match(/^HI_([A-Z0-9]+)_(B?)(\d+(?:\.\d+)?)F?(?:_\d+)?_ENTER$/)
  if (entrance) return `${entrance[1]}동 ${entrance[2] ? '지하 ' : ''}${entrance[3]}층 출입구`
  const elevator = code.match(/^HI_([A-Z0-9]+)(?:_\d+)?_ELEVATOR$/)
  if (elevator) return `${elevator[1]}동 엘리베이터`
  return code
}

/**
 * 조사 메모를 길 안내 한 줄로(11-09). 조사 경로 이름("상수역 -> T동")은 빼고, 이름표만 있는 줄·'2대' 같은 줄은 버리고,
 * 남은 이름표는 읽는 말로 바꾼다. 쓸 게 없으면 null.
 */
export function readableMemo(memo: string): string | null {
  if (memo.includes('->')) return null
  const lines = memo
    .split(/\n+/)
    .map((line) => line.trim())
    .filter((line) => line && !/^\d+대$/.test(line))
  const kept: string[] = []
  for (const line of lines) {
    if (/^HI_[A-Z0-9_]+(\s*=\s*HI_[A-Z0-9_]+)*$/.test(line)) {
      if (/_ELEVATOR/.test(line)) kept.push(readableCode(line.split(/\s*=\s*/)[0]))
      continue
    }
    kept.push(line.replace(/HI_[A-Z0-9_]+/g, readableCode))
  }
  const text = kept.join(' · ').trim()
  return text ? text : null
}

/** 조사 정점 id → 층(실외 null). */
const VERTEX_FLOORS = new Map(SURVEY_V3_VERTICES.map((v) => [v[0], v[4]]))
/** 조사 정점 id → 건물 code(실외 없음). */
const VERTEX_CODES = new Map(SURVEY_V3_VERTICES.filter((v) => v[3]).map((v) => [v[0], v[3] as string]))

/** 실외 길 위의 점인지(실내 `@`, 층 합성 `::`, 출입구 앵커 `#`, 내 위치가 아님). */
function isOutdoorId(id: string | undefined): boolean {
  return !!id && !id.includes('@') && !id.includes('::') && !id.includes('#') && id !== 'me'
}

function floorText(floor: number): string {
  return floor < 0 ? `지하 ${-floor}층` : floor === 0 ? 'L층' : `${floor}층`
}

/** 건물 code(hongik_t) → 이름표 글자('T동'). 계단 메모('L동 4층 올라가는 계단')가 가리키는 건물을 경로와 맞출 때 쓴다. */
let codeTokens: Map<string, string> | null = null
function codeToken(code: string | undefined): string | undefined {
  if (!code) return undefined
  if (!codeTokens) {
    codeTokens = new Map()
    for (const v of SURVEY_V3_VERTICES) {
      const letter = v[3] && v[6] ? v[6].match(/^HI_([A-Z0-9]+)_/)?.[1] : undefined
      if (letter && !codeTokens.has(v[3]!)) codeTokens.set(v[3]!, `${letter}동`)
    }
  }
  return codeTokens.get(code)
}

/** 계단 끝에서 이만큼 안의 출입구로 그 자리 높이를 어림한다. */
const STAIR_ENTRANCE_METERS = 35

/** 층이 있는 출입구 정점들(계단 방향 어림용, 처음 쓸 때 만든다). */
let entrancePoints: { lat: number; lng: number; code: string; floor: number }[] | null = null

/**
 * 실외 계단의 오르내림(조사 자료에 방향이 없다, 11-09). 계단 시작·끝 근처(35m) 출입구 중 같은 건물 것을 골라 층을 비교한다 —
 * 'L동 1층 출입구 쪽에서 L동 4층 출입구 쪽으로' 가면 오름. 건물마다 결과가 엇갈리거나 같은 건물이 양쪽에 없으면 0(모름).
 * (실외 길을 계단으로 나눈 '마당' 높이로 재 보았지만, 경사로로 이어진 큰 마당 하나에 여러 높이 출입구가 섞여 틀렸다.)
 */
function stairRiseLocal(from: RoutePoint, to: RoutePoint): number {
  if (!entrancePoints) {
    entrancePoints = SURVEY_V3_VERTICES.filter((v) => v[5] === 1 && v[3] && v[4] != null).map((v) => ({
      lat: v[1],
      lng: v[2],
      code: v[3] as string,
      floor: v[4] as number,
    }))
  }
  const nearest = (at: RoutePoint) => {
    const byCode = new Map<string, { floor: number; meters: number }>()
    for (const e of entrancePoints!) {
      const meters = haversineMeters(at.lat, at.lng, e.lat, e.lng)
      if (meters > STAIR_ENTRANCE_METERS) continue
      const prev = byCode.get(e.code)
      if (!prev || meters < prev.meters) byCode.set(e.code, { floor: e.floor, meters })
    }
    return byCode
  }
  const a = nearest(from)
  const b = nearest(to)
  let sign = 0
  for (const [code, x] of a) {
    const y = b.get(code)
    if (!y || y.floor === x.floor) continue
    const next = Math.sign(y.floor - x.floor)
    if (sign !== 0 && next !== sign) return 0
    sign = next
  }
  return sign
}

/**
 * 메모로 계단 방향 어림: 'L동 4층 올라가는 계단'은 L동 쪽이 위다. 경로가 계단 뒤에 그 건물로 가면 그 방향, 계단 앞에서 그 건물에서
 * 왔으면 반대. 메모에 건물이 없거나('차도로 내려가는 계단') 경로와 맞지 않으면 0.
 */
function memoRise(memo: string, before: ReadonlySet<string>, after: ReadonlySet<string>): number {
  const up = /올라가/.test(memo)
  const down = /내려가/.test(memo)
  if (up === down) return 0
  const tokens = memo.match(/[A-Z][0-9]?동/g) ?? []
  for (const token of tokens) {
    if (after.has(token) && !before.has(token)) return up ? 1 : -1
    if (before.has(token) && !after.has(token)) return up ? -1 : 1
  }
  return 0
}

/**
 * 길 흐름(11-09 사용자 요청: 'T동 5층 출구 → Q동 1층'처럼). 경로를 따라 건물을 나가고 들어가는 출입구, 건물 안 층 이동
 * ('엘리베이터로 5층 올라가기'), 실외 계단('계단 올라가기·내려가기', 방향을 모르면 '계단 이용')을 순서대로 적는다.
 * 중간 건물을 바로 지나가면 '○동 2층 → 3층 통과'.
 */
function routeSteps(graph: Graph, nodeIds: readonly string[], nameOf: (code: string) => string | undefined): string[] {
  const n = nodeIds.length
  const edgeAt = (i: number) => (i < 0 || i >= n - 1 ? undefined : (graph.adj.get(nodeIds[i]) ?? []).find((e) => e.to === nodeIds[i + 1]))
  const entranceName = (id: string) => {
    const floor = VERTEX_FLOORS.get(id) ?? null
    const code = VERTEX_CODES.get(id)
    const known = code ? nameOf(code) : undefined
    return known && floor !== null ? `${known} ${floorText(floor)} 출입구` : readableCode(ENTRANCE_LABELS.get(id) ?? id)
  }
  // 경로 각 지점까지(앞)·그 뒤(뒤) 지나는 건물 글자 — 계단 메모 방향 맞추기용.
  const tokenAt = nodeIds.map((id) => codeToken(VERTEX_CODES.get(id)))

  type Step = { text: string; kind: 'enter' | 'exit' | 'move'; building?: string; floor?: number | null }
  const steps: Step[] = []
  let lastFloor: number | null = null
  // 고른 출발 층(조사 안 된 층이면 출발이 층 합성 노드 `건물::5`)에서 실제로 나가는 층까지.
  const startMatch = nodeIds[0]?.match(/::(-?[\d.]+)$/)
  let startFloor: number | null = startMatch ? Number(startMatch[1]) : null
  for (let i = 0; i < n; i++) {
    const id = nodeIds[i]
    const f = VERTEX_FLOORS.get(id)
    if (startFloor !== null && f != null) {
      if (f !== startFloor) steps.push({ text: `계단·엘리베이터로 ${floorText(f)} ${f > startFloor ? '올라가기' : '내려가기'}`, kind: 'move' })
      startFloor = null
    }
    if (ENTRANCE_LABELS.has(id)) {
      const name = entranceName(id)
      const building = name.replace(/ (지하 \d+층|L층|[\d.]+층) 출입구$/, '')
      const floor = VERTEX_FLOORS.get(id) ?? null
      const before = isOutdoorId(nodeIds[i - 1])
      const after = isOutdoorId(nodeIds[i + 1])
      // 앞뒤가 다 바깥이면 그 출입구 앞을 지나갈 뿐 — 안내하지 않는다.
      if (before && !after) steps.push({ text: name, kind: 'enter', building, floor })
      else if (after && !before) steps.push({ text: name.replace(/출입구$/, '출구'), kind: 'exit', building, floor })
    }
    if (f !== undefined && f !== null) lastFloor = f
    const edge = edgeAt(i)
    if (!edge) continue
    // 건물 안 층 이동(수직 간선이 이어지면 한 번으로).
    if (edge.vertical && edge.seconds > 0) {
      const from = VERTEX_FLOORS.get(id) ?? lastFloor
      let j = i
      let stairs = false
      while (edgeAt(j)?.vertical && edgeAt(j)!.seconds > 0) {
        if (edgeAt(j)!.stairs) stairs = true
        j++
      }
      const to = VERTEX_FLOORS.get(nodeIds[j]) ?? null
      if (from != null && to != null && to !== from) {
        steps.push({ text: `${stairs ? '계단으로' : '엘리베이터로'} ${floorText(to)} ${to > from ? '올라가기' : '내려가기'}`, kind: 'move' })
      }
      i = j - 1
      continue
    }
    // 실외 계단(이어진 계단 구간을 한 번으로).
    if (edge.stairs && !edge.vertical && isOutdoorId(id)) {
      let j = i
      while (edgeAt(j)?.stairs && !edgeAt(j)!.vertical) j++
      const fromPoint = graph.nodes.get(nodeIds[i])
      const toPoint = graph.nodes.get(nodeIds[j])
      let rise = fromPoint && toPoint ? stairRiseLocal(fromPoint, toPoint) : 0
      if (rise === 0) {
        const before = new Set(tokenAt.slice(0, i).filter((t): t is string => !!t))
        const after = new Set(tokenAt.slice(j + 1).filter((t): t is string => !!t))
        for (let k = Math.max(0, i - 1); k <= Math.min(n - 1, j + 1) && rise === 0; k++) {
          const memo = SURVEY_V3_NODE_MEMOS[surveyNodeId(nodeIds[k])]
          if (memo) rise = memoRise(memo, before, after)
          const next = nodeIds[k + 1]
          const edgeMemo = next ? SURVEY_V3_EDGE_MEMOS[[surveyNodeId(nodeIds[k]), surveyNodeId(next)].sort().join('|')] : undefined
          if (rise === 0 && edgeMemo) rise = memoRise(edgeMemo, before, after)
        }
      }
      steps.push({ text: rise > 0 ? '계단 올라가기' : rise < 0 ? '계단 내려가기' : '계단 이용', kind: 'move' })
      i = j - 1
    }
  }

  // 고른 층이 조사되지 않은 층이면 끝이 층 합성 노드(`건물::5`)다 — 어떻게 가는지는 모르니 층만 적는다.
  const target = nodeIds[n - 1]?.match(/::(-?[\d.]+)$/)
  if (target) {
    const targetFloor = Number(target[1])
    if (lastFloor !== null && targetFloor !== lastFloor) {
      steps.push({ text: `계단·엘리베이터로 ${floorText(targetFloor)} ${targetFloor > lastFloor ? '올라가기' : '내려가기'}`, kind: 'move' })
    }
  }

  // 중간 건물에 들어갔다가 바로(층 이동만 하고) 나오면 '○동 2층 → 3층 통과' 한 줄로.
  const out: string[] = []
  for (let k = 0; k < steps.length; k++) {
    const s = steps[k]
    const next = steps[k + 1]
    if (s.kind === 'enter' && next?.kind === 'exit' && next.building === s.building) {
      const inFloor = s.floor == null ? '' : floorText(s.floor)
      const outFloor = next.floor == null ? '' : floorText(next.floor)
      out.push(`${s.building} ${inFloor}${outFloor && outFloor !== inFloor ? ` → ${outFloor}` : ''} 통과`.replace(/\s+/g, ' '))
      k++
      continue
    }
    if (out[out.length - 1] !== s.text) out.push(s.text)
  }
  return out
}

/** 출입구 정점 id → 출입구 이름표(메모 앞에 어느 출입구인지 붙인다). */
const ENTRANCE_LABELS = new Map(
  SURVEY_V3_VERTICES.filter((v) => v[5] === 1 && v[6]).map((v) => [v[0], v[6] as string]),
)

/** 정점 id(`n12@hongik_t:1`)의 원래 조사 점 id(`n12`). */
function surveyNodeId(id: string): string {
  return id.split('@')[0]
}

interface GraphEdge {
  to: string
  seconds: number
  meters: number
  stairs?: boolean
  /** 경로망 밖 건물을 가까운 길에 직선으로 이은 간선. */
  link?: boolean
  /** 건물 안 층 이동(경로망 조사 v3 의 계단·엘리베이터 수직 간선). */
  vertical?: boolean
}

interface Graph {
  nodes: Map<string, RoutePoint>
  /** 층 이동을 나타내는 합성 노드. 지도에는 그리지 않는다(출입구와 좌표가 같다). */
  floorNodeIds: Set<string>
  adj: Map<string, GraphEdge[]>
  /** 건물 이름 → 경로망에 이어진 출입구(정점 id 와 그 출입구 층). */
  entrancesByBuilding: Map<string, { id: string; floor: number }[]>
  /** 건물 이름 → 층 → 그 층에서 조사된 실내 정점 id(경로망 조사 v3). 고른 층에서 실제 실내 길로 출발·도착한다. */
  levelVertices: Map<string, Map<number, string[]>>
  /**
   * 가장 큰 덩어리(서로 이어진 정점 무리)의 정점. 조사가 덜 끝나 큰 길망과 떨어진 조각(출입구 + 점 하나 등)은
   * 출입구·층 정점·연결 후보로 쓰지 않는다 — 그 건물로 가는 길이 아예 안 나오는 대신 예전 자료나 직선 연결로 대신한다.
   */
  mainComponent: Set<string>
}

/** 가장 큰 덩어리의 정점들(간선 방향 무시, BFS). */
function largestComponent(graph: Graph): Set<string> {
  const seen = new Set<string>()
  let best = new Set<string>()
  for (const start of graph.nodes.keys()) {
    if (seen.has(start)) continue
    const component = new Set<string>([start])
    seen.add(start)
    const queue = [start]
    while (queue.length > 0) {
      const id = queue.pop()!
      for (const edge of graph.adj.get(id) ?? []) {
        if (seen.has(edge.to)) continue
        seen.add(edge.to)
        component.add(edge.to)
        queue.push(edge.to)
      }
    }
    if (component.size > best.size) best = component
  }
  return best
}

interface PathResult {
  nodeIds: string[]
  seconds: number
}

function pushAdj(graph: Graph, id: string, edge: GraphEdge): void {
  const list = graph.adj.get(id)
  if (list) list.push(edge)
  else graph.adj.set(id, [edge])
}

/** 바깥 계단 구간 시간 = 평지 걷는 시간 × 이 값(계단 가로 6m 쯤에 한 층 높이를 오르내린다). */
const STAIRS_TIME_FACTOR = 3

function addEdge(
  graph: Graph,
  aId: string,
  aPoint: RoutePoint,
  bId: string,
  bPoint: RoutePoint,
  stairs = false,
): void {
  graph.nodes.set(aId, aPoint)
  graph.nodes.set(bId, bPoint)
  const meters = haversineMeters(aPoint.lat, aPoint.lng, bPoint.lat, bPoint.lng)
  // 계단은 평지보다 느리다(오르내림). 평지로 치면 건물 안 층 이동(층당 20초)보다 바깥 계단이 늘 싸 보여, 1층에서 출발할 때
  // 바깥 계단으로 돌아 올라가는 길이 3층 출구로 바로 나가는 길보다 빠르다고 나왔다(11-09).
  const seconds = (meters / WALKING_METERS_PER_MINUTE) * 60 * (stairs ? STAIRS_TIME_FACTOR : 1)
  pushAdj(graph, aId, { to: bId, seconds, meters, stairs })
  pushAdj(graph, bId, { to: aId, seconds, meters, stairs })
}

/**
 * PATH_EDGES 의 한쪽 끝을 실제 좌표로 푼다. PathWaypoint.id 이거나,
 * '건물명' 또는 '건물명#출입구라벨' 문자열이다. 못 찾으면 null — 오타가 있는
 * 간선은 조용히 건너뛴다(전체 그래프를 무너뜨리지 않는다).
 */
export function resolveRef(
  ref: string,
  waypointById: Map<string, { id: string; lat: number; lng: number }>,
  buildings: readonly Building[],
): { id: string; point: RoutePoint } | null {
  const waypoint = waypointById.get(ref)
  if (waypoint) return { id: waypoint.id, point: { lat: waypoint.lat, lng: waypoint.lng } }

  const hashIndex = ref.indexOf('#')
  if (hashIndex === -1) {
    const building = buildings.find((b) => b.name === ref)
    if (!building) return null
    return { id: building.name, point: { lat: building.lat, lng: building.lng } }
  }

  const buildingName = ref.slice(0, hashIndex)
  const label = ref.slice(hashIndex + 1)
  const building = buildings.find((b) => b.name === buildingName)
  const entrance = building?.entrances?.find((e) => e.label === label)
  if (!building || !entrance) return null
  return { id: ref, point: { lat: entrance.lat, lng: entrance.lng } }
}

/**
 * 출입구 이름의 건물 코드(HI_R_… 의 'R') → 건물. 서버 지도 데이터의 출입구 이름 앞부분으로 찾는다 —
 * 경로 조사에서 새로 생긴 출입구 이름(서버에 아직 없는 것)도 같은 건물에 붙일 수 있다.
 */
function buildingsByCode(buildings: readonly Building[]): Map<string, Building> {
  const byCode = new Map<string, Building>()
  for (const building of buildings) {
    for (const entrance of building.entrances ?? []) {
      const code = entrance.label.match(/^HI_([A-Z0-9]+)_/)?.[1]
      if (code && !byCode.has(code)) byCode.set(code, building)
    }
  }
  return byCode
}

/**
 * 경로망 조사 v3 의 건물 code(`hongik_r`) → 앱 건물. 서버 지도 데이터의 건물 code 로 찾고, code 가 없으면
 * 그 건물의 v3 출입구 이름 앞부분(HI_R_ → 'R')을 서버 출입구 이름과 맞춰 찾는다.
 */
function v3BuildingResolver(buildings: readonly Building[]): (code: string) => Building | undefined {
  const byServerCode = new Map<string, Building>()
  for (const building of buildings) if (building.code) byServerCode.set(building.code, building)
  const byLabelCode = buildingsByCode(buildings)
  const viaLabel = new Map<string, Building>()
  for (const [, , , code, , , label] of SURVEY_V3_VERTICES) {
    if (!code || !label || viaLabel.has(code)) continue
    const labelCode = label.match(/^HI_([A-Z0-9]+)_/)?.[1]
    const building = labelCode ? byLabelCode.get(labelCode) : undefined
    if (building) viaLabel.set(code, building)
  }
  return (code) => byServerCode.get(code) ?? viaLabel.get(code)
}

/** 계단 한 칸(인접 층) 또는 엘리베이터 한 번 타기의 시간(초). 층 눈금은 levelIndex(L층·0층 없음 반영). */
function verticalSeconds(kind: 'stairs_vertical' | 'elevator_vertical', fromFloor: number, toFloor: number): number {
  const floors = Math.abs(levelIndex(fromFloor) - levelIndex(toFloor))
  return kind === 'stairs_vertical'
    ? floors * FLOOR_TRANSIT_SECONDS
    : ELEVATOR_WAIT_SECONDS + floors * ELEVATOR_SECONDS_PER_FLOOR
}

/**
 * 경로망 조사 v3(surveyGraphV3.ts, 11-08)로 만든 경로망. 실외 길, 건물 안 층마다의 정점, 계단·엘리베이터 수직 간선,
 * 건물끼리 높이가 같은 층을 잇는 tie 까지 그대로 쓴다. 출입구는 v3 출입구 정점 그 자체다.
 * v3 에 아직 없는 건물만 9월 자료(pathNodes.ts)로 채운다(addLegacyFill).
 */
function buildBaseGraph(buildings: readonly Building[]): Graph {
  const graph: Graph = {
    nodes: new Map(),
    floorNodeIds: new Set(),
    adj: new Map(),
    entrancesByBuilding: new Map(),
    levelVertices: new Map(),
    mainComponent: new Set(),
  }
  const vertexById = new Map(SURVEY_V3_VERTICES.map((v) => [v[0], v]))

  for (const [aId, bId, kind] of SURVEY_V3_EDGES) {
    const a = vertexById.get(aId)
    const b = vertexById.get(bId)
    if (!a || !b) continue
    const aPoint = { lat: a[1], lng: a[2] }
    const bPoint = { lat: b[1], lng: b[2] }
    if (kind === 'normal' || kind === 'stairs') {
      addEdge(graph, aId, aPoint, bId, bPoint, kind === 'stairs')
      continue
    }
    graph.nodes.set(aId, aPoint)
    graph.nodes.set(bId, bPoint)
    let seconds = 0
    if (kind === 'stairs_vertical' || kind === 'elevator_vertical') {
      if (a[4] === null || b[4] === null) continue
      seconds = verticalSeconds(kind, a[4], b[4])
    }
    const stairs = kind === 'stairs_vertical'
    const vertical = kind !== 'tie'
    pushAdj(graph, aId, { to: bId, seconds, meters: 0, stairs, vertical })
    pushAdj(graph, bId, { to: aId, seconds, meters: 0, stairs, vertical })
  }

  // 출입구가 길 한가운데 찍혀 앞뒤 실외 점이 그 출입구로만 이어진 곳(K동 4층 등 5곳)은 앞뒤 점을 바로 잇는다 — 지나가기만 하는데
  // 출입구를 찍고 가는 것처럼 그려지고 '○동 4층 출입구'가 안내에 끼었다(11-09).
  for (const [id, , , , , type] of SURVEY_V3_VERTICES) {
    if (type !== 1) continue
    const outside = (graph.adj.get(id) ?? []).filter((e) => !e.to.includes('@') && !e.vertical && !e.stairs).map((e) => e.to)
    for (let i = 0; i < outside.length; i++) {
      for (let j = i + 1; j < outside.length; j++) {
        const a = graph.nodes.get(outside[i])
        const b = graph.nodes.get(outside[j])
        if (a && b && !(graph.adj.get(outside[i]) ?? []).some((e) => e.to === outside[j])) addEdge(graph, outside[i], a, outside[j], b)
      }
    }
  }

  graph.mainComponent = largestComponent(graph)
  const resolveBuilding = v3BuildingResolver(buildings)
  for (const [id, , , code, floor, type] of SURVEY_V3_VERTICES) {
    if (!code || floor === null || !graph.mainComponent.has(id)) continue
    const building = resolveBuilding(code)
    if (!building) continue
    const byFloor = graph.levelVertices.get(building.name) ?? new Map<number, string[]>()
    byFloor.set(floor, [...(byFloor.get(floor) ?? []), id])
    graph.levelVertices.set(building.name, byFloor)
    if (type !== 1) continue
    const list = graph.entrancesByBuilding.get(building.name) ?? []
    list.push({ id, floor })
    graph.entrancesByBuilding.set(building.name, list)
  }

  // 9월 자료(pathNodes.ts)는 더 쓰지 않는다(11-09 사용자 결정: 새 조사 자료만). 새 자료에 없는 건물은 가까운 길에 직선으로 잇거나
  // (linkToNearestPaths) 직선 어림으로 대신한다.
  return graph
}

/**
 * 큰 길망 위의 실외 정점인지(실내 정점 `n12@건물:층`, 출입구 앵커 `건물#…`, 합성 노드 `건물::층`, 내 위치, 떨어진 조각이 아님).
 * 경로망 밖 건물과 내 위치를 이을 후보다.
 */
function isOutdoorPathPoint(graph: Graph, id: string): boolean {
  return (
    graph.mainComponent.has(id) &&
    !graph.floorNodeIds.has(id) &&
    !id.includes('@') &&
    !id.includes('#') &&
    !id.includes('::') &&
    id !== MY_LOCATION_NODE
  )
}

const baseGraphCache = new WeakMap<readonly Building[], Graph>()

function getBaseGraph(buildings: readonly Building[]): Graph {
  let graph = baseGraphCache.get(buildings)
  if (!graph) {
    graph = buildBaseGraph(buildings)
    baseGraphCache.set(buildings, graph)
  }
  return graph
}

function cloneGraph(graph: Graph): Graph {
  const adj = new Map<string, GraphEdge[]>()
  graph.adj.forEach((edges, id) => adj.set(id, [...edges]))
  return {
    nodes: new Map(graph.nodes),
    floorNodeIds: new Set(graph.floorNodeIds),
    adj,
    entrancesByBuilding: graph.entrancesByBuilding,
    levelVertices: graph.levelVertices,
    mainComponent: graph.mainComponent,
  }
}

/**
 * 고른 건물·층에서 출발(도착)하는 합성 노드를 붙인다.
 * - 그 건물의 경로망에 이어진 출입구 모두와 잇고, 층 차이만큼 시간을 더한다(조사되지 않은 실내는 계단으로 오르내린다고 어림).
 * - 그 층에 경로망 조사 v3 로 찍은 실내 정점(엘리베이터·계단·복도 점)이 있으면 그 정점들과 0초로도 잇는다 —
 *   실제 실내 길(엘리베이터·계단·건물끼리 이어진 층)이 더 빠르면 길찾기가 그쪽을 고른다.
 * 층을 안 골랐으면 모든 출입구가 0초다. 그 건물이 아직 경로망에 없으면 그래프에 없는 id 를 돌려줘
 * 호출부가 직선 추정으로 대신하게 한다.
 */
function attachFloorNode(graph: Graph, building: Building, floor: number | null): string {
  const entrances = graph.entrancesByBuilding.get(building.name) ?? linkToNearestPaths(graph, building)
  const surveyed = floor === null ? [] : graph.levelVertices.get(building.name)?.get(floor) ?? []
  const floorNodeId = `${building.name}::${floor ?? 'any'}`
  const first = surveyed[0] ?? entrances[0]?.id
  if (first === undefined) return floorNodeId

  // 출발·도착은 건물 가운데(11-09 사용자 요청) — 지도에서 건물 가운데부터 계단·엘리베이터, 출입구로 이어 그린다.
  const center = { lat: building.lat, lng: building.lng }
  graph.nodes.set(floorNodeId, center)
  graph.floorNodeIds.add(floorNodeId)
  const link = (id: string, extraSeconds: number) => {
    const point = graph.nodes.get(id)
    const meters = point ? haversineMeters(center.lat, center.lng, point.lat, point.lng) : 0
    const seconds = (meters / WALKING_METERS_PER_MINUTE) * 60 + extraSeconds
    pushAdj(graph, floorNodeId, { to: id, seconds, meters })
    pushAdj(graph, id, { to: floorNodeId, seconds, meters })
  }
  // 그 층에 조사된 실내 점(엘리베이터·계단·복도)으로 걸어간다 — 다른 층 출구가 가까우면 거기서 엘리베이터·계단 수직 간선을 탄다.
  for (const id of surveyed) link(id, 0)
  // 조사되지 않은 층이면 출입구로 바로(층 차이만큼 계단·엘리베이터 시간을 어림해 더한다).
  for (const entrance of entrances) {
    if (surveyed.includes(entrance.id)) continue
    link(entrance.id, floor === null ? 0 : Math.abs(levelIndex(floor) - levelIndex(entrance.floor)) * FLOOR_TRANSIT_SECONDS)
  }
  return floorNodeId
}

/** 경로망 밖 건물의 출입구를 이을 가까운 길 점 수와 최대 거리. */
const LINK_POINTS = 2
const LINK_MAX_METERS = 300

/**
 * 경로망에 아직 출입구가 없는 건물(11-03 조사 전)은 서버 지도 데이터의 출입구(없으면 건물 중심)에서
 * 가장 가까운 길 점(300m 안, 2곳)까지 직선으로 잇는다 — 운영진 요청: 직선 하나로 대신하지 말고 길을 따라 이어 가게.
 * 복사한 그래프(findRoutes 의 cloneGraph)에만 붙이고, 공유하는 entrancesByBuilding 은 건드리지 않는다.
 */
function linkToNearestPaths(graph: Graph, building: Building): { id: string; floor: number }[] {
  const pathPoints: { id: string; point: RoutePoint }[] = []
  graph.nodes.forEach((point, id) => {
    if (isOutdoorPathPoint(graph, id)) pathPoints.push({ id, point })
  })
  const starts =
    building.entrances && building.entrances.length > 0
      ? building.entrances.map((e) => ({ id: `${building.name}#${e.label}`, point: { lat: e.lat, lng: e.lng }, floor: e.minFloor }))
      : [{ id: `${building.name}#center`, point: { lat: building.lat, lng: building.lng }, floor: 1 }]

  const linked: { id: string; floor: number }[] = []
  for (const start of starts) {
    const near = pathPoints
      .map((p) => ({ ...p, meters: haversineMeters(start.point.lat, start.point.lng, p.point.lat, p.point.lng) }))
      .filter((p) => p.meters <= LINK_MAX_METERS)
      .sort((a, b) => a.meters - b.meters)
      .slice(0, LINK_POINTS)
    if (near.length === 0) continue
    graph.nodes.set(start.id, start.point)
    for (const p of near) {
      const seconds = (p.meters / WALKING_METERS_PER_MINUTE) * 60
      pushAdj(graph, start.id, { to: p.id, seconds, meters: p.meters, link: true })
      pushAdj(graph, p.id, { to: start.id, seconds, meters: p.meters, link: true })
    }
    linked.push({ id: start.id, floor: start.floor })
  }
  return linked
}

function dijkstra(
  graph: Graph,
  sourceId: string,
  targetId: string,
  excludedNodes: ReadonlySet<string> = new Set(),
  excludedEdges: ReadonlySet<string> = new Set(),
  /** 간선 비용(초). 없으면 걷는 시간. Infinity 면 그 간선은 쓰지 않는다. 돌려주는 seconds 는 이 비용의 합이다. */
  weight?: (fromId: string, edge: GraphEdge) => number,
): PathResult | null {
  const dist = new Map<string, number>([[sourceId, 0]])
  const prev = new Map<string, string>()
  const visited = new Set<string>()

  for (;;) {
    let currentId: string | null = null
    let currentDist = Infinity
    for (const [id, d] of dist) {
      if (!visited.has(id) && d < currentDist) {
        currentDist = d
        currentId = id
      }
    }
    if (currentId === null || currentId === targetId) break
    visited.add(currentId)

    for (const edge of graph.adj.get(currentId) ?? []) {
      if (excludedNodes.has(edge.to) || excludedEdges.has(`${currentId}->${edge.to}`)) continue
      const cost = weight ? weight(currentId, edge) : edge.seconds
      if (cost === Infinity) continue
      const next = currentDist + cost
      if (next < (dist.get(edge.to) ?? Infinity)) {
        dist.set(edge.to, next)
        prev.set(edge.to, currentId)
      }
    }
  }

  if (!dist.has(targetId)) return null

  const nodeIds: string[] = [targetId]
  for (let cursor = targetId; cursor !== sourceId; ) {
    const p = prev.get(cursor)
    if (p === undefined) return null
    nodeIds.push(p)
    cursor = p
  }
  nodeIds.reverse()
  return { nodeIds, seconds: dist.get(targetId)! }
}

function pathSeconds(graph: Graph, nodeIds: string[]): number {
  let total = 0
  for (let i = 0; i < nodeIds.length - 1; i++) {
    const edge = (graph.adj.get(nodeIds[i]) ?? []).find((e) => e.to === nodeIds[i + 1])
    if (edge) total += edge.seconds
  }
  return total
}

function arraysEqual(a: string[], b: string[]): boolean {
  return a.length === b.length && a.every((v, i) => v === b[i])
}

function pathKey(nodeIds: string[]): string {
  return nodeIds.join('>')
}

/** Yen's algorithm — 루프 없는 k 개의 최단 경로 후보. */
function yenKShortestPaths(graph: Graph, sourceId: string, targetId: string, k: number): PathResult[] {
  const first = dijkstra(graph, sourceId, targetId)
  if (!first) return []

  const A: PathResult[] = [first]
  const seen = new Set<string>([pathKey(first.nodeIds)])
  const B: PathResult[] = []

  for (let i = 1; i < k; i++) {
    const prevPath = A[i - 1].nodeIds

    for (let spurIndex = 0; spurIndex < prevPath.length - 1; spurIndex++) {
      const spurNode = prevPath[spurIndex]
      const rootPath = prevPath.slice(0, spurIndex + 1)

      const excludedEdges = new Set<string>()
      for (const path of A) {
        if (
          path.nodeIds.length > spurIndex &&
          arraysEqual(path.nodeIds.slice(0, spurIndex + 1), rootPath)
        ) {
          excludedEdges.add(`${path.nodeIds[spurIndex]}->${path.nodeIds[spurIndex + 1]}`)
        }
      }
      const excludedNodes = new Set(rootPath.slice(0, -1))

      const spurResult = dijkstra(graph, spurNode, targetId, excludedNodes, excludedEdges)
      if (!spurResult) continue

      const totalNodeIds = rootPath.slice(0, -1).concat(spurResult.nodeIds)
      const key = pathKey(totalNodeIds)
      if (seen.has(key)) continue
      seen.add(key)
      B.push({ nodeIds: totalNodeIds, seconds: pathSeconds(graph, rootPath) + spurResult.seconds })
    }

    if (B.length === 0) break
    B.sort((a, b) => a.seconds - b.seconds)
    A.push(B.shift()!)
  }

  return A
}

/** 경로의 간선(방향 무시) → 길이(m). */
function edgeMeters(graph: Graph, nodeIds: readonly string[]): Map<string, number> {
  const map = new Map<string, number>()
  for (let i = 0; i < nodeIds.length - 1; i++) {
    const a = nodeIds[i]
    const b = nodeIds[i + 1]
    const meters = (graph.adj.get(a) ?? []).find((e) => e.to === b)?.meters ?? 0
    map.set(a < b ? `${a}|${b}` : `${b}|${a}`, meters)
  }
  return map
}

function totalMeters(edges: ReadonlyMap<string, number>): number {
  let sum = 0
  for (const m of edges.values()) sum += m
  return sum
}

/**
 * 두 길이 얼마나 겹치는지 — 길이(m)로 잰다(11-09). 간선 수로 재면 건물을 한 바퀴 도는 짧은 간선 여러 개 때문에
 * 같은 큰길을 걷는 두 길이 '다른 길'로 나왔다(T동 1층 출구로 돌아 나가는 길).
 */
function overlapRatio(a: ReadonlyMap<string, number>, b: ReadonlyMap<string, number>): number {
  const ta = totalMeters(a)
  const tb = totalMeters(b)
  if (ta === 0 || tb === 0) return 0
  let shared = 0
  for (const [key, meters] of a) if (b.has(key)) shared += meters
  return shared / Math.min(ta, tb)
}

/**
 * 후보 중 서로 많이 겹치지 않는 것만 고른다. 실제로 다른 길이 하나뿐이면
 * 억지로 여러 개를 만들지 않고 하나만 돌려준다.
 */
function pickDiverseRoutes(
  graph: Graph,
  candidates: PathResult[],
  maxResults: number,
  overlapThreshold = 0.6,
): PathResult[] {
  const sorted = [...candidates].sort((a, b) => a.seconds - b.seconds)
  const picked: PathResult[] = []
  const pickedEdges: Map<string, number>[] = []

  for (const candidate of sorted) {
    if (picked.length >= maxResults) break
    const edges = edgeMeters(graph, candidate.nodeIds)
    if (pickedEdges.some((existing) => overlapRatio(edges, existing) >= overlapThreshold)) continue
    picked.push(candidate)
    pickedEdges.push(edges)
  }

  return picked
}

/**
 * 후보로 보여 줄 만한 시간: 가장 빠른 길의 1.25배 또는 +1분 중 큰 쪽까지(11-09: 억지로 다른 길을 만들지 말 것 —
 * 1.5배·+4분까지 받으니 돌아가는 길이 후보로 나왔다).
 */
function withinDetour(seconds: number, bestSeconds: number): boolean {
  return seconds <= Math.max(bestSeconds * 1.25, bestSeconds + 60)
}

/**
 * 억지 우회인지(11-09 사용자 지적): 다른 건물 출입구를 '찍고' 되돌아 나오거나(바깥 → 출입구 → 바깥), 이미 지난 자리(8m 안)로
 * 30m 넘게 돌아 다시 오는 길. 벌점 방식이 다른 길을 만들려다 이런 길을 내놓는다.
 */
function isContrivedDetour(graph: Graph, nodeIds: readonly string[]): boolean {
  for (let i = 1; i < nodeIds.length - 1; i++) {
    if (ENTRANCE_LABELS.has(nodeIds[i]) && isOutdoorId(nodeIds[i - 1]) && isOutdoorId(nodeIds[i + 1])) return true
  }
  const points = nodeIds.map((id) => graph.nodes.get(id))
  let walked = 0
  const along: number[] = [0]
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1]
    const b = points[i]
    walked += a && b ? haversineMeters(a.lat, a.lng, b.lat, b.lng) : 0
    along.push(walked)
  }
  for (let i = 0; i < points.length; i++) {
    for (let j = i + 2; j < points.length; j++) {
      const a = points[i]
      const b = points[j]
      if (!a || !b || along[j] - along[i] <= 30) continue
      if (haversineMeters(a.lat, a.lng, b.lat, b.lng) < 8) return true
    }
  }
  return false
}

/** 이미 찾은 길을 이만큼 비싸게 보고 다시 찾는다(벌점 방식). 겹치는 구간이 줄어든 '실제로 다른 길'이 나온다. */
const DETOUR_PENALTY = 1.8
const PENALTY_ROUNDS = 4

/**
 * 길찾기 후보(11-09 사용자 요청: 후보 3개 정도). Yen(가장 짧은 순 k개)만 쓰면 거의 같은 길만 나와 겹침 거르기 뒤에
 * 하나만 남는 쌍이 많았다(운영 지도 702쌍 중 442쌍). 그래서 찾은 길의 간선을 비싸게 보고 다시 찾는 벌점 방식으로
 * 실제로 다른 길을 더한다. (계단 없는 길을 따로 넣던 것은 11-09 사용자 요청으로 뺐다.)
 * 돌려주는 값은 가장 빠른 길이 맨 앞, 나머지는 시간 순.
 */
function routeCandidates(graph: Graph, sourceId: string, targetId: string, maxResults: number): PathResult[] {
  const yen = yenKShortestPaths(graph, sourceId, targetId, Math.max(6, maxResults * 2))
  if (yen.length === 0) return []
  const best = yen[0]
  const all: PathResult[] = [...yen]
  const seen = new Set(yen.map((path) => pathKey(path.nodeIds)))
  const add = (path: PathResult | null): PathResult | null => {
    if (!path) return null
    const key = pathKey(path.nodeIds)
    if (seen.has(key)) return all.find((p) => pathKey(p.nodeIds) === key) ?? null
    const real = { nodeIds: path.nodeIds, seconds: pathSeconds(graph, path.nodeIds) }
    seen.add(key)
    all.push(real)
    return real
  }

  const penalty = new Map<string, number>()
  const penalize = (path: PathResult) => {
    for (let i = 0; i < path.nodeIds.length - 1; i++) {
      for (const key of [`${path.nodeIds[i]}->${path.nodeIds[i + 1]}`, `${path.nodeIds[i + 1]}->${path.nodeIds[i]}`]) {
        penalty.set(key, (penalty.get(key) ?? 1) * DETOUR_PENALTY)
      }
    }
  }
  penalize(best)
  for (let round = 0; round < PENALTY_ROUNDS; round++) {
    const found = add(
      dijkstra(graph, sourceId, targetId, undefined, undefined, (from, edge) => edge.seconds * (penalty.get(`${from}->${edge.to}`) ?? 1)),
    )
    if (!found) break
    penalize(found)
  }

  const near = all.filter(
    (path) => path === best || (withinDetour(path.seconds, best.seconds) && !isContrivedDetour(graph, path.nodeIds)),
  )
  const picked = pickDiverseRoutes(graph, near, maxResults)
  return [picked[0], ...picked.slice(1).sort((a, b) => a.seconds - b.seconds)]
}

/** 실내 정점 id(`n12@hongik_t:1`)의 건물 code. 실외·합성 노드는 null. */
function indoorCode(id: string): string | null {
  const at = id.indexOf('@')
  if (at < 0) return null
  const colon = id.lastIndexOf(':')
  return id.slice(at + 1, colon > at ? colon : undefined)
}

function toRouteAlternative(graph: Graph, path: PathResult, nameOf: (code: string) => string | undefined = () => undefined): RouteAlternative {
  const points: RoutePoint[] = []
  for (const id of path.nodeIds) {
    // 층 합성 노드는 이제 건물 가운데에 있다 — 출발·도착 점으로 그린다.
    const point = graph.nodes.get(id)
    // 층 이동(같은 자리의 다른 층 정점)은 지도에서 한 점이다.
    const last = points[points.length - 1]
    if (point && !(last && last.lat === point.lat && last.lng === point.lng)) points.push(point)
  }

  let distanceMeters = 0
  let hasIndoorTransit = false
  let hasStairs = false
  let hasLinkSegment = false
  const notes: string[] = []
  const addNote = (memo: string | undefined) => {
    const text = memo ? readableMemo(memo) : null
    if (text && !notes.includes(text)) notes.push(text)
  }
  const edgeAt = (i: number) =>
    i < 0 || i >= path.nodeIds.length - 1 ? undefined : (graph.adj.get(path.nodeIds[i]) ?? []).find((e) => e.to === path.nodeIds[i + 1])
  for (let i = 0; i < path.nodeIds.length; i++) {
    const fullId = path.nodeIds[i]
    const id = surveyNodeId(fullId)
    const memo = SURVEY_V3_NODE_MEMOS[id]
    // 계단 메모는 계단 옆 갈림길에 적힌 것이 많다 — 이 길이 그 점에서 실제로 계단을 탈 때만 넣는다(계단 없는 길에 '계단'이 뜨지 않게).
    const stairsHere = !!edgeAt(i - 1)?.stairs || !!edgeAt(i)?.stairs
    if (memo && (!memo.includes('계단') || stairsHere)) {
      // '주말 폐문'처럼 어느 출입구인지 없는 메모는 출입구 이름을 앞에 붙인다.
      const label = ENTRANCE_LABELS.get(fullId)
      const code = VERTEX_CODES.get(fullId)
      const floor = VERTEX_FLOORS.get(fullId)
      const known = code ? nameOf(code) : undefined
      const where = label ? (known && floor != null ? `${known} ${floorText(floor)} 출입구` : readableCode(label)) : null
      addNote(where && !/동|HI_|기숙사|관/.test(memo) ? `${where} ${memo}` : memo)
    }
    const next = path.nodeIds[i + 1]
    if (next) addNote(SURVEY_V3_EDGE_MEMOS[[id, surveyNodeId(next)].sort().join('|')])
  }
  let usesElevator = false
  let indoorMeters = 0
  const viaCodes: string[] = []
  for (let i = 0; i < path.nodeIds.length - 1; i++) {
    const edge = (graph.adj.get(path.nodeIds[i]) ?? []).find((e) => e.to === path.nodeIds[i + 1])
    if (!edge) continue
    distanceMeters += edge.meters
    const codeA = indoorCode(path.nodeIds[i])
    const codeB = indoorCode(edge.to)
    if (codeA && codeB) indoorMeters += edge.meters
    if (edge.vertical && !edge.stairs && edge.seconds > 0) usesElevator = true
    for (const code of [codeA, codeB]) if (code && viaCodes[viaCodes.length - 1] !== code && !viaCodes.includes(code)) viaCodes.push(code)
    if (edge.stairs) hasStairs = true
    if (edge.link) hasLinkSegment = true
    // 건물 안 층 이동: v3 수직 간선, 또는 합성 노드와 출입구 사이 시간이 있는 간선(층 차이 어림).
    if (edge.vertical && edge.seconds > 0) hasIndoorTransit = true
    const walkSeconds = (edge.meters / WALKING_METERS_PER_MINUTE) * 60
    if (edge.seconds > walkSeconds + 0.5 && (graph.floorNodeIds.has(path.nodeIds[i]) || graph.floorNodeIds.has(edge.to))) {
      hasIndoorTransit = true
    }
  }

  return {
    points,
    distanceMeters: Math.round(distanceMeters),
    totalSeconds: path.seconds,
    minutes: Math.max(1, Math.round(path.seconds / 60)),
    hasIndoorTransit,
    hasStairs,
    hasLinkSegment,
    isEstimate: false,
    usesElevator,
    indoorMeters: Math.round(indoorMeters),
    viaBuildings: viaCodes,
    steps: routeSteps(graph, path.nodeIds, nameOf),
    indoorSegments: indoorSegmentsOf(graph, path.nodeIds),
    notes: [...startFloorNote(path.nodeIds), ...notes],
  }
}

/** 건물 안(실내 정점·건물 가운데 합성 노드 사이) 구간들. 이어진 구간은 하나로 잇는다. */
function indoorSegmentsOf(graph: Graph, nodeIds: readonly string[]): RoutePoint[][] {
  const inside = (id: string) => id.includes('@') || graph.floorNodeIds.has(id)
  const segments: RoutePoint[][] = []
  let current: RoutePoint[] | null = null
  for (let i = 0; i < nodeIds.length - 1; i++) {
    const a = nodeIds[i]
    const b = nodeIds[i + 1]
    const pa = graph.nodes.get(a)
    const pb = graph.nodes.get(b)
    if (!pa || !pb || !(inside(a) && inside(b)) || (pa.lat === pb.lat && pa.lng === pb.lng)) {
      if (!pa || !pb || !(inside(a) && inside(b))) current = null
      continue
    }
    if (!current) {
      current = [pa]
      segments.push(current)
    }
    current.push(pb)
  }
  return segments
}

/** 고른 출발 층과 실제로 나가는 출구 층이 다르면(가까운 출구로) 그 까닭을 한 줄로. */
function startFloorNote(nodeIds: readonly string[]): string[] {
  const start = nodeIds[0]?.match(/::(-?[\d.]+)$/)
  if (!start) return []
  const chosen = Number(start[1])
  for (let i = 1; i < nodeIds.length; i++) {
    if (!ENTRANCE_LABELS.has(nodeIds[i]) || !isOutdoorId(nodeIds[i + 1])) continue
    const exit = VERTEX_FLOORS.get(nodeIds[i])
    return exit != null && exit !== chosen ? [`${floorText(chosen)} 대신 ${floorText(exit)} 출구로 나가요(더 가까워요)`] : []
  }
  return []
}

/** 건물 code → 짧은 건물 이름('제4공학관 T동' → 'T동'). 길 흐름·지나는 건물에 쓴다. */
function shortNamer(buildings: readonly Building[]): (code: string) => string | undefined {
  const resolve = v3BuildingResolver(buildings)
  return (code) => {
    const name = resolve(code)?.name
    return name ? shortBuildingName(name) : undefined
  }
}

/** `viaBuildings` 에 담긴 건물 code 를 이름으로 바꾸고 출발·도착 건물은 뺀다. */
function nameVia(route: RouteAlternative, buildings: readonly Building[], exclude: readonly string[]): RouteAlternative {
  const resolve = v3BuildingResolver(buildings)
  const names: string[] = []
  for (const code of route.viaBuildings ?? []) {
    const name = resolve(code)?.name
    if (name && !exclude.includes(name) && !names.includes(name)) names.push(name)
  }
  return { ...route, viaBuildings: names }
}

/**
 * 실측 경로망을 따라 계산한 대안 경로들. 어느 한쪽 건물이 아직 경로망에
 * 없으면(그래프에 앵커가 없으면) 빈 배열을 돌려준다 — 호출부는
 * straightLineFallback 으로 대신해야 한다.
 */
export function findRoutes(
  buildings: readonly Building[],
  from: { building: Building; floor: number | null },
  to: { building: Building; floor: number | null },
  maxAlternatives = 3,
): RouteAlternative[] {
  const graph = cloneGraph(getBaseGraph(buildings))
  const sourceId = attachFloorNode(graph, from.building, from.floor)
  const targetId = attachFloorNode(graph, to.building, to.floor)
  if (!graph.nodes.has(sourceId) || !graph.nodes.has(targetId)) return []

  const exclude = [from.building.name, to.building.name]
  const nameOf = shortNamer(buildings)
  return routeCandidates(graph, sourceId, targetId, maxAlternatives).map((path) =>
    nameVia(toRouteAlternative(graph, path, nameOf), buildings, exclude),
  )
}

/**
 * 경로망이 아직 이 구간을 덮지 못할 때 쓰는 대체값. 출입구 간 직선거리 +
 * 층 이동 시간으로 추정한다(기존 routeMinutes 와 같은 계산).
 */
export function straightLineFallback(
  fromBuilding: Building,
  fromFloor: number | null,
  toBuilding: Building,
  toFloor: number | null,
): RouteAlternative {
  const fromPoint = resolveEntrancePoint(fromBuilding, fromFloor)
  const toPoint = resolveEntrancePoint(toBuilding, toFloor)
  const meters = haversineMeters(fromPoint.lat, fromPoint.lng, toPoint.lat, toPoint.lng)
  const walkSeconds = (meters / WALKING_METERS_PER_MINUTE) * 60
  const totalSeconds =
    walkSeconds + entranceTransitSeconds(fromBuilding, fromFloor) + entranceTransitSeconds(toBuilding, toFloor)

  return {
    points: [fromPoint, toPoint],
    distanceMeters: Math.round(meters),
    totalSeconds,
    minutes: Math.max(1, Math.round(totalSeconds / 60)),
    hasIndoorTransit: fromFloor !== null || toFloor !== null,
    hasStairs: false,
    hasLinkSegment: false,
    isEstimate: true,
  }
}

/** 내 위치를 경로망에 이을 때 볼 가까운 점 수와 최대 거리. 더 멀면 직선 어림으로 대신한다. */
const MY_LOCATION_LINKS = 3
const MY_LOCATION_MAX_METERS = 150
export const MY_LOCATION_NODE = 'me'

/**
 * 내 위치(휴대폰이 읽은 좌표)에서 건물까지(11-03). 좌표는 이 계산에만 쓰고 저장하거나 서버로 보내지 않는다.
 * 내 위치에서 가까운 경로망 점(150m 안, 최대 3곳)으로 직선으로 걸어간다고 보고 잇는다. 너무 멀거나 그 건물이 망에 없으면 빈 배열.
 */
export function findRoutesFromPoint(
  buildings: readonly Building[],
  from: RoutePoint,
  to: { building: Building; floor: number | null },
  maxAlternatives = 3,
): RouteAlternative[] {
  const graph = cloneGraph(getBaseGraph(buildings))
  const targetId = attachFloorNode(graph, to.building, to.floor)
  if (!graph.nodes.has(targetId)) return []

  const near: { id: string; point: RoutePoint; meters: number }[] = []
  graph.nodes.forEach((point, id) => {
    if (!isOutdoorPathPoint(graph, id)) return
    const meters = haversineMeters(from.lat, from.lng, point.lat, point.lng)
    if (meters <= MY_LOCATION_MAX_METERS) near.push({ id, point, meters })
  })
  if (near.length === 0) return []
  near.sort((a, b) => a.meters - b.meters)
  for (const n of near.slice(0, MY_LOCATION_LINKS)) addEdge(graph, MY_LOCATION_NODE, from, n.id, n.point)

  const nameOf = shortNamer(buildings)
  return routeCandidates(graph, MY_LOCATION_NODE, targetId, maxAlternatives).map((path) =>
    nameVia(toRouteAlternative(graph, path, nameOf), buildings, [to.building.name]),
  )
}

/** 내 위치에서 건물까지 직선 어림(경로망이 못 덮을 때). */
export function straightLineFromPoint(from: RoutePoint, toBuilding: Building, toFloor: number | null): RouteAlternative {
  const toPoint = resolveEntrancePoint(toBuilding, toFloor)
  const meters = haversineMeters(from.lat, from.lng, toPoint.lat, toPoint.lng)
  const totalSeconds = (meters / WALKING_METERS_PER_MINUTE) * 60 + entranceTransitSeconds(toBuilding, toFloor)
  return {
    points: [from, toPoint],
    distanceMeters: Math.round(meters),
    totalSeconds,
    minutes: Math.max(1, Math.round(totalSeconds / 60)),
    hasIndoorTransit: toFloor !== null,
    hasStairs: false,
    hasLinkSegment: false,
    isEstimate: true,
  }
}
