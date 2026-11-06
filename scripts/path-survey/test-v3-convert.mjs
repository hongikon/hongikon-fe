// Path survey v3: v2 conversion and snapshots.
// Optional regression on real data, which is never committed:
//   PATH_SURVEY_V2_FILE=<export.json> PATH_SURVEY_MAP_DATA=<map-data.json> node --test scripts/path-survey/test-v3-convert.mjs
import { readFileSync } from 'node:fs'
import { register } from 'node:module'
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { FIXTURE_BUILDINGS, hasPath, lvl, memoryStorage } from './v3-helpers.mjs'

register('../ask/ts-hooks.mjs', import.meta.url)
process.removeAllListeners('warning')
const C = await import('../../src/utils/pathSurveyV3/convertV2.ts')
const B = await import('../../src/utils/pathSurveyV3/buildings.ts')
const Snap = await import('../../src/utils/pathSurveyV3/snapshots.ts')
const Store = await import('../../src/utils/pathSurveyV3/store.ts')
const { checkGraph } = await import('../../src/utils/pathSurveyV3/check.ts')
const { expandGraph } = await import('../../src/utils/pathSurveyV3/expand.ts')

const index = B.buildBuildingIndex([
  ...FIXTURE_BUILDINGS,
  { id: 20, code: 'hongik_p', name: 'P\uB3D9', lat: 1, lng: 1, entrances: [{ label: 'HI_P_7F_ENTER', minFloor: 7, maxFloor: 7 }] },
  { id: 21, code: 'hongik_i', name: 'I\uB3D9', lat: 1, lng: 1, entrances: [{ label: 'HI_I_6F_ENTER', minFloor: 6, maxFloor: 6 }] },
  { id: 22, code: 'hongik_a', name: 'A\uB3D9', lat: 1, lng: 1, entrances: [] },
])

const module = (id, nodes, edges = []) => ({ id, name: id, status: 'draft', color: '#2563EB', nodes, edges, places: [], memo: '', createdAt: 1, updatedAt: 1 })

const SAMPLE = () => [
  module('m1', [
    { id: 'a', lat: 37.1, lng: 126.1, kind: 'entrance', sharedId: 'a', sharedUpdatedAt: 5, memo: 'HI_K_1F_1_ENTER\nside door' },
    { id: 'b', lat: 37.2, lng: 126.2, memo: 'old memo' },
    { id: 'c', lat: 37.3, lng: 126.3, kind: 'intersection' },
    { id: 'd', lat: 37.4, lng: 126.4, kind: 'stairs', sharedId: 'd', sharedUpdatedAt: 1 },
  ], [
    { id: 'e1', a: 'a', b: 'b' },
    { id: 'e2', a: 'b', b: 'c', memo: 'edge memo' },
    { id: 'e3', a: 'c', b: 'd', kind: 'stairs' },
  ]),
  module('m2', [
    { id: 'a2', lat: 37.9, lng: 126.9, kind: 'entrance', sharedId: 'a', sharedUpdatedAt: 9, memo: 'HI_K_1F_1_ENTER\nside door' },
    { id: 'd2', lat: 37.8, lng: 126.8, kind: 'stairs', sharedId: 'd', sharedUpdatedAt: 7 },
    { id: 'x', lat: 37.5, lng: 126.5 },
    { id: 'p', lat: 37.6, lng: 126.6, kind: 'entrance', memo: 'HI_P_7F_ENTER = HI_I_6F_ENTER\nbridge' },
    { id: 'i', lat: 37.61, lng: 126.61, kind: 'entrance', memo: 'HI_I_6F_ENTER = HI_P_7F_ENTER' },
    { id: 'el', lat: 37.7, lng: 126.7, kind: 'elevator', memo: 'HI_T_ELEVATOR\nB2F~3F\n2 cars' },
    { id: 'el2', lat: 37.71, lng: 126.71, kind: 'elevator', memo: 'HI_MH_ELEVATOR\n1F~16F\n\uD640\uC218\uCE35' },
    { id: 'el3', lat: 37.72, lng: 126.72, kind: 'elevator', memo: 'HI_A_ELEVATOR = HI_K_ELEVATOR\n1F~6F' },
    { id: 'el4', lat: 37.73, lng: 126.73, kind: 'elevator', memo: 'HI_T_ELEVATOR\n1F, 11F~24F' },
    { id: 'z', lat: 37.74, lng: 126.74, kind: 'entrance', memo: 'free text door' },
    { id: 'lf', lat: 37.75, lng: 126.75, kind: 'entrance', memo: 'HI_R_LF_1_ENTER' },
    { id: 'b2', lat: 37.76, lng: 126.76, kind: 'entrance', memo: 'HI_R_B2F_ENTER' },
    { id: 'inR', lat: 37.5005, lng: 126.9005 },
  ], [
    { id: 'e9', a: 'b', b: 'a2' },
    { id: 'e4', a: 'a2', b: 'x' },
    { id: 'e5', a: 'd2', b: 'x', kind: 'stairs' },
    { id: 'e6', a: 'p', b: 'i' },
    { id: 'e7', a: 'a2', b: 'a2' },
  ]),
]

