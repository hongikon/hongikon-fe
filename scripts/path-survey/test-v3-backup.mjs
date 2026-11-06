// Path survey v3: save point list rules, backup content and round trips, backup status, Gist sync, typed floor ranges.
import { readFileSync } from 'node:fs'
import { register } from 'node:module'
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { edge, FIXTURE_BUILDINGS, indoor, lvl, memoryStorage, node } from './v3-helpers.mjs'

register('../ask/ts-hooks.mjs', import.meta.url)
process.removeAllListeners('warning')
const Snap = await import('../../src/utils/pathSurveyV3/snapshots.ts')
const Store = await import('../../src/utils/pathSurveyV3/store.ts')
const X = await import('../../src/utils/pathSurveyV3/transfer.ts')
const G = await import('../../src/utils/pathSurveyV3/gist.ts')
const L = await import('../../src/utils/pathSurveyV3/levels.ts')
const B = await import('../../src/utils/pathSurveyV3/buildings.ts')
const C = await import('../../src/utils/pathSurveyV3/convertV2.ts')
const { checkGraph } = await import('../../src/utils/pathSurveyV3/check.ts')

const index = B.buildBuildingIndex(FIXTURE_BUILDINGS)
const R = 'hongik_r'
const K = 'hongik_k'

function sampleStore() {
  const nodes = [
    node('n1', { memo: '메모 "따옴표"\n둘째 줄' }),
    indoor('n2', [lvl(R, 1)], { type: 'entrance', entranceLabel: 'HI_R_1F5_ENTER' }),
    indoor('n3', [lvl(R, -1), lvl(R, 0), lvl(R, 1.5), lvl(K, 2)], {
      type: 'elevator',
      ties: [[lvl(R, 1.5), lvl(K, 2)]],
      legacyId: 'old-7',
    }),
  ]
  const edges = [edge('e1', 'n1', 'n2'), edge('e2', 'n2', 'n3', { kind: 'stairs', memo: 'x', pairs: [[lvl(R, 1), lvl(R, 1.5)]] })]
  return Store.normalizeStoreV3({ nodes, edges, nextNode: 4, nextEdge: 3, updatedAt: 5 }, 5)
}

// Save points

test('save points: the save button reuses its own 10 slots and leaves protected and manual ones alone', () => {
  const storage = memoryStorage()
  const s = sampleStore()
  Snap.createSnapshot(s, 'v2 변환 직전', 'protected', storage, 1)
  Snap.createSnapshot(s, '직접', 'manual', storage, 2)
  for (let i = 0; i < 40; i += 1) assert.equal(Snap.createSnapshot(s, `저장 ${i}`, 'rolling', storage, 10 + i).error, null)
  const list = Snap.loadSnapshots(storage)
  assert.equal(list.filter((x) => x.kind === 'rolling').length, Snap.ROLLING_LIMIT)
  assert.deepEqual(list.filter((x) => x.kind !== 'rolling').map((x) => x.name), ['v2 변환 직전', '직접'])
  assert.ok(list.some((x) => x.name === '저장 39'))
  assert.ok(!list.some((x) => x.name === '저장 29'))
})

test('save points: full kept slots never stop the save button, and full rolling slots never stop a kept one', () => {
  const storage = memoryStorage()
  const s = sampleStore()
  let first
  for (let i = 0; i < Snap.KEPT_LIMIT; i += 1) {
    const made = Snap.createSnapshot(s, `p${i}`, 'protected', storage, i).snapshot
    first ??= made
  }
  assert.equal(Snap.createSnapshot(s, 'more', 'protected', storage, 50).error, 'limit')
  assert.equal(Snap.createSnapshot(s, 'more', 'manual', storage, 50).error, 'limit')
  for (let i = 0; i < 12; i += 1) assert.equal(Snap.createSnapshot(s, `저장 ${i}`, 'rolling', storage, 100 + i).error, null)
  assert.equal(Snap.loadSnapshots(storage).length, Snap.KEPT_LIMIT + Snap.ROLLING_LIMIT)
  Snap.deleteSnapshot(first.id, storage)
  assert.equal(Snap.createSnapshot(s, 'more', 'protected', storage, 200).error, null)
  assert.equal(Snap.loadSnapshots(storage).filter((x) => x.kind === 'rolling').length, Snap.ROLLING_LIMIT)
})

