/**
 * 지도 페이지(map.html)의 길찾기 경로선·출발/도착 표시를 브랜드 남색으로 다시 칠하는 스크립트(11-03, 운영진: 메인 컬러만).
 * 배포된 map.html 은 파랑 선·초록/빨강 표시로 그려서, showRoute·selectRouteAlternative 를 보낸 뒤 이걸 넣는다
 * (map.html 을 새로 배포하지 않아도 된다. 소스 map.html 도 같은 색으로 고쳐 두었다).
 *
 * - 고른 경로: 남색 실선, 다른 경로: 회색 실선(11-09 사용자 요청 — 점선 대신 회색 길). 회색 길을 누르면 그 길로 바꾼다
 *   (`routeTap` 메시지). 선이 가늘어 누르기 어려워 다른 경로마다 보이지 않는 굵은 선(누르는 자리)을 겹친다.
 * - 출발: 흰 바탕에 남색 테두리 '출발', 도착: 남색 바탕 흰 글씨 '도착'
 */
import type { RouteMarker } from '../apis/routes'
import { formatFloor } from './common/floors'
import { haversineMeters } from './common/geo'

const NAVY = '#05014A'
const ROUTE_GRAY = '#A3A7B3'

function marker(label: string, filled: boolean): string {
  const background = filled ? NAVY : '#FFFFFF'
  const text = filled ? '#FFFFFF' : NAVY
  const border = filled ? '#FFFFFF' : NAVY
  return `<div style="width:34px;height:34px;border-radius:50%;background:${background};border:2.5px solid ${border};box-shadow:0 2px 8px rgba(5,1,74,0.35);display:flex;align-items:center;justify-content:center;box-sizing:border-box"><span style="color:${text};font-size:10px;font-weight:700;font-family:-apple-system,sans-serif">${label}</span></div>`
}

/** 경로를 화면에 맞출 때 가장 크게 확대하는 단계. 배포된 map.html 의 맞추기는 위 경로 막대·아래 결과 카드를 몰라 너무 확대됐다(11-03). */
const MAX_FIT_ZOOM = 18

/**
 * @param fit 있으면 모든 경로가 위 막대(top)와 아래 카드(bottom) 사이에 보이게 다시 맞춘다(px). 경로를 처음 그릴 때만 준다.
 */
/** 길찾기를 끝낼 때 누르는 자리(보이지 않는 선)·실내 점선·층 표시를 지운다. 지도 페이지의 clearRoute 는 이걸 모른다. */
/**
 * 출발만 고르고 도착은 아직일 때 그 건물에 '출발' 표시(11-16 사용자 요청 — 어디를 출발로 골랐는지 보이게).
 * 경로를 그리면 지도 페이지가 제 출발 표시를 올리므로 그때는 null 로 지운다. 지도 페이지(map.html)를 새로 배포하지 않으려고 주입한다.
 */
export function pendingStartScript(at: LatLng | null): string {
  const clear = 'if (window.__hkPendingStart) { window.__hkPendingStart.setMap(null); window.__hkPendingStart = null; }'
  if (!at || !Number.isFinite(at.lat) || !Number.isFinite(at.lng)) return `(function () { ${clear} })(); true;`
  return `(function () { if (typeof naver === 'undefined' || typeof map === 'undefined') return; ${clear}
  window.__hkPendingStart = new naver.maps.Marker({ position: new naver.maps.LatLng(${at.lat}, ${at.lng}), map: map, clickable: false, zIndex: 400,
    icon: { content: ${JSON.stringify(marker('출발', false))}, size: new naver.maps.Size(34, 34), anchor: new naver.maps.Point(17, 17) } });
})(); true;`
}

export const ROUTE_HITS_CLEAR_SCRIPT =
  '(function () { (window.__hkRouteHits || []).concat(window.__hkIndoorLines || [], window.__hkRouteMarkers || []).forEach(function (h) { h.setMap(null); }); window.__hkRouteHits = []; window.__hkIndoorLines = []; window.__hkRouteMarkers = []; })(); true;'

/** 글은 서버가 만든 짧은 말이지만 HTML 로 넣으니 escape 한다. */
function escapeHtml(text: string): string {
  return text.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] as string)
}

