// 경로망 조사 내보내기/가져오기(src/utils/pathSurveySync.ts) 단위 테스트. 사용: node --test scripts/path-survey/test-sync.mjs
import { register } from 'node:module'
import { test } from 'node:test'
import assert from 'node:assert/strict'

register('../ask/ts-hooks.mjs', import.meta.url)
process.removeAllListeners('warning')
const S = await import('../../src/utils/pathSurveyStore.ts')
const Y = await import('../../src/utils/pathSurveySync.ts')
const { formatModuleExport } = await import('../../src/utils/pathSurvey.ts')

function moduleOf(id, updatedAt, extra = {}) {
  return S.normalizeModule({ id, name: id, status: 'draft', color: '#2563EB', nodes: [], edges: [], places: [], memo: '', createdAt: 0, updatedAt, ...extra })
}

test('내보낸 전체 JSON 을 다시 읽으면 같은 모듈', () => {
  const store = { ...S.emptyStore(0), modules: [moduleOf('mA', 5)], customColors: ['#ABCDEF'] }
  const parsed = Y.parseBundle(Y.serializeAll(store, 9))
  assert.deepEqual(parsed.modules, store.modules)
  assert.deepEqual(parsed.customColors, ['#ABCDEF'])
  // 모듈 하나만 붙여 넣어도 읽는다.
  assert.equal(Y.parseBundle(JSON.stringify(store.modules[0])).modules.length, 1)
  assert.throws(() => Y.parseBundle('nope'), /JSON/)
  assert.throws(() => Y.parseBundle('{"modules":[]}'), /모듈/)
})

test('가져오기: 새 것은 추가, 겹치면 updatedAt 최신 쪽, 덮어쓰기는 확인 후에만', () => {
  const store = { ...S.emptyStore(0), modules: [moduleOf('mA', 10), moduleOf('mB', 10)], activeModuleId: 'mA' }
  const incoming = { modules: [moduleOf('mA', 20, { name: '원격 A' }), moduleOf('mB', 5), moduleOf('mC', 1)] }
  const plan = Y.planImport(store, incoming)
  assert.deepEqual(plan.added.map((m) => m.id), ['mC'])
  assert.deepEqual(plan.newer.map((m) => m.id), ['mA'])
  assert.deepEqual(plan.kept.map((m) => m.id), ['mB'])

  const refused = Y.applyImport(store, plan, false, 30)
  assert.equal(refused.modules.find((m) => m.id === 'mA').name, 'mA')
  assert.equal(refused.modules.length, 3)

  const accepted = Y.applyImport(store, plan, true, 30)
  assert.equal(accepted.modules.find((m) => m.id === 'mA').name, '원격 A')
  assert.equal(accepted.modules.find((m) => m.id === 'mB').updatedAt, 10)
})

test('다른 모듈과 겹치는 지점 id 는 접두사로 바꾸고 간선도 따라간다', () => {
  const nodes = [
    { id: 'n153', lat: 1, lng: 1 },
    { id: 'n154', lat: 2, lng: 2 },
  ]
  const local = moduleOf('mA', 1, { nodes, edges: [{ id: 'mA-e1', a: 'n153', b: 'n154' }] })
  const store = { ...S.emptyStore(0), modules: [local] }
  const other = moduleOf('mB', 1, { nodes, edges: [{ id: 'mB-e1', a: 'n153', b: 'n154' }] })
  const next = Y.applyImport(store, Y.planImport(store, { modules: [other] }), true, 2)
  const b = next.modules.find((m) => m.id === 'mB')
  assert.deepEqual(b.nodes.map((n) => n.id), ['mB-n153', 'mB-n154'])
  assert.deepEqual([b.edges[0].a, b.edges[0].b], ['mB-n153', 'mB-n154'])
  const all = next.modules.flatMap((m) => m.nodes.map((n) => n.id))
  assert.equal(new Set(all).size, all.length)
})

test('모듈 코드 조각: 기존 지점 복사본은 원래 id 로, 간선 메모는 줄 끝 주석', () => {
  const m = moduleOf('mA', 1, {
    nodes: [
      { id: 'mA-n1', lat: 37.5, lng: 126.9, memo: '계단' },
      { id: 'mA-n12', lat: 37.6, lng: 126.8, ref: 'n12' },
    ],
    edges: [{ id: 'mA-e1', a: 'mA-n1', b: 'mA-n12', memo: '경사로' }],
    places: [{ buildingName: '학생회관 G동', floor: -1 }],
  })
  const text = formatModuleExport(m)
  assert.match(text, /\{ id: 'mA-n1', lat: 37\.5000000, lng: 126\.9000000 \}, \/\/ 계단/)
  assert.doesNotMatch(text, /id: 'mA-n12'/)
  assert.match(text, /\['mA-n1', 'n12'\], \/\/ 경사로/)
  assert.match(text, /학생회관 G동 B1/)
})
