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

function splitFixture() {
  return S.normalizeModule({ id: 'm', nodes: [
    { id: 'm-n1', lat: 37.5, lng: 126.9 },
    { id: 'm-n2', lat: 37.5, lng: 126.902 },
    { id: 'm-n3', lat: 37.501, lng: 126.902 },
    { id: 'm-n4', lat: 37.501, lng: 126.901, kind: 'intersection', memo: '새 지점' },
  ], edges: [
    { id: 'm-e1', a: 'm-n2', b: 'm-n3' },
    { id: 'm-e2', a: 'm-n3', b: 'm-n4' },
    { id: 'm-e3', a: 'm-n1', b: 'm-n2', memo: '경사로' },
  ] })
}

test('간선 위로 이동: 원래 간선 제거, 두 간선과 메모 보존, 다른 연결 유지', () => {
  const original = splitFixture()
  const snapshot = structuredClone(original)
  const next = S.moveNodeOntoEdge(original, 'm-n4', 'm-e3', 37.5, 126.901)
  assert.deepEqual(original, snapshot, '원본은 되돌리기에 쓸 수 있어야 한다')
  assert.equal(next.nodes.length, 4)
  assert.equal(next.edges.length, 4)
  assert.ok(!next.edges.some((e) => e.id === 'm-e3'))
  for (const end of ['m-n1', 'm-n2']) {
    assert.ok(S.hasModuleEdge(next, end, 'm-n4'))
    assert.equal(next.edges.find((e) => [e.a, e.b].includes(end) && [e.a, e.b].includes('m-n4')).memo, '경사로')
  }
  assert.deepEqual(next.edges.slice(0, 2), original.edges.slice(0, 2))
  assert.deepEqual(next.nodes[3], { ...original.nodes[3], lat: 37.5, lng: 126.901 })
  assert.equal(new Set(next.edges.map((e) => e.id)).size, next.edges.length)
})

test('간선 분할: 기존 연결 중복 없이 메모를 합치고, 같은 요청 재적용은 무시', () => {
  let m = S.addEdge(splitFixture(), 'm-n4', 'm-n1')
  m = S.setEdgeMemo(m, m.edges.at(-1).id, '기존 메모')
  const next = S.moveNodeOntoEdge(m, 'm-n4', 'm-e3', 37.5, 126.901)
  assert.equal(next.edges.length, 4)
  assert.equal(next.edges.find((e) => e.a === 'm-n4' && e.b === 'm-n1').memo, '기존 메모\n경사로')
  assert.equal(S.moveNodeOntoEdge(next, 'm-n4', 'm-e3', 37.5, 126.901), next)
})

test('간선 분할: 끝 지점·없는 지점·깨진 간선·유효하지 않은 좌표는 무시', () => {
  const m = splitFixture()
  assert.equal(S.moveNodeOntoEdge(m, 'm-n1', 'm-e3', 37.5, 126.901), m)
  assert.equal(S.moveNodeOntoEdge(m, 'missing', 'm-e3', 37.5, 126.901), m)
  assert.equal(S.moveNodeOntoEdge(m, 'm-n4', 'm-e3', 37.5, 126.9), m)
  assert.equal(S.moveNodeOntoEdge(m, 'm-n4', 'm-e3', NaN, 126.901), m)
  const broken = { ...m, nodes: m.nodes.filter((n) => n.id !== 'm-n1') }
  assert.equal(S.moveNodeOntoEdge(broken, 'm-n4', 'm-e3', 37.5, 126.901), broken)
})

test('교차점 성질: 저장 후 불러오기와 해제', () => {
  const storage = memoryStorage()
  const m = splitFixture()
  S.saveStore({ ...S.emptyStore(0), modules: [m] }, storage)
  assert.equal(S.loadStore([], storage).store.modules[0].nodes[3].kind, 'intersection')
  assert.equal(S.setNodeKind(m, 'm-n4', undefined).nodes[3].kind, undefined)
})

function sharedFixture(kind = 'elevator') {
  const source = S.normalizeModule({ id: 'source', status: 'done', name: '완료 모듈', updatedAt: 10,
    nodes: [{ id: 'source-n1', lat: 37.5, lng: 126.9, kind }, { id: 'source-n2', lat: 37.51, lng: 126.91 }],
    edges: [{ id: 'source-e1', a: 'source-n1', b: 'source-n2' }],
  })
  const target = S.normalizeModule({ id: 'target', status: 'draft', updatedAt: 20,
    nodes: [{ id: 'target-n1', lat: 37.52, lng: 126.92 }], edges: [],
  })
  return { ...S.emptyStore(20), modules: [source, target], activeModuleId: 'target' }
}