/** 이만큼 안에 붙은 같은 층 출입구는 한 동그라미로 잇는다. 바깥 계단도 앞 표시와 이 안이면 따로 안 찍는다. */
const MERGE_METERS = 12
/**
 * 층 이동이 출입구와 이만큼 붙어 있으면 경로망에 건물 안 계단·엘리베이터 자리가 없는 것이다(문 점에서 바로 층을 옮김).
 * 어디서 옮기는지 모르니 따로 찍지 않고 출입구 층 동그라미만 둔다(11-16 사용자: 계단·엘베 없는 곳에 층 변화를 쓰면 알 수 없다).
 */
const SAME_SPOT_METERS = 3

/**
 * 지도에 찍는 길찾기 표시(11-16).
 * - door: 출입구·통과. 그 문의 층을 남색 동그라미로('3F').
 * - change: 건물 안 계단·엘리베이터 자리. '계단 1F→3F' 처럼 수단과 층 변화.
 * - stairs: 층을 모르는 바깥 계단. 예전처럼 점 위 짧은 글.
 */
export interface RouteMapMark extends LatLng {
  type: 'door' | 'change' | 'stairs'
  text: string
}

const isDoor = (kind: RouteMarker['kind']) => kind === 'exit' || kind === 'enter' || kind === 'pass'
const hasFloor = (m: RouteMarker): m is RouteMarker & { floor: number } => typeof m.floor === 'number' && Number.isFinite(m.floor)

/** '계단·엘리베이터 3층 ↑' → '계단·엘베', '엘리베이터 1층 ↓' → '엘베', '계단 3층 ↑' → '계단' */
function meansOf(label: string): string {
  const stairs = label.includes('계단')
  const elevator = label.includes('엘리베이터')
  return stairs && elevator ? '계단·엘베' : elevator ? '엘베' : stairs ? '계단' : ''
}

export function routeMapMarks(markers: RouteMarker[], startFloor?: number | null): RouteMapMark[] {
  const valid = markers.filter((m) => Number.isFinite(m.lat) && Number.isFinite(m.lng) && typeof m.label === 'string' && m.label.length > 0)
  const near = (a: LatLng, b: LatLng, meters: number) => haversineMeters(a.lat, a.lng, b.lat, b.lng) < meters
  const out: (RouteMapMark & { floors?: number[] })[] = []
  let current: number | null = typeof startFloor === 'number' && Number.isFinite(startFloor) ? startFloor : null
  valid.forEach((m, i) => {
    const last = out[out.length - 1]
    if (m.kind === 'floor') {
      const target = hasFloor(m) ? m.floor : null
      const atDoor = [valid[i - 1], valid[i + 1]].some((d) => d && isDoor(d.kind) && near(d, m, SAME_SPOT_METERS))
      if (!atDoor && target !== null) {
        const means = meansOf(m.label)
        const change = current !== null && current !== target ? `${formatFloor(current)}→${formatFloor(target)}` : formatFloor(target)
        out.push({ lat: m.lat, lng: m.lng, type: 'change', text: means ? `${means} ${change}` : change })
      }
      if (target !== null) current = target
      return
    }
    if (isDoor(m.kind)) {
      if (hasFloor(m)) current = m.floor
      // 붙은 두 문은 같은 층일 때만 한 동그라미로. 층이 다르면 각자 그 문의 층(문 자리에 층 변화를 쓰지 않는다).
      if (last && last.type === 'door' && near(last, m, MERGE_METERS) && (last.floors ?? [])[0] === m.floor) return
      if (last && last.type === 'stairs' && near(last, m, MERGE_METERS)) out.pop()
      const floors = hasFloor(m) ? [m.floor] : []
      out.push({ lat: m.lat, lng: m.lng, type: 'door', text: floors.length ? formatFloor(floors[0]) : m.label, floors })
      return
    }
    // 바깥 계단: 바로 앞 표시와 붙어 있으면 그 표시에 맡긴다.
    if (last && near(last, m, MERGE_METERS)) return
    out.push({ lat: m.lat, lng: m.lng, type: 'stairs', text: m.label })
  })
  return out.map(({ lat, lng, type, text }) => ({ lat, lng, type, text }))
}

