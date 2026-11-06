// Path survey v3: store, expansion and check. Usage: node --test scripts/path-survey/test-v3-*.mjs
import { register } from 'node:module'
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { edge, FIXTURE_BUILDINGS, hasPath, indoor, lvl, memoryStorage, node } from './v3-helpers.mjs'

register('../ask/ts-hooks.mjs', import.meta.url)
process.removeAllListeners('warning')
const Store = await import('../../src/utils/pathSurveyV3/store.ts')
const { expandGraph, summarizeGraph } = await import('../../src/utils/pathSurveyV3/expand.ts')
const { checkGraph } = await import('../../src/utils/pathSurveyV3/check.ts')
const B = await import('../../src/utils/pathSurveyV3/buildings.ts')

const codes = (issues) => issues.map((i) => i.code)
const range = (b, from, to) => {
  const out = []
  for (let f = from; f <= to; f += 1) if (f !== 0) out.push(lvl(b, f))
  return out
}

test('S1 outdoor, entrance, multi floor corridor, stairs 1-3, room on 3F', () => {
  const nodes = [
    node('n1'),
    indoor('n2', [lvl('A', 1)], { type: 'entrance', entranceLabel: 'HI_A_1F_ENTER' }),
    indoor('n3', range('A', 1, 3)),
    indoor('n4', range('A', 1, 3), { type: 'stairs' }),
    indoor('n5', [lvl('A', 3)]),
  ]
  const edges = [edge('e1', 'n1', 'n2'), edge('e2', 'n2', 'n3'), edge('e3', 'n3', 'n4'), edge('e4', 'n3', 'n5')]
  assert.deepEqual(checkGraph(nodes, edges).errors, [])
  const { graph, skipped } = expandGraph(nodes, edges)
  assert.deepEqual(skipped, [])
  assert.ok(hasPath(graph, 'n1', 'n5@A:3'))
  assert.equal(graph.edges.filter((e) => e.kind === 'stairs_vertical').length, 2)
  // The corridor exists once per floor and the edge to the stairs too.
  assert.equal(graph.edges.filter((e) => e.a.startsWith('n3@') && e.b.startsWith('n4@')).length, 3)
})

test('S1 extra: without the stairs node the room cannot be reached', () => {
  const nodes = [node('n1'), indoor('n2', [lvl('A', 1)], { type: 'entrance', entranceLabel: 'L' }), indoor('n3', range('A', 1, 3)), indoor('n5', [lvl('A', 3)])]
  const edges = [edge('e1', 'n1', 'n2'), edge('e2', 'n2', 'n3'), edge('e4', 'n3', 'n5')]
  assert.equal(hasPath(expandGraph(nodes, edges).graph, 'n1', 'n5@A:3'), false)
})

test('S2 elevator over two buildings needs ties', () => {
  const levels = [...range('A', 1, 6), ...range('B', 1, 4)]
  const ties = [[lvl('A', 3), lvl('B', 1)], [lvl('A', 4), lvl('B', 2)], [lvl('A', 5), lvl('B', 3)], [lvl('A', 6), lvl('B', 4)]]
  const withTies = [indoor('n1', levels, { type: 'elevator', ties })]
  assert.deepEqual(checkGraph(withTies, []).errors, [])
  const { graph } = expandGraph(withTies, [])
  assert.ok(hasPath(graph, 'n1@A:3', 'n1@B:4'))
  assert.equal(graph.edges.filter((e) => e.kind === 'tie').length, 4)
  assert.ok(graph.edges.filter((e) => e.kind === 'tie').every((e) => e.meters === 0))
  assert.ok(graph.edges.filter((e) => e.kind === 'elevator_vertical').every((e) => e.meters === undefined))

  const without = [indoor('n1', levels, { type: 'elevator' })]
  assert.deepEqual(codes(checkGraph(without, []).errors), ['ties_missing'])
  assert.equal(hasPath(expandGraph(without, []).graph, 'n1@A:3', 'n1@B:4'), false)
})

