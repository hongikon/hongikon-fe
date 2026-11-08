// Path survey v3: logic behind the context bar, pickers, bulk edits, backup and export, labels and the sample.
import { register } from 'node:module'
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { edge, FIXTURE_BUILDINGS, indoor, lvl, memoryStorage, node } from './v3-helpers.mjs'

register('../ask/ts-hooks.mjs', import.meta.url)
process.removeAllListeners('warning')
const L = await import('../../src/utils/pathSurveyV3/levels.ts')
const X = await import('../../src/utils/pathSurveyV3/transfer.ts')
const Store = await import('../../src/utils/pathSurveyV3/store.ts')
const B = await import('../../src/utils/pathSurveyV3/buildings.ts')
const M = await import('../../src/screens/pathSurveyV3/mapState.ts')
const Sample = await import('../../src/screens/pathSurveyV3/devSample.ts')
const { checkGraph } = await import('../../src/utils/pathSurveyV3/check.ts')

const index = B.buildBuildingIndex(FIXTURE_BUILDINGS)
const store = (nodes, edges = []) => ({ version: 3, nodes, edges, nextNode: 99, nextEdge: 99, updatedAt: 1 })
const draw = (s, extra = {}) => M.buildRenderState(s, { index, filter: M.NO_FILTER, mode: 'add', selected: null, pending: null, selectedEdge: null, ...extra })

test('floor search accepts numbers, half, L and B, refuses the rest', () => {
  const cases = { 2: 2, 1.5: 1.5, L: 0, l: 0, B1: -1, b2: -2, 0: 0, 'B1.5': -1.5 }
  for (const [text, floor] of Object.entries(cases)) assert.equal(L.parseFloorQuery(text), floor, text)
  for (const text of ['', ' ', '1.3', 'x', '2F', '--1', '-1', '-0', 'B0']) assert.equal(L.parseFloorQuery(text), null, text)
  assert.ok(Object.is(L.parseFloorQuery('0'), 0))
})

test('floor chips filter by search', () => {
  const floors = [-2, -1, 0, 1, 1.5, 2, 10]
  assert.deepEqual(L.filterFloors(floors, ''), floors)
  assert.deepEqual(L.filterFloors(floors, '1'), [1, 1.5, 10])
  assert.deepEqual(L.filterFloors(floors, '-1'), [])
  assert.deepEqual(L.filterFloors(floors, 'B1'), [-1])
  assert.deepEqual(L.filterFloors(floors, 'b'), [-2, -1])
  assert.deepEqual(L.filterFloors(floors, 'L'), [0])
  assert.deepEqual(L.filterFloors(floors, '1.5'), [1.5])
})

test('floors toggle, an entrance keeps exactly one, buildings can be removed', () => {
  let levels = L.toggleFloor([], 'A', 1)
  levels = L.toggleFloor(levels, 'A', 2)
  levels = L.toggleFloor(levels, 'B', 1)
  assert.equal(levels.length, 3)
  assert.deepEqual(L.groupLevels(levels), [{ building: 'A', floors: [1, 2] }, { building: 'B', floors: [1] }])
  assert.equal(L.toggleFloor(levels, 'A', 1).length, 2)
  assert.deepEqual(L.toggleFloor(levels, 'C', 3, true), [lvl('C', 3)])
  assert.deepEqual(L.removeBuildingLevels(levels, 'A'), [lvl('B', 1)])
})

test('used floors are collected per building', () => {
  const used = L.usedFloorsByBuilding([indoor('n1', [lvl('A', 1), lvl('A', 2)]), indoor('n2', [lvl('A', 1), lvl('B', 7)]), node('n3')])
  assert.deepEqual(used.get('A').sort(), [1, 2])
  assert.deepEqual(used.get('B'), [7])
})

