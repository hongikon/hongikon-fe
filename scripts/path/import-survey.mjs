#!/usr/bin/env node
/**
 * 경로 조사 도구(/dev/path-survey)에서 "전체 내보내기"한 JSON 을 길찾기 경로망(src/constants/surveyPaths.ts)으로 바꾼다.
 *
 *   node scripts/path/import-survey.mjs ~/Downloads/path-survey-all-YYYYMMDD-HHMM.json
 *
 * - 모듈끼리는 같은 sharedId 를 가진 점이 같은 지점이다 → 하나로 묶는다(가장 최근에 고친 좌표).
 * - 선(edge)에 이어진 점만 넣는다. 선이 없는 점(출입구 모음 모듈의 표시용 점)은 길찾기에 못 쓰므로 뺀다.
 * - 출입구: 점 메모 첫 줄이 'HI_<건물코드>_<층>[_n]_ENTER' 인 점. 층은 1F→1, 1F5→1.5, LF→0(L층), B1F·B1→-1.
 *   건물은 앱이 서버 지도 데이터의 출입구 이름 앞부분(HI_R_ → 홍문관 R동)으로 찾는다(routing.ts).
 * - 계단 선(kind 'stairs')은 표시해 둔다. 경로에 계단이 있으면 앱이 "계단 있음"을 보여 준다.
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { basename, dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const input = process.argv[2]
if (!input) {
  console.error('사용법: node scripts/path/import-survey.mjs <path-survey-all-*.json>')
  process.exit(1)
}
const data = JSON.parse(readFileSync(input, 'utf8'))
if (data.format !== 'hongikon.pathSurvey' || !Array.isArray(data.modules)) {
  throw new Error('경로 조사 내보내기(format hongikon.pathSurvey) 파일이 아니다')
}

const round7 = (n) => Math.round(n * 1e7) / 1e7

// 1. 점: sharedId 로 묶는다.
const canonicalOf = new Map()
const points = new Map() // canonical id -> { lat, lng, updatedAt, memos: [] }
for (const module of data.modules) {
  for (const node of module.nodes) {
    const id = node.sharedId || node.id
    canonicalOf.set(node.id, id)
    const updatedAt = node.sharedUpdatedAt ?? module.updatedAt ?? 0
    const prev = points.get(id)
    if (!prev || updatedAt > prev.updatedAt) {
      points.set(id, { lat: node.lat, lng: node.lng, updatedAt, memos: [...(prev?.memos ?? [])] })
    }
    if (node.memo) points.get(id).memos.push(node.memo)
  }
}

// 2. 선: 같은 두 점을 잇는 선은 하나만. 계단이 하나라도 있으면 계단으로.
const edges = new Map()
for (const module of data.modules) {
  for (const edge of module.edges) {
    const a = canonicalOf.get(edge.a)
    const b = canonicalOf.get(edge.b)
    if (!a || !b || a === b) continue
    const key = a < b ? `${a}|${b}` : `${b}|${a}`
    const stairs = edge.kind === 'stairs' || edges.get(key)?.stairs === true
    edges.set(key, { a, b, stairs })
  }
}
const used = new Set([...edges.values()].flatMap((e) => [e.a, e.b]))

// 3. 짧은 id(p1, p2, …)로 바꿔 파일을 줄인다.
const shortId = new Map([...used].sort().map((id, i) => [id, `p${i + 1}`]))

// 4. 출입구.
function parseFloor(token) {
  if (token === 'LF') return 0
  let m = token.match(/^B(\d+)F?$/)
  if (m) return -Number(m[1])
  m = token.match(/^(\d+)F(\d)?$/)
  if (m) return m[2] ? Number(`${m[1]}.${m[2]}`) : Number(m[1])
  return null
}
const entrances = []
const skipped = []
for (const [id, point] of points) {
  if (!used.has(id)) continue
  for (const memo of point.memos) {
    const first = memo.split('\n')[0].trim()
    const m = first.match(/^HI_([A-Z0-9]+)_([A-Z0-9]+)(?:_\d+)?_ENTER/)
    if (!m) continue
    const label = first.match(/^HI_[A-Z0-9_]+?_ENTER/)[0]
    const floor = parseFloor(m[2])
    if (floor === null) {
      skipped.push(first)
      continue
    }
    if (entrances.some((e) => e.label === label)) continue
    entrances.push({ code: m[1], label, floor, node: shortId.get(id) })
  }
}
entrances.sort((x, y) => x.label.localeCompare(y.label))

const waypoints = [...used]
  .sort()
  .map((id) => `  { id: '${shortId.get(id)}', lat: ${round7(points.get(id).lat)}, lng: ${round7(points.get(id).lng)} },`)
const edgeLines = [...edges.values()].map(
  (e) => `  ['${shortId.get(e.a)}', '${shortId.get(e.b)}'${e.stairs ? ', true' : ''}],`,
)
const entranceLines = entrances.map(
  (e) => `  { code: '${e.code}', label: '${e.label}', floor: ${e.floor}, node: '${e.node}' },`,
)

const out = `/**
 * 길찾기 실측 경로망 — \`scripts/path/import-survey.mjs\` 가 만든 파일이다. 손으로 고치지 말고 조사 도구에서 고친 뒤 다시 만든다.
 * 원본: ${basename(input)} (내보낸 시각 ${new Date(data.exportedAt).toISOString()}, 모듈 ${data.modules.length}개)
 * 점 ${waypoints.length}개, 선 ${edgeLines.length}개(계단 ${[...edges.values()].filter((e) => e.stairs).length}개), 출입구 ${entranceLines.length}개.
 */

export interface SurveyWaypoint {
  id: string
  lat: number
  lng: number
}

/** [점 a, 점 b, 계단이면 true]. 양방향. */
export type SurveyEdge = [string, string, true?]

/** 경로망에 이어진 건물 출입구. code 는 출입구 이름의 건물 코드(HI_R_… → 'R'), floor 는 그 출입구 층(L층 0, 1.5층 1.5). */
export interface SurveyEntrance {
  code: string
  label: string
  floor: number
  node: string
}

export const SURVEY_WAYPOINTS: SurveyWaypoint[] = [
${waypoints.join('\n')}
]

export const SURVEY_EDGES: SurveyEdge[] = [
${edgeLines.join('\n')}
]

export const SURVEY_ENTRANCES: SurveyEntrance[] = [
${entranceLines.join('\n')}
]
`
const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const target = join(root, 'src', 'constants', 'surveyPaths.ts')
writeFileSync(target, out)
console.log(`점 ${waypoints.length}, 선 ${edgeLines.length}, 출입구 ${entranceLines.length} → ${target}`)
if (skipped.length) console.log(`층을 못 읽은 출입구 ${skipped.length}개: ${skipped.join(', ')}`)
