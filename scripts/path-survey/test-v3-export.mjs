// Path survey v3: the graph export read by routing work, finished or not. The sample files next to this test are
// checked against what the code makes now. To write them again: PATH_SURVEY_UPDATE_SAMPLES=1 node --test <this file>
import { readFileSync, writeFileSync } from 'node:fs'
import { register } from 'node:module'
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { edge, FIXTURE_BUILDINGS, hasPath, indoor, lvl, node } from './v3-helpers.mjs'

register('../ask/ts-hooks.mjs', import.meta.url)
process.removeAllListeners('warning')
const Store = await import('../../src/utils/pathSurveyV3/store.ts')
const X = await import('../../src/utils/pathSurveyV3/transfer.ts')
const B = await import('../../src/utils/pathSurveyV3/buildings.ts')
const C = await import('../../src/utils/pathSurveyV3/convertV2.ts')
const { expandGraph } = await import('../../src/utils/pathSurveyV3/expand.ts')

const index = B.buildBuildingIndex(FIXTURE_BUILDINGS)
const R = 'hongik_r'
const K = 'hongik_k'
const AT = Date.UTC(2026, 10, 6)
const inR = (i) => ({ lat: 37.5001 + i * 0.0001, lng: 126.9001 + i * 0.0001 })

const toStore = (nodes, edges) => Store.normalizeStoreV3({ nodes, edges, nextNode: nodes.length + 1, nextEdge: edges.length + 1, updatedAt: AT }, AT)

function finishedStore() {
  return toStore(
    [
      node('n1', { lat: 37.4995, lng: 126.9001 }),
      indoor('n2', [lvl(R, 1.5)], { ...inR(1), type: 'entrance', entranceLabel: 'HI_R_1F5_ENTER' }),
      indoor('n3', [lvl(R, 1.5)], inR(2)),
      indoor('n4', [lvl(R, 1.5), lvl(R, 2)], { ...inR(3), type: 'stairs' }),
      indoor('n5', [lvl(R, 2)], inR(4)),
      indoor('n6', [lvl(R, 1.5), lvl(R, 2), lvl(K, 1), lvl(K, 2)], { ...inR(5), type: 'elevator', ties: [[lvl(R, 1.5), lvl(K, 1)]] }),
    ],
    [edge('e1', 'n1', 'n2'), edge('e2', 'n2', 'n3'), edge('e3', 'n3', 'n4'), edge('e4', 'n4', 'n5'), edge('e5', 'n3', 'n6')],
  )
}

function unfinishedStore() {
  const base = finishedStore()
  return toStore(
    [
      ...base.nodes,
      indoor('n7', [], inR(6)),
      indoor('n8', [lvl(R, 1.3)], inR(7)),
      indoor('n9', [lvl(R, 2), lvl(R, 2.3)], inR(8)),
      indoor('n10', [lvl(R, 2)], { ...inR(9), type: 'entrance' }),
    ],
    [
      ...base.edges,
      edge('e6', 'n5', 'n7'),
      edge('e7', 'n1', 'n5'),
      edge('e8', 'n1', 'n99'),
      edge('e9', 'n5', 'n9'),
      edge('e10', 'n5', 'n10'),
    ],
  )
}

const SAMPLES = [
  ['path-survey-v3-export-complete.json', finishedStore],
  ['path-survey-v3-export-incomplete.json', unfinishedStore],
]

const sampleUrl = (name) => new URL(`./fixtures/${name}`, import.meta.url)

test('sample export files match what the code makes', () => {
  for (const [name, make] of SAMPLES) {
    const { text } = X.buildGraphExport(make(), index, AT)
    if (process.env.PATH_SURVEY_UPDATE_SAMPLES) writeFileSync(sampleUrl(name), `${text}\n`)
    assert.deepEqual(JSON.parse(readFileSync(sampleUrl(name), 'utf8')), JSON.parse(text), name)
  }
})

