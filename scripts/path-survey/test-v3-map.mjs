// Path survey v3: map drawing rules and the injected map script, on a mock map.
import vm from 'node:vm'
import { register } from 'node:module'
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { edge, FIXTURE_BUILDINGS, indoor, lvl, memoryStorage, node } from './v3-helpers.mjs'

register('../ask/ts-hooks.mjs', import.meta.url)
process.removeAllListeners('warning')
const M = await import('../../src/screens/pathSurveyV3/mapState.ts')
const { SETUP_JS } = await import('../../src/screens/pathSurveyV3/mapBridge.ts')
const B = await import('../../src/utils/pathSurveyV3/buildings.ts')

const index = B.buildBuildingIndex(FIXTURE_BUILDINGS)
const R = 'hongik_r'
const K = 'hongik_k'
const store = (nodes, edges = []) => ({ version: 3, nodes, edges, nextNode: 99, nextEdge: 99, updatedAt: 1 })
const draw = (s, extra = {}) =>
  M.buildRenderState(s, { index, filter: M.NO_FILTER, mode: 'add', selected: null, pending: null, selectedEdge: null, ...extra })

test('shape follows type', () => {
  const { nodes } = draw(store([node('n1'), indoor('n2', [lvl(R, 1)], { type: 'entrance' }), indoor('n3', [lvl(R, 1), lvl(R, 2)], { type: 'elevator' }), indoor('n4', [lvl(R, 1), lvl(R, 2)], { type: 'stairs' })]))
  assert.deepEqual(nodes.map((n) => n.shape), ['circle', 'square', 'diamond', 'triangle'])
})

test('color follows location: outdoor fixed, indoor by building and stable by list order', () => {
  const { nodes } = draw(store([node('n1'), indoor('n2', [lvl(R, 1)]), indoor('n3', [lvl(R, 5)]), indoor('n4', [lvl(K, 1)]), indoor('n5', [lvl('nope', 1)]), indoor('n6', [])]))
  assert.equal(nodes[0].fill, M.OUTDOOR_COLOR)
  assert.equal(nodes[1].fill, nodes[2].fill)
  assert.equal(nodes[1].fill, M.BUILDING_COLORS[0])
  assert.equal(nodes[3].fill, M.BUILDING_COLORS[1])
  assert.equal(nodes[4].fill, M.NEUTRAL_COLOR)
  assert.equal(nodes[5].fill, M.NEUTRAL_COLOR)
  assert.equal(nodes[1].letter, 'R')
})

test('colors cycle after twelve buildings and differ from the fixed colors', () => {
  const many = B.buildBuildingIndex(Array.from({ length: 14 }, (_, i) => ({ id: i, code: `b${i}`, name: `b${i}`, lat: 1, lng: 1 })))
  assert.equal(M.buildingColor(many, 'b12'), M.buildingColor(many, 'b0'))
  assert.notEqual(M.buildingColor(many, 'b11'), M.buildingColor(many, 'b0'))
  assert.equal(new Set(M.BUILDING_COLORS).size, 12)
  for (const fixed of [M.OUTDOOR_COLOR, M.NEUTRAL_COLOR, M.NEUTRAL_EDGE_COLOR, M.STAIRS_COLOR]) assert.ok(!M.BUILDING_COLORS.includes(fixed))
})

test('multi building node has a neutral ring and letters, multi floor node has a floor range badge', () => {
  const { nodes } = draw(store([indoor('n1', [lvl(R, 1), lvl(K, 1)]), indoor('n2', [lvl(R, -1), lvl(R, 1), lvl(R, 3)]), indoor('n3', [lvl(R, 2)]), indoor('n4', [lvl(R, 0), lvl(R, 1.5)])]))
  assert.equal(nodes[0].ring, M.NEUTRAL_COLOR)
  assert.equal(nodes[0].badge, 'R/K')
  assert.equal(nodes[0].letter, '')
  assert.equal(nodes[1].badge, 'B1-3')
  assert.equal(nodes[1].ring, '#FFFFFF')
  assert.equal(nodes[2].badge, '')
  assert.equal(nodes[3].badge, 'L-1.5')
})