test('모든 특수 성질: 완료 모듈 지점을 참조하고 간선 연결, 재선택 시 중복 없음', () => {
  for (const kind of ['elevator', 'entrance', 'intersection']) {
    const original = sharedFixture(kind)
    const snapshot = structuredClone(original)
    const r = S.referenceSpecialNode(original, 'target', 'source', 'source-n1', 30)
    const source = S.findModule(r.store, 'source')
    const target = S.findModule(r.store, 'target')
    assert.equal(target.nodes.at(-1).kind, kind)
    assert.equal(target.nodes.at(-1).sharedId, source.nodes[0].sharedId)
    assert.notEqual(r.id, 'source-n1', '모듈 내부 id 는 구분한다')
    assert.equal(source.status, 'done')
    const linked = S.updateModule(r.store, 'target', (m) => S.addEdge(m, 'target-n1', r.id), 40)
    assert.ok(S.hasModuleEdge(S.findModule(linked, 'target'), 'target-n1', r.id))
    const again = S.referenceSpecialNode(linked, 'target', 'source', 'source-n1', 50)
    assert.equal(again.id, r.id)
    assert.equal(again.store, linked)
    assert.deepEqual(original, snapshot)
  }
})

test('일반 지점 외부 참조·완료 모듈에 참조 추가는 거절', () => {
  const store = sharedFixture()
  assert.equal(S.referenceSpecialNode(store, 'target', 'source', 'source-n2'), null)
  assert.equal(S.referenceSpecialNode(store, 'source', 'target', 'target-n1'), null)
  assert.equal(S.referenceSpecialNode(store, 'target', 'missing', 'source-n1'), null)
})

test('공유 위치 이동: 완료 상태·원래 간선 유지, 모든 참조 갱신, 원본 스냅샷으로 되돌리기 가능', () => {
  const r = S.referenceSpecialNode(sharedFixture(), 'target', 'source', 'source-n1', 30)
  const snapshot = structuredClone(r.store)
  const moved = S.updateModule(r.store, 'target', (m) => S.moveNode(m, r.id, 37.6, 126.8), 40)
  for (const m of moved.modules) {
    const node = m.nodes.find((n) => n.sharedId === 'source-n1')
    assert.equal(node.lat, 37.6)
    assert.equal(node.lng, 126.8)
    assert.equal(node.sharedUpdatedAt, 40)
    assert.equal(m.updatedAt, 40)
  }
  assert.equal(moved.modules[0].status, 'done')
  assert.deepEqual(moved.modules[0].edges, snapshot.modules[0].edges)
  assert.deepEqual(r.store, snapshot)
  const storage = memoryStorage()
  S.saveStore(moved, storage)
  assert.deepEqual(S.loadStore([], storage).store, moved)
  const returned = S.updateModule(moved, 'source', (m) => S.moveNode(m, 'source-n1', 37.7, 126.7), 50)
  assert.equal(S.findModule(returned, 'target').nodes.at(-1).lat, 37.7)
})

test('공유 참조 삭제는 다른 모듈의 지점과 연결을 지우지 않음', () => {
  const r = S.referenceSpecialNode(sharedFixture(), 'target', 'source', 'source-n1', 30)
  const removed = S.updateModule(r.store, 'source', (m) => S.removeNode(m, 'source-n1'), 40)
  assert.equal(S.findModule(removed, 'target').nodes.at(-1).sharedId, 'source-n1')
  const deleted = S.deleteModule(r.store, 'source', 40)
  const moved = S.updateModule(deleted, 'target', (m) => S.moveNode(m, r.id, 37.6, 126.8), 50)
  assert.equal(moved.modules[0].nodes.at(-1).lat, 37.6)
})

test('공유 후 성질은 고정, 모듈 이름·메모 변경으로 공유 위치 시각은 바뀌지 않음', () => {
  const r = S.referenceSpecialNode(sharedFixture(), 'target', 'source', 'source-n1', 30)
  const next = S.updateModule(r.store, 'target', (m) => S.setNodeKind(m, r.id, undefined), 40)
  assert.equal(S.findModule(next, 'target').nodes.at(-1).kind, 'elevator')
  const named = S.updateModule(next, 'target', (m) => ({ ...m, name: '새 이름' }), 50)
  assert.equal(S.findModule(named, 'target').nodes.at(-1).sharedUpdatedAt, 10)
  assert.equal(S.findModule(named, 'source').updatedAt, 30)
})