test('S2 extra: three buildings where ties leave one out', () => {
  const nodes = [indoor('n1', [lvl('A', 1), lvl('B', 1), lvl('C', 1)], { type: 'stairs', ties: [[lvl('A', 1), lvl('B', 1)]] })]
  assert.deepEqual(codes(checkGraph(nodes, []).errors), ['ties_incomplete'])
})

test('S3 even and odd elevators share 1F: 2F to 3F through 1F', () => {
  const nodes = [
    indoor('n1', [lvl('A', 1), lvl('A', 2), lvl('A', 4)], { type: 'elevator' }),
    indoor('n2', [lvl('A', 1), lvl('A', 3), lvl('A', 5)], { type: 'elevator' }),
  ]
  const edges = [edge('e1', 'n1', 'n2')]
  assert.deepEqual(checkGraph(nodes, edges).errors, [])
  const { graph } = expandGraph(nodes, edges)
  assert.ok(hasPath(graph, 'n1@A:2', 'n2@A:3'))
  assert.equal(graph.edges.filter((e) => e.kind === 'normal').length, 1)
})

test('S4 outdoor stairs are only an edge kind', () => {
  const nodes = [node('n1'), node('n2')]
  const edges = [edge('e1', 'n1', 'n2', { kind: 'stairs' })]
  assert.deepEqual(checkGraph(nodes, edges).errors, [])
  const { graph } = expandGraph(nodes, edges)
  assert.equal(graph.edges.length, 1)
  assert.equal(graph.edges[0].kind, 'stairs')
  assert.ok(graph.edges[0].meters > 0)
  assert.ok(graph.vertices.every((v) => v.type === 'basic'))
})

test('S5 bad input is reported and expansion stays safe', () => {
  const cases = [
    [[node('n1', { type: 'elevator' })], [], 'vertical_outdoor'],
    [[indoor('n1', [lvl('A', 1)], { type: 'stairs' })], [], 'vertical_few_levels'],
    [[indoor('n1', [lvl('A', 1)], { type: 'entrance' })], [], 'entrance_no_label'],
    [[indoor('n1', [])], [], 'indoor_no_levels'],
    [[node('n1'), indoor('n2', [lvl('A', 1)])], [edge('e1', 'n1', 'n2')], 'edge_outdoor_indoor'],
  ]
  for (const [nodes, edges, code] of cases) {
    assert.ok(codes(checkGraph(nodes, edges).errors).includes(code), code)
    assert.doesNotThrow(() => expandGraph(nodes, edges))
  }
  assert.deepEqual(expandGraph(cases[4][0], cases[4][1]).skipped, [{ edgeId: 'e1', reason: 'needs_entrance' }])
})

test('S5 extra: garbage shapes do not throw in expand or check', () => {
  const nodes = [
    indoor('n1', undefined),
    indoor('n2', [lvl('A', 1), lvl('A', 1)], { type: 'elevator', ties: [[lvl('X', 1), lvl('Y', 2)]] }),
    node('n3', { type: 'entrance' }),
  ]
  const edges = [edge('e1', 'n1', 'n2'), edge('e2', 'nope', 'n3'), edge('e3', 'n3', 'n3')]
  assert.doesNotThrow(() => checkGraph(nodes, edges))
  const { skipped } = expandGraph(nodes, edges)
  assert.deepEqual(skipped.map((s) => s.reason).sort(), ['missing_node', 'no_levels', 'self'])
})

test('S6 one floor each without a common floor: connected directly', () => {
  const nodes = [indoor('n1', [lvl('Z3', -1)]), indoor('n2', [lvl('T', 1)])]
  const edges = [edge('e1', 'n1', 'n2')]
  const result = checkGraph(nodes, edges)
  assert.deepEqual(result.errors, [])
  assert.deepEqual(codes(result.warnings), [])
  assert.ok(hasPath(expandGraph(nodes, edges).graph, 'n1@Z3:-1', 'n2@T:1'))
})