export function routeMarkerHtml(mark: Pick<RouteMapMark, 'type' | 'text'>): string {
  const text = escapeHtml(mark.text)
  const center = 'position:absolute;left:0;top:0;transform:translate(-50%,-50%);box-sizing:border-box;white-space:nowrap;font-weight:800;font-family:-apple-system,sans-serif'
  if (mark.type === 'door') {
    // 점 자리에 바로 층 동그라미. 층을 모르는 문(서버 글 그대로)처럼 글이 길면 알약 모양.
    const shape = mark.text.length <= 4
      ? `width:32px;height:32px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:${mark.text.length > 2 ? 11 : 13}px;line-height:1`
      : 'padding:2px 8px;border-radius:14px;font-size:13px;line-height:22px'
    return `<div style="position:relative;width:0;height:0"><div style="${center};${shape};background:${NAVY};border:2.5px solid #FFFFFF;box-shadow:0 2px 8px rgba(5,1,74,0.35);color:#FFFFFF">${text}</div></div>`
  }
  if (mark.type === 'change') {
    return `<div style="position:relative;width:0;height:0"><div style="${center};padding:2px 8px;border-radius:14px;font-size:12px;line-height:20px;background:#FFFFFF;border:2px solid ${NAVY};box-shadow:0 2px 8px rgba(5,1,74,0.35);color:${NAVY}">${text}</div></div>`
  }
  return `<div style="position:relative;width:0;height:0"><div style="position:absolute;left:-5px;top:-5px;width:10px;height:10px;border-radius:50%;background:#FFFFFF;border:2.5px solid ${NAVY};box-sizing:border-box"></div><div style="position:absolute;left:0;bottom:9px;transform:translateX(-50%);white-space:nowrap;padding:3px 7px;border-radius:10px;background:#FFFFFF;border:1.5px solid ${NAVY};box-shadow:0 1px 4px rgba(5,1,74,0.3);color:${NAVY};font-size:11px;font-weight:700;line-height:14px;font-family:-apple-system,sans-serif">${text}</div></div>`
}

type LatLng = { lat: number; lng: number }

/**
 * 경로 점을 바깥(실선)·건물 안(점선) 구간으로 나눈다(11-16 사용자 요청 — 점선 밑 흰 바탕을 없애고, 고르지 않은 경로도 건물 안은 점선).
 * 건물 안 구간의 이웃한 두 점 쌍과 같은 쌍이면 건물 안이다. 구간 끝점은 이웃 구간과 겹쳐 선이 끊기지 않는다.
 */
export function routeRuns(points: LatLng[], indoorSegments: LatLng[][] = []): { path: LatLng[]; indoor: boolean }[] {
  const key = (a: LatLng, b: LatLng) => `${a.lat},${a.lng}|${b.lat},${b.lng}`
  const inside = new Set<string>()
  for (const seg of indoorSegments) {
    for (let i = 0; i + 1 < seg.length; i++) {
      inside.add(key(seg[i], seg[i + 1]))
      inside.add(key(seg[i + 1], seg[i]))
    }
  }
  const runs: { path: LatLng[]; indoor: boolean }[] = []
  for (let i = 0; i + 1 < points.length; i++) {
    const indoor = inside.has(key(points[i], points[i + 1]))
    const last = runs[runs.length - 1]
    if (last && last.indoor === indoor) last.path.push(points[i + 1])
    else runs.push({ path: [points[i], points[i + 1]], indoor })
  }
  return runs
}

