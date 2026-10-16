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

// Gist(네트워크는 모의 fetch)

function fakeFetch(handler) {
  const calls = []
  const fn = async (url, init = {}) => {
    calls.push({ url, init })
    const { status = 200, body = {} } = await handler(url, init)
    return { ok: status >= 200 && status < 300, status, json: async () => body, text: async () => JSON.stringify(body) }
  }
  fn.calls = calls
  return fn
}

test('Gist 올리기: id 가 있으면 PATCH, 없으면 비공개로 새로 만든다. 토큰은 헤더에만', async () => {
  const store = { ...S.emptyStore(0), modules: [moduleOf('mA', 1)] }
  const patch = fakeFetch(() => ({ body: { id: 'g1' } }))
  assert.equal(await Y.pushGistBundle({ token: 'TKN', gistId: 'g1' }, store, patch, 5), 'g1')
  assert.equal(patch.calls[0].init.method, 'PATCH')
  assert.match(patch.calls[0].url, /\/gists\/g1$/)
  assert.equal(patch.calls[0].init.headers.Authorization, 'Bearer TKN')
  assert.ok(!patch.calls[0].init.body.includes('TKN'))
  const files = JSON.parse(patch.calls[0].init.body).files
  assert.equal(Y.parseBundle(files[Y.GIST_FILE].content).modules[0].id, 'mA')

  const create = fakeFetch(() => ({ status: 201, body: { id: 'gNew' } }))
  assert.equal(await Y.pushGistBundle({ token: 'TKN', gistId: '' }, store, create, 5), 'gNew')
  assert.equal(create.calls[0].init.method, 'POST')
  assert.equal(JSON.parse(create.calls[0].init.body).public, false)
})

test('Gist 실패 사유는 사람이 읽을 문구로, 토큰은 담지 않는다', async () => {
  const settings = { token: 'SECRET-TOKEN', gistId: 'g1' }
  for (const [status, pattern] of [[401, /401/], [403, /403/], [404, /404/], [502, /502/]]) {
    await assert.rejects(Y.fetchGistBundle(settings, fakeFetch(() => ({ status }))), (e) => {
      assert.ok(e instanceof Y.GistError)
      assert.match(e.message, pattern)
      assert.ok(!e.message.includes('SECRET-TOKEN'))
      return true
    })
  }
  const down = async () => {
    throw new TypeError('Failed to fetch')
  }
  await assert.rejects(Y.fetchGistBundle(settings, down), /닿지 못했어요/)
  await assert.rejects(Y.pushGistBundle({ token: '', gistId: 'g1' }, S.emptyStore(0), down), /토큰/)
})

test('Gist 불러오기: 파일 내용을 읽고, 파일이 없으면 null', async () => {
  const content = Y.serializeAll({ ...S.emptyStore(0), modules: [moduleOf('mR', 3)] }, 1)
  const ok = fakeFetch(() => ({ body: { id: 'g1', files: { [Y.GIST_FILE]: { content } } } }))
  assert.equal((await Y.fetchGistBundle({ token: 't', gistId: 'g1' }, ok)).modules[0].id, 'mR')
  const empty = fakeFetch(() => ({ body: { id: 'g1', files: {} } }))
  assert.equal(await Y.fetchGistBundle({ token: 't', gistId: 'g1' }, empty), null)
})

test('올리기 전 충돌: 원격이 더 최신인 모듈, 다른 기기에서 새로 만든 모듈. 이 기기에서 지운 모듈은 충돌 아님', () => {
  const store = { ...S.emptyStore(0), modules: [moduleOf('mA', 10), moduleOf('mB', 10)] }
  const meta = { lastSyncAt: 1, syncedStoreUpdatedAt: 1, synced: { mA: 10, mB: 10, mGone: 7 } }
  const remote = [moduleOf('mA', 12), moduleOf('mB', 9), moduleOf('mGone', 7), moduleOf('mNew', 3)]
  const c = Y.pushConflicts(store, remote, meta)
  assert.deepEqual(c.remoteNewer.map((m) => m.id), ['mA'])
  assert.deepEqual(c.remoteOnly.map((m) => m.id), ['mNew'])

  const { plan, skipped } = Y.dropLocallyDeleted(Y.planImport(store, { modules: remote }), meta)
  assert.deepEqual(skipped.map((m) => m.id), ['mGone'])
  assert.deepEqual(plan.added.map((m) => m.id), ['mNew'])
})

test('올리지 않은 변경 표시', () => {
  const store = { ...S.emptyStore(0), modules: [moduleOf('mA', 10)], updatedAt: 10 }
  assert.equal(Y.hasUnsyncedChanges(store, Y.EMPTY_META), true)
  const meta = Y.metaAfterSync(store, [], 11)
  assert.equal(Y.hasUnsyncedChanges(store, meta), false)
  assert.equal(Y.hasUnsyncedChanges({ ...store, updatedAt: 12 }, meta), true)
})
