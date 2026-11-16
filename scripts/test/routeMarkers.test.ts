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