test('save points: an older list with more rolling points than slots shrinks on the next save', () => {
  const old = Array.from({ length: 20 }, (_, i) => ({ id: `r${i}`, name: `저장 ${i}`, createdAt: i, auto: true, nodes: [], edges: [], nextNode: 1, nextEdge: 1 }))
  const storage = memoryStorage({ [Snap.SNAPSHOTS_KEY]: JSON.stringify(old) })
  const { list } = Snap.createSnapshot(sampleStore(), '저장 새로', 'rolling', storage, 100)
  assert.equal(list.length, Snap.ROLLING_LIMIT)
  assert.ok(list.some((x) => x.name === '저장 19'))
  assert.ok(!list.some((x) => x.name === '저장 10'))
})

test('save points: naming a rolling point when the kept slots are full keeps it rolling', () => {
  const storage = memoryStorage()
  const s = sampleStore()
  for (let i = 0; i < Snap.KEPT_LIMIT; i += 1) Snap.createSnapshot(s, `p${i}`, 'manual', storage, i)
  const made = Snap.createSnapshot(s, '저장 1', 'rolling', storage, 50).snapshot
  const after = Snap.renameSnapshot(made.id, '이름', storage).find((x) => x.id === made.id)
  assert.deepEqual([after.name, after.kind], ['이름', 'rolling'])
})

/** A storage with a length, so the budget check can see how much is used. */
function countingStorage() {
  const data = new Map()
  return {
    data,
    get length() {
      return data.size
    },
    key: (i) => [...data.keys()][i],
    getItem: (k) => data.get(k) ?? null,
    setItem: (k, v) => data.set(k, v),
  }
}

test('save points: all slots full of large data stay inside the budget by giving up rolling points', () => {
  const storage = countingStorage()
  // Big enough that 30 of them do not fit: each is a tenth of the budget.
  const memo = 'x'.repeat(Math.floor(Snap.STORAGE_REFUSE_CHARS / 10))
  const s = Store.normalizeStoreV3({ nodes: [node('n1', { memo })], edges: [], nextNode: 2, nextEdge: 1, updatedAt: 1 }, 1)
  for (let i = 0; i < 5; i += 1) assert.equal(Snap.createSnapshot(s, `p${i}`, 'protected', storage, i).error, null)
  for (let i = 0; i < 20; i += 1) assert.equal(Snap.createSnapshot(s, `저장 ${i}`, 'rolling', storage, 100 + i).error, null)
  assert.ok(Snap.storageUsage(storage) < Snap.STORAGE_REFUSE_CHARS)
  let list = Snap.loadSnapshots(storage)
  assert.equal(list.filter((x) => x.kind !== 'rolling').length, 5)
  assert.ok(list.some((x) => x.name === '저장 19'))
  // Kept ones take the space from rolling ones, and once there is nothing left to give up it says so.
  let refused = null
  for (let i = 5; i < 20 && !refused; i += 1) refused = Snap.createSnapshot(s, `p${i}`, 'protected', storage, 200 + i).error
  assert.equal(refused, 'storage')
  list = Snap.loadSnapshots(storage)
  assert.equal(list.filter((x) => x.kind === 'rolling').length, 0)
  assert.ok(list.filter((x) => x.kind !== 'rolling').length >= 5)
  assert.ok(Snap.storageUsage(storage) < Snap.STORAGE_REFUSE_CHARS)
})

