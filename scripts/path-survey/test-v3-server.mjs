// Path survey v3: save button to server draft. Upload rules, status, newer versions, apply warnings, stored state.
import { readFileSync } from 'node:fs'
import { register } from 'node:module'
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { edge, memoryStorage, node } from './v3-helpers.mjs'

register('../ask/ts-hooks.mjs', import.meta.url)
process.removeAllListeners('warning')
const S = await import('../../src/utils/pathSurveyV3/serverSave.ts')
const X = await import('../../src/utils/pathSurveyV3/transfer.ts')

// A made up key for the tests only. It must never show up in stored state or outcomes.
const DEV_KEY = 'test-dev-key-not-real'

const fixture = (name) => {
  const data = JSON.parse(readFileSync(new URL(`./fixtures/${name}`, import.meta.url), 'utf8'))
  return { nodes: data.nodes, edges: data.edges, updatedAt: 1 }
}
const routable = fixture('path-survey-v3-export-complete.json')
const withErrors = fixture('path-survey-v3-export-incomplete.json')
const print = (store) => X.storeFingerprint(store)

function fakeUpload(result = { id: 7, vertexCount: 3, edgeCount: 2 }) {
  const calls = []
  const upload = async (devKey, body) => {
    calls.push({ devKey, body })
    if (result instanceof Error) throw result
    return result
  }
  return { calls, upload }
}
const errorText = (e) => `failed: ${e?.message ?? 'unknown'}`
const push = (overrides) =>
  S.pushSurvey({ store: routable, devKey: DEV_KEY, blocked: false, state: S.EMPTY_SERVER_STATE, now: 1000, errorText, ...overrides })

// Upload rules

test('server save: upload only when the content differs from the last good draft', () => {
  assert.equal(S.shouldUpload(S.EMPTY_SERVER_STATE, 'a'), true, 'no record yet')
  assert.equal(S.shouldUpload({ lastFingerprint: 'a' }, 'a'), false, 'same content')
  assert.equal(S.shouldUpload({ lastFingerprint: 'a' }, 'b'), true, 'other content')
})

test('server save: after a failure, other content uploads again, content equal to the last good draft does not', () => {
  const good = S.afterUpload(S.EMPTY_SERVER_STATE, 5, 'a', 10)
  const failed = S.afterFailure(good, 'network')
  assert.equal(S.shouldUpload(failed, 'b'), true)
  assert.equal(S.shouldUpload(failed, 'a'), false)
  assert.equal(S.afterSkip(failed).lastError, null, 'a skip on the good content clears the old failure')
  assert.equal(S.afterSkip(good), good, 'a skip without a failure keeps the same object')
})

test('server save: no key and blocked stop before anything is built or sent', async () => {
  for (const [overrides, kind] of [
    [{ devKey: undefined }, 'noKey'],
    [{ devKey: '' }, 'noKey'],
    [{ blocked: true }, 'blocked'],
  ]) {
    const { calls, upload } = fakeUpload()
    const outcome = await push({ ...overrides, upload })
    assert.equal(outcome.kind, kind)
    assert.equal(calls.length, 0)
    assert.equal(S.stateAfter(S.EMPTY_SERVER_STATE, outcome), S.EMPTY_SERVER_STATE)
  }
})

test('server save: same content is skipped without a request', async () => {
  const { calls, upload } = fakeUpload()
  const state = S.afterUpload(S.EMPTY_SERVER_STATE, 9, print(routable), 10)
  const outcome = await push({ state, upload })
  assert.deepEqual(outcome, { kind: 'same', versionId: 9 })
  assert.equal(calls.length, 0)
})

test('server save: a new survey is sent once as a draft with backup and graph, and recorded', async () => {
  const { calls, upload } = fakeUpload()
  const outcome = await push({ upload })
  assert.equal(outcome.kind, 'uploaded')
  assert.equal(calls.length, 1)
  assert.equal(calls[0].devKey, DEV_KEY, 'the key goes to the request only')
  const { body } = calls[0]
  assert.equal(body.backup.format, 'hongikon.pathSurvey')
  assert.equal(body.backup.version, 3)
  assert.equal(body.backup.nodes.length, routable.nodes.length)
  assert.ok(body.graph.vertices.length > 0 && body.graph.edges.length > 0)
  assert.ok(body.sourceName.startsWith('저장 '), body.sourceName)
  const state = S.stateAfter(S.EMPTY_SERVER_STATE, outcome, 2000)
  assert.deepEqual(state, { lastVersionId: 7, lastAt: 2000, lastFingerprint: print(routable), lastError: null, noRouteFingerprint: null })
  assert.equal(S.shouldUpload(state, print(routable)), false, 'pressing save again sends nothing')
})

test('server save: a typed name is used, blank falls back to the save time', async () => {
  const named = fakeUpload()
  await push({ upload: named.upload, name: '  체육관 주변  ' })
  assert.equal(named.calls[0].body.sourceName, '체육관 주변')
  const blank = fakeUpload()
  await push({ upload: blank.upload, name: '   ' })
  assert.ok(blank.calls[0].body.sourceName.startsWith('저장 '))
})

