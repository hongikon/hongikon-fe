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

// C stage: status line, notices, entry check, check before a save

const clock = (at) => `t${at}`
const SUMMARY = (id, extra = {}) => ({ id, sourceName: `name${id}`, createdAt: '2026-11-10T05:05:00', status: 'DRAFT', ...extra })
const lister = (versions) => {
  const calls = []
  return {
    calls,
    list: async () => {
      calls.push(1)
      return { activeSource: 'file', bundledExportedAt: '', versions }
    },
  }
}
const backups = (byId) => {
  const calls = []
  return {
    calls,
    fingerprint: async (id) => {
      calls.push(id)
      if (byId[id] instanceof Error) throw byId[id]
      return byId[id]
    },
  }
}
const failingList = async () => {
  throw new Error('offline')
}

test('status line: every server state has its text, errors are added, only a failure retries', () => {
  const good = S.afterUpload(S.EMPTY_SERVER_STATE, 12, 'a', 500)
  const line = (view, state = good, errors = 0) => S.serverStatusLine(view, state, errors, clock)
  assert.deepEqual(line('synced'), { text: '서버 저장됨 #12 t500', tone: 'ok', retry: false })
  assert.equal(line('changed').text, '서버에 안 올린 변경 있음 (마지막 서버 저장 #12 t500)')
  assert.equal(line('saving').text, '서버 저장 중...')
  assert.equal(line('noKey').text, '브라우저에만 저장됨: 이 탭에 서버 암호키가 없어요')
  assert.equal(line('noRoute').text, '서버에 올릴 길 없음')
  const failed = line('failed', S.afterFailure(good, '서버와 연결이 원활하지 않아요.'))
  assert.equal(failed.text, '서버 저장 실패: 서버와 연결이 원활하지 않아요. 눌러서 다시 시도')
  assert.equal(failed.retry, true)
  assert.equal(line('synced', good, 3).text, '서버 저장됨 #12 t500 (점검 오류 3건 포함)')
  assert.ok(line('changed', good, 2).text.endsWith('(점검 오류 2건 포함)'))
  assert.equal(line('noKey', good, 2).text.includes('점검 오류'), false, 'nothing about errors when the server is not involved')
  for (const view of ['blocked', 'noKey', 'saving', 'synced', 'noRoute', 'never', 'changed']) assert.equal(line(view).retry, false, view)
})

test('status line: what the screen shows follows serverSaveStateOf', () => {
  const on = { hasKey: true, blocked: false, saving: false }
  const failed = S.afterFailure(S.afterUpload(S.EMPTY_SERVER_STATE, 2, 'a', 1), 'down')
  assert.equal(S.serverStatusLine(S.serverSaveStateOf(failed, 'b', on), failed, 0, clock).retry, true)
  assert.equal(S.serverStatusLine(S.serverSaveStateOf(failed, 'b', { ...on, saving: true }), failed, 0, clock).text, '서버 저장 중...')
})

test('save notice: browser result first, then the server result, both when the browser storage was full', () => {
  const up = { kind: 'uploaded', version: { id: 8, vertexCount: 1, edgeCount: 1 }, fingerprint: 'x', skipped: 0 }
  assert.equal(S.saveNoticeText(true, up), '브라우저에 저장했어요. 서버 초안 #8에도 저장했어요.')
  const full = S.saveNoticeText(false, up)
  assert.ok(full.startsWith('브라우저에는 저장하지 못했어요'))
  assert.ok(full.endsWith('서버 초안 #8에는 저장했어요.'))
  assert.ok(S.saveNoticeText(true, { kind: 'same', versionId: 8 }).includes('(#8)'))
  assert.ok(S.saveNoticeText(true, { kind: 'failed', text: 'down.' }).includes('서버 저장 실패: down.'))
  assert.ok(S.saveNoticeText(true, { kind: 'noRoute', fingerprint: 'x' }).endsWith('서버 저장 안 함(올릴 길 없음).'))
  assert.ok(S.saveNoticeText(true, { kind: 'canceled' }).endsWith('서버에는 올리지 않았어요.'))
  assert.equal(S.saveNoticeText(true, { kind: 'blocked' }), null, 'the stopped notice stays')
  assert.equal(S.saveNoticeText(false, { kind: 'blocked' }), S.BROWSER_SAVE_FAILED_TEXT)
})