test('save points: entries from step 3 and 4 keep working and are classified', () => {
  const old = (id, name, auto) => ({ id, name, createdAt: 1, auto, nodes: [node('n1')], edges: [], nextNode: 2, nextEdge: 1 })
  const storage = memoryStorage({
    [Snap.SNAPSHOTS_KEY]: JSON.stringify([old('a', '예시 넣기 직전', true), old('b', 'v2 변환 직전', true), old('c', '저장 14:30', true), old('d', '직접', false)]),
  })
  const list = Snap.loadSnapshots(storage)
  assert.deepEqual(list.map((s) => s.kind), ['protected', 'protected', 'rolling', 'manual'])
  assert.ok(list.every((s) => !('auto' in s)))
  // The sample data point can be brought back.
  const restored = Snap.storeFromSnapshot(list[0], 50)
  assert.deepEqual(restored.nodes.map((n) => n.id), ['n1'])
  assert.equal(restored.nextNode, 2)
})

test('save points: naming keeps the data, a named rolling point stops rolling, an empty name does nothing', () => {
  const storage = memoryStorage()
  const s = sampleStore()
  const made = Snap.createSnapshot(s, '저장 09:00', 'rolling', storage, 1).snapshot
  const protectedOne = Snap.createSnapshot(s, 'v2 변환 직전', 'protected', storage, 2).snapshot
  assert.equal(Snap.renameSnapshot(made.id, '   ', storage)[0].name, '저장 09:00')
  const list = Snap.renameSnapshot(made.id, ' K동 끝 ', storage)
  assert.equal(list[0].name, 'K동 끝')
  assert.equal(list[0].kind, 'manual')
  assert.deepEqual(list[0].nodes, s.nodes)
  assert.equal(Snap.renameSnapshot(protectedOne.id, '변환 전', storage)[1].kind, 'protected')
})

test('save points: dropping rolling points counts as freeing space', () => {
  const storage = countingStorage()
  const data = storage.data
  const s = sampleStore()
  const roll = Snap.createSnapshot(s, '저장 1', 'rolling', storage, 1).snapshot
  const keep = Snap.createSnapshot(s, 'v2 변환 직전', 'protected', storage, 2).snapshot
  // Just below the budget: there is no room for one more on top, but enough once the rolling one is gone.
  const size = JSON.stringify(roll).length
  data.set('other', 'x'.repeat(Snap.STORAGE_REFUSE_CHARS - Snap.storageUsage(storage) - Math.floor(size / 2)))
  const result = Snap.createSnapshot(s, '새 저장 지점', 'manual', storage, 3)
  assert.equal(result.error, null)
  assert.deepEqual(result.list.map((x) => x.id), [keep.id, result.snapshot.id])
})

test('save points: a save point downloads as a file that loads back, with its own time', () => {
  const s = sampleStore()
  const { snapshot } = Snap.createSnapshot(s, 'x', 'manual', memoryStorage(), 1234)
  const text = X.serializeBackup(Snap.storeFromSnapshot(snapshot), snapshot.createdAt)
  assert.equal(JSON.parse(text).exportedAt, 1234)
  assert.deepEqual(X.parseBackupText(text).nodes, s.nodes)
  assert.match(X.snapshotFileName(1234), /^path-survey-v3-snapshot-\d{8}-\d{4}\.json$/)
})

// Backup content and round trips

test('backup file: format, version, saved time, every point and edge, no graph', () => {
  const s = sampleStore()
  const file = JSON.parse(X.serializeBackup(s, 777))
  assert.deepEqual(Object.keys(file).sort(), ['edges', 'exportedAt', 'format', 'nodes', 'version'])
  assert.equal(file.format, 'hongikon.pathSurvey')
  assert.equal(file.version, 3)
  assert.equal(file.exportedAt, 777)
  assert.equal(file.nodes.length, 3)
  assert.equal(file.edges.length, 2)
  assert.deepEqual(file.nodes, s.nodes)
  assert.deepEqual(file.edges, s.edges)
  assert.match(X.backupFileName(new Date(2026, 10, 6, 9, 5)), /^path-survey-v3-backup-20261106-0905\.json$/)
})

