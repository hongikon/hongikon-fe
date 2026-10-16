// 경로망 조사 저장소(src/utils/pathSurveyStore.ts) 단위 테스트. 사용: node --test scripts/path-survey/test-store.mjs
// 앱 소스(.ts)를 Node 24 타입 지우기로 바로 읽는다(확장자 없는 import 는 ../ask/ts-hooks.mjs 가 잇는다).
import { register } from 'node:module'
import { test } from 'node:test'
import assert from 'node:assert/strict'

register('../ask/ts-hooks.mjs', import.meta.url)
process.removeAllListeners('warning')
const S = await import('../../src/utils/pathSurveyStore.ts')

/** localStorage 흉내. */
function memoryStorage(init = {}) {
  const data = new Map(Object.entries(init))
  return {
    data,
    getItem: (k) => (data.has(k) ? data.get(k) : null),
    setItem: (k, v) => data.set(k, String(v)),
  }
}

const EXISTING = [
  { id: 'n1', lat: 37.55, lng: 126.92 },
  { id: 'n12', lat: 37.551, lng: 126.921 },
  { id: 'n153', lat: 37.552, lng: 126.922 }, // v1 을 찍은 뒤 pathNodes.ts 에 같은 번호가 생긴 경우
]

const V1 = {
  nodes: [
    { id: 'n153', lat: 37.5501, lng: 126.9201 },
    { id: 'n154', lat: 37.5502, lng: 126.9202 },
    { id: 'n155', lat: 37.5503, lng: 126.9203 },
  ],
  edges: [
    ['n153', 'n154'],
    ['n154', 'n155'],
    ['n155', 'n12'], // 기존 지점에 이은 간선
  ],
  memos: { n154: '계단 5칸', n12: '기존 지점 메모', n999: '지워진 지점 메모', n155: '   ' },
}

test('v1 변환: 지점/간선/메모 개수가 v1 과 같다', () => {
  const { module, report } = S.migrateV1(V1, EXISTING, 1000, 'mA')
  assert.equal(module.name, '미분류')
  assert.equal(module.status, 'draft')
  assert.equal(report.nodes, V1.nodes.length)
  assert.equal(module.nodes.filter((n) => !n.ref).length, V1.nodes.length)
  assert.equal(report.edges, V1.edges.length)
  assert.equal(module.edges.length, V1.edges.length)
  // 빈 메모(공백)는 v1 화면에서도 메모가 아니다.
  assert.equal(report.v1Memos, 3)
  assert.equal(report.memos, 3)
  assert.equal(module.nodes.filter((n) => n.memo).length + (module.memo.match(/^n\d+: /gm) ?? []).length, 3)
})

test('v1 변환: 새로 찍은 id 는 유지하고, pathNodes.ts 와 겹치는 id 만 접두사', () => {
  const { module, report } = S.migrateV1(V1, EXISTING, 1000, 'mA')
  const ids = module.nodes.map((n) => n.id)
  assert.ok(ids.includes('n154') && ids.includes('n155'))
  assert.ok(!ids.includes('n153'))
  assert.ok(ids.includes('mA-n153'))
  assert.deepEqual(report.renamed, ['n153'])
  // 기존 지점 n12 는 모듈 안 복사본으로 이어진다.
  const ref = module.nodes.find((n) => n.ref === 'n12')
  assert.equal(ref.id, 'mA-n12')
  assert.equal(ref.memo, '기존 지점 메모')
  assert.ok(module.edges.some((e) => (e.a === 'n155' && e.b === 'mA-n12') || (e.b === 'n155' && e.a === 'mA-n12')))
  assert.ok(module.edges.some((e) => e.a === 'mA-n153' && e.b === 'n154'))
  // 전체 유일
  assert.equal(new Set(ids).size, ids.length)
})

test('v1 이 비어 있으면 모듈을 만들지 않는다', () => {
  assert.equal(S.migrateV1({ nodes: [], edges: [], memos: {} }, EXISTING, 1), null)
  assert.equal(S.migrateV1(null, EXISTING, 1), null)
})