test('edge color: outdoor, indoor building, neutral for entrances and links between buildings, stairs stay the same', () => {
  const a = node('n1')
  const b = node('n2')
  const door = indoor('n3', [lvl(R, 1)], { type: 'entrance' })
  const r1 = indoor('n4', [lvl(R, 1)])
  const r2 = indoor('n5', [lvl(R, 1)])
  const k1 = indoor('n6', [lvl(K, 1)])
  const { edges } = draw(store([a, b, door, r1, r2, k1], [
    edge('e1', 'n1', 'n2'),
    edge('e2', 'n1', 'n3'),
    edge('e3', 'n3', 'n4'),
    edge('e4', 'n4', 'n5'),
    edge('e5', 'n4', 'n6'),
    edge('e6', 'n1', 'n2', { kind: 'stairs' }),
    edge('e7', 'n4', 'n5', { kind: 'stairs' }),
  ]))
  assert.deepEqual(edges.slice(0, 5).map((e) => e.color), [M.OUTDOOR_COLOR, M.NEUTRAL_EDGE_COLOR, M.BUILDING_COLORS[0], M.BUILDING_COLORS[0], M.NEUTRAL_EDGE_COLOR])
  assert.deepEqual(edges.map((e) => e.dashed), [false, true, false, false, true, false, false])
  assert.equal(edges[5].color, M.STAIRS_COLOR)
  assert.equal(edges[6].color, M.STAIRS_COLOR)
  assert.equal(edges[5].stairs, true)
})

test('floor filter: matching and outdoor points are strong, others dim and cannot be pressed', () => {
  const s = store([node('n1'), indoor('n2', [lvl(R, 1), lvl(R, 2)]), indoor('n3', [lvl(R, 3)]), indoor('n4', [lvl(K, 1)])], [edge('e1', 'n1', 'n2'), edge('e2', 'n2', 'n3')])
  const floor = draw(s, { filter: { building: R, floor: 2 }, mode: 'move' })
  assert.deepEqual(floor.nodes.map((n) => n.dim), [false, false, true, true])
  assert.deepEqual(floor.nodes.map((n) => n.clickable), [true, true, false, false])
  assert.deepEqual(floor.nodes.map((n) => n.draggable), [true, true, false, false])
  assert.deepEqual(floor.edges.map((e) => e.clickable), [true, false])
  assert.deepEqual(floor.edges.map((e) => e.snap), [true, false])
  assert.ok(floor.edges[1].opacity < floor.edges[0].opacity)
  const building = draw(s, { filter: { building: R, floor: null } })
  assert.deepEqual(building.nodes.map((n) => n.dim), [false, false, false, true])
  const off = draw(s)
  assert.ok(off.nodes.every((n) => n.clickable && !n.dim))
  assert.ok(off.edges.every((e) => e.clickable && e.snap))
})

test('selection and pending rings, only move mode can drag', () => {
  const s = store([node('n1'), node('n2'), node('n3')])
  const { nodes } = draw(s, { selected: 'n1', pending: 'n2' })
  assert.equal(nodes[0].ring, M.SELECTED_RING)
  assert.equal(nodes[1].ring, M.PENDING_RING)
  assert.deepEqual(nodes.map((n) => n.emphasized), [true, true, false])
  assert.ok(nodes.every((n) => !n.draggable))
  assert.ok(draw(s, { mode: 'move' }).nodes.every((n) => n.draggable))
})

test('edges with a missing end are not drawn and do not throw', () => {
  const { edges } = draw(store([node('n1')], [edge('e1', 'n1', 'gone'), edge('e2', 'n1', 'n1')]))
  assert.deepEqual(edges, [])
})

function mockMap() {
  const messages = []
  const markers = []
  const lines = []
  class LatLng {
    constructor(lat, lng) {
      this.latitude = lat
      this.longitude = lng
    }
    lat() {
      return this.latitude
    }
    lng() {
      return this.longitude
    }
  }
  class Overlay {
    constructor(options) {
      this.options = options
      this.listeners = {}
      this.position = options.position
      this.removed = false
    }
    setMap(value) {
      if (value === null) this.removed = true
    }
    getPosition() {
      return this.position
    }
  }
  class Marker extends Overlay {
    constructor(options) {
      super(options)
      markers.push(this)
    }
  }
  class Polyline extends Overlay {
    constructor(options) {
      super(options)
      lines.push(this)
    }
  }
  const mapListeners = {}
  const map = {
    options: {},
    setOptions(o) {
      Object.assign(this.options, o)
    },
    getCenter() {
      return this.center
    },
    getProjection: () => ({
      fromCoordToOffset: (p) => ({ x: p.lng(), y: p.lat() }),
      fromOffsetToCoord: (p) => new LatLng(p.y, p.x),
    }),
    center: null,
    setCenter(c) {
      this.center = c
    },
  }
  const window = { ReactNativeWebView: { postMessage: (s) => messages.push(JSON.parse(s)) } }
  const naver = {
    maps: {
      LatLng,
      Marker,
      Polyline,
      Point: class {
        constructor(x, y) {
          this.x = x
          this.y = y
        }
      },
      Event: {
        addListener: (o, name, fn) => {
          if (o === map) mapListeners[name] = fn
          else o.listeners[name] = fn
          return {}
        },
        removeListener() {},
      },
    },
  }
  window.naver = naver
  vm.runInNewContext(SETUP_JS, { window, map, naver, Date, JSON, Object })
  return { messages, markers, lines, window, map, mapListeners, LatLng }
}

