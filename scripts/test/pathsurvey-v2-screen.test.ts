import { test } from 'node:test'
import assert from 'node:assert/strict'

import { parseSurveyMessage } from '../../src/screens/pathSurvey/mapBridge'
import { bootNotice, buildSurveyRenderState } from '../../src/screens/pathSurvey/screenModel'

/** v2 경로망 조사 화면(DevPathSurveyScreen)에서 떼어 낸 순수 함수들. */

const off = { plainNodes: false, namedNodes: false, namedFloors: {}, nodeEdges: false, anchorEdges: false, unconnectedEntrances: false }
const noOverlay = { plainNodes: [], namedNodes: [], unconnectedEntrances: [], namedFloorKeys: [], nodeEdges: [], anchorEdges: [] } as any

const mod = (id: string, nodes: any[], edges: any[] = [], extra: any = {}) => ({ id, name: id.toUpperCase(), color: '#2563EB', status: 'draft', nodes, edges, updatedAt: 1, ...extra })

test('지도 메시지: survey 가 보낸 것만 통과(v3 메시지는 거른다)', () => {
  assert.deepEqual(parseSurveyMessage('{"src":"survey","type":"tap","lat":1,"lng":2}'), { src: 'survey', type: 'tap', lat: 1, lng: 2 })
  assert.equal(parseSurveyMessage({ data: { src: 'surveyV3', type: 'tap' } }), null)
  assert.equal(parseSurveyMessage('{'), null)
})

test('첫 안내: 못 읽음, v1 옮김, 아무 일 없음', () => {
  assert.match(bootNotice({ corrupt: true, migrated: null }), /^저장된 조사 내용\(v2\)을 읽지 못했어요/)
  assert.equal(bootNotice({ corrupt: false, migrated: null }), '')
  const migrated = { nodes: 3, v1Nodes: 4, edges: 2, v1Edges: 2, memos: 1, v1Memos: 1, refNodes: 0, renamed: ['n1'] } as any
  assert.equal(bootNotice({ corrupt: false, migrated }), "예전 초안(v1)을 '미분류' 모듈로 옮겼어요 · 지점 3/4 · 간선 2/2 · 메모 1/1 · id 바꿈 n1")
})

test('그리기 상태: 숨긴 모듈 빼고, 편집 중 모듈은 맨 뒤, 공유 특수 지점은 한 번만', () => {
  const a = mod('ma', [{ id: 'ma-n1', lat: 1, lng: 1 }, { id: 'ma-n2', lat: 2, lng: 2, kind: 'elevator', sharedId: 's1' }], [{ id: 'ma-e1', a: 'ma-n1', b: 'ma-n2' }])
  const b = mod('mb', [{ id: 'mb-n1', lat: 3, lng: 3, kind: 'elevator', sharedId: 's1' }, { id: 'mb-n2', lat: 4, lng: 4, kind: 'entrance' }], [], { status: 'done' })
  const c = mod('mc', [{ id: 'mc-n1', lat: 5, lng: 5 }])
  const store = { version: 2, modules: [a, b, c], activeModuleId: 'ma', customColors: [], updatedAt: 1 } as any
  const state = buildSurveyRenderState({ store, active: a as any, hidden: { mc: true, ma: true }, legacyToggles: off, overlay: noOverlay, selected: 'ma-n1', pending: null, selectedEdge: null, mode: 'link' })
  assert.deepEqual(state.modules.map((m) => m.id), ['mb', 'ma'], '숨긴 mc 는 빠지고, 숨겨도 편집 중인 ma 는 남아 맨 뒤')
  const [mb, ma] = state.modules
  assert.deepEqual(mb.nodes.map((n) => n.id), ['mb-n2'], '편집 중 모듈이 이미 보이는 공유 지점은 다시 그리지 않는다')
  assert.equal(mb.nodes[0].short, 'n2 (MB)')
  assert.equal(mb.dashed, false)
  assert.equal(ma.dashed, true)
  assert.equal(ma.dim, false)
  assert.deepEqual(ma.edges, [{ id: 'ma-e1', a: 'ma-n1', b: 'ma-n2', p: [1, 1, 2, 2], memo: false, kind: undefined }])
  assert.deepEqual(state.legacy, { nodes: [], lines: [] })
  assert.equal(state.selected, 'ma-n1')
  assert.equal(state.mode, 'link')
})