test('마이그레이션은 v2 가 없을 때 한 번만, v1 키는 남긴다', () => {
  const storage = memoryStorage({ [S.V1_KEY]: JSON.stringify(V1) })
  const first = S.loadStore(EXISTING, storage, 1000)
  assert.ok(first.migrated)
  assert.equal(first.store.modules.length, 1)
  assert.ok(storage.data.has(S.STORE_KEY))
  assert.ok(storage.data.has(S.V1_KEY), 'v1 키는 지우지 않는다')

  // 다시 열어도 v1 을 또 합치지 않는다.
  const second = S.loadStore(EXISTING, storage, 2000)
  assert.equal(second.migrated, null)
  assert.equal(second.store.modules.length, 1)

  // '미분류'를 지운 뒤에도 v1 이 되살아나지 않는다.
  S.saveStore(S.deleteModule(second.store, second.store.modules[0].id, 3000), storage)
  const third = S.loadStore(EXISTING, storage, 4000)
  assert.equal(third.store.modules.length, 0)
  assert.equal(third.migrated, null)
})

test('v2 가 깨져 있으면 덮어쓰지 않고 표시만 한다', () => {
  const storage = memoryStorage({ [S.STORE_KEY]: '{깨진', [S.V1_KEY]: JSON.stringify(V1) })
  const r = S.loadStore(EXISTING, storage, 1)
  assert.equal(r.corrupt, true)
  assert.equal(storage.data.get(S.STORE_KEY), '{깨진')
})

test('중복 간선 방지: 같은 쌍(방향 무관)·자기 자신은 추가하지 않는다', () => {
  let { store, module } = S.createModule(S.emptyStore(0), '1층 길', 0)
  let r = S.addNode(module, 37.1, 126.1)
  r = S.addNode(r.module, 37.2, 126.2, r.id) // 이어 찍기: 직전 지점과 간선
  let m = r.module
  assert.equal(m.edges.length, 1)
  const [a, b] = m.nodes.map((n) => n.id)
  m = S.addEdge(m, a, b)
  m = S.addEdge(m, b, a)
  m = S.addEdge(m, a, a)
  assert.equal(m.edges.length, 1)
  assert.match(m.nodes[0].id, new RegExp(`^${module.id}-n1$`))
  assert.match(m.edges[0].id, new RegExp(`^${module.id}-e1$`))
  // 불러온 값에 중복이 있어도 정리할 때 하나만 남는다.
  const dirty = { ...m, edges: [...m.edges, { id: 'x', a: b, b: a }] }
  assert.equal(S.normalizeModule(dirty).edges.length, 1)
  void store
})

test('확정 검증: places 가 없으면 done 으로 못 바꾼다', () => {
  let { store, module } = S.createModule(S.emptyStore(0), 'G동 2층 통로', 0)
  let r = S.finishModule(store, module.id, 10)
  assert.ok(r.problems.length > 0)
  assert.equal(S.findModule(r.store, module.id).status, 'draft')

  store = S.updateModule(store, module.id, (m) => ({ ...m, places: [{ buildingName: '학생회관 G동', floor: 2 }] }), 20)
  r = S.finishModule(store, module.id, 30)
  assert.deepEqual(r.problems, [])
  assert.equal(S.findModule(r.store, module.id).status, 'done')
  assert.equal(r.store.activeModuleId, null)

  // 0층은 잘못된 층
  const bad = { ...S.findModule(store, module.id), places: [{ buildingName: 'X', floor: 0 }] }
  assert.ok(S.doneProblems(bad).length > 0)

  // 다시 편집하면 draft + 활성
  const reopened = S.reopenModule(r.store, module.id, 40)
  assert.equal(S.findModule(reopened, module.id).status, 'draft')
  assert.equal(reopened.activeModuleId, module.id)
})

test('색: 어둡게, 직접 색 추가는 중복 없이', () => {
  assert.equal(S.darken('#FFFFFF', 0.5), '#808080')
  let store = S.addCustomColor(S.emptyStore(0), '#abcdef', 1)
  store = S.addCustomColor(store, '#ABCDEF', 2)
  store = S.addCustomColor(store, 'red', 3)
  assert.deepEqual(store.customColors, ['#ABCDEF'])
})
