// Path survey v3: what changed since the last save point ("show changes"), compared field by field.
import { register } from 'node:module'
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { edge, indoor, lvl, node } from './v3-helpers.mjs'

register('../ask/ts-hooks.mjs', import.meta.url)
process.removeAllListeners('warning')
const C = await import('../../src/utils/pathSurveyV3/changes.ts')
const Store = await import('../../src/utils/pathSurveyV3/store.ts')

const R = 'hongik_r'
const K = 'hongik_k'
const store = (nodes, edges = []) => ({ version: 3, nodes, edges, nextNode: 99, nextEdge: 99, updatedAt: 1 })
const reread = (s) => JSON.parse(JSON.stringify(s))
const ids = (list, kind) => list.filter((c) => c.kind === kind).map((c) => c.id)

test('changes: nothing changed gives no entry, also against a base read back from JSON', () => {
  const s = store([node('n1'), indoor('n2', [lvl(R, 1), lvl(R, 2)], { memo: 'm', ties: [[lvl(R, 1), lvl(K, 1)]] })], [edge('e1', 'n1', 'n2', { pairs: [[lvl(R, 1), lvl(K, 1)]] })])
  assert.deepEqual(C.diffStores(s, s), { nodes: [], edges: [], total: { added: 0, changed: 0, removed: 0 } })
  assert.deepEqual(C.diffStores(reread(s), s).total, { added: 0, changed: 0, removed: 0 })
  // Key order, level order, pair direction and edge direction are not content.
  const shuffled = reread(s)
  shuffled.nodes[1] = { memo: 'm', levels: [lvl(R, 2), lvl(R, 1)], ties: [[lvl(K, 1), lvl(R, 1)]], type: 'basic', scope: 'indoor', lng: s.nodes[1].lng, lat: s.nodes[1].lat, id: 'n2' }
  shuffled.edges[0] = { ...shuffled.edges[0], a: 'n2', b: 'n1', pairs: [[lvl(K, 1), lvl(R, 1)]] }
  assert.deepEqual(C.diffStores(shuffled, s).total, { added: 0, changed: 0, removed: 0 })
  // A missing memo and an empty one are the same, as are missing and empty pairs.
  const one = node('n1')
  const blank = store([{ ...one, memo: '' }], [edge('e1', 'n1', 'n1', { pairs: [] })])
  assert.equal(C.diffStores(store([one], [edge('e1', 'n1', 'n1')]), blank).total.changed, 0)
})

test('changes: added, removed and changed are told apart for points and edges', () => {
  const base = store([node('n1'), node('n2'), node('n3')], [edge('e1', 'n1', 'n2'), edge('e2', 'n2', 'n3')])
  const now = reread(base)
  now.nodes = now.nodes.filter((n) => n.id !== 'n3')
  now.nodes.push(node('n4'))
  now.nodes[0].memo = 'new memo'
  now.edges = [now.edges[0], edge('e3', 'n1', 'n4')]
  now.edges[0].kind = 'stairs'
  const diff = C.diffStores(base, now)
  assert.deepEqual(ids(diff.nodes, 'added'), ['n4'])
  assert.deepEqual(ids(diff.nodes, 'removed'), ['n3'])
  assert.deepEqual(ids(diff.nodes, 'changed'), ['n1'])
  assert.deepEqual(diff.nodes.find((c) => c.id === 'n1').aspects, ['memo'])
  assert.deepEqual(ids(diff.edges, 'added'), ['e3'])
  assert.deepEqual(ids(diff.edges, 'removed'), ['e2'])
  assert.deepEqual(diff.edges.find((c) => c.id === 'e1').aspects, ['kind'])
  assert.deepEqual(diff.total, { added: 2, changed: 2, removed: 2 })
  assert.equal(C.countOf(diff.nodes, 'added'), 1)
})