test('full browser storage still saves to the server, a stopped tab does not', async () => {
  const ok = fakeUpload()
  const outcome = await push({ upload: ok.upload })
  assert.equal(outcome.kind, 'uploaded')
  assert.ok(S.saveNoticeText(false, outcome).includes('#7에는 저장했어요'))
  const stopped = fakeUpload()
  assert.equal((await push({ blocked: true, upload: stopped.upload })).kind, 'blocked')
  assert.equal(stopped.calls.length, 0)
})

test('entry (a): no server record and a local survey offers the base save, even with server versions, and fetches no backup', async () => {
  for (const versions of [[], [SUMMARY(3), SUMMARY(9)]]) {
    const l = lister(versions)
    const b = backups({})
    const result = await S.checkOnEntry({ state: S.EMPTY_SERVER_STATE, store: routable, listVersions: l.list, backupFingerprint: b.fingerprint })
    assert.deepEqual(result.offer, { kind: 'baseline' })
    assert.equal(result.state, S.EMPTY_SERVER_STATE)
    assert.equal(result.seenId, versions.length ? 9 : null)
    assert.equal(l.calls.length, 1)
    assert.equal(b.calls.length, 0)
  }
  assert.equal(S.offerText({ kind: 'baseline' }), '이 내용은 아직 서버에 올라가지 않았어요. 서버에 기준으로 저장할까요?')
})

test('entry (a): approving the base save uploads once without asking, closing it sends nothing', async () => {
  const approved = fakeUpload()
  const outcome = await push({ upload: approved.upload })
  assert.equal(outcome.kind, 'uploaded')
  assert.equal(approved.calls.length, 1)
  // Closing the offer is just not calling push: the entry check itself never uploads.
  const closed = fakeUpload()
  await S.checkOnEntry({ state: S.EMPTY_SERVER_STATE, store: routable, listVersions: lister([]).list, backupFingerprint: backups({}).fingerprint })
  assert.equal(closed.calls.length, 0)
})

test('entry (b): a newer id is compared by content; the same content is recorded quietly', async () => {
  const state = S.afterUpload(S.EMPTY_SERVER_STATE, 3, 'old', 1)
  const b = backups({ 5: print(routable) })
  const result = await S.checkOnEntry({ state, store: routable, listVersions: lister([SUMMARY(3), SUMMARY(5)]).list, backupFingerprint: b.fingerprint })
  assert.equal(result.offer, null)
  assert.deepEqual(b.calls, [5])
  assert.equal(result.state.lastVersionId, 5)
  assert.equal(result.state.lastFingerprint, print(routable))
  assert.equal(result.state.lastAt, Date.UTC(2026, 10, 10, 5, 5), 'the server time, read as UTC')
  assert.equal(S.serverSaveStateOf(result.state, print(routable), { hasKey: true, blocked: false, saving: false }), 'synced')
})

test('entry (b): other content, or a backup that cannot be read, is offered for loading', async () => {
  const state = S.afterUpload(S.EMPTY_SERVER_STATE, 3, 'old', 1)
  for (const value of ['other-print', new Error('down')]) {
    const result = await S.checkOnEntry({ state, store: routable, listVersions: lister([SUMMARY(5), SUMMARY(3)]).list, backupFingerprint: backups({ 5: value }).fingerprint })
    assert.equal(result.offer.kind, 'load')
    assert.equal(result.offer.version.id, 5)
    assert.equal(result.offer.newer, true)
    assert.equal(result.state, state)
  }
  const text = S.offerText({ kind: 'load', version: SUMMARY(15), newer: true })
  assert.ok(text.startsWith('다른 기기에서 저장한 #15('))
  assert.ok(text.includes('name15'))
})