test('same building, different floor, one floor each: connected, warned unless stairs', () => {
  const nodes = [indoor('n1', [lvl('F', 2)]), indoor('n2', [lvl('F', 3)])]
  const normal = [edge('e1', 'n1', 'n2')]
  assert.deepEqual(codes(checkGraph(nodes, normal).warnings), ['same_building_direct'])
  assert.deepEqual(codes(checkGraph(nodes, normal).errors), [])
  assert.ok(hasPath(expandGraph(nodes, normal).graph, 'n1@F:2', 'n2@F:3'))
  assert.deepEqual(codes(checkGraph(nodes, [edge('e1', 'n1', 'n2', { kind: 'stairs' })]).warnings), [])
})

test('rule 3: a multi floor edge expands per common floor only', () => {
  const nodes = [indoor('n1', range('A', 1, 3)), indoor('n2', range('A', 2, 4))]
  const { graph } = expandGraph(nodes, [edge('e1', 'n1', 'n2')])
  assert.deepEqual(graph.edges.map((e) => e.a).sort(), ['n1@A:2', 'n1@A:3'])
})

test('rule 4: several floors and no common floor needs pairs', () => {
  const nodes = [indoor('n1', range('A', 1, 2)), indoor('n2', range('B', 3, 4))]
  assert.deepEqual(codes(checkGraph(nodes, [edge('e1', 'n1', 'n2')]).errors), ['edge_needs_pairs'])
  const pairs = [[lvl('A', 1), lvl('B', 3)]]
  const edges = [edge('e1', 'n1', 'n2', { pairs })]
  assert.deepEqual(checkGraph(nodes, edges).errors, [])
  assert.ok(hasPath(expandGraph(nodes, edges).graph, 'n1@A:1', 'n2@B:3'))
  const bad = [edge('e1', 'n1', 'n2', { pairs: [[lvl('A', 9), lvl('B', 3)]] })]
  assert.deepEqual(codes(checkGraph(nodes, bad).errors).sort(), ['edge_needs_pairs', 'pair_bad_level'])
  const reversed = [edge('e1', 'n2', 'n1', { pairs: [[lvl('B', 3), lvl('A', 1)]] })]
  assert.ok(hasPath(expandGraph(nodes, reversed).graph, 'n1@A:1', 'n2@B:3'))
})

test('pairs next to common floors are ignored with a warning', () => {
  const nodes = [indoor('n1', range('A', 1, 2)), indoor('n2', range('A', 2, 3))]
  const edges = [edge('e1', 'n1', 'n2', { pairs: [[lvl('A', 1), lvl('A', 3)]] })]
  assert.deepEqual(codes(checkGraph(nodes, edges).warnings), ['pairs_ignored'])
  assert.equal(expandGraph(nodes, edges).graph.edges.length, 1)
})

test('stairs link neighbours in sorted order, across a gap, L and half floors', () => {
  const nodes = [indoor('n1', [lvl('R', 3), lvl('R', -1), lvl('R', 1.5), lvl('R', 0)], { type: 'stairs' })]
  assert.deepEqual(checkGraph(nodes, []).errors, [])
  const { graph } = expandGraph(nodes, [])
  assert.deepEqual(graph.edges.map((e) => `${e.a}|${e.b}`), ['n1@R:-1|n1@R:0', 'n1@R:0|n1@R:1.5', 'n1@R:1.5|n1@R:3'])
})

test('elevator links all pairs of floors inside one building', () => {
  const { graph } = expandGraph([indoor('n1', range('A', 1, 4), { type: 'elevator' })], [])
  assert.equal(graph.edges.length, 6)
})

test('floor values: 0 and halves are fine anywhere, other fractions are errors', () => {
  assert.deepEqual(checkGraph([indoor('n1', [lvl('K', 0)]), indoor('n2', [lvl('K', 2.5)])], []).errors, [])
  assert.deepEqual(codes(checkGraph([indoor('n1', [lvl('K', 1.3)])], []).errors), ['bad_floor'])
})

test('errors: missing node, self edge, duplicate edge, unknown kind, outdoor with levels', () => {
  const nodes = [node('n1'), node('n2'), node('n3', { levels: [lvl('A', 1)] })]
  const edges = [edge('e1', 'n1', 'zz'), edge('e2', 'n1', 'n1'), edge('e3', 'n1', 'n2'), edge('e4', 'n2', 'n1'), edge('e5', 'n2', 'n3', { kind: 'ramp' })]
  assert.deepEqual(codes(checkGraph(nodes, edges).errors).sort(), ['edge_duplicate', 'edge_kind', 'edge_missing_node', 'edge_self', 'outdoor_has_levels'])
})