export function routeStyleScript(
  selectedIndex: number,
  fit?: { top: number; bottom: number },
  /**
   * 지도에 올린 경로들(showRoute 와 같은 순서). 지도 페이지가 그린 선은 숨기고(맞추기·누르는 자리에만 쓴다) 바깥은 실선, 건물 안은 점선으로
   * 다시 그린다. 고른 경로는 남색, 나머지는 회색.
   */
  routes: { points: LatLng[]; indoorSegments?: LatLng[][] }[] = [],
  /** 고른 경로의 층 바뀌는 곳(출구·입구·계단·엘리베이터). routeMapMarks 로 찍는다. */
  markers: RouteMarker[] = [],
  /** 출발 층(고른 층). 첫 층 이동을 '1F→3F' 로 쓰려고. 모르면 '3F' 만. */
  startFloor?: number | null,
): string {
  const runs = routes.map((route, index) =>
    routeRuns(route.points ?? [], route.indoorSegments ?? []).map((run) => ({ ...run, index })),
  ).flat()
  const markerItems = routeMapMarks(markers, startFloor).map((m) => ({ lat: m.lat, lng: m.lng, html: routeMarkerHtml(m) }))
  const fitJs = fit
    ? `
  var lats = [], lngs = [];
  routePolylines.forEach(function (poly) { poly.getPath().forEach(function (p) { lats.push(p.lat()); lngs.push(p.lng()); }); });
  if (lats.length > 1 && window.map) {
    var b = new naver.maps.LatLngBounds(new naver.maps.LatLng(Math.min.apply(null, lats), Math.min.apply(null, lngs)),
      new naver.maps.LatLng(Math.max.apply(null, lats), Math.max.apply(null, lngs)));
    map.fitBounds(b, { top: ${Math.round(fit.top)}, bottom: ${Math.round(fit.bottom)}, left: 40, right: 40 });
    if (map.getZoom() > ${MAX_FIT_ZOOM}) map.setZoom(${MAX_FIT_ZOOM}, false);
  }`
    : ''
  return `(function () {
  if (!window.naver || typeof routePolylines === 'undefined') return;
  (window.__hkRouteHits || []).forEach(function (h) { h.setMap(null); });
  window.__hkRouteHits = [];
  (window.__hkIndoorLines || []).forEach(function (h) { h.setMap(null); });
  window.__hkIndoorLines = [];
  var drawn = ${JSON.stringify(runs)};
  drawn.forEach(function (run) {
    var path = run.path.map(function (p) { return new naver.maps.LatLng(p.lat, p.lng); });
    if (path.length < 2) return;
    var on = run.index === ${selectedIndex};
    window.__hkIndoorLines.push(new naver.maps.Polyline({ map: map, path: path, strokeColor: on ? '${NAVY}' : '${ROUTE_GRAY}',
      strokeWeight: run.indoor ? (on ? 5 : 4) : (on ? 6 : 5), strokeOpacity: on ? 0.92 : 0.9,
      strokeStyle: run.indoor ? 'shortdash' : 'solid', strokeLineCap: run.indoor ? 'round' : 'butt', strokeLineJoin: 'round',
      zIndex: (on ? 200 : 100) + (run.indoor ? 1 : 0) }));
  });
  (window.__hkRouteMarkers || []).forEach(function (h) { h.setMap(null); });
  window.__hkRouteMarkers = [];
  ${JSON.stringify(markerItems)}.forEach(function (m, i) {
    window.__hkRouteMarkers.push(new naver.maps.Marker({ map: map, position: new naver.maps.LatLng(m.lat, m.lng),
      icon: { content: m.html, size: new naver.maps.Size(0, 0), anchor: new naver.maps.Point(0, 0) }, clickable: false, zIndex: 300 + i }));
  });
  var tap = function (index) {
    window.__hkRouteTapAt = Date.now();
    var msg = JSON.stringify({ type: 'routeTap', index: index });
    if (window.ReactNativeWebView) window.ReactNativeWebView.postMessage(msg);
  };
  routePolylines.forEach(function (poly, i) {
    var on = i === ${selectedIndex};
    // 다시 그린 선이 있으면 지도 페이지의 선은 숨긴다(점선 밑에 실선이 깔리면 점선이 안 보인다). 없으면(예전 호출) 그대로 칠한다.
    poly.setOptions({ strokeColor: on ? '${NAVY}' : '${ROUTE_GRAY}', strokeWeight: on ? 6 : 5,
      strokeOpacity: drawn.length > 0 ? 0 : (on ? 0.92 : 0.9), strokeStyle: 'solid', zIndex: on ? 200 : 100 });
    if (on) return;
    var hit = new naver.maps.Polyline({ map: map, path: poly.getPath(), strokeColor: '#000000', strokeOpacity: 0.01, strokeWeight: 26,
      clickable: true, zIndex: 150 });
    naver.maps.Event.addListener(hit, 'click', function () { tap(i); });
    window.__hkRouteHits.push(hit);
  });
  var icon = function (html) { return { content: html, size: new naver.maps.Size(34, 34), anchor: new naver.maps.Point(17, 17) }; };
  if (typeof fromOverlay !== 'undefined' && fromOverlay) fromOverlay.setIcon(icon(${JSON.stringify(marker('출발', false))}));
  if (typeof toOverlay !== 'undefined' && toOverlay) toOverlay.setIcon(icon(${JSON.stringify(marker('도착', true))}));${fitJs}
})(); true;`
}