test('changes: each point aspect is named', () => {
  const base = indoor('n1', [lvl(R, 1)], { type: 'entrance', entranceLabel: 'A', memo: 'x' })
  const cases = [
    [{ lat: base.lat + 1e-5 }, ['move']],
    [{ lng: base.lng + 1e-5 }, ['move']],
    [{ scope: 'outdoor' }, ['scope']],
    [{ type: 'basic' }, ['type']],
    [{ levels: [lvl(R, 2)] }, ['levels']],
    [{ ties: [[lvl(R, 1), lvl(K, 1)]] }, ['ties']],
    [{ entranceLabel: 'B' }, ['entranceLabel']],
    [{ memo: 'y' }, ['memo']],
    [{ lat: 0, memo: '' }, ['move', 'memo']],
  ]
  for (const [patch, aspects] of cases) assert.deepEqual(C.nodeAspects(base, { ...base, ...patch }), aspects, JSON.stringify(patch))
  assert.deepEqual(C.nodeAspects(base, { ...base, legacyId: 'old' }), [], 'fields outside the list do not count')
})

test('changes: each edge aspect is named', () => {
  const base = edge('e1', 'n1', 'n2', { memo: 'x' })
  assert.deepEqual(C.edgeAspects(base, { ...base, a: 'n2', b: 'n1' }), [], 'direction is not a change')
  assert.deepEqual(C.edgeAspects(base, { ...base, b: 'n3' }), ['ends'])
  assert.deepEqual(C.edgeAspects(base, { ...base, kind: 'stairs' }), ['kind'])
  assert.deepEqual(C.edgeAspects(base, { ...base, pairs: [[lvl(R, 1), lvl(K, 1)]] }), ['pairs'])
  assert.deepEqual(C.edgeAspects(base, { ...base, memo: undefined }), ['memo'])
  assert.deepEqual(C.edgeAspects({ ...base, kind: undefined }, { ...base, kind: 'normal' }), [], 'a missing kind is normal')
})

test('changes: an edge split shows as one edge removed, two edges and one point added', () => {
  const a = Store.addNode(Store.emptyStoreV3(0), 37.55, 126.92, { scope: 'outdoor' }, null, 0)
  const b = Store.addNode(a.store, 37.55, 126.93, { scope: 'outdoor' }, a.id, 0)
  const base = b.store
  const split = Store.splitEdgeAt(base, base.edges[0].id, 37.55, 126.925, 0)
  const diff = C.diffStores(reread(base), split.store)
  assert.deepEqual(ids(diff.nodes, 'added'), [split.id])
  assert.equal(C.countOf(diff.nodes, 'changed'), 0)
  assert.equal(C.countOf(diff.edges, 'removed'), 1)
  assert.equal(C.countOf(diff.edges, 'added'), 2)
  assert.deepEqual(diff.total, { added: 3, changed: 0, removed: 1 })
})

test('changes: moving back to the saved content counts as nothing', () => {
  const base = store([node('n1'), node('n2')], [edge('e1', 'n1', 'n2')])
  const moved = Store.moveNode(base, 'n1', 1, 2, 0)
  assert.deepEqual(C.diffStores(base, moved).total, { added: 0, changed: 1, removed: 0 })
  const back = Store.moveNode(moved, 'n1', base.nodes[0].lat, base.nodes[0].lng, 0)
  assert.notEqual(back, base, 'another object')
  assert.deepEqual(C.diffStores(reread(base), back).total, { added: 0, changed: 0, removed: 0 })
  const memoBack = Store.setNodeMemo(Store.setNodeMemo(base, 'n1', 'temp', 0), 'n1', '', 0)
  assert.deepEqual(C.diffStores(base, memoBack).total, { added: 0, changed: 0, removed: 0 })
})

test('changes: map marks hold added and changed only, by id', () => {
  const base = store([node('n1'), node('n2')], [edge('e1', 'n1', 'n2')])
  const now = store([{ ...base.nodes[0], memo: 'm' }, node('n3')], [edge('e2', 'n1', 'n3')])
  const marks = C.changeMarks(C.diffStores(base, now))
  assert.deepEqual([...marks.nodes], [['n1', 'changed'], ['n3', 'added']])
  assert.deepEqual([...marks.edges], [['e2', 'added']])
})
