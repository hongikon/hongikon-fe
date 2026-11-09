#!/usr/bin/env node
/**
 * 경로망 조사 v3(/dev/path-survey-v3)의 백업 또는 그래프 내보내기 JSON 을 길찾기 경로망(src/constants/surveyGraphV3.ts)으로 바꾼다.
 *
 *   node --import ./scripts/test/register.mjs scripts/path/import-survey-v3.mjs ~/Downloads/path-survey-v3-backup-YYYYMMDD-HHMM.json
 *
 * - 파일에 `graph` 가 있으면(그래프 내보내기) 그대로, 없으면(백업) 조사 도구와 같은 `expandGraph` 로 펼친다.
 * - 간선에 이어진 정점만 넣는다(이어지지 않은 점은 길찾기에 못 쓴다).
 * - 실내 정점 id 는 `n12@hongik_k:-1`(점@건물코드:층). 건물 코드는 서버 지도 데이터의 건물 code 와 같다.
 * - 수직 간선(stairs_vertical·elevator_vertical)과 tie 의 시간은 routing.ts 가 정한다.
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { basename, dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { expandGraph } from '../../src/utils/pathSurveyV3/expand'

const input = process.argv[2]
if (!input) {
  console.error('사용법: node --import ./scripts/test/register.mjs scripts/path/import-survey-v3.mjs <path-survey-v3-*.json>')
  process.exit(1)
}
const data = JSON.parse(readFileSync(input, 'utf8'))
if (data.format !== 'hongikon.pathSurvey' || data.version !== 3 || !Array.isArray(data.nodes) || !Array.isArray(data.edges)) {
  throw new Error('경로망 조사 v3(format hongikon.pathSurvey, version 3) 파일이 아니다')
}

let graph = data.graph
let skippedCount = 0
if (!graph) {
  const result = expandGraph(data.nodes, data.edges)
  graph = result.graph
  skippedCount = result.skipped.length + result.skippedNodes.length + result.skippedLevels.length + result.skippedTies.length
  for (const s of result.skipped) console.warn(`간선 제외 ${s.edgeId}: ${s.reason}`)
  for (const s of result.skippedNodes) console.warn(`점 제외 ${s.nodeId}: ${s.reason}`)
  for (const s of result.skippedLevels) console.warn(`층 제외 ${s.nodeId} ${s.building}:${s.floor}: ${s.reason}`)
  for (const s of result.skippedTies) console.warn(`tie 제외 ${s.nodeId}: ${s.reason}`)
}

const nodeById = new Map(data.nodes.map((n) => [n.id, n]))
const round7 = (n) => Math.round(n * 1e7) / 1e7
const used = new Set()
for (const e of graph.edges) {
  used.add(e.a)
  used.add(e.b)
}

const TYPE_CODE = { basic: 0, entrance: 1, elevator: 2, stairs: 3 }
const vertices = graph.vertices
  .filter((v) => used.has(v.id))
  .map((v) => {
    const label = v.type === 'entrance' ? nodeById.get(v.node)?.entranceLabel ?? null : null
    return [v.id, round7(v.lat), round7(v.lng), v.building ?? null, v.floor ?? null, TYPE_CODE[v.type] ?? 0, label]
  })
const edges = graph.edges.map((e) => (e.meters === undefined ? [e.a, e.b, e.kind] : [e.a, e.b, e.kind, e.meters]))

// 조사 때 적은 메모(11-09): 점 메모는 원래 점 id, 선 메모는 두 점 id('a|b', 작은 쪽 먼저)로. 길찾기 카드의 안내 줄이 된다.
const usedNodes = new Set(vertices.map((v) => graph.vertices.find((g) => g.id === v[0])?.node).filter(Boolean))
const nodeMemos = Object.fromEntries(
  data.nodes.filter((n) => usedNodes.has(n.id) && typeof n.memo === 'string' && n.memo.trim()).map((n) => [n.id, n.memo.trim()]),
)
const edgeMemos = Object.fromEntries(
  data.edges
    .filter((e) => usedNodes.has(e.a) && usedNodes.has(e.b) && typeof e.memo === 'string' && e.memo.trim())
    .map((e) => [[e.a, e.b].sort().join('|'), e.memo.trim()]),
)

const buildings = new Set(vertices.filter((v) => v[3]).map((v) => v[3]))
const entranceCount = vertices.filter((v) => v[5] === 1).length
const exportedAt = new Date(data.exportedAt).toISOString()

const json = (value) => JSON.stringify(value)
const lines = [
  '/**',
  ' * 길찾기 경로망(경로망 조사 v3) — `scripts/path/import-survey-v3.mjs` 가 만든 파일이다. 손으로 고치지 말고 조사 도구에서 고친 뒤 다시 만든다.',
  ` * 원본: ${basename(input)} (내보낸 시각 ${exportedAt}${data.graph ? ', 그래프 내보내기' : ', 백업을 expandGraph 로 펼침'})`,
  ` * 정점 ${vertices.length}개, 간선 ${edges.length}개, 출입구 ${entranceCount}개, 건물 ${buildings.size}곳.${skippedCount ? ` 펼치지 못한 항목 ${skippedCount}개(가져올 때 경고로 출력).` : ''}`,
  ' */',
  '',
  '/** 간선 종류(pathSurveyV3/types 의 GraphEdgeKind 와 같다). 조사 도구 코드 없이도 읽히도록 여기 적는다. */',
  "export type SurveyV3EdgeKind = 'normal' | 'stairs' | 'stairs_vertical' | 'elevator_vertical' | 'tie'",
  '',
  '/** 0 기본, 1 출입구, 2 엘리베이터, 3 계단. */',
  'export type SurveyV3VertexType = 0 | 1 | 2 | 3',
  '',
  '/** [id, 위도, 경도, 건물 code(실외 null), 층(실외 null), 종류, 출입구 이름(출입구만)]. */',
  'export type SurveyV3Vertex = [string, number, number, string | null, number | null, SurveyV3VertexType, string | null]',
  '',
  '/** [정점 a, 정점 b, 종류, 미터(수직 간선은 없음)]. 양방향. */',
  'export type SurveyV3Edge = [string, string, SurveyV3EdgeKind, number?]',
  '',
  `export const SURVEY_V3_EXPORTED_AT = ${json(exportedAt)}`,
  '',
  'export const SURVEY_V3_VERTICES: SurveyV3Vertex[] = [',
  ...vertices.map((v) => `  ${json(v)},`),
  ']',
  '',
  'export const SURVEY_V3_EDGES: SurveyV3Edge[] = [',
  ...edges.map((e) => `  ${json(e)},`),
  ']',
  '',
  '/** 조사 메모: 원래 점 id(정점 id 의 @ 앞) → 메모. 길찾기 카드에 지나는 곳 안내로 쓴다. */',
  'export const SURVEY_V3_NODE_MEMOS: Record<string, string> = {',
  ...Object.entries(nodeMemos).map(([id, memo]) => `  ${json(id)}: ${json(memo)},`),
  '}',
  '',
  "/** 조사 메모: 'a|b'(원래 점 id, 작은 쪽 먼저) → 그 선의 메모. */",
  'export const SURVEY_V3_EDGE_MEMOS: Record<string, string> = {',
  ...Object.entries(edgeMemos).map(([id, memo]) => `  ${json(id)}: ${json(memo)},`),
  '}',
  '',
]

const out = join(dirname(fileURLToPath(import.meta.url)), '../../src/constants/surveyGraphV3.ts')
writeFileSync(out, lines.join('\n'))
console.log(`${out}: 정점 ${vertices.length}, 간선 ${edges.length}, 출입구 ${entranceCount}, 건물 ${buildings.size}, 제외 ${skippedCount}, 메모 점 ${Object.keys(nodeMemos).length}·선 ${Object.keys(edgeMemos).length}`)
