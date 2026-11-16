import assert from 'node:assert/strict'
import { test } from 'node:test'
import type { RouteMarker } from '../../src/apis/routes'
import { routeMapMarks, routeMarkerHtml, routeRuns, routeStyleScript } from '../../src/utils/routeStyleScript'

/** 운영 /map/routes T동 1F → F동 1F 가장 빠른 길(11-16)의 표시 그대로. */
const T_TO_F: RouteMarker[] = [
  { kind: 'floor', label: '계단·엘리베이터 3층 ↑', floor: 3, lat: 37.550131, lng: 126.924946 },
  { kind: 'exit', label: 'T동 3층 출구', floor: 3, lat: 37.550131, lng: 126.924946 },
  { kind: 'stairs', label: '계단', floor: null, lat: 37.550147, lng: 126.925524 },
  { kind: 'enter', label: '조형관 1층 입구', floor: 1, lat: 37.550305, lng: 126.926082 },
  { kind: 'floor', label: '계단 3층 ↑', floor: 3, lat: 37.550375, lng: 126.926137 },
  { kind: 'exit', label: '조형관 3층 출구', floor: 3, lat: 37.550548, lng: 126.926219 },
  { kind: 'stairs', label: '계단', floor: null, lat: 37.550573, lng: 126.926222 },
  { kind: 'enter', label: 'F동 2층 입구', floor: 2, lat: 37.550598, lng: 126.926276 },
  { kind: 'floor', label: '계단·엘리베이터 1층 ↓', floor: 1, lat: 37.550598, lng: 126.926276 },
]

test('출입구는 그 문의 층 동그라미, 층 이동은 계단·엘베 자리에만, 문 자리 층 이동은 안 찍는다', () => {
  const marks = routeMapMarks(T_TO_F, 1)
  assert.deepEqual(marks.map((m) => [m.type, m.text]), [
    ['door', '3F'],
    ['stairs', '계단'],
    ['door', '1F'],
    ['change', '계단 1F→3F'],
    ['door', '3F'],
    ['door', '2F'],
  ])
  assert.deepEqual([marks[3].lat, marks[3].lng], [37.550375, 126.926137])
})

test('출발 층을 모르면 층 이동은 도착 층만', () => {
  const marks = routeMapMarks([{ kind: 'floor', label: '엘리베이터 6층 ↑', floor: 6, lat: 37.55, lng: 126.92 }])
  assert.deepEqual(marks.map((m) => m.text), ['엘베 6F'])
})

test('출입구는 남색 동그라미, 층 이동은 흰 알약, 글은 escape', () => {
  const door = routeMarkerHtml({ type: 'door', text: '3F' })
  assert.ok(door.includes('border-radius:50%') && door.includes('background:#05014A') && door.includes('>3F<'))
  assert.ok(!routeMarkerHtml({ type: 'door', text: 'R동 출구' }).includes('border-radius:50%'))
  assert.ok(routeMarkerHtml({ type: 'change', text: '계단 1F→3F' }).includes('background:#FFFFFF'))
  assert.ok(routeMarkerHtml({ type: 'stairs', text: '<계단>' }).includes('&lt;계단&gt;'))
})

test('고른 경로의 표시만 찍고 좌표가 이상한 것은 뺀다', () => {
  const script = routeStyleScript(0, undefined, [], [
    { lat: 37.55, lng: 126.92, kind: 'exit', label: 'T동 3층 출구', floor: 3 },
    { lat: Number.NaN, lng: 126.92, kind: 'stairs', label: '계단 ↑' },
  ])
  assert.ok(script.includes('>3F<'))
  assert.ok(!script.includes('계단 ↑'))
  assert.ok(script.includes('__hkRouteMarkers'))
})

test('경로를 바깥 실선·건물 안 점선 구간으로 나눈다', () => {
  const p = (n: number) => ({ lat: 37.55 + n / 10000, lng: 126.92 })
  const runs = routeRuns([p(0), p(1), p(2), p(3), p(4)], [[p(1), p(2), p(3)]])
  assert.deepEqual(runs.map((r) => [r.indoor, r.path.length]), [[false, 2], [true, 3], [false, 2]])
  assert.deepEqual(runs[1].path[0], p(1))
  assert.deepEqual(routeRuns([p(0), p(1)]).map((r) => r.indoor), [false])
})
