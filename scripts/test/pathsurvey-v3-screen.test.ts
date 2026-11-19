import { test } from 'node:test'
import assert from 'node:assert/strict'

import {
  latestRollingSnapshot,
  legacyRenderPayload,
  openManualCount,
  parseSurveyMessage,
  placedNotice,
} from '../../src/screens/pathSurveyV3/screenModel'

/** 경로망 조사 v3 화면(DevPathSurveyV3Screen)에서 떼어 낸 순수 함수들. */

test('지도 메시지: surveyV3 가 보낸 것만 통과', () => {
  assert.deepEqual(parseSurveyMessage({ nativeEvent: { data: '{"src":"surveyV3","type":"tap"}' } }), { src: 'surveyV3', type: 'tap' })
  assert.deepEqual(parseSurveyMessage({ data: { src: 'surveyV3', type: 'node', id: 'n1' } }), { src: 'surveyV3', type: 'node', id: 'n1' })
  assert.equal(parseSurveyMessage('{"src":"map","type":"tap"}'), null)
  assert.equal(parseSurveyMessage('not json'), null)
  assert.equal(parseSurveyMessage(null), null)
})

const overlay = {
  plainNodes: [{ id: 'n1', lat: 1, lng: 2 }],
  namedNodes: [
    { id: 'R1', lat: 3, lng: 4, floor: 1 },
    { id: 'R?', lat: 5, lng: 6, floor: null },
  ],
  unconnectedEntrances: [{ id: 'E1', lat: 7, lng: 8 }],
  namedFloorKeys: [],
  nodeEdges: [[1, 2, 3, 4]] as [number, number, number, number][],
  anchorEdges: [
    { line: [1, 1, 2, 2] as [number, number, number, number] },
    { line: null },
  ],
} as any

const allOn = { plainNodes: true, namedNodes: true, namedFloors: {}, nodeEdges: true, anchorEdges: true, unconnectedEntrances: true }
const allOff = { plainNodes: false, namedNodes: false, namedFloors: {}, nodeEdges: false, anchorEdges: false, unconnectedEntrances: false }

test('기존 자료 겹쳐 보기: 켠 것만, 층 끈 이름 지점은 빼고, 선 종류 표시', () => {
  const all = legacyRenderPayload(overlay, allOn)
  assert.deepEqual(all.nodes.map((n) => n.id), ['n1', 'R1', 'R?', 'E1'])
  assert.match(all.nodes[1].label, /^R1 \(.+\)$/)
  assert.equal(all.nodes[2].label, 'R? (층 모름)')
  assert.deepEqual(all.lines, [
    [1, 2, 3, 4, 0],
    [1, 1, 2, 2, 1],
  ])
  assert.deepEqual(legacyRenderPayload(overlay, allOff), { nodes: [], lines: [] })
  const noUnknown = legacyRenderPayload(overlay, { ...allOff, namedNodes: true, namedFloors: { '층 모름': false } })
  assert.deepEqual(noUnknown.nodes.map((n) => n.id), ['R1'])
})

test('변경 보기 기준: 가장 새 저장 버튼 지점(rolling)', () => {
  const s = (id: string, kind: string, createdAt: number) => ({ id, kind, createdAt, name: id, nodes: [], edges: [], nextNode: 1, nextEdge: 1 }) as any
  assert.equal(latestRollingSnapshot([]), null)
  assert.equal(latestRollingSnapshot([s('a', 'manual', 9)]), null)
  assert.equal(latestRollingSnapshot([s('a', 'rolling', 1), s('b', 'manual', 9), s('c', 'rolling', 5), s('d', 'rolling', 3)])?.id, 'c')
})

test('v2 변환 수동 확인: 아직 열린 항목 수', () => {
  const store = {
    version: 3,
    nodes: [
      { id: 'n1', lat: 0, lng: 0, scope: 'outdoor', type: 'basic' },
      { id: 'n2', lat: 0, lng: 0, scope: 'indoor', type: 'basic', levels: [{ building: 'b', floor: 1 }] },
    ],
    edges: [],
    nextNode: 3,
    nextEdge: 1,
    updatedAt: 1,
  } as any
  assert.equal(openManualCount(store, null), 0)
  const report = { manual: [{ kind: 'boundary', nodeId: 'n1', candidates: [] }, { kind: 'boundary', nodeId: 'n2', candidates: [] }, { kind: 'boundary', nodeId: 'gone', candidates: [] }] } as any
  assert.equal(openManualCount(store, report), 1)
  assert.equal(openManualCount(store, { ...report, dismissed: ['n1'] }), 0)
})

test('점 찍은 뒤 안내', () => {
  const out = { id: 'n2', lat: 0, lng: 0, scope: 'outdoor', type: 'basic' } as any
  const inn = { id: 'n1', lat: 0, lng: 0, scope: 'indoor', type: 'basic', levels: [] } as any
  assert.equal(placedNotice(out, undefined, true, true), 'n2 추가')
  assert.equal(
    placedNotice(out, inn, true, true),
    'n2 추가, n1 와 이었어요. 외부 점과 내부 점은 출입구로만 이을 수 있어 이 간선은 점검에서 오류로 나와요',
  )
  assert.equal(placedNotice({ ...out, type: 'entrance' }, undefined, true, true), 'n2 추가. 아래에서 건물, 층, 이름을 고르세요. 비워 두면 점검 오류로 나와요')
  assert.equal(placedNotice(inn, undefined, false, true), 'n1 추가. 건물과 층이 없어 점검 오류로 나와요. 지금 층 필터 밖의 점이라 흐리게 보여요. 다른 점을 고르면 이 점은 잠겨요')
  assert.equal(placedNotice(out, undefined, false, false), 'n2 추가. 지금 층 필터 밖의 점이라 흐리게 보여요')
})
