#!/usr/bin/env node
/**
 * 경로망 조사 v3(/dev/path-survey-v3)의 백업 또는 그래프 내보내기 JSON 을 서버 길찾기 경로망
 * (hongikon-be/src/main/resources/walkroute/survey-graph-v3.json)으로 바꾼다. 길찾기 계산은 서버(GET /map/routes)가 한다.
 * 운영 경로망은 조사 도구의 '서버' 탭(올리기 → 길 시험 → 운영에 적용)으로 바꾼다 — 이 파일은 서버가 처음 켜질 때 쓰는 기본값이다.
 *
 *   node --import ./scripts/test/register.mjs scripts/path/import-survey-v3.mjs ~/Downloads/path-survey-v3-backup-YYYYMMDD-HHMM.json [출력 파일]
 *
 * 바꾸는 규칙은 src/utils/pathSurveyV3/serverGraph.ts(조사 도구 올리기와 같은 코드).
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { basename, dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { buildServerGraph } from '../../src/utils/pathSurveyV3/serverGraph'

const input = process.argv[2]
if (!input) {
  console.error('사용법: node --import ./scripts/test/register.mjs scripts/path/import-survey-v3.mjs <path-survey-v3-*.json> [출력 파일]')
  process.exit(1)
}
const data = JSON.parse(readFileSync(input, 'utf8'))
const { graph, skipped, entranceCount, buildingCount } = buildServerGraph(data)
for (const line of skipped) console.warn(line)

const out = process.argv[3] ?? join(dirname(fileURLToPath(import.meta.url)), '../../../hongikon-be/src/main/resources/walkroute/survey-graph-v3.json')
writeFileSync(out, JSON.stringify(graph))
console.log(`${out} (${basename(input)}${data.graph ? ', 그래프 내보내기' : ', 백업을 expandGraph 로 펼침'}): 정점 ${graph.vertices.length}, 간선 ${graph.edges.length}, 출입구 ${entranceCount}, 건물 ${buildingCount}, 제외 ${skipped.length}, 메모 점 ${Object.keys(graph.nodeMemos).length}·선 ${Object.keys(graph.edgeMemos).length}`)
console.log('서버 저장소에서 길찾기 비교 자료(src/test/resources/walkroute)도 새 경로망으로 다시 만들고 WalkRouterParityTest 를 돌린다.')