test('entry (b): the newest id is this browser own, no backup is fetched and nothing is offered', async () => {
  const state = S.afterUpload(S.EMPTY_SERVER_STATE, 5, 'mine', 1)
  const b = backups({})
  const result = await S.checkOnEntry({ state, store: routable, listVersions: lister([SUMMARY(4), SUMMARY(5)]).list, backupFingerprint: b.fingerprint })
  assert.equal(result.offer, null)
  assert.equal(b.calls.length, 0)
  assert.equal(result.seenId, 5)
})

test('entry (c): an empty browser offers the newest version, nothing when the server is empty too', async () => {
  const empty = { nodes: [], edges: [] }
  const result = await S.checkOnEntry({ state: S.EMPTY_SERVER_STATE, store: empty, listVersions: lister([SUMMARY(2), SUMMARY(7), SUMMARY(4)]).list, backupFingerprint: backups({}).fingerprint })
  assert.deepEqual(result.offer, { kind: 'load', version: SUMMARY(7), newer: false })
  assert.ok(S.offerText(result.offer).startsWith('이 브라우저는 비어 있어요'))
  const none = await S.checkOnEntry({ state: S.EMPTY_SERVER_STATE, store: empty, listVersions: lister([]).list, backupFingerprint: backups({}).fingerprint })
  assert.equal(none.offer, null)
})

test('entry: a failed list gives no offer and leaves the state', async () => {
  const state = S.afterUpload(S.EMPTY_SERVER_STATE, 3, 'old', 1)
  const result = await S.checkOnEntry({ state, store: routable, listVersions: failingList, backupFingerprint: backups({}).fingerprint })
  assert.deepEqual(result, { offer: null, state, seenId: null })
})

test('loading over unsent work warns first, an empty browser or a synced one does not', () => {
  assert.equal(S.hasUnsentChanges(S.EMPTY_SERVER_STATE, routable), true)
  assert.equal(S.hasUnsentChanges(S.afterUpload(S.EMPTY_SERVER_STATE, 1, print(routable), 1), routable), false)
  assert.equal(S.hasUnsentChanges(S.EMPTY_SERVER_STATE, { nodes: [], edges: [] }), false)
  assert.ok(S.UNSENT_WARNING_TEXT.startsWith('서버에 안 올린 변경이 있어요'))
  const adopted = S.afterAdopt(S.EMPTY_SERVER_STATE, SUMMARY(6, { createdAt: 'bad' }), 'p', 77)
  assert.deepEqual([adopted.lastVersionId, adopted.lastFingerprint, adopted.lastAt], [6, 'p', 77])
})

test('before a save: nothing known asks nothing and lists nothing', async () => {
  const l = lister([SUMMARY(9)])
  let asked = 0
  const result = await S.overwriteCheck({
    lastVersionId: null,
    seenId: null,
    listVersions: l.list,
    confirm: () => {
      asked += 1
      return false
    },
  })
  assert.deepEqual(result, { go: true, seenId: null })
  assert.equal(l.calls.length, 0)
  assert.equal(asked, 0)
})

test('before a save: no newer version goes on, a newer one asks, yes goes on and no cancels', async () => {
  const never = () => assert.fail('no question expected')
  const quiet = await S.overwriteCheck({ lastVersionId: 5, seenId: 5, listVersions: lister([SUMMARY(5), SUMMARY(4)]).list, confirm: never })
  assert.deepEqual(quiet, { go: true, seenId: 5 })
  // The first save after the base offer: only something newer than what was seen on entry asks.
  const afterEntry = await S.overwriteCheck({ lastVersionId: null, seenId: 9, listVersions: lister([SUMMARY(9)]).list, confirm: never })
  assert.equal(afterEntry.go, true)
  const asked = []
  const yes = await S.overwriteCheck({
    lastVersionId: 5,
    seenId: 6,
    listVersions: lister([SUMMARY(8), SUMMARY(5)]).list,
    confirm: (v) => {
      asked.push(v.id)
      return true
    },
  })
  assert.deepEqual(yes, { go: true, seenId: 8 })
  assert.deepEqual(asked, [8])
  const no = await S.overwriteCheck({ lastVersionId: 5, seenId: 6, listVersions: lister([SUMMARY(8)]).list, confirm: () => false })
  assert.deepEqual(no, { go: false, seenId: 6 }, 'canceling keeps the old reference, so the next save asks again')
  const offline = await S.overwriteCheck({ lastVersionId: 5, seenId: null, listVersions: failingList, confirm: () => false })
  assert.equal(offline.go, true)
  assert.ok(S.overwriteQuestion(SUMMARY(8)).endsWith('그래도 이 내용으로 새 초안을 만들까요?'))
})