test('backup round trip: the text copied out loads back as the same data, with every optional field', () => {
  const s = sampleStore()
  const back = X.parseBackupText(X.serializeBackup(s, 777), 888)
  assert.deepEqual(back.nodes, s.nodes)
  assert.deepEqual(back.edges, s.edges)
  assert.equal(X.storeFingerprint(back), X.storeFingerprint(s))
  assert.equal(back.nextNode, s.nextNode)
  assert.equal(back.nextEdge, s.nextEdge)
  // A second trip changes nothing.
  assert.equal(X.serializeBackup(back, 1), X.serializeBackup(X.parseBackupText(X.serializeBackup(back, 1)), 1))
})

test('backup round trip: floors stay stored as numbers, new points do not reuse ids', () => {
  const back = X.parseBackupText(X.serializeBackup(sampleStore(), 1))
  assert.deepEqual(back.nodes[2].levels.map((l) => l.floor), [-1, 0, 1.5, 2])
  assert.equal(Store.addNode(back, 1, 1).id, 'n4')
})

test('backup round trip: a store with errors can still be saved and loaded', () => {
  const s = Store.normalizeStoreV3({ nodes: [indoor('n1', [])], edges: [edge('e1', 'n1', 'n9')], nextNode: 2, nextEdge: 2, updatedAt: 1 }, 1)
  assert.ok(checkGraph(s.nodes, s.edges).errors.length > 0)
  assert.deepEqual(X.parseBackupText(X.serializeBackup(s, 1)).edges, s.edges)
})

const v2File = process.env.PATH_SURVEY_V2_FILE
const mapFile = process.env.PATH_SURVEY_MAP_DATA
test('backup round trip on the real data', { skip: !v2File || !mapFile }, () => {
  const real = JSON.parse(readFileSync(mapFile, 'utf8'))
  const realIndex = B.buildBuildingIndex(real.buildings ?? real)
  const { store } = C.convertV2(C.parseV2Text(readFileSync(v2File, 'utf8')).modules, realIndex)
  const text = X.serializeBackup(store, 1)
  const file = JSON.parse(text)
  assert.equal(file.nodes.length, 328)
  assert.equal(file.edges.length, 315)
  const back = X.parseBackupText(text)
  assert.deepEqual(back.nodes, store.nodes)
  assert.deepEqual(back.edges, store.edges)
  assert.equal(X.storeFingerprint(back), X.storeFingerprint(store))
  const record = X.makeBackupRecord(store, 'file')
  assert.ok(JSON.stringify(record).length < text.length / 2, 'the backup record is much smaller than a copy')
})

// Backup status

test('backup status: counts added, removed and changed, and undo back counts as zero', () => {
  const s = sampleStore()
  const record = X.makeBackupRecord(s, 'file', 100)
  assert.deepEqual(X.changesSinceBackup(s, record), { nodes: 0, edges: 0 })

  const moved = Store.moveNode(s, 'n1', 37.7, 127)
  assert.deepEqual(X.changesSinceBackup(moved, record), { nodes: 1, edges: 0 })
  const added = Store.addNode(moved, 1, 1, Store.OUTDOOR_CONTEXT, 'n1').store
  assert.deepEqual(X.changesSinceBackup(added, record), { nodes: 2, edges: 1 })
  const removed = Store.removeNode(s, 'n2')
  assert.deepEqual(X.changesSinceBackup(removed, record), { nodes: 1, edges: 2 })
  assert.deepEqual(X.changesSinceBackup(s, record), { nodes: 0, edges: 0 })
})

test('backup status: the order of keys and an empty field are not changes', () => {
  const s = sampleStore()
  const record = X.makeBackupRecord(s, 'copy')
  const shuffled = { ...s, nodes: s.nodes.map((n) => Object.fromEntries(Object.entries(n).reverse())) }
  assert.deepEqual(X.changesSinceBackup(shuffled, record).nodes, 0)
  const withEmpty = { ...s, nodes: s.nodes.map((n) => ({ ...n, unused: undefined })) }
  assert.deepEqual(X.changesSinceBackup(withEmpty, record).nodes, 0)
})

