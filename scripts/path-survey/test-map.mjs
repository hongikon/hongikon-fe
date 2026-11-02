// 지도 주입 코드의 드래그 판정과 메시지를 모의 지도에서 검증한다.
import { readFileSync } from 'node:fs'
import vm from 'node:vm'
import { test } from 'node:test'
import assert from 'node:assert/strict'

const source = readFileSync(new URL('../../src/screens/DevPathSurveyScreen.tsx', import.meta.url), 'utf8')
const setup = vm.runInNewContext(source.match(/const SETUP_JS = (`[\s\S]*?`)/)[1])

function drag({ x = 50, y = 7, active = true, mode = 'move', otherActive = false, kind = 'intersection' } = {}) {
  const messages = [], markers = []
  class LatLng {
    constructor(lat, lng) { this.latitude = lat; this.longitude = lng }
    lat() { return this.latitude }
    lng() { return this.longitude }
  }
  class Overlay {
    constructor(options) { this.options = options; this.listeners = {}; this.position = options.position }
    setMap() {}
    getPosition() { return this.position }
  }
  class Marker extends Overlay { constructor(options) { super(options); markers.push(this) } }
  const map = {
    setOptions() {},
    getProjection: () => ({
      fromCoordToOffset: (p) => ({ x: p.lng(), y: p.lat() }),
      fromOffsetToCoord: (p) => new LatLng(p.y, p.x),
    }),
  }
  const window = { ReactNativeWebView: { postMessage: (s) => messages.push(JSON.parse(s)) } }
  const naver = { maps: {
    LatLng, Marker, Polyline: Overlay, Point: class { constructor(x, y) { this.x = x; this.y = y } },
    Event: { addListener: (o, name, fn) => { (o.listeners ??= {})[name] = fn }, removeListener() {} },
  } }
  window.naver = naver
  vm.runInNewContext(setup, { window, map, naver })
  window.__surveyRender({ legacy: { nodes: [], lines: [] }, mode, modules: [...(otherActive ? [{ id: 'target', active: true, nodes: [], edges: [{ id: 'target-edge', a: 'x', b: 'y', p: [0, 0, 0, 100] }] }] : []), {
    id: 'source', active, color: '#2563EB', dark: '#123456', nodes: [
      { id: 'a', lat: 0, lng: 0 }, { id: 'b', lat: 0, lng: 100 },
      { id: 'c', lat: 40, lng: 50, kind },
    ], edges: [
      { id: 'ab', a: 'a', b: 'b', p: [0, 0, 0, 100] },
      { id: 'ac', a: 'a', b: 'c', p: [0, 0, 40, 50] },
    ],
  }] })
  const marker = markers.find((m) => m.options.title === 'c')
  if (marker.options.draggable) {
    marker.position = new LatLng(y, x)
    marker.listeners.dragend()
  }
  return { messages, marker, click: () => marker.listeners.click?.() }
}

test('드래그: 12px 안의 비연결 간선에 스냅, 자신과 연결된 간선은 제외', () => {
  const { messages, marker } = drag()
  assert.deepEqual(messages, [{ src: 'survey', type: 'move', id: 'c', moduleId: 'source', lat: 0, lng: 50, edgeId: 'ab' }])
  assert.match(marker.options.icon.content, /#7C3AED/)
})

test('드래그: 멀리 놓거나 끝 지점 근처에 놓으면 일반 이동', () => {
  assert.equal(drag({ y: 13 }).messages[0].edgeId, null)
  assert.equal(drag({ x: 3, y: 1 }).messages[0].edgeId, null)
  assert.equal(drag({ x: -5, y: 1 }).messages[0].edgeId, null)
})

test('위치 옮기기 모드의 활성 모듈만 드래그 가능', () => {
  assert.equal(drag({ active: false }).messages.length, 0)
  assert.equal(drag({ mode: 'add' }).messages.length, 0)
})


test('다른 모듈의 특수 지점: 클릭에 원본 모듈 전달, 드래그는 활성 모듈의 간선에만 스냅', () => {
  const r = drag({ active: false, otherActive: true })
  assert.equal(r.marker.options.clickable, true)
  assert.equal(r.messages[0].moduleId, 'source')
  assert.equal(r.messages[0].edgeId, 'target-edge')
  r.click()
  assert.deepEqual(r.messages[1], { src: 'survey', type: 'node', id: 'c', moduleId: 'source' })
})

test('다른 모듈의 일반 지점과 지점 찍기 모드의 외부 특수 지점은 편집 불가', () => {
  const plain = drag({ active: false, otherActive: true, kind: null })
  assert.equal(plain.marker.options.clickable, false)
  assert.equal(plain.messages.length, 0)
  const add = drag({ active: false, otherActive: true, mode: 'add' })
  assert.equal(add.marker.options.clickable, false)
  assert.equal(add.messages.length, 0)
})