const byLegacy = (store, id) => store.nodes.find((n) => n.legacyId === id)

test('merge: shared nodes become one at the newest position, ids are new, old id is kept', () => {
  const { store, report } = C.convertV2(SAMPLE(), index, 100)
  assert.equal(report.rawNodes, 17)
  assert.equal(report.mergedNodes, 15)
  const a = byLegacy(store, 'a')
  assert.deepEqual([a.lat, a.lng], [37.9, 126.9])
  assert.deepEqual([byLegacy(store, 'd').lat], [37.8])
  assert.ok(store.nodes.every((n, i) => n.id === `n${i + 1}`))
  assert.equal(store.nextNode, 16)
})

test('edges: undirected merge, stairs wins, memo kept, self links dropped', () => {
  const { store, report } = C.convertV2(SAMPLE(), index)
  assert.equal(report.rawEdges, 8)
  assert.equal(report.mergedEdges, 6)
  assert.equal(report.stairsEdges, 2)
  assert.ok(store.edges.every((e, i) => e.id === `e${i + 1}`))
  const a = byLegacy(store, 'a').id
  const b = byLegacy(store, 'b').id
  assert.equal(store.edges.filter((e) => [e.a, e.b].sort().join() === [a, b].sort().join()).length, 1)
  assert.equal(store.edges.find((e) => e.memo).memo, 'edge memo')
})

test('kinds: intersection and old stairs end become basic outdoor, memo stays', () => {
  const { store, report } = C.convertV2(SAMPLE(), index)
  for (const id of ['c', 'd', 'x']) {
    const n = byLegacy(store, id)
    assert.deepEqual([n.scope, n.type, n.levels], ['outdoor', 'basic', undefined])
  }
  assert.equal(byLegacy(store, 'b').memo, 'old memo')
  assert.deepEqual(report.oldKinds, { basic: 3, intersection: 1, entrance: 6, elevator: 4, stairs: 1 })
  assert.ok(!store.nodes.some((n) => n.type === 'stairs'))
})

test('entrance: label, floor, building read from the first line, rest becomes memo', () => {
  const { store, report } = C.convertV2(SAMPLE(), index)
  const a = byLegacy(store, 'a')
  assert.equal(a.scope, 'indoor')
  assert.deepEqual(a.levels, [lvl('hongik_k', 1)])
  assert.equal(a.entranceLabel, 'HI_K_1F_1_ENTER')
  assert.equal(a.memo, 'side door')
  const lf = byLegacy(store, 'lf')
  assert.deepEqual(lf.levels, [lvl('hongik_r', 0)])
  assert.equal(lf.memo, undefined)
  // B2F in the memo is spelled B2 on the server.
  assert.equal(byLegacy(store, 'b2').entranceLabel, 'HI_R_B2_ENTER')
  assert.deepEqual(report.labelsNotOnServer, ['HI_R_LF_1_ENTER'])
})