test('server save: check errors do not stop a draft', async () => {
  const { calls, upload } = fakeUpload()
  const outcome = await push({ store: withErrors, upload })
  assert.equal(outcome.kind, 'uploaded')
  assert.equal(calls.length, 1)
})

test('server save: nothing routable is not a failure and sends nothing', async () => {
  for (const store of [
    { nodes: [], edges: [], updatedAt: 1 },
    { nodes: [node('n1'), node('n2')], edges: [], updatedAt: 1 },
  ]) {
    const { calls, upload } = fakeUpload()
    const outcome = await push({ store, upload })
    assert.equal(outcome.kind, 'noRoute')
    assert.equal(calls.length, 0)
    const state = S.stateAfter(S.afterFailure(S.EMPTY_SERVER_STATE, 'old'), outcome)
    assert.equal(state.lastError, null)
    assert.equal(S.serverSaveStateOf(state, print(store), { hasKey: true, blocked: false, saving: false }), 'noRoute')
  }
})

test('server save: a failed request becomes screen text and keeps the last good draft', async () => {
  const { upload } = fakeUpload(new Error('offline'))
  const good = S.afterUpload(S.EMPTY_SERVER_STATE, 3, 'older', 10)
  const outcome = await push({ state: good, upload })
  assert.deepEqual(outcome, { kind: 'failed', text: 'failed: offline' })
  const state = S.stateAfter(good, outcome)
  assert.equal(state.lastVersionId, 3)
  assert.equal(state.lastFingerprint, 'older')
  assert.equal(state.lastError, 'failed: offline')
})

test('server save: 401 and 403 say the key was refused, other errors use the usual text', () => {
  const generic = (_e, fallback) => `generic ${fallback}`
  assert.equal(S.serverErrorText({ status: 401 }, 'x', generic), S.KEY_REJECTED_TEXT)
  assert.equal(S.serverErrorText({ status: 403 }, 'x', generic), S.KEY_REJECTED_TEXT)
  assert.equal(S.serverErrorText({ status: 500 }, 'x', generic), 'generic x')
  assert.equal(S.serverErrorText(new Error('net'), 'x', generic), 'generic x')
  assert.equal(S.serverErrorText(null, 'x', generic), 'generic x')
})

// Status

test('server status: blocked first, then no key, saving, synced, failed, no route, never, changed', () => {
  const on = { hasKey: true, blocked: false, saving: false }
  const good = S.afterUpload(S.EMPTY_SERVER_STATE, 1, 'a', 10)
  assert.equal(S.serverSaveStateOf(good, 'b', { ...on, blocked: true, hasKey: false }), 'blocked')
  assert.equal(S.serverSaveStateOf(good, 'b', { ...on, hasKey: false }), 'noKey')
  assert.equal(S.serverSaveStateOf(good, 'b', { ...on, saving: true }), 'saving')
  assert.equal(S.serverSaveStateOf(good, 'a', on), 'synced')
  assert.equal(S.serverSaveStateOf(S.afterFailure(good, 'x'), 'a', on), 'synced', 'content back to the draft is on the server')
  assert.equal(S.serverSaveStateOf(S.afterFailure(good, 'x'), 'b', on), 'failed')
  assert.equal(S.serverSaveStateOf(S.afterNoRoute(good, 'c'), 'c', on), 'noRoute')
  assert.equal(S.serverSaveStateOf(S.EMPTY_SERVER_STATE, 'a', on), 'never')
  assert.equal(S.serverSaveStateOf(good, 'b', on), 'changed')
})

// Newer versions on the server

test('newer on server: empty, mine is newest, another is newer, no record but the server has some', () => {
  const v = (id) => ({ id, sourceName: `#${id}` })
  assert.equal(S.newerOnServer([], { lastVersionId: 3 }), null)
  assert.equal(S.newerOnServer([], { lastVersionId: null }), null)
  assert.equal(S.newerOnServer([v(1), v(3), v(2)], { lastVersionId: 3 }), null)
  assert.equal(S.newerOnServer([v(5), v(3)], { lastVersionId: 3 })?.id, 5)
  assert.equal(S.newerOnServer([v(2), v(4), v(1)], { lastVersionId: null })?.id, 4)
})

// Apply warnings

const report = (checks = {}, comparison = {}) => ({
  checks: { vertices: 10, edges: 9, detachedVertices: 0, detachedSample: [], unresolvedBuildingCodes: [], buildingsWithoutEntrances: [], ...checks },
  comparison: { against: 'file', pairs: 4, same: 4, faster: 0, slower: 0, becameEstimate: 0, becameReal: 0, biggest: [], ...comparison },
})