const live = (list) => list.filter((o) => !o.removed)
const LEGACY = { nodes: [], lines: [] }

test('map script: every shape is drawn as svg with the fill and ring from the state', () => {
  const { window, markers } = mockMap()
  const { nodes, edges } = draw(store([node('n1'), indoor('n2', [lvl(R, 1)], { type: 'entrance' }), indoor('n3', [lvl(R, 1), lvl(R, 2)], { type: 'elevator' }), indoor('n4', [lvl(R, 1), lvl(R, 2)], { type: 'stairs' })]))
  window.__surveyV3Render({ legacy: LEGACY, nodes, edges })
  const content = markers.map((m) => m.options.icon.content)
  assert.match(content[0], /data-shape="circle"[\s\S]*<circle/)
  assert.match(content[1], /data-shape="square"[\s\S]*<rect/)
  assert.match(content[2], /data-shape="diamond"[\s\S]*<polygon/)
  assert.match(content[3], /data-shape="triangle"[\s\S]*<polygon/)
  assert.ok(content[1].includes(M.BUILDING_COLORS[0]))
  assert.ok(content[0].includes(M.OUTDOOR_COLOR))
  assert.ok(content[2].includes('1-2'))
})

test('map script: stairs edge is a dark line with a white dash, other edges one line and a hit line', () => {
  const { window, lines } = mockMap()
  const { nodes, edges } = draw(store([node('n1'), node('n2'), node('n3')], [edge('e1', 'n1', 'n2'), edge('e2', 'n2', 'n3', { kind: 'stairs' })]))
  window.__surveyV3Render({ legacy: LEGACY, nodes, edges })
  const drawn = lines.filter((l) => !l.options.clickable)
  assert.equal(drawn.length, 3)
  assert.equal(drawn[0].options.strokeColor, M.OUTDOOR_COLOR)
  assert.equal(drawn[1].options.strokeColor, '#111827')
  assert.equal(drawn[2].options.strokeColor, '#fff')
  assert.equal(drawn[2].options.strokeStyle, 'shortdash')
  assert.equal(lines.filter((l) => l.options.clickable).length, 2)
})

test('map script: clicks post messages, a dim point has no click, and the map tap after a press is ignored', () => {
  const { window, markers, messages, mapListeners, LatLng } = mockMap()
  const s = store([node('n1'), indoor('n2', [lvl(R, 1)])])
  const { nodes, edges } = draw(s, { filter: { building: K, floor: 1 } })
  window.__surveyV3Render({ legacy: LEGACY, nodes, edges })
  assert.equal(markers[1].options.clickable, false)
  assert.equal(markers[1].listeners.click, undefined)
  assert.match(markers[1].options.icon.content, /pointer-events:none/)
  mapListeners.click({ coord: new LatLng(1, 2) })
  assert.deepEqual(messages, [{ type: 'tap', lat: 1, lng: 2, src: 'surveyV3' }])
  markers[0].listeners.click()
  mapListeners.click({ coord: new LatLng(3, 4) })
  assert.equal(messages.length, 2)
  assert.deepEqual(messages[1], { type: 'node', id: 'n1', src: 'surveyV3' })
})

test('map script: drag snaps only to snap edges and never to its own edges', () => {
  const run = (filter) => {
    const { window, markers, messages, LatLng } = mockMap()
    const nodes = [
      node('n1', { lat: 0, lng: 0 }),
      node('n2', { lat: 0, lng: 100 }),
      indoor('n3', [lvl(R, 1)], { lat: 0, lng: 0 }),
      indoor('n4', [lvl(R, 1)], { lat: 0, lng: 100 }),
      node('n5', { lat: 40, lng: 50 }),
    ]
    const drawn = draw(store(nodes, [edge('e1', 'n3', 'n4'), edge('e2', 'n1', 'n5')]), { mode: 'move', filter })
    window.__surveyV3Render({ legacy: LEGACY, ...drawn })
    const marker = markers.find((m) => m.options.title === 'n5')
    marker.position = new LatLng(5, 50)
    marker.listeners.dragend()
    return messages[0]
  }
  assert.equal(run(M.NO_FILTER).edgeId, 'e1')
  assert.equal(run(M.NO_FILTER).lat, 0)
  // The indoor edge on another floor is dim: the point just moves.
  const filtered = run({ building: R, floor: 9 })
  assert.equal(filtered.edgeId, null)
  assert.equal(filtered.lat, 5)
})