test('warnings and info: duplicate label, isolated, components, dead ends', () => {
  const nodes = [
    indoor('n1', [lvl('A', 1)], { type: 'entrance', entranceLabel: 'L' }),
    indoor('n2', [lvl('A', 1)], { type: 'entrance', entranceLabel: 'L' }),
    node('n3'),
    node('n4'),
  ]
  const result = checkGraph(nodes, [edge('e1', 'n3', 'n4')])
  assert.deepEqual(result.errors, [])
  assert.deepEqual(codes(result.warnings), ['duplicate_label', 'duplicate_label'])
  assert.deepEqual(result.connectivity.sizes, [2, 1, 1])
  assert.deepEqual(result.connectivity.isolated, ['n1', 'n2'])
  assert.deepEqual(result.connectivity.deadEnds, ['n3', 'n4'])
})

test('boundary: outdoor inside suggests a building, indoor outside warns, entrance has slack', () => {
  const index = B.buildBuildingIndex(FIXTURE_BUILDINGS)
  const outdoorInside = node('n1', { lat: 37.5005, lng: 126.9005 })
  const info = checkGraph([outdoorInside], [], index).infos.find((i) => i.code === 'outdoor_in_boundary')
  assert.deepEqual(info.candidates, ['hongik_r'])

  // Second boundary block (extraBoundaries) counts too.
  const inExtra = node('n1', { lat: 37.6105, lng: 127.0005 })
  assert.deepEqual(checkGraph([inExtra], [], index).infos.find((i) => i.code === 'outdoor_in_boundary').candidates, ['hongik_b'])

  const far = indoor('n2', [lvl('hongik_r', 1)], { lat: 37.51, lng: 126.91 })
  assert.deepEqual(codes(checkGraph([far], [], index).warnings), ['indoor_out_of_boundary'])
  assert.deepEqual(checkGraph([far], [], index).errors, [])

  // About 11 m past the outline: an entrance is fine, a corridor point is not.
  const near = { lat: 37.5011, lng: 126.9005 }
  const door = indoor('n3', [lvl('hongik_r', 1)], { ...near, type: 'entrance', entranceLabel: 'HI_R_1F5_ENTER' })
  assert.deepEqual(codes(checkGraph([door], [], index).warnings), [])
  assert.deepEqual(codes(checkGraph([indoor('n4', [lvl('hongik_r', 1)], near)], [], index).warnings), ['indoor_out_of_boundary'])

  // No boundary for the building: nothing to compare.
  assert.deepEqual(codes(checkGraph([indoor('n5', [lvl('hongik_k', 1)])], [], index).warnings), [])
})

test('info: labels and buildings the server does not know', () => {
  const index = B.buildBuildingIndex(FIXTURE_BUILDINGS)
  const nodes = [indoor('n1', [lvl('nope', 1)]), indoor('n2', [lvl('hongik_k', 1)], { type: 'entrance', entranceLabel: 'HI_K_9F_1_ENTER' })]
  const found = codes(checkGraph(nodes, [], index).infos)
  assert.ok(found.includes('unknown_building'))
  assert.ok(found.includes('label_not_on_server'))
})

test('expansion: outdoor vertex id is the node id, indoor is node@building:floor, meters are computed', () => {
  const nodes = [node('n1', { lat: 37.55, lng: 126.92 }), indoor('n3', [lvl('hongik_r', -1)], { lat: 37.551, lng: 126.92, type: 'entrance', entranceLabel: 'L' })]
  const { graph } = expandGraph(nodes, [edge('e1', 'n1', 'n3')])
  assert.deepEqual(graph.vertices.map((v) => v.id), ['n1', 'n3@hongik_r:-1'])
  assert.equal(graph.vertices[1].building, 'hongik_r')
  assert.equal(graph.vertices[1].floor, -1)
  assert.ok(Math.abs(graph.edges[0].meters - 111.2) < 0.5)
})