test('before a save: canceling the question uploads nothing and keeps the state, busy is set and cleared', async () => {
  const { calls, upload } = fakeUpload()
  const events = []
  const state = S.afterUpload(S.EMPTY_SERVER_STATE, 5, 'older', 1)
  const outcome = await push({
    state,
    upload,
    begin: () => events.push('begin'),
    end: () => events.push('end'),
    beforeUpload: async () => (await S.overwriteCheck({ lastVersionId: 5, seenId: 5, listVersions: lister([SUMMARY(8)]).list, confirm: () => false })).go,
  })
  assert.deepEqual(outcome, { kind: 'canceled' })
  assert.equal(calls.length, 0)
  assert.deepEqual(events, ['begin', 'end'])
  assert.equal(S.stateAfter(state, outcome), state)
})

test('busy is only set when an upload really starts, and is cleared after a failure', async () => {
  const events = []
  const track = { begin: () => events.push('begin'), end: () => events.push('end') }
  const state = S.afterUpload(S.EMPTY_SERVER_STATE, 5, print(routable), 1)
  await push({ state, upload: fakeUpload().upload, ...track })
  await push({ busy: true, upload: fakeUpload().upload, ...track })
  assert.deepEqual(events, [])
  await push({ upload: fakeUpload(new Error('down')).upload, ...track })
  assert.deepEqual(events, ['begin', 'end'])
})

test('retry after a failure: the next try uploads, clears the failure and the line turns synced', async () => {
  let state = S.EMPTY_SERVER_STATE
  state = S.stateAfter(state, await push({ state, upload: fakeUpload(new Error('down')).upload }))
  const on = { hasKey: true, blocked: false, saving: false }
  assert.equal(S.serverSaveStateOf(state, print(routable), on), 'failed')
  const again = fakeUpload({ id: 11, vertexCount: 1, edgeCount: 1 })
  state = S.stateAfter(state, await push({ state, upload: again.upload }), 50)
  assert.equal(again.calls.length, 1)
  assert.equal(state.lastError, null)
  assert.equal(S.serverStatusLine(S.serverSaveStateOf(state, print(routable), on), state, 0, clock).text, '서버 저장됨 #11 t50')
})

test('C stage: the dev key stays out of the state after entry checks, loads, cancels and failures', async () => {
  const storage = memoryStorage()
  const entry = await S.checkOnEntry({
    state: S.afterUpload(S.EMPTY_SERVER_STATE, 3, 'o', 1),
    store: routable,
    listVersions: lister([SUMMARY(5)]).list,
    backupFingerprint: backups({ 5: print(routable) }).fingerprint,
  })
  const states = [
    entry.state,
    S.afterAdopt(S.EMPTY_SERVER_STATE, SUMMARY(4), 'p'),
    S.stateAfter(S.EMPTY_SERVER_STATE, await push({ upload: fakeUpload().upload, beforeUpload: async () => false })),
    S.stateAfter(S.EMPTY_SERVER_STATE, await push({ upload: fakeUpload(new Error('down')).upload })),
  ]
  for (const state of states) {
    S.saveServerSaveState(state, storage)
    assert.ok(!storage.data.get(S.SERVER_KEY_V3).includes(DEV_KEY))
  }
})

test('server times: a time without a zone is UTC, a bad one is kept as text', () => {
  assert.equal(S.serverTimeMs('2026-11-10T05:05:00'), Date.UTC(2026, 10, 10, 5, 5))
  assert.equal(S.serverTimeMs('2026-11-10T05:05:00Z'), Date.UTC(2026, 10, 10, 5, 5))
  assert.equal(S.serverTimeMs('2026-11-10T14:05:00+09:00'), Date.UTC(2026, 10, 10, 5, 5))
  assert.equal(S.serverTimeMs(null), null)
  assert.equal(S.serverTimeText('bad'), 'bad')
  assert.equal(S.versionLabel({ id: 2, sourceName: null, createdAt: 'bad' }), '#2(bad)')
})