test('map script: only changed objects are rebuilt, removed ones disappear', () => {
  const { window, markers } = mockMap()
  const s = store([node('n1'), node('n2')])
  window.__surveyV3Render({ legacy: LEGACY, ...draw(s) })
  const before = markers.length
  window.__surveyV3Render({ legacy: LEGACY, ...draw(s) })
  assert.equal(markers.length, before)
  window.__surveyV3Render({ legacy: LEGACY, ...draw(s, { selected: 'n1' }) })
  assert.equal(markers.length, before + 1)
  assert.equal(live(markers).length, 2)
  window.__surveyV3Render({ legacy: LEGACY, ...draw(store([node('n1')]), { selected: 'n1' }) })
  assert.equal(live(markers).length, 1)
})

test('map script: legacy overlay is drawn gray and can be switched off', () => {
  const { window, markers, lines } = mockMap()
  const legacy = { nodes: [{ id: 'old', lat: 1, lng: 1, label: 'old' }], lines: [[1, 1, 2, 2, 0], [1, 1, 3, 3, 1]] }
  window.__surveyV3Render({ legacy, nodes: [], edges: [] })
  assert.equal(live(markers).length, 1)
  assert.equal(markers[0].options.clickable, false)
  assert.equal(live(lines).length, 2)
  assert.equal(lines[1].options.strokeStyle, 'shortdash')
  window.__surveyV3Render({ legacy: LEGACY, nodes: [], edges: [] })
  assert.equal(live(markers).length, 0)
  assert.equal(live(lines).length, 0)
})

test('map script: running setup twice removes the first objects', () => {
  const { window, map, markers } = mockMap()
  window.__surveyV3Render({ legacy: LEGACY, ...draw(store([node('n1')])) })
  assert.equal(live(markers).length, 1)
  vm.runInNewContext(SETUP_JS, { window, map, naver: window.naver, Date, JSON, Object })
  assert.equal(live(markers).length, 0)
})

test('building cache keeps what the survey needs and survives bad values', () => {
  const storage = memoryStorage()
  assert.equal(B.saveBuildingCache(FIXTURE_BUILDINGS, storage), true)
  assert.deepEqual(storage.writes, ['hongikon.pathSurvey.v3.buildings'])
  const again = B.buildBuildingIndex(B.loadBuildingCache(storage))
  assert.equal(again.list.length, FIXTURE_BUILDINGS.length)
  assert.equal(again.byLetter.get('M').code, 'hongik_gym')
  assert.equal(again.byCode.get('hongik_b').rings.length, 2)
  // Same content does not write again.
  B.saveBuildingCache(FIXTURE_BUILDINGS, storage)
  assert.equal(storage.writes.length, 1)
  assert.deepEqual(B.loadBuildingCache(memoryStorage({ 'hongikon.pathSurvey.v3.buildings': '{bad' })), [])
  assert.deepEqual(B.loadBuildingCache(memoryStorage()), [])
})

test('map script: reports the world width for arrow keys only when it changes, and locks the map keys on request', () => {
  const { messages, map, mapListeners, window, LatLng } = mockMap()
  assert.deepEqual(messages.filter((m) => m.type === 'scale'), [], 'nothing before the map has a center')
  map.center = new LatLng(0, 0)
  mapListeners.idle()
  mapListeners.idle()
  // The mock projection has one pixel per degree.
  assert.deepEqual(messages.filter((m) => m.type === 'scale').map((m) => m.worldPx), [360])
  window.__surveyV3KeyLock(true)
  assert.equal(map.options.keyboardShortcuts, false)
  window.__surveyV3KeyLock(false)
  assert.equal(map.options.keyboardShortcuts, true)
})

test('map script: only the chain base point gets the ring', () => {
  const { window, markers } = mockMap()
  const base = { shape: 'circle', fill: '#000', ring: '#fff', ringWidth: 2, size: 18, num: '', letter: '', badge: '', dim: false, clickable: true, draggable: false, emphasized: false, lat: 1, lng: 1 }
  window.__surveyV3Render({ legacy: LEGACY, edges: [], nodes: [{ ...base, id: 'n1', anchor: true }, { ...base, id: 'n2', anchor: false }] })
  const html = (id) => live(markers).find((m) => m.title === id || m.options?.title === id)
  assert.ok(JSON.stringify(html('n1')).includes('data-anchor'))
  assert.ok(!JSON.stringify(html('n2')).includes('data-anchor'))
})