test('fingerprint: the same content in another key order is the same, other content is not', () => {
  const s = sampleStore()
  const reversed = (value) => (Array.isArray(value) ? value.map(reversed) : value && typeof value === 'object' ? Object.fromEntries(Object.entries(value).reverse().map(([k, v]) => [k, reversed(v)])) : value)
  assert.equal(X.storeFingerprint({ nodes: reversed(s.nodes), edges: reversed(s.edges) }), X.storeFingerprint(s))
  assert.notEqual(X.storeFingerprint(Store.moveNode(s, 'n1', 1, 1)), X.storeFingerprint(s))
  const noMemo = { ...s, edges: s.edges.map((e) => ({ ...e, memo: undefined })) }
  assert.notEqual(X.storeFingerprint(noMemo), X.storeFingerprint(s))
})

test('backup status: stored under its own v3 key, a damaged value reads as never', () => {
  const storage = memoryStorage()
  const record = X.makeBackupRecord(sampleStore(), 'gist', 5)
  X.saveBackupRecord(record, storage)
  assert.deepEqual(X.loadBackupRecord(storage), record)
  assert.deepEqual(storage.writes, ['hongikon.pathSurvey.v3.backup'])
  assert.equal(X.loadBackupRecord(memoryStorage()), null)
  assert.equal(X.loadBackupRecord(memoryStorage({ [X.BACKUP_KEY]: '{bad' })), null)
  assert.equal(X.loadBackupRecord(memoryStorage({ [X.BACKUP_KEY]: '{"at":"x"}' })), null)
})

// Gist

const TOKEN = 'secret-token-value'

/** A small stand in for the GitHub API. It keeps one gist in memory and records the calls. */
function fakeGitHub({ files = {}, status = 200 } = {}) {
  const calls = []
  const state = { id: 'abc', files: { ...files } }
  const impl = async (url, init = {}) => {
    calls.push({ url, ...init })
    if (status !== 200) return { ok: false, status }
    if (init.method === 'PATCH' || init.method === 'POST') {
      const body = JSON.parse(init.body)
      for (const [name, file] of Object.entries(body.files)) state.files[name] = { content: file.content }
    }
    return { ok: true, status: 200, json: async () => ({ id: state.id, files: state.files }) }
  }
  return { impl, calls, state }
}

test('gist: settings live under the v3 key only and never touch v1 or v2 keys', () => {
  const storage = memoryStorage({ 'hongikon.pathSurvey.gist': '{"token":"v2-token","gistId":"v2-id"}' })
  assert.equal(G.GIST_KEY_V3, 'hongikon.pathSurvey.v3.gist')
  assert.deepEqual(G.loadGistState(storage), G.EMPTY_GIST_STATE)
  G.saveGistState({ ...G.EMPTY_GIST_STATE, token: ` ${TOKEN} `, gistId: ' abc ' }, storage)
  assert.deepEqual(storage.writes, ['hongikon.pathSurvey.v3.gist'])
  assert.equal(G.loadGistState(storage).token, TOKEN)
  assert.equal(G.loadGistState(storage).gistId, 'abc')
  assert.equal(storage.data.get('hongikon.pathSurvey.gist'), '{"token":"v2-token","gistId":"v2-id"}')
  assert.deepEqual(G.loadGistState(memoryStorage({ [G.GIST_KEY_V3]: '{bad' })), G.EMPTY_GIST_STATE)
})

test('gist: a push sends the whole survey as one v3 file, the token only in the header', async () => {
  const hub = fakeGitHub()
  const s = sampleStore()
  assert.equal(await G.pushGistSurvey({ token: TOKEN, gistId: 'abc' }, s, hub.impl, 9), 'abc')
  const call = hub.calls[0]
  assert.equal(call.method, 'PATCH')
  assert.match(call.url, /\/gists\/abc$/)
  assert.equal(call.headers.Authorization, `Bearer ${TOKEN}`)
  assert.ok(!call.body.includes(TOKEN))
  assert.deepEqual(Object.keys(JSON.parse(call.body).files), [G.GIST_FILE_V3])
  assert.notEqual(G.GIST_FILE_V3, 'hongikon-path-survey.json')
})