test('ties fill upward from one pair and repeat nothing', () => {
  const levels = [lvl('A', 1), lvl('A', 2), lvl('A', 3), lvl('A', 4), lvl('A', 5), lvl('A', 6), lvl('B', 1), lvl('B', 2), lvl('B', 3), lvl('B', 4)]
  const ties = L.fillTiesUpward(levels, [], [lvl('A', 3), lvl('B', 1)])
  assert.deepEqual(ties.map(([x, y]) => `${x.floor}=${y.floor}`), ['3=1', '4=2', '5=3', '6=4'])
  assert.equal(L.fillTiesUpward(levels, ties, [lvl('A', 3), lvl('B', 1)]).length, 4)
  assert.equal(L.fillTiesUpward(levels, [[lvl('B', 1), lvl('A', 3)]], [lvl('A', 3), lvl('B', 1)]).length, 4)
  assert.deepEqual(L.fillTiesUpward(levels, [], [lvl('A', 9), lvl('B', 1)]), [])
  assert.deepEqual(checkGraph([indoor('n1', levels, { type: 'elevator', ties })], []).errors, [])
})

test('points on the same spot and points inside a boundary', () => {
  const a = node('n1', { lat: 37.5005, lng: 126.9005 })
  const b = indoor('n2', [lvl('hongik_r', 1)], { lat: 37.50051, lng: 126.9005 })
  const far = node('n3', { lat: 37.6, lng: 126.9 })
  assert.deepEqual(L.nodesNear([a, b, far], a).map((n) => n.id), ['n2'])
  assert.deepEqual(L.nodesInBuilding([a, b, far], index, 'hongik_r'), ['n1'])
  assert.deepEqual(L.nodesInBuilding([a, b, far], index, 'hongik_r', false), ['n1', 'n2'])
})

test('context: new points follow it, stays until changed', () => {
  let ctx = X.DEFAULT_CONTEXT
  let s = Store.addNode(Store.emptyStoreV3(1), 1, 1, X.toNodeContext(ctx)).store
  assert.deepEqual([s.nodes[0].scope, s.nodes[0].type, s.nodes[0].levels], ['outdoor', 'basic', undefined])
  ctx = X.updateWorkContext(ctx, { scope: 'indoor', building: 'A', floors: [1, 2] })
  for (let i = 0; i < 2; i += 1) s = Store.addNode(s, 2, 2, X.toNodeContext(ctx)).store
  assert.deepEqual(s.nodes[1].levels, [lvl('A', 1), lvl('A', 2)])
  assert.deepEqual(s.nodes[2].levels, [lvl('A', 1), lvl('A', 2)])
})

test('context: a type implies indoor, outdoor resets the type, an entrance has one floor', () => {
  let ctx = X.updateWorkContext(X.DEFAULT_CONTEXT, { type: 'stairs' })
  assert.equal(ctx.scope, 'indoor')
  ctx = X.updateWorkContext(ctx, { building: 'A', floors: [3, 1] })
  assert.equal(ctx.floors.length, 2)
  ctx = X.updateWorkContext(ctx, { type: 'entrance' })
  assert.deepEqual(ctx.floors, [3])
  const s = Store.addNode(Store.emptyStoreV3(1), 1, 1, X.toNodeContext(ctx)).store
  assert.deepEqual([s.nodes[0].type, s.nodes[0].levels, s.nodes[0].entranceLabel], ['entrance', [lvl('A', 3)], undefined])
  // A blank entrance is allowed and reported by the check.
  assert.deepEqual(checkGraph(s.nodes, []).errors.map((e) => e.code), ['entrance_no_label'])
  ctx = X.updateWorkContext(ctx, { scope: 'outdoor' })
  assert.equal(ctx.type, 'basic')
  assert.deepEqual(X.contextLevels(ctx), [])
  assert.equal(Store.addNode(Store.emptyStoreV3(1), 1, 1, { scope: 'outdoor', type: 'stairs' }).store.nodes[0].type, 'basic')
})