// D stage: folded version list, apply warnings

const V = (id, status = 'DRAFT', vertexCount = 100, edgeCount = 100) => ({ id, status, vertexCount, edgeCount, sourceName: null, createdAt: '' })
const range = (n, make = (id) => V(id)) => Array.from({ length: n }, (_, i) => make(i + 1))
const ids = (list) => list.map((v) => v.id)

test('version list: exactly 10 are all shown and nothing is folded', () => {
  const { shown, hidden } = S.visibleVersions(range(10), { expanded: false })
  assert.deepEqual(ids(shown), [10, 9, 8, 7, 6, 5, 4, 3, 2, 1])
  assert.equal(hidden, 0)
})

test('version list: 11 show the newest 10 and fold one, expanded shows all newest first', () => {
  const shuffled = [V(3), V(11), V(1), V(7), V(2), V(10), V(4), V(9), V(5), V(8), V(6)]
  const folded = S.visibleVersions(shuffled, { expanded: false })
  assert.deepEqual(ids(folded.shown), [11, 10, 9, 8, 7, 6, 5, 4, 3, 2])
  assert.equal(folded.hidden, 1)
  const open = S.visibleVersions(shuffled, { expanded: true })
  assert.deepEqual(ids(open.shown), [11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1])
  assert.equal(open.hidden, 0)
})

test('version list: production and the route test target stay visible beyond the newest 10, in id order', () => {
  const versions = range(15, (id) => V(id, id === 2 ? 'ACTIVE' : id < 4 ? 'ARCHIVED' : 'DRAFT'))
  const folded = S.visibleVersions(versions, { expanded: false })
  assert.deepEqual(ids(folded.shown), [15, 14, 13, 12, 11, 10, 9, 8, 7, 6, 2])
  assert.equal(folded.hidden, 4)
  const withTest = S.visibleVersions(versions, { expanded: false, testId: 4 })
  assert.deepEqual(ids(withTest.shown), [15, 14, 13, 12, 11, 10, 9, 8, 7, 6, 4, 2])
  assert.equal(withTest.hidden, 3)
  // Production as the 11th from the top: just past the cut.
  const eleventh = S.visibleVersions(range(11, (id) => V(id, id === 1 ? 'ACTIVE' : 'DRAFT')), { expanded: false })
  assert.equal(eleventh.shown.length, 11)
  assert.equal(eleventh.hidden, 0)
  assert.deepEqual(S.visibleVersions([], { expanded: false }), { shown: [], hidden: 0 })
})

test('20 percent drop: exactly 20 percent warns, just under does not, growth and an empty production never do', () => {
  assert.equal(S.droppedByFifth(100, 80), true)
  assert.equal(S.droppedByFifth(100, 81), false)
  assert.equal(S.droppedByFifth(100, 79), true)
  assert.equal(S.droppedByFifth(5, 4), true)
  assert.equal(S.droppedByFifth(6, 5), false)
  assert.equal(S.droppedByFifth(100, 120), false)
  assert.equal(S.droppedByFifth(0, 0), false)
})

const cleanReport = () => report()
const applyList = (...versions) => versions

test('apply warnings: the newest draft with a clean report and similar size gives the plain question', () => {
  const versions = applyList(V(5, 'ACTIVE', 100, 100), V(6, 'DRAFT', 95, 98))
  assert.deepEqual(S.applyWarnings(versions[1], cleanReport(), versions, 'v5'), [])
  assert.equal(S.applyConfirmText(versions[1], cleanReport(), versions, 'v5'), S.plainApplyQuestion(6))
  assert.equal(S.plainApplyQuestion(6), '#6 경로망을 운영에 적용할까요? 바로 앱 길찾기가 이 경로망을 써요. 예전 버전을 다시 적용하면 되돌릴 수 있어요.')
})