test('gist: without an id it makes a new secret gist, without a token it does not try', async () => {
  const hub = fakeGitHub()
  assert.equal(await G.pushGistSurvey({ token: TOKEN, gistId: '' }, sampleStore(), hub.impl), 'abc')
  assert.equal(hub.calls[0].method, 'POST')
  assert.equal(JSON.parse(hub.calls[0].body).public, false)
  const none = fakeGitHub()
  await assert.rejects(G.pushGistSurvey({ token: '', gistId: 'abc' }, sampleStore(), none.impl), G.GistErrorV3)
  assert.equal(none.calls.length, 0)
})

test('gist: push then fetch gives back the same data, and the v2 file in the gist is left alone', async () => {
  const hub = fakeGitHub({ files: { 'hongikon-path-survey.json': { content: 'v2 data' } } })
  const s = sampleStore()
  await G.pushGistSurvey({ token: TOKEN, gistId: 'abc' }, s, hub.impl, 42)
  assert.equal(hub.state.files['hongikon-path-survey.json'].content, 'v2 data')
  const remote = await G.fetchGistSurvey({ token: TOKEN, gistId: 'abc' }, hub.impl)
  assert.deepEqual(remote.store.nodes, s.nodes)
  assert.deepEqual(remote.store.edges, s.edges)
  assert.equal(remote.exportedAt, 42)
  assert.equal(remote.fingerprint, X.storeFingerprint(s))
})

test('gist: a gist without the v3 file, a long file and a damaged file', async () => {
  const empty = fakeGitHub({ files: { 'hongikon-path-survey.json': { content: 'v2 data' } } })
  assert.equal(await G.fetchGistSurvey({ token: '', gistId: 'abc' }, empty.impl), null)

  const text = X.serializeBackup(sampleStore(), 3)
  const long = async (url) => (url === 'raw' ? { ok: true, text: async () => text } : { ok: true, status: 200, json: async () => ({ files: { [G.GIST_FILE_V3]: { truncated: true, raw_url: 'raw', content: '' } } }) })
  assert.equal((await G.fetchGistSurvey({ token: '', gistId: 'abc' }, long)).store.nodes.length, 3)

  const bad = fakeGitHub({ files: { [G.GIST_FILE_V3]: { content: 'not json' } } })
  await assert.rejects(G.fetchGistSurvey({ token: '', gistId: 'abc' }, bad.impl), G.GistErrorV3)
  await assert.rejects(G.fetchGistSurvey({ token: '', gistId: '' }, bad.impl), G.GistErrorV3)
})

test('gist: failures have screen text and never contain the token', async () => {
  const s = sampleStore()
  for (const status of [401, 403, 404, 422, 500]) {
    const hub = fakeGitHub({ status })
    const error = await G.pushGistSurvey({ token: TOKEN, gistId: 'abc' }, s, hub.impl).catch((e) => e)
    assert.ok(error instanceof G.GistErrorV3, String(status))
    assert.ok(error.message.includes(String(status)))
    assert.ok(!error.message.includes(TOKEN))
  }
  const leaking = async () => {
    throw new Error(`failed with Bearer ${TOKEN}`)
  }
  const error = await G.pushGistSurvey({ token: TOKEN, gistId: 'abc' }, s, leaking).catch((e) => e)
  assert.ok(error instanceof G.GistErrorV3)
  assert.ok(!error.message.includes(TOKEN))
})

test('gist: the token does not end up in backup files or save points', () => {
  const storage = memoryStorage()
  G.saveGistState({ ...G.EMPTY_GIST_STATE, token: TOKEN }, storage)
  const s = sampleStore()
  Snap.createSnapshot(s, 'x', 'manual', storage)
  assert.ok(!X.serializeBackup(s).includes(TOKEN))
  assert.ok(!storage.data.get(Snap.SNAPSHOTS_KEY).includes(TOKEN))
})