/** What someone reading the file may rely on, finished or not. */
function assertReadable(file) {
  assert.equal(file.format, 'hongikon.pathSurvey')
  assert.equal(file.version, 3)
  assert.equal(typeof file.exportedAt, 'number')
  assert.equal(file.complete, file.check.errorCount === 0)
  assert.equal(file.check.errors.length, file.check.errorCount)
  assert.equal(file.check.warnings.length, file.check.warningCount)
  for (const issue of [...file.check.errors, ...file.check.warnings]) {
    assert.equal(typeof issue.code, 'string')
    assert.equal(typeof issue.message, 'string')
  }
  const ids = new Set(file.graph.vertices.map((v) => v.id))
  assert.equal(ids.size, file.graph.vertices.length, 'vertex ids are unique')
  for (const v of file.graph.vertices) {
    assert.ok(Number.isFinite(v.lat) && Number.isFinite(v.lng), v.id)
    assert.ok(Number.isInteger(v.floor === undefined ? 0 : v.floor * 2), v.id)
    assert.equal(v.building === undefined, v.floor === undefined, v.id)
  }
  const kinds = new Set(['normal', 'stairs', 'stairs_vertical', 'elevator_vertical', 'tie'])
  for (const e of file.graph.edges) {
    assert.ok(ids.has(e.a) && ids.has(e.b), `${e.a} ${e.b}`)
    assert.ok(kinds.has(e.kind), e.kind)
    if (e.kind === 'stairs_vertical' || e.kind === 'elevator_vertical') assert.equal(e.meters, undefined)
    else assert.equal(typeof e.meters, 'number')
  }
  const inGraph = new Set(file.graph.vertices.map((v) => v.node))
  for (const excluded of file.excluded.nodes) assert.ok(!inGraph.has(excluded.id), excluded.id)
  for (const list of Object.values(file.excluded)) for (const item of list) assert.equal(typeof item.reason, 'string')
}

test('a finished survey: complete is true, nothing is left out, and a route runs through it', () => {
  const made = X.buildGraphExport(finishedStore(), index, AT)
  const file = JSON.parse(made.text)
  assertReadable(file)
  assert.equal(file.complete, true)
  assert.equal(made.complete, true)
  assert.deepEqual(file.check.errors, [])
  assert.deepEqual(file.excluded, { nodes: [], levels: [], edges: [], ties: [] })
  assert.ok(hasPath(file.graph, 'n1', `n5@${R}:2`))
  assert.ok(hasPath(file.graph, 'n1', `n6@${K}:2`))
  assert.deepEqual(new Set(file.graph.edges.map((e) => e.kind)), new Set(['normal', 'stairs_vertical', 'elevator_vertical', 'tie']))
})

test('an unfinished survey: exported anyway, marked, with the reason for everything left out', () => {
  const made = X.buildGraphExport(unfinishedStore(), index, AT)
  const file = JSON.parse(made.text)
  assertReadable(file)
  assert.equal(file.complete, false)
  assert.equal(made.complete, false)
  assert.ok(file.check.errorCount > 0)
  assert.equal(made.errorCount, file.check.errorCount)
  assert.deepEqual(file.excluded.nodes, [
    { id: 'n7', reason: 'no_levels' },
    { id: 'n8', reason: 'no_usable_levels' },
  ])
  assert.deepEqual(file.excluded.levels, [
    { id: 'n8', building: R, floor: 1.3, reason: 'bad_floor' },
    { id: 'n9', building: R, floor: 2.3, reason: 'bad_floor' },
  ])
  assert.deepEqual(file.excluded.edges, [
    { id: 'e6', reason: 'no_levels' },
    { id: 'e7', reason: 'needs_entrance' },
    { id: 'e8', reason: 'missing_node' },
  ])
  assert.equal(made.excludedNodes, 2)
  assert.equal(made.excludedEdges, 3)
  // The finished part still works, including the good floor of a half bad point, and the entrance without a label.
  assert.ok(hasPath(file.graph, 'n1', `n5@${R}:2`))
  assert.ok(hasPath(file.graph, 'n1', `n9@${R}:2`))
  assert.ok(hasPath(file.graph, 'n1', `n10@${R}:2`))
  assert.ok(file.check.errors.some((e) => e.code === 'entrance_no_label' && e.nodeId === 'n10'))
  // Every left out thing has a cause in the error list.
  for (const { id } of file.excluded.nodes) assert.ok(file.check.errors.some((e) => e.nodeId === id), id)
  // An edge is either reported itself, or one of its ends has the error.
  const edgeById = new Map(file.edges.map((e) => [e.id, e]))
  for (const { id } of file.excluded.edges) {
    const ends = [edgeById.get(id).a, edgeById.get(id).b]
    assert.ok(file.check.errors.some((e) => e.edgeId === id || ends.includes(e.nodeId)), id)
  }
})

