import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

import { buildServerGraph } from '../../src/utils/pathSurveyV3/serverGraph'

/** 조사 도구 자료 → 서버 길찾기 경로망(hongikon-be SurveyGraph 모양). '서버에 올리기'와 import-survey-v3.mjs 가 같이 쓴다. */
test('그래프 내보내기 파일을 서버 경로망으로: 이어진 정점만, 출입구 이름, 메모', () => {
  const data = JSON.parse(readFileSync('scripts/path-survey/fixtures/path-survey-v3-export-complete.json', 'utf8'))
  const { graph, skipped, entranceCount } = buildServerGraph(data)
  assert.equal(skipped.length, 0)
  assert.ok(graph.vertices.length > 0 && graph.edges.length > 0)
  assert.match(graph.exportedAt, /^\d{4}-\d\d-\d\dT/)
  const used = new Set(graph.edges.flatMap((e) => [e[0], e[1]]))
  assert.ok(graph.vertices.every((v) => used.has(v[0])), '간선에 이어지지 않은 정점은 넣지 않는다')
  assert.equal(entranceCount, graph.vertices.filter((v) => v[5] === 1).length)
  for (const v of graph.vertices.filter((x) => x[5] === 1)) assert.ok(v[6], '출입구 정점에는 출입구 이름')
})

test('v3 조사 자료가 아니면 던진다', () => {
  assert.throws(() => buildServerGraph({ format: 'x' }), /경로망 조사 v3/)
  assert.throws(() => buildServerGraph(null), /경로망 조사 v3/)
})