test('context is remembered and bad values fall back', () => {
  const storage = memoryStorage()
  const ctx = X.updateWorkContext(X.DEFAULT_CONTEXT, { scope: 'indoor', building: 'A', floors: [2] })
  X.saveWorkContext(ctx, storage)
  assert.deepEqual(X.loadWorkContext(storage), ctx)
  assert.deepEqual(X.loadWorkContext(memoryStorage({ [X.CONTEXT_KEY]: '{bad' })), X.DEFAULT_CONTEXT)
  assert.deepEqual(X.loadWorkContext(memoryStorage({ [X.CONTEXT_KEY]: '{"scope":"x"}' })), X.DEFAULT_CONTEXT)
  assert.ok(X.CONTEXT_KEY.startsWith('hongikon.pathSurvey.v3'))
})

test('bulk: level, type and outdoor apply to all targets in one edit each', () => {
  let s = Store.emptyStoreV3(1)
  for (let i = 0; i < 3; i += 1) s = Store.addNode(s, i, i).store
  const a = Store.applyBulkToNodes(s, ['n1', 'n3'], { levels: [lvl('A', 1), lvl('A', 2)] })
  assert.deepEqual(a.nodes.map((n) => n.scope), ['indoor', 'outdoor', 'indoor'])
  assert.equal(a.nodes[0].levels.length, 2)
  const b = Store.applyBulkToNodes(a, ['n1', 'n3'], { type: 'stairs' })
  assert.deepEqual(b.nodes.map((n) => n.type), ['stairs', 'basic', 'stairs'])
  assert.equal(b.nodes[0].levels.length, 2)
  // An entrance keeps one floor, and a type on an outdoor point makes it indoor.
  const c = Store.applyBulkToNodes(s, ['n2'], { type: 'entrance', levels: [lvl('A', 1), lvl('A', 2)] })
  assert.deepEqual([c.nodes[1].scope, c.nodes[1].type, c.nodes[1].levels], ['indoor', 'entrance', [lvl('A', 1)]])
  const d = Store.applyBulkToNodes(b, ['n1'], { scope: 'outdoor' })
  assert.deepEqual([d.nodes[0].scope, d.nodes[0].type, d.nodes[0].levels], ['outdoor', 'basic', undefined])
  assert.equal(Store.applyBulkToNodes(s, ['zz'], { scope: 'outdoor' }), s)
})

test('type change to entrance keeps one floor', () => {
  let s = Store.addNode(Store.emptyStoreV3(1), 1, 1, { scope: 'indoor', levels: [lvl('A', 1), lvl('A', 2)] }).store
  s = Store.setNodeType(s, 'n1', 'entrance')
  assert.deepEqual(s.nodes[0].levels, [lvl('A', 1)])
})

test('backup: allowed with errors, has no graph, reads back the same', () => {
  const s = store([indoor('n1', []), node('n2')], [edge('e1', 'n1', 'n2')])
  assert.ok(checkGraph(s.nodes, s.edges).errors.length > 0)
  const text = X.serializeBackup(s, 5)
  const file = JSON.parse(text)
  assert.deepEqual([file.format, file.version, file.exportedAt, file.graph], ['hongikon.pathSurvey', 3, 5, undefined])
  const back = X.parseBackupText(text, 9)
  assert.deepEqual(back.nodes, s.nodes)
  assert.deepEqual(back.edges, s.edges)
  assert.equal(back.nextNode, 3)
})

test('backup: bad files give a screen message, a graph in the file is ignored', () => {
  assert.throws(() => X.parseBackupText('{bad'), /JSON/)
  assert.throws(() => X.parseBackupText('{"format":"other","version":3,"nodes":[],"edges":[]}'), (e) => e.message.includes('경로망'))
  assert.throws(() => X.parseBackupText('{"format":"hongikon.pathSurvey","version":2,"modules":[]}'), /v2/)
  assert.throws(() => X.parseBackupText('{"format":"hongikon.pathSurvey","version":3}'), /v3/)
  const back = X.parseBackupText('{"format":"hongikon.pathSurvey","version":3,"nodes":[],"edges":[],"graph":{"vertices":[1]}}')
  assert.equal(back.graph, undefined)
})