test('apply warnings: a missing report comes first', () => {
  const versions = applyList(V(5, 'ACTIVE'), V(6))
  for (const missing of [null, undefined]) {
    const lines = S.applyWarnings(versions[1], missing, versions, 'v5')
    assert.equal(lines.length, 1)
    assert.ok(lines[0].startsWith('검사 결과를 받지 못했어요'))
  }
})

test('apply warnings: check problems give their count, then the detail lines', () => {
  const versions = applyList(V(5, 'ACTIVE'), V(6))
  const bad = report({ detachedVertices: 2, detachedSample: ['n1', 'n2'], unresolvedBuildingCodes: ['hongik_x'] }, { becameEstimate: 1 })
  assert.equal(S.reportProblemCount(bad), 4)
  const lines = S.applyWarnings(versions[1], bad, versions, 'v5')
  assert.equal(lines[0], '서버 점검 문제 4건이 있어요.')
  assert.equal(lines.length, 4)
  const one = S.applyWarnings(versions[1], report({}, { becameEstimate: 1 }), versions, 'v5')
  assert.equal(one[0], '서버 점검 문제 1건이 있어요.')
})

test('apply warnings: points or edges down 20 percent against production, at the boundary', () => {
  const at = applyList(V(5, 'ACTIVE', 100, 50), V(6, 'DRAFT', 80, 50))
  const lines = S.applyWarnings(at[1], cleanReport(), at, 'v5')
  assert.equal(lines.length, 1)
  assert.ok(lines[0].startsWith('점이 운영 #5보다 20% 이상 줄어요'))
  const under = applyList(V(5, 'ACTIVE', 100, 50), V(6, 'DRAFT', 81, 41))
  assert.deepEqual(S.applyWarnings(under[1], cleanReport(), under, 'v5'), [])
  const edges = applyList(V(5, 'ACTIVE', 100, 50), V(6, 'DRAFT', 100, 40))
  assert.ok(S.applyWarnings(edges[1], cleanReport(), edges, 'v5')[0].startsWith('간선이 운영 #5보다'))
  // Production is the bundled file: its counts are unknown, so no size warning.
  assert.deepEqual(S.applyWarnings(at[1], cleanReport(), at.slice(1), 'file'), [])
})

test('apply warnings: an older draft or an archived version is not the newest draft', () => {
  const versions = applyList(V(3, 'ARCHIVED'), V(5, 'ACTIVE'), V(6), V(7))
  const older = S.applyWarnings(versions[2], cleanReport(), versions, 'v5')
  assert.deepEqual(older, ['가장 최신 초안(#7)이 아니에요. 되돌리려는 게 아니면 최신 초안인지 확인해 주세요.'])
  assert.equal(S.applyWarnings(versions[0], cleanReport(), versions, 'v5').length, 1)
  assert.deepEqual(S.applyWarnings(versions[3], cleanReport(), versions, 'v5'), [])
  const noDraft = applyList(V(3, 'ARCHIVED'), V(5, 'ACTIVE'))
  assert.deepEqual(S.applyWarnings(noDraft[0], cleanReport(), noDraft, 'v5'), ['가장 최신 초안이 아니에요.'])
})

test('apply confirmation with warnings: warnings, both counts with the difference, then the plain question', () => {
  const versions = applyList(V(5, 'ACTIVE', 100, 90), V(6, 'DRAFT', 70, 95), V(7))
  const text = S.applyConfirmText(versions[1], null, versions, 'v5')
  const lines = text.split('\n')
  assert.equal(lines[0], '주의할 점')
  assert.ok(lines[1].startsWith('- 검사 결과를 받지 못했어요'))
  assert.ok(lines[2].startsWith('- 점이 운영 #5보다'))
  assert.ok(lines[3].startsWith('- 가장 최신 초안(#7)'))
  assert.ok(text.includes('적용할 #6: 점 70, 간선 95'))
  assert.ok(text.includes('운영 #5: 점 100, 간선 90 (차이 점 -30, 간선 +5)'))
  assert.ok(text.endsWith(S.plainApplyQuestion(6)))
  const fromFile = S.applyConfirmText(versions[1], null, versions, 'file')
  assert.ok(fromFile.includes('운영: 저장소 기본 경로망'))
})