test('apply warnings: none for a clean report, one line for each problem', () => {
  assert.deepEqual(S.activationWarnings(report()), [])
  const lines = S.activationWarnings(report({ detachedVertices: 2, detachedSample: ['n1', 'n2'], unresolvedBuildingCodes: ['hongik_x'] }, { becameEstimate: 3 }))
  assert.equal(lines.length, 3)
  assert.ok(lines[0].includes('떨어진 점 2개') && lines[0].endsWith('n1, n2'), lines[0])
  assert.ok(lines[1].endsWith('hongik_x'))
  assert.ok(lines[2].endsWith(' 3'))
  assert.deepEqual(S.activationWarnings(report({ buildingsWithoutEntrances: ['hongik_r'] }, { becameReal: 2, slower: 1 })), [], 'only the three named problems')
})

test('apply warnings: a missing report starts with the warning and does not throw', () => {
  for (const missing of [null, undefined]) {
    const lines = S.activationWarnings(missing)
    assert.equal(lines.length, 1)
    assert.ok(lines[0].startsWith('검사 결과를 받지 못했어요'))
  }
})

// Stored state

test('server state: its own v3 key, round trip, other v1, v2 and v3 keys untouched', () => {
  assert.equal(S.SERVER_KEY_V3, 'hongikon.pathSurvey.v3.server')
  const storage = memoryStorage()
  const state = S.afterUpload(S.EMPTY_SERVER_STATE, 12, 'print', 99)
  S.saveServerSaveState(state, storage)
  assert.deepEqual(storage.writes, [S.SERVER_KEY_V3])
  assert.deepEqual(S.loadServerSaveState(storage), state)
})

test('server state: missing or damaged values read as empty, wrong field types are dropped', () => {
  assert.deepEqual(S.loadServerSaveState(memoryStorage()), S.EMPTY_SERVER_STATE)
  assert.deepEqual(S.loadServerSaveState(null), S.EMPTY_SERVER_STATE)
  for (const bad of ['{', 'null', '"text"', '42']) {
    assert.deepEqual(S.loadServerSaveState(memoryStorage({ [S.SERVER_KEY_V3]: bad })), S.EMPTY_SERVER_STATE, bad)
  }
  const mixed = JSON.stringify({ lastVersionId: '7', lastAt: Infinity, lastFingerprint: 5, lastError: '', noRouteFingerprint: 'p' })
  assert.deepEqual(S.loadServerSaveState(memoryStorage({ [S.SERVER_KEY_V3]: mixed })), { ...S.EMPTY_SERVER_STATE, noRouteFingerprint: 'p' })
  const throwing = { getItem: () => { throw new Error('blocked') }, setItem: () => { throw new Error('full') } }
  assert.deepEqual(S.loadServerSaveState(throwing), S.EMPTY_SERVER_STATE)
  assert.doesNotThrow(() => S.saveServerSaveState(S.EMPTY_SERVER_STATE, throwing))
})

test('server state: the dev key is never stored, even when a caller passes extra fields', async () => {
  const storage = memoryStorage()
  S.saveServerSaveState({ ...S.EMPTY_SERVER_STATE, devKey: DEV_KEY, token: DEV_KEY }, storage)
  assert.ok(!storage.data.get(S.SERVER_KEY_V3).includes(DEV_KEY))
  const outcomes = [
    await push({ upload: fakeUpload().upload }),
    await push({ upload: fakeUpload(new Error('down')).upload }),
    await push({ store: { nodes: [], edges: [], updatedAt: 1 }, upload: fakeUpload().upload }),
  ]
  for (const outcome of outcomes) {
    assert.ok(!JSON.stringify(outcome).includes(DEV_KEY), outcome.kind)
    S.saveServerSaveState(S.stateAfter(S.EMPTY_SERVER_STATE, outcome), storage)
    assert.ok(!storage.data.get(S.SERVER_KEY_V3).includes(DEV_KEY), outcome.kind)
  }
  const { calls, upload } = fakeUpload()
  await push({ upload })
  assert.ok(!JSON.stringify(calls[0].body).includes(DEV_KEY), 'the key is not in the uploaded body')
})

test('server state: a small edit after a draft shows as changed', async () => {
  const outcome = await push({ upload: fakeUpload().upload })
  const state = S.stateAfter(S.EMPTY_SERVER_STATE, outcome)
  const edited = { ...routable, edges: [...routable.edges, edge('e-extra', routable.nodes[0].id, routable.nodes[1].id)] }
  assert.equal(S.serverSaveStateOf(state, print(edited), { hasKey: true, blocked: false, saving: false }), 'changed')
})

test('server save: one going already skips a new upload, but same content and no key still answer first', async () => {
  const { calls, upload } = fakeUpload()
  assert.deepEqual(await push({ busy: true, upload }), { kind: 'busy' })
  assert.equal((await push({ busy: true, devKey: undefined, upload })).kind, 'noKey')
  assert.equal((await push({ busy: true, blocked: true, upload })).kind, 'blocked')
  const state = S.afterUpload(S.EMPTY_SERVER_STATE, 4, print(routable), 10)
  assert.equal((await push({ busy: true, state, upload })).kind, 'same')
  assert.equal(calls.length, 0)
  assert.equal(S.stateAfter(state, { kind: 'busy' }), state)
})