test('gist: overwriting asks only when the gist has something this browser has not seen', () => {
  const local = 'local-print'
  const remote = (exportedAt, fingerprint = 'remote-print') => ({ store: null, exportedAt, fingerprint })
  assert.equal(G.remoteHasOtherChanges({ lastRemoteAt: null }, null, local), false)
  assert.equal(G.remoteHasOtherChanges({ lastRemoteAt: null }, remote(5), local), true)
  assert.equal(G.remoteHasOtherChanges({ lastRemoteAt: 5 }, remote(5), local), false)
  assert.equal(G.remoteHasOtherChanges({ lastRemoteAt: 5 }, remote(6), local), true)
  assert.equal(G.remoteHasOtherChanges({ lastRemoteAt: 5 }, remote(6, local), local), false)
  const synced = G.afterSync({ ...G.EMPTY_GIST_STATE, token: TOKEN }, 'abc', 'print', 6, 7)
  assert.deepEqual(synced, { token: TOKEN, gistId: 'abc', lastSyncAt: 7, lastSyncFingerprint: 'print', lastRemoteAt: 6 })
})

// Typed floors

const floors = (text, options) => L.parseFloorInput(text, options).floors

test('floor input: ranges, including below ground and mixed lists', () => {
  assert.deepEqual(floors('1-15'), [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15])
  assert.deepEqual(floors('B3-5'), [-3, -2, -1, 1, 2, 3, 4, 5])
  assert.deepEqual(floors('B3-B1'), [-3, -2, -1])
  assert.deepEqual(floors('B2-3, 5, 8-10'), [-2, -1, 1, 2, 3, 5, 8, 9, 10])
  assert.deepEqual(floors('b2 - 1'), [-2, -1, 1])
  assert.deepEqual(floors('5-1'), [1, 2, 3, 4, 5])
  assert.deepEqual(floors('2 3'), [2, 3])
  assert.equal(L.parseFloorInput('1-3').isList, true)
  assert.equal(L.parseFloorInput('1,3').isList, true)
  assert.equal(L.parseFloorInput('3').isList, false)
  assert.equal(L.parseFloorInput('-1').isList, false)
})

test('floor input: a range fills whole floors, the typed ends stay', () => {
  assert.deepEqual(floors('1.5-3'), [1.5, 2, 3])
  assert.deepEqual(floors('B1.5-2'), [-1.5, -1, 1, 2])
  assert.deepEqual(floors('1.5-2.5'), [1.5, 2, 2.5])
  assert.deepEqual(floors('1.5'), [1.5])
  assert.deepEqual(floors('B1.5'), [-1.5])
  assert.deepEqual(floors('L'), [0])
})

test('floor input: the L floor is only filled when the building has one or it was typed', () => {
  assert.deepEqual(floors('B1-1'), [-1, 1])
  assert.deepEqual(floors('B1-1', { includeL: true }), [-1, 0, 1])
  assert.deepEqual(floors('L-2'), [0, 1, 2])
  assert.deepEqual(floors('B2-L'), [-2, -1, 0])
  assert.ok(floors('L, 1').every((f) => !Object.is(f, -0)))
})

test('floor input: a minus sign is refused and reported, other bad parts too', () => {
  assert.deepEqual(L.parseFloorInput('-1'), { floors: [], bad: [], negative: ['-1'], isList: false })
  assert.deepEqual(L.parseFloorInput('2, -1').negative, ['-1'])
  assert.deepEqual(floors('2, -1'), [2])
  assert.equal(L.parseFloorQuery('-1'), null)
  assert.equal(L.parseFloorQuery('B0'), null)
  for (const text of ['1.3', 'x', '2F', '1-', '1-2-3', '1-1.3', 'B', '100', '1-90']) {
    const input = L.parseFloorInput(text)
    assert.deepEqual(input.floors, [], text)
    assert.deepEqual(input.bad.length, 1, text)
  }
  assert.deepEqual(L.parseFloorInput('  '), { floors: [], bad: [], negative: [], isList: false })
})