test('summary counts points per floor', () => {
  const nodes = [node('n1'), indoor('n2', range('A', 1, 2)), indoor('n3', [lvl('A', 1)])]
  const edges = [edge('e1', 'n2', 'n3')]
  const s = summarizeGraph(nodes, edges, expandGraph(nodes, edges).graph)
  assert.equal(s.outdoorVertices, 1)
  assert.deepEqual(s.byLevel, [{ building: 'A', floor: 1, count: 2 }, { building: 'A', floor: 2, count: 1 }])
})

test('store: ids never come back after a delete, new points inherit the context', () => {
  let s = Store.emptyStoreV3(1)
  const a = Store.addNode(s, 37.5, 126.9)
  assert.equal(a.id, 'n1')
  s = Store.removeNode(a.store, 'n1')
  const b = Store.addNode(s, 37.5, 126.9, { scope: 'indoor', levels: [lvl('A', 2)] })
  assert.equal(b.id, 'n2')
  assert.deepEqual(b.store.nodes[0].levels, [lvl('A', 2)])
  assert.equal(b.store.nodes[0].scope, 'indoor')
  const c = Store.addNode(b.store, 37.51, 126.91, Store.OUTDOOR_CONTEXT, 'n2')
  assert.deepEqual(c.store.edges, [{ id: 'e1', a: 'n2', b: 'n3', kind: 'normal' }])
  assert.equal(c.store.nodes[1].levels, undefined)
})

test('store: edges refuse self and duplicate, in either direction', () => {
  let s = Store.emptyStoreV3(1)
  s = Store.addNode(s, 1, 1).store
  s = Store.addNode(s, 2, 2).store
  s = Store.addEdge(s, 'n1', 'n2')
  assert.equal(Store.addEdge(s, 'n2', 'n1'), s)
  assert.equal(Store.addEdge(s, 'n1', 'n1'), s)
  assert.equal(Store.addEdge(s, 'n1', 'nope'), s)
})

test('store: dropping a node on an edge splits it, keeps kind and memo, drops pairs', () => {
  let s = Store.emptyStoreV3(1)
  for (const [lat, lng] of [[1, 1], [1, 3], [5, 2]]) s = Store.addNode(s, lat, lng).store
  s = Store.addEdge(s, 'n1', 'n2', 'stairs')
  s = Store.setEdgeMemo(s, 'e1', 'memo')
  s = Store.setEdgePairs(s, 'e1', [[lvl('A', 1), lvl('B', 1)]])
  const r = Store.moveNodeOntoEdge(s, 'n3', 'e1', 1, 2)
  assert.equal(r.split, true)
  assert.equal(r.pairsDropped, true)
  assert.deepEqual(r.store.edges, [
    { id: 'e2', a: 'n1', b: 'n3', kind: 'stairs', memo: 'memo' },
    { id: 'e3', a: 'n3', b: 'n2', kind: 'stairs', memo: 'memo' },
  ])
  assert.equal(r.store.nodes[2].lat, 1)
  // Own edge or an end point position: nothing happens.
  assert.equal(Store.moveNodeOntoEdge(r.store, 'n3', 'e2', 1, 2).split, false)
  assert.equal(Store.moveNodeOntoEdge(s, 'n3', 'e1', 1, 1).split, false)
})

test('store: scope and type changes stay consistent', () => {
  let s = Store.addNode(Store.emptyStoreV3(1), 1, 1).store
  s = Store.setNodeType(s, 'n1', 'elevator', [lvl('A', 1), lvl('A', 2)])
  assert.equal(s.nodes[0].scope, 'indoor')
  assert.equal(s.nodes[0].levels.length, 2)
  s = Store.setNodeTies(s, 'n1', [[lvl('A', 1), lvl('A', 2)]])
  s = Store.setNodeScope(s, 'n1', 'outdoor')
  assert.deepEqual([s.nodes[0].scope, s.nodes[0].type, s.nodes[0].levels, s.nodes[0].ties], ['outdoor', 'basic', undefined, undefined])
  s = Store.setNodeType(s, 'n1', 'entrance', [lvl('A', 1)])
  s = Store.setEntranceLabel(s, 'n1', 'L')
  s = Store.setNodeType(s, 'n1', 'basic')
  assert.equal(s.nodes[0].entranceLabel, undefined)
  s = Store.setNodeType(s, 'n1', 'stairs')
  s = Store.setNodeLevels(s, 'n1', [lvl('A', 1), lvl('B', 1), lvl('A', 1)])
  assert.equal(s.nodes[0].levels.length, 2)
  s = Store.setNodeTies(s, 'n1', [[lvl('A', 1), lvl('B', 1)]])
  s = Store.setNodeLevels(s, 'n1', [lvl('A', 1), lvl('A', 2)])
  assert.equal(s.nodes[0].ties, undefined)
})

