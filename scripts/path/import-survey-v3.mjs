#!/usr/bin/env node
/**
 * 경로망 조사 v3(/dev/path-survey-v3)의 백업 또는 그래프 내보내기 JSON 을 서버 길찾기 경로망
 * (hongikon-be/src/main/resources/walkroute/survey-graph-v3.json)으로 바꾼다. 길찾기 계산은 서버(GET /map/routes)가 한다.
 *
 *   node --import ./scripts/test/register.mjs scripts/path/import-survey-v3.mjs ~/Downloads/path-survey-v3-backup-YYYYMMDD-HHMM.json [출력 파일]
 *
 * - 파일에 `graph` 가 있으면(그래프 내보내기) 그대로, 없으면(백업) 조사 도구와 같은 `expandGraph` 로 펼친다.
 * - 간선에 이어진 정점만 넣는다(이어지지 않은 점은 길찾기에 못 쓴다).
 * - 실내 정점 id 는 `n12@hongik_k:-1`(점@건물코드:층). 건물 코드는 서버 지도 데이터의 건물 code 와 같다.
 * - 수직 간선(stairs_vertical·elevator_vertical)과 tie 의 시간은 서버(WalkRouter)가 정한다.
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

// 서버(hongikon-be)가 길찾기에 쓰는 파일로 쓴다(11-09: 길찾기 계산은 서버, 앱에는 경로망을 두지 않는다).
const out = process.argv[3] ?? join(dirname(fileURLToPath(import.meta.url)), '../../../hongikon-be/src/main/resources/walkroute/survey-graph-v3.json')
writeFileSync(out, JSON.stringify({ exportedAt, vertices, edges, nodeMemos, edgeMemos }))
console.log(`${out} (${basename(input)}${data.graph ? ', 그래프 내보내기' : ', 백업을 expandGraph 로 펼침'}): 정점 ${vertices.length}, 간선 ${edges.length}, 출입구 ${entranceCount}, 건물 ${buildings.size}, 제외 ${skippedCount}, 메모 점 ${Object.keys(nodeMemos).length}·선 ${Object.keys(edgeMemos).length}`)
console.log('서버 저장소에서 길찾기 비교 자료(src/test/resources/walkroute)도 새 경로망으로 다시 만들고 WalkRouterParityTest 를 돌린다.')
