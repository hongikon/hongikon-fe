import assert from 'node:assert/strict'
import { test } from 'node:test'
import { mergeRouteMarkers, routeMarkerHtml, routeStyleScript } from '../../src/utils/routeStyleScript'

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