test('ties that cannot be used are left out and listed', () => {
  const nodes = [indoor('n1', [lvl(R, 1), lvl(R, 2), lvl(K, 1)], { type: 'elevator', ties: [[lvl(R, 9), lvl(K, 1)], [lvl(R, 1), lvl(R, 2)], [lvl(R, 1), lvl(K, 1)]] })]
  const { graph, skippedTies } = expandGraph(nodes, [])
  assert.deepEqual(skippedTies.map((t) => t.reason), ['missing_level', 'same_building'])
  assert.equal(graph.edges.filter((e) => e.kind === 'tie').length, 1)
})

test('an unknown edge kind stays out of the graph', () => {
  const { graph, skipped } = expandGraph([node('n1'), node('n2')], [edge('e1', 'n1', 'n2', { kind: 'ramp' })])
  assert.deepEqual(graph.edges, [])
  assert.deepEqual(skipped, [{ edgeId: 'e1', reason: 'bad_kind' }])
})

test('a pair pointing at a bad floor does not count, and the edge is listed', () => {
  const nodes = [indoor('n1', [lvl(R, 1), lvl(R, 1.3)]), indoor('n2', [lvl(K, 1), lvl(K, 2)])]
  const { graph, skipped } = expandGraph(nodes, [edge('e1', 'n1', 'n2', { pairs: [[lvl(R, 1.3), lvl(K, 2)]] })])
  assert.deepEqual(graph.edges, [])
  assert.deepEqual(skipped, [{ edgeId: 'e1', reason: 'needs_pairs' }])
})

test('export uses the tolerance from the settings, so the file agrees with the check screen', () => {
  const near = { lat: 37.5, lng: 126.8999 }
  const s = toStore([indoor('n1', [lvl(R, 1.5)], { ...near, type: 'entrance', entranceLabel: 'HI_R_1F5_ENTER' })], [])
  assert.equal(X.buildGraphExport(s, index, AT).warningCount, 0)
  assert.equal(X.buildGraphExport(s, index, AT, { entranceToleranceM: 1 }).warningCount, 1)
})

test('an export can be loaded back as a working copy, and only a backup has no graph', () => {
  const s = unfinishedStore()
  const back = X.parseBackupText(X.buildGraphExport(s, index, AT).text)
  assert.deepEqual(back.nodes, s.nodes)
  assert.deepEqual(back.edges, s.edges)
  const backup = JSON.parse(X.serializeBackup(s, AT))
  for (const key of ['graph', 'complete', 'check', 'excluded', 'report']) assert.ok(!(key in backup), key)
})

test('an unfinished file says so in its name', () => {
  const at = new Date(2026, 10, 6, 9, 5)
  assert.equal(X.graphFileName(at, true), 'path-survey-v3-graph-20261106-0905.json')
  assert.equal(X.graphFileName(at, false), 'path-survey-v3-graph-incomplete-20261106-0905.json')
})

const v2File = process.env.PATH_SURVEY_V2_FILE
const mapFile = process.env.PATH_SURVEY_MAP_DATA
test('the real data exports as unfinished and stays readable', { skip: !v2File || !mapFile }, (t) => {
  const real = JSON.parse(readFileSync(mapFile, 'utf8'))
  const realIndex = B.buildBuildingIndex(real.buildings ?? real)
  const { store } = C.convertV2(C.parseV2Text(readFileSync(v2File, 'utf8')).modules, realIndex)
  const made = X.buildGraphExport(store, realIndex, AT)
  const file = JSON.parse(made.text)
  assertReadable(file)
  assert.equal(file.complete, false)
  t.diagnostic(
    `real export: errors ${made.errorCount}, warnings ${made.warningCount}, vertices ${made.summary.vertices}, graph edges ${made.summary.graphEdges}, ` +
      `excluded nodes ${made.excludedNodes}, levels ${file.excluded.levels.length}, edges ${made.excludedEdges}, ties ${file.excluded.ties.length}`,
  )
})
