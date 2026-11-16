import assert from 'node:assert/strict'
import { test } from 'node:test'
import { mergeRouteMarkers, routeMarkerHtml, routeRuns, routeStyleScript } from '../../src/utils/routeStyleScript'

test('층 표시 글은 HTML 로 escape 한다', () => {
  const html = routeMarkerHtml({ kind: 'exit', label: 'T동 <3층> & "출구"' })
  assert.ok(html.includes('T동 &lt;3층&gt; &amp; &quot;출구&quot;'))
  assert.ok(!html.includes('<3층>'))
})

test('출구·입구는 남색 바탕, 층 이동·계단은 흰 바탕', () => {
  assert.ok(routeMarkerHtml({ kind: 'enter', label: 'R동 1층 입구' }).includes('background:#05014A;border:1.5px'))
  assert.ok(routeMarkerHtml({ kind: 'floor', label: '엘리베이터 5층 ↑' }).includes('background:#FFFFFF;border:1.5px'))
})

test('고른 경로의 표시만 찍고 좌표가 이상한 것은 뺀다', () => {
  const script = routeStyleScript(0, undefined, [], [
    { lat: 37.55, lng: 126.92, kind: 'exit', label: 'T동 3층 출구' },
    { lat: Number.NaN, lng: 126.92, kind: 'stairs', label: '계단 ↑' },
  ])
  assert.ok(script.includes('T동 3층 출구'))
  assert.ok(!script.includes('계단 ↑'))
  assert.ok(script.includes('__hkRouteMarkers'))
})

test('붙어 있는 표시는 한 말풍선으로 잇는다', () => {
  const merged = mergeRouteMarkers([
    { lat: 37.55, lng: 126.92, kind: 'enter', label: 'I동 1층 입구' },
    { lat: 37.55003, lng: 126.92, kind: 'floor', label: '계단·엘리베이터 6층 ↑' },
    { lat: 37.551, lng: 126.92, kind: 'stairs', label: '계단' },
  ])
  assert.deepEqual(merged.map((m) => m.label), ['I동 1층 입구 · 계단·엘리베이터 6층 ↑', '계단'])
  assert.equal(merged[0].kind, 'enter')
})

test('경로를 바깥 실선·건물 안 점선 구간으로 나눈다', () => {
  const p = (n: number) => ({ lat: 37.55 + n / 10000, lng: 126.92 })
  const runs = routeRuns([p(0), p(1), p(2), p(3), p(4)], [[p(1), p(2), p(3)]])
  assert.deepEqual(runs.map((r) => [r.indoor, r.path.length]), [[false, 2], [true, 3], [false, 2]])
  assert.deepEqual(runs[1].path[0], p(1))
  assert.deepEqual(routeRuns([p(0), p(1)]).map((r) => r.indoor), [false])
})

test('층을 아는 표시는 점 대신 그 자리에 층 배지, 한 자리에서 옮기면 화살표로', () => {
  const merged = mergeRouteMarkers([
    { lat: 37.55, lng: 126.92, kind: 'floor', label: '계단·엘리베이터 3층 ↑', floor: 3 },
    { lat: 37.55002, lng: 126.92, kind: 'exit', label: 'T동 3층 출구', floor: 3 },
    { lat: 37.552, lng: 126.92, kind: 'enter', label: 'I동 1층 입구', floor: 1 },
    { lat: 37.55203, lng: 126.92, kind: 'floor', label: '계단·엘리베이터 6층 ↑', floor: 6 },
    { lat: 37.554, lng: 126.92, kind: 'enter', label: 'MH동 지하 1층 입구', floor: -1 },
    { lat: 37.556, lng: 126.92, kind: 'stairs', label: '계단', floor: null },
  ])
  assert.deepEqual(merged.map((m) => m.floors), [[3], [1, 6], [-1], []])
  const html = merged.map(routeMarkerHtml)
  assert.ok(html[0].includes('>3F<') && html[0].includes('translate(-50%,-50%)') && !html[0].includes('width:10px') && !html[0].includes('출구'))
  assert.ok(html[1].includes('>1F→6F<'))
  assert.ok(html[2].includes('>B1<'))
  assert.ok(html[3].includes('>계단<') && html[3].includes('font-size:11px'))
})

test('출입구 층 표시는 남색 동그라미, 층 이동과 겹치면 출입구로', () => {
  const [m] = mergeRouteMarkers([
    { lat: 37.55, lng: 126.92, kind: 'floor', label: '계단·엘리베이터 3층 ↑', floor: 3 },
    { lat: 37.55002, lng: 126.92, kind: 'exit', label: 'T동 3층 출구', floor: 3 },
  ])
  assert.equal(m.kind, 'exit')
  const html = routeMarkerHtml(m)
  assert.ok(html.includes('border-radius:50%') && html.includes('background:#05014A'))
  assert.ok(!routeMarkerHtml({ kind: 'floor', label: 'x', floors: [1, 6] }).includes('border-radius:50%'))
})