test('entrance: two buildings or other formats go to the manual list with hints', () => {
  const { store, report } = C.convertV2(SAMPLE(), index)
  assert.equal(report.autoEntrances, 3)
  assert.equal(report.manualEntrances, 3)
  const p = byLegacy(store, 'p')
  assert.deepEqual([p.scope, p.type, p.levels, p.entranceLabel], ['indoor', 'entrance', undefined, undefined])
  assert.ok(p.memo.includes('bridge'))
  const item = report.manual.find((m) => m.nodeId === p.id)
  assert.deepEqual(item.candidates, [
    { building: 'hongik_p', floors: [7], label: 'HI_P_7F_ENTER' },
    { building: 'hongik_i', floors: [6], label: 'HI_I_6F_ENTER' },
  ])
  assert.equal(report.manual.find((m) => m.nodeId === byLegacy(store, 'z').id).candidates.length, 0)
  assert.equal(report.bridgePairs, 1)
  assert.equal(report.crossBuildingPairs, 1)
})

test('elevator: plain range is automatic, complex memos go to the manual list', () => {
  const { store, report } = C.convertV2(SAMPLE(), index)
  assert.equal(report.autoElevators, 1)
  assert.equal(report.manualElevators, 3)
  const el = byLegacy(store, 'el')
  assert.deepEqual(el.levels.map((l) => l.floor), [-2, -1, 1, 2, 3])
  assert.ok(el.levels.every((l) => l.building === 'hongik_t'))
  assert.ok(el.memo.startsWith('HI_T_ELEVATOR'))
  assert.equal(byLegacy(store, 'el2').levels, undefined)
  const two = report.manual.find((m) => m.nodeId === byLegacy(store, 'el3').id)
  assert.deepEqual(two.candidates.map((c) => c.building), ['hongik_a', 'hongik_k'])
  assert.equal(two.candidates[0].floors.length, 6)
  // A floor list that is not a plain range is not guessed.
  assert.equal(byLegacy(store, 'el4').levels, undefined)
})

test('boundary: an outdoor point inside a building gets a hint and no other change', () => {
  const { store, report } = C.convertV2(SAMPLE(), index)
  const n = byLegacy(store, 'inR')
  assert.equal(n.scope, 'outdoor')
  assert.equal(report.boundaryCandidates, 1)
  assert.deepEqual(report.manual.find((m) => m.nodeId === n.id).candidates, [{ building: 'hongik_r' }])
})

test('manual items close when the node has been filled in', () => {
  const entrance = { kind: 'entrance' }
  assert.equal(C.isManualItemOpen(entrance, { type: 'entrance' }), true)
  assert.equal(C.isManualItemOpen(entrance, { type: 'entrance', levels: [lvl('A', 1)], entranceLabel: 'L' }), false)
  assert.equal(C.isManualItemOpen(entrance, undefined), false)
  assert.equal(C.isManualItemOpen({ kind: 'elevator' }, { type: 'elevator', levels: [lvl('A', 1)] }), true)
  assert.equal(C.isManualItemOpen({ kind: 'boundary', nodeId: 'n1' }, { scope: 'indoor' }), true)
  assert.equal(C.isManualItemOpen({ kind: 'boundary', nodeId: 'n1' }, { scope: 'indoor', levels: [lvl('A', 1)] }), false)
  assert.equal(C.isManualItemOpen({ kind: 'boundary', nodeId: 'n1' }, { scope: 'outdoor' }), true)
  assert.equal(C.isManualItemOpen({ kind: 'boundary', nodeId: 'n1' }, { scope: 'outdoor' }, ['n1']), false)
})

test('source stays untouched and the same input gives the same result', () => {
  const input = SAMPLE()
  const before = JSON.stringify(input)
  const first = C.convertV2(input, index, 1)
  assert.equal(JSON.stringify(input), before)
  assert.deepEqual(C.convertV2(input, index, 1), first)
})