test('floor input: floors the building does not list are found, whatever the data used', () => {
  const k = index.byCode.get(K)
  const listed = B.floorOptions(k, []).main
  assert.deepEqual(L.floorsOutsideBuilding(k, listed), [])
  assert.deepEqual(L.floorsOutsideBuilding(k, [...listed, 77]), [77])
  const r = index.byCode.get(R)
  assert.ok(B.floorOptions(r, []).main.includes(0))
  assert.deepEqual(L.floorsOutsideBuilding(r, [0]), [])
})

// Bulk confirmation helper and tolerance setting

test('selection buildings: levels first, otherwise the boundary the point stands in', () => {
  const inR = node('n1', { lat: 37.5005, lng: 126.9005 })
  const inB = node('n2', { lat: 37.6005, lng: 127.0005 })
  const onK = indoor('n3', [lvl(K, 1)], { lat: 37.5005, lng: 126.9005 })
  const nowhere = node('n4', { lat: 1, lng: 1 })
  const nodes = [inR, inB, onK, nowhere]
  assert.deepEqual(L.selectionBuildings(nodes, ['n1'], index), [R])
  assert.deepEqual(L.selectionBuildings(nodes, ['n1', 'n2'], index), [R, 'hongik_b'])
  assert.deepEqual(L.selectionBuildings(nodes, ['n3'], index), [K])
  assert.deepEqual(L.selectionBuildings(nodes, ['n4'], index), [])
})

test('tolerance: applies to entrances only, the default stays 15, and it does not change errors', () => {
  const near = { lat: 37.5, lng: 126.8999 }
  const door = indoor('n1', [lvl(R, 1)], { type: 'entrance', entranceLabel: 'HI_R_1F5_ENTER', ...near })
  const plain = indoor('n2', [lvl(R, 1)], near)
  const warned = (nodes, options) => checkGraph(nodes, [], index, options).warnings.filter((w) => w.code === 'indoor_out_of_boundary').map((w) => w.nodeId)
  assert.deepEqual(warned([door, plain]), ['n2'])
  assert.deepEqual(warned([door, plain], { entranceToleranceM: 15 }), ['n2'])
  assert.deepEqual(warned([door, plain], { entranceToleranceM: 5 }), ['n1', 'n2'])
  assert.deepEqual(warned([door, plain], { entranceToleranceM: 200 }), ['n2'])
  assert.deepEqual(checkGraph([door], [], index, { entranceToleranceM: 0 }).errors, [])
})

test('tolerance setting: default, stored value, refused values', () => {
  const storage = memoryStorage()
  assert.equal(X.loadSurveySettings(storage).entranceToleranceM, 15)
  X.saveSurveySettings({ entranceToleranceM: 30 }, storage)
  assert.deepEqual(storage.writes, ['hongikon.pathSurvey.v3.settings'])
  assert.equal(X.loadSurveySettings(storage).entranceToleranceM, 30)
  for (const bad of ['"x"', '-1', '999', 'null']) {
    assert.equal(X.loadSurveySettings(memoryStorage({ [X.SETTINGS_KEY]: `{"entranceToleranceM":${bad}}` })).entranceToleranceM, 15, bad)
  }
  assert.equal(X.isValidTolerance(0), true)
  assert.equal(X.isValidTolerance(201), false)
  assert.equal(X.isValidTolerance(NaN), false)
})

test('check messages show below ground floors as B', () => {
  const nodes = [indoor('n1', [lvl(R, -1), lvl(K, 1)], { type: 'elevator', ties: [[lvl(R, -2), lvl(K, 1)]] })]
  const message = checkGraph(nodes, []).errors.find((e) => e.code === 'tie_bad_level').message
  assert.ok(message.includes('B2'))
  assert.ok(!message.includes('-2'))
})