test('store: bulk assignment changes all targets in one step', () => {
  let s = Store.emptyStoreV3(1)
  for (let i = 0; i < 3; i += 1) s = Store.addNode(s, i, i).store
  const next = Store.assignLevelsToNodes(s, ['n1', 'n3'], [lvl('A', 1)])
  assert.deepEqual(next.nodes.map((n) => n.scope), ['indoor', 'outdoor', 'indoor'])
  assert.deepEqual(Store.assignOutdoorToNodes(next, ['n1']).nodes.map((n) => n.scope), ['outdoor', 'outdoor', 'indoor'])
  assert.equal(Store.assignLevelsToNodes(s, ['zz'], []), s)
})

test('save and load: round trip, unreadable values stop saving, only the v3 key is written', () => {
  const storage = memoryStorage()
  const s = Store.addNode(Store.emptyStoreV3(1), 1, 1).store
  assert.equal(Store.saveStoreV3(s, storage), true)
  assert.deepEqual(storage.writes, ['hongikon.pathSurvey.v3'])
  assert.deepEqual(Store.loadStoreV3(storage).store, s)

  const broken = memoryStorage({ 'hongikon.pathSurvey.v3': '{not json' })
  const loaded = Store.loadStoreV3(broken)
  assert.equal(loaded.corrupt, true)
  assert.deepEqual(broken.writes, [])
  assert.equal(Store.loadStoreV3(memoryStorage({ 'hongikon.pathSurvey.v3': '{"nodes":3}' })).corrupt, true)
  assert.equal(Store.loadStoreV3(memoryStorage()).corrupt, false)

  const full = { getItem: () => null, setItem: () => { throw new Error('quota') } }
  assert.equal(Store.saveStoreV3(s, full), false)
  assert.equal(Store.saveStoreV3(s, null), false)
})

test('normalize: keeps what the check must see, recomputes counters', () => {
  const s = Store.normalizeStoreV3({
    nodes: [{ id: 'n9', lat: 1, lng: 2, scope: 'indoor', type: 'stairs', levels: [{ building: 'A', floor: 1.3 }] }, { id: 'n9', lat: 1, lng: 2 }, { id: 'x' }, 7],
    edges: [{ id: 'e4', a: 'n9', b: 'n9' }, { id: 'e5', a: 'n9', b: 'gone', kind: 'ramp' }, { id: 'e4', a: 'x', b: 'y' }],
  })
  assert.equal(s.nodes.length, 1)
  assert.equal(s.nodes[0].levels[0].floor, 1.3)
  assert.equal(s.edges.length, 2)
  assert.equal(s.edges[0].kind, 'normal')
  assert.equal(s.edges[1].kind, 'ramp')
  assert.equal(s.nextNode, 10)
  assert.equal(s.nextEdge, 6)
})

test('buildings: search by letter, label prefix, code suffix and name', () => {
  const index = B.buildBuildingIndex(FIXTURE_BUILDINGS)
  const search = (q) => B.searchBuildings(index, q).map((b) => b.code)
  assert.equal(search('k')[0], 'hongik_k')
  assert.equal(search('K')[0], 'hongik_k')
  assert.deepEqual(search('d').slice(0, 2), ['hongik_d', 'hongik_dorm2'])
  assert.equal(search('d2')[0], 'hongik_dorm2')
  assert.deepEqual(search('z'), ['hongik_z1', 'hongik_z3'])
  assert.equal(search('z3')[0], 'hongik_z3')
  assert.equal(search('m')[0], 'hongik_gym')
  assert.equal(search('mh')[0], 'hongik_mh')
  assert.equal(search('gym')[0], 'hongik_gym')
  assert.equal(search('hongmun')[0], 'hongik_r')
  assert.deepEqual(search('qqq'), [])
  assert.equal(search('').length, FIXTURE_BUILDINGS.length)
})