test('v2 storage is read only, and v2 and v1 keys are never written', () => {
  const v2 = JSON.stringify({ version: 2, modules: SAMPLE(), activeModuleId: null, customColors: [], updatedAt: 1 })
  const storage = memoryStorage({ 'hongikon.pathSurvey.v2': v2, 'hongikon.pathSurvey.v1': '{"nodes":[]}' })
  const source = C.readV2FromStorage(storage)
  assert.equal(source.modules.length, 2)
  assert.deepEqual(storage.writes, [])
  assert.equal(storage.getItem('hongikon.pathSurvey.v2'), v2)

  const empty = memoryStorage({ 'hongikon.pathSurvey.v1': '{"nodes":[{"id":"n1","lat":1,"lng":1}]}' })
  assert.equal(C.readV2FromStorage(empty), null)
  assert.deepEqual(empty.writes, [])
  assert.equal(C.readV2FromStorage(memoryStorage({ 'hongikon.pathSurvey.v2': '{bad' })), null)

  const out = memoryStorage()
  C.saveConvertReport(C.convertV2(SAMPLE(), index).report, out)
  Store.saveStoreV3(C.convertV2(SAMPLE(), index).store, out)
  Snap.createSnapshot(Store.emptyStoreV3(1), 'x', 'protected', out)
  assert.ok(out.writes.every((k) => k.startsWith('hongikon.pathSurvey.v3')))
  assert.equal(C.loadConvertReport(out).mergedNodes, 15)
})

test('v2 text: accepts an export, refuses anything else', () => {
  const file = JSON.stringify({ format: 'hongikon.pathSurvey', version: 2, exportedAt: 1, modules: SAMPLE(), customColors: [] })
  assert.equal(C.parseV2Text(file).modules.length, 2)
  assert.throws(() => C.parseV2Text('{bad'), /JSON/)
  assert.throws(() => C.parseV2Text(JSON.stringify({ format: 'hongikon.pathSurvey', version: 3, nodes: [], edges: [] })), /v2/)
  assert.throws(() => C.parseV2Text('{"modules":[]}'), /v2/)
})

test('floor range parser', () => {
  assert.deepEqual(C.parseFloorRange('B1F~2F'), [-1, 1, 2])
  assert.deepEqual(C.parseFloorRange('3F~5F'), [3, 4, 5])
  assert.equal(C.parseFloorRange('1F, 11F~24F'), null)
  assert.equal(C.parseFloorRange('5F~1F'), null)
  assert.equal(C.parseFloorRange(''), null)
})

test('converted data runs through the check and expansion without throwing', () => {
  const { store } = C.convertV2(SAMPLE(), index)
  const result = checkGraph(store.nodes, store.edges, index)
  assert.ok(result.errors.some((e) => e.code === 'entrance_levels'))
  assert.ok(result.errors.some((e) => e.code === 'vertical_few_levels'))
  assert.doesNotThrow(() => expandGraph(store.nodes, store.edges))
})

test('snapshots: create, full kept slots refuse, deleting by hand makes room', () => {
  const storage = memoryStorage()
  const s = Store.addNode(Store.emptyStoreV3(1), 1, 1).store
  const first = Snap.createSnapshot(s, 'first', 'manual', storage, 1)
  assert.equal(first.error, null)
  for (let i = 0; i < 19; i += 1) Snap.createSnapshot(s, `m${i}`, 'manual', storage, 10 + i)
  assert.equal(Snap.loadSnapshots(storage).length, 20)
  const full = Snap.createSnapshot(s, 'more', 'manual', storage, 101)
  assert.equal(full.error, 'limit')
  assert.equal(full.snapshot, null)
  assert.equal(Snap.loadSnapshots(storage).length, 20)
  assert.equal(Snap.deleteSnapshot(first.snapshot.id, storage).length, 19)
  assert.equal(Snap.createSnapshot(s, 'more', 'manual', storage, 102).error, null)
})