test('file names carry date and time', () => {
  const at = new Date(2026, 10, 6, 9, 5)
  assert.equal(X.backupFileName(at), 'path-survey-v3-backup-20261106-0905.json')
  assert.equal(X.graphFileName(at), 'path-survey-v3-graph-20261106-0905.json')
})

test('graph export lists labels missing on the server', () => {
  const s = store(
    [
      node('n1'),
      indoor('n2', [lvl('hongik_k', 1)], { type: 'entrance', entranceLabel: 'HI_K_1F_1_ENTER' }),
      indoor('n3', [lvl('hongik_k', 2)], { type: 'entrance', entranceLabel: 'HI_K_2F_1_ENTER' }),
    ],
    [edge('e1', 'n1', 'n2')],
  )
  const result = X.buildGraphExport(s, index, 7)
  const file = JSON.parse(result.text)
  assert.equal(file.exportedAt, 7)
  assert.equal(file.graph.vertices.length, 3)
  assert.equal(file.graph.edges.length, 1)
  assert.deepEqual(file.report.labelsNotOnServer, ['HI_K_2F_1_ENTER'])
  assert.deepEqual(result.labelsNotOnServer, ['HI_K_2F_1_ENTER'])
  assert.equal(result.summary.outdoorVertices, 1)
  assert.deepEqual(result.summary.byLevel.map((l) => l.floor), [1, 2])
})

test('save state: never, saved, needed, also after an undo back past the save', () => {
  let s = Store.addNode(Store.emptyStoreV3(1), 1, 1).store
  const printAtSave = X.storeFingerprint(s)
  const meta = { lastSaveAt: 10, lastSaveFingerprint: printAtSave }
  assert.equal(X.saveStateOf(X.EMPTY_META, printAtSave), 'never')
  assert.equal(X.saveStateOf(meta, printAtSave), 'saved')
  const later = Store.addNode(s, 2, 2).store
  assert.equal(X.saveStateOf(meta, X.storeFingerprint(later)), 'needed')
  // Going back to the saved content counts as saved again, an older state does not.
  assert.equal(X.saveStateOf(meta, X.storeFingerprint(s)), 'saved')
  assert.equal(X.saveStateOf(meta, X.storeFingerprint(Store.emptyStoreV3(1))), 'needed')
  assert.notEqual(X.storeFingerprint(Store.setNodeMemo(s, 'n1', 'a')), X.storeFingerprint(Store.setNodeMemo(s, 'n1', 'b')))
  const storage = memoryStorage()
  X.saveSaveMeta(meta, storage)
  assert.deepEqual(X.loadSaveMeta(storage), meta)
  assert.deepEqual(X.loadSaveMeta(memoryStorage({ [X.META_KEY]: '{bad' })), X.EMPTY_META)
})

test('labels: mode none, number, full, selected only', () => {
  const s = store([indoor('n1', [lvl('hongik_r', 1), lvl('hongik_r', 2)]), indoor('n2', [lvl('hongik_r', 1)])])
  const full = draw(s, { labelMode: 'full' }).nodes[0]
  assert.deepEqual([full.num, full.letter, full.badge], ['1', 'R', '1-2'])
  const number = draw(s, { labelMode: 'number' }).nodes[0]
  assert.deepEqual([number.num, number.letter, number.badge], ['1', '', ''])
  const none = draw(s, { labelMode: 'none', selected: 'n2' }).nodes
  assert.deepEqual(none.map((n) => n.num), ['', ''])
  assert.deepEqual(none.map((n) => n.emphasized), [false, true])
  const only = draw(s, { labelMode: 'selected', selected: 'n2' }).nodes
  assert.equal(only[0].num, '')
  assert.deepEqual([only[1].num, only[1].letter], ['2', 'R'])
  assert.deepEqual(draw(s, { labelMode: 'selected', multi: ['n1'] }).nodes.map((n) => n.num), ['1', ''])
  assert.deepEqual(draw(s, { labelMode: 'selected' }).nodes.map((n) => n.num), ['', ''])
  // The two showing modes still always label the selected point.
  assert.equal(draw(s, { labelMode: 'number', selected: 'n2', filter: { selections: [{ building: 'hongik_k', floor: null }] } }).nodes[1].num, '2')
})