test('buildings: order follows the server id, not the response order', () => {
  const index = B.buildBuildingIndex(FIXTURE_BUILDINGS)
  assert.deepEqual(index.list.slice(3, 5).map((b) => b.code), ['hongik_dorm2', 'hongik_d'])
  assert.equal(index.byLetter.get('D2').code, 'hongik_dorm2')
  assert.equal(index.byLetter.get('M').code, 'hongik_gym')
})

test('buildings: floor chips come from the entrance range, special floors and used floors', () => {
  const index = B.buildBuildingIndex([...FIXTURE_BUILDINGS, { id: 99, code: 'x', name: 'x', lat: 1, lng: 1, floors: 3, basementFloors: 1 }])
  const r = B.floorOptions(index.byCode.get('hongik_r'))
  assert.deepEqual(r.special, [0, 1.5])
  assert.deepEqual(r.main, [-2, -1, 0, 1, 1.5])
  assert.equal(r.more.at(-1), 30)
  assert.ok(!r.more.includes(1))
  assert.deepEqual(B.floorOptions(index.byCode.get('hongik_k')).main, [1])
  assert.deepEqual(B.floorOptions(index.byCode.get('hongik_k'), [7, 0]).main, [0, 1, 7])
  assert.deepEqual(B.floorOptions(index.byCode.get('x')).main, [-1, 1, 2, 3])
  // No entrances and no counts: a compact default, the rest behind more.
  const none = B.floorOptions(index.byCode.get('hongik_t'))
  assert.equal(none.main[0], -5)
  assert.equal(none.main.at(-1), 10)
  assert.ok(!none.main.includes(0))
  assert.equal(none.more[0], 11)
})

test('labels: floor tokens and new label numbering', () => {
  const cases = { LF: 0, B1: -1, B1F: -1, B2F: -2, '1F': 1, '1F5': 1.5, B1F5: -1.5, '10F': 10 }
  for (const [token, floor] of Object.entries(cases)) assert.equal(B.parseFloorToken(token), floor, token)
  assert.equal(B.parseFloorToken('1'), null)
  assert.equal(B.parseFloorToken('X'), null)
  assert.deepEqual([0, -1, 1, 1.5, -1.5].map(B.formatFloorToken), ['LF', 'B1', '1F', '1F5', 'B1F5'])
  assert.deepEqual(B.parseEntranceLabel('HI_Z1_2F_ENTER'), { letter: 'Z1', floor: 2 })
  assert.deepEqual(B.parseEntranceLabel('HI_R_LF_2_ENTER'), { letter: 'R', floor: 0 })
  assert.equal(B.parseEntranceLabel('HI_D2_B1_ENTER2'), null)

  const index = B.buildBuildingIndex(FIXTURE_BUILDINGS)
  assert.equal(B.nextEntranceLabel(index, lvl('hongik_k', 1), []), 'HI_K_1F_2_ENTER')
  assert.equal(B.nextEntranceLabel(index, lvl('hongik_k', 1), ['HI_K_1F_2_ENTER']), 'HI_K_1F_3_ENTER')
  assert.equal(B.nextEntranceLabel(index, lvl('hongik_r', 1.5), []), 'HI_R_1F5_1_ENTER')
  assert.equal(B.nextEntranceLabel(index, lvl('hongik_gym', -1), []), 'HI_M_B1_1_ENTER')
  assert.equal(B.serverLabelFor(index, 'HI_Z3_B1F_ENTER'), 'HI_Z3_B1F_ENTER')
  assert.equal(B.serverLabelFor(index, 'HI_R_B2F_ENTER'), 'HI_R_B2_ENTER')
  assert.equal(B.serverLabelFor(index, 'HI_R_9F_ENTER'), null)
})