test('snapshots: restoring gives the same data, ids keep counting', () => {
  const storage = memoryStorage()
  let s = Store.addNode(Store.emptyStoreV3(1), 1, 1).store
  s = Store.addNode(s, 2, 2, Store.OUTDOOR_CONTEXT, 'n1').store
  const { snapshot } = Snap.createSnapshot(s, 'x', 'manual', storage)
  const restored = Snap.storeFromSnapshot(snapshot, 500)
  assert.deepEqual(restored.nodes, s.nodes)
  assert.deepEqual(restored.edges, s.edges)
  assert.equal(restored.nextNode, 3)
})

test('snapshots: a refused write is reported and the main store key is not involved', () => {
  const data = new Map()
  const storage = { getItem: (k) => data.get(k) ?? null, setItem: () => { throw new Error('quota') } }
  const r = Snap.createSnapshot(Store.emptyStoreV3(1), 'x', 'manual', storage)
  assert.equal(r.error, 'storage')
  assert.equal(data.size, 0)
})

test('snapshots: usage over the budget refuses', () => {
  const big = 'x'.repeat(Snap.STORAGE_REFUSE_CHARS)
  const data = new Map([['other', big]])
  const storage = {
    get length() { return data.size },
    key: (i) => [...data.keys()][i],
    getItem: (k) => data.get(k) ?? null,
    setItem: (k, v) => data.set(k, v),
  }
  assert.equal(Snap.storageUsage(storage) > Snap.STORAGE_REFUSE_CHARS, true)
  assert.equal(Snap.createSnapshot(Store.emptyStoreV3(1), 'x', 'manual', storage).error, 'storage')
  assert.equal(Snap.storageUsage(null), null)
})

const filePath = process.env.PATH_SURVEY_V2_FILE
const mapPath = process.env.PATH_SURVEY_MAP_DATA
test('real v2 export matches the agreed numbers', { skip: !filePath || !mapPath }, () => {
  const realIndex = B.buildBuildingIndex(JSON.parse(readFileSync(mapPath, 'utf8')).buildings)
  const source = C.parseV2Text(readFileSync(filePath, 'utf8'))
  const { store, report } = C.convertV2(source.modules, realIndex)
  assert.equal(report.rawNodes, 433)
  assert.equal(report.mergedNodes, 328)
  assert.equal(report.rawEdges, 316)
  assert.equal(report.mergedEdges, 315)
  assert.equal(report.stairsEdges, 45)
  assert.deepEqual(report.oldKinds, { basic: 174, intersection: 24, entrance: 98, elevator: 16, stairs: 16 })
  assert.equal(report.components, 35)
  assert.equal(report.largestComponent, 289)
  assert.equal(report.isolated, 29)
  assert.equal(report.bridgePairs, 5)
  assert.equal(report.crossBuildingPairs, 6)
  assert.equal(report.autoEntrances, 87)
  assert.equal(report.manualEntrances, 11)
  assert.equal(report.autoElevators, 10)
  assert.equal(report.manualElevators, 6)
  const result = checkGraph(store.nodes, store.edges, realIndex)
  console.log('labels not on server:', report.labelsNotOnServer.length, 'boundary candidates:', report.boundaryCandidates)
  const count = (issues) => Object.entries(issues.reduce((m, i) => ({ ...m, [i.code]: (m[i.code] ?? 0) + 1 }), {}))
  console.log('errors', count(result.errors), 'warnings', count(result.warnings), 'infos', count(result.infos))
  const { graph, skipped } = expandGraph(store.nodes, store.edges)
  console.log('vertices', graph.vertices.length, 'edges', graph.edges.length, 'skipped', skipped.length)
  assert.deepEqual(count(result.errors).sort(), [['edge_outdoor_indoor', 7], ['entrance_levels', 11], ['entrance_no_label', 11], ['vertical_few_levels', 6]])
  assert.equal(skipped.length, 12)
  // An automatic elevator keeps working: its floors are connected to each other.
  const elevator = store.nodes.find((n) => n.type === 'elevator' && n.levels?.length >= 2)
  const ends = [elevator.levels[0], elevator.levels.at(-1)].map((l) => `${elevator.id}@${l.building}:${l.floor}`)
  assert.ok(hasPath(graph, ends[0], ends[1]))
})