test('labels: with a floor filter only matching points and selected points keep a label', () => {
  const s = store([node('n1'), node('n2'), indoor('n3', [lvl('hongik_r', 1)]), indoor('n4', [lvl('hongik_r', 2)]), indoor('n5', [lvl('hongik_k', 1)])])
  const { nodes } = draw(s, { filter: { selections: [{ building: 'hongik_r', floor: 1 }] }, selected: 'n2' })
  assert.deepEqual(nodes.map((n) => n.num), ['', '2', '3', '', ''])
  assert.deepEqual(nodes.map((n) => n.emphasized), [false, true, false, false, false])
})

test('multi select draws its own ring and only select mode changes nothing about dragging', () => {
  const { nodes } = draw(store([node('n1'), node('n2')]), { mode: 'select', multi: ['n2'] })
  assert.equal(nodes[1].ring, M.MULTI_RING)
  assert.equal(nodes[0].ring, '#FFFFFF')
  assert.equal(nodes[1].emphasized, true)
  assert.ok(nodes.every((n) => n.clickable && !n.draggable))
})

test('neutral edges are dashed and stay different from stairs', () => {
  const s = store([node('n1'), indoor('n2', [lvl('hongik_r', 1)], { type: 'entrance' }), indoor('n3', [lvl('hongik_r', 1)])], [edge('e1', 'n1', 'n2'), edge('e2', 'n1', 'n2', { kind: 'stairs' }), edge('e3', 'n2', 'n3', { kind: 'stairs' })])
  const { edges } = draw(s)
  assert.deepEqual(edges.map((e) => [e.dashed, e.stairs]), [[true, false], [false, true], [false, true]])
  assert.notEqual(edges[0].color, M.STAIRS_COLOR)
})

test('sample: added next to real data, removed again without touching it, nor its neighbors', () => {
  let s = Store.addNode(Store.emptyStoreV3(1), 37.1, 126.1).store
  s = Store.addNode(s, 37.2, 126.2, Store.OUTDOOR_CONTEXT, 'n1').store
  const added = Sample.addDevSample(s, index, 50)
  assert.equal(added.nodes.length, 12)
  assert.equal(added.edges.length, 10)
  assert.equal(new Set(added.nodes.map((n) => n.id)).size, 12)
  assert.equal(added.nodes[2].id, 'n3')
  assert.equal(Sample.devSampleNodeIds(added, index).length, 10)
  // A real point tied to a sample point: the edge goes, the point stays.
  const linked = Store.addEdge(added, 'n2', 'n3')
  const removed = Sample.removeDevSample(linked, index)
  assert.deepEqual(removed.nodes, s.nodes)
  assert.deepEqual(removed.edges, s.edges)
  assert.equal(removed.nextNode > s.nextNode, true)
  assert.equal(Sample.devSampleNodeIds(removed, index).length, 0)
})

test('sample: points left by the earlier button are found by id and position, real points are not', () => {
  const first = Sample.addDevSample(Store.emptyStoreV3(1), index, 50)
  const old = { ...first, nodes: first.nodes.map(({ legacyId, ...n }) => n) }
  assert.equal(Sample.devSampleNodeIds(old, index).length, 10)
  assert.equal(Sample.removeDevSample(old, index).edges.length, 0)
  const real = Store.addNode(Store.emptyStoreV3(1), 37.1, 126.1).store
  assert.deepEqual(Sample.devSampleNodeIds(real, index), [])
  const converted = store([node('n1', { legacyId: 'abc' })])
  assert.deepEqual(Sample.devSampleNodeIds(converted, index), [])
})

test('map script draws dashed edges and hides empty labels', async () => {
  const { SETUP_JS } = await import('../../src/screens/pathSurveyV3/mapBridge.ts')
  assert.ok(SETUP_JS.includes("e.dashed ? 'shortdash' : 'solid'"))
  assert.ok(SETUP_JS.includes("if (!n.num) return '';"))
})