test('공유 지점의 간선 분할은 활성 모듈에서만, 위치는 모든 참조에서 갱신', () => {
  const r = S.referenceSpecialNode(sharedFixture('intersection'), 'target', 'source', 'source-n1', 30)
  const prepared = S.updateModule(r.store, 'target', (m) => {
    const added = S.addNode(m, 37.54, 126.92)
    return S.addEdge(added.module, 'target-n1', added.id)
  }, 40)
  const next = S.updateModule(prepared, 'target', (m) => S.moveNodeOntoEdge(m, r.id, m.edges[0].id, 37.53, 126.92), 50)
  assert.equal(S.findModule(next, 'target').edges.length, 2)
  assert.equal(S.findModule(next, 'source').edges.length, 1)
  assert.equal(S.findModule(next, 'source').nodes[0].lat, 37.53)
})

test('계단 간선: 기본은 일반, 계단으로 바꾸고 되돌리기, kind 없는 기존 데이터는 일반', () => {
  const m = splitFixture()
  assert.ok(m.edges.every((e) => !('kind' in e)), 'kind 없는 기존 간선은 일반')
  const stairs = S.setEdgeKind(m, 'm-e1', 'stairs')
  assert.equal(stairs.edges[0].kind, 'stairs')
  assert.deepEqual(m.edges[0], { id: 'm-e1', a: 'm-n2', b: 'm-n3' }, '되돌리기용 원본은 그대로')
  const plain = S.setEdgeKind(stairs, 'm-e1', undefined)
  assert.deepEqual(plain.edges[0], m.edges[0])
  // 모르는 종류 값은 읽을 때 버리고, 계단은 저장 후 불러오기에 남는다.
  const storage = memoryStorage()
  const weird = { ...stairs, edges: [...stairs.edges.slice(0, 2), { ...stairs.edges[2], kind: 'escalator' }] }
  S.saveStore({ ...S.emptyStore(0), modules: [weird] }, storage)
  const loaded = S.loadStore([], storage).store.modules[0]
  assert.equal(loaded.edges[0].kind, 'stairs')
  assert.equal(loaded.edges[1].kind, undefined)
  assert.equal(loaded.edges[2].kind, undefined)
})

test('계단 간선: 위로 지점을 옮겨 나누면 두 간선 모두 계단', () => {
  const m = S.setEdgeKind(splitFixture(), 'm-e3', 'stairs')
  const next = S.moveNodeOntoEdge(m, 'm-n4', 'm-e3', 37.5, 126.901)
  for (const end of ['m-n1', 'm-n2']) {
    assert.equal(next.edges.find((e) => [e.a, e.b].includes(end) && [e.a, e.b].includes('m-n4')).kind, 'stairs')
  }
  assert.equal(next.edges.find((e) => e.id === 'm-e2').kind, undefined)
})

test('계단 잇기: 다른 모듈의 일반 지점은 allowPlain 일 때만 계단 끝으로 공유', () => {
  const store = sharedFixture()
  assert.equal(S.referenceSpecialNode(store, 'target', 'source', 'source-n2', 30), null, '기본 동작은 그대로(거절)')
  const r = S.referenceSpecialNode(store, 'target', 'source', 'source-n2', 30, true)
  const source = S.findModule(r.store, 'source')
  const target = S.findModule(r.store, 'target')
  assert.equal(source.nodes[1].kind, 'stairs')
  assert.equal(source.nodes[1].sharedId, 'source-n2')
  assert.equal(target.nodes.at(-1).kind, 'stairs')
  assert.equal(target.nodes.at(-1).sharedId, 'source-n2')
  assert.equal(source.status, 'done')
  const linked = S.updateModule(r.store, 'target', (m) => S.setEdgeKind(S.addEdge(m, 'target-n1', r.id), 'target-e1', 'stairs'), 40)
  assert.equal(S.findModule(linked, 'target').edges[0].kind, 'stairs')
  // 다시 눌러도 같은 참조를 쓴다.
  assert.equal(S.referenceSpecialNode(linked, 'target', 'source', 'source-n2', 50, true).id, r.id)
  // 이미 특수 지점이면 원래 성질을 유지한다.
  assert.equal(S.findModule(S.referenceSpecialNode(store, 'target', 'source', 'source-n1', 30, true).store, 'target').nodes.at(-1).kind, 'elevator')
})
