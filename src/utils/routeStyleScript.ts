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
import { haversineMeters } from './geo'

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
export const ROUTE_HITS_CLEAR_SCRIPT =
  '(function () { (window.__hkRouteHits || []).concat(window.__hkIndoorLines || [], window.__hkRouteMarkers || []).forEach(function (h) { h.setMap(null); }); window.__hkRouteHits = []; window.__hkIndoorLines = []; window.__hkRouteMarkers = []; })(); true;'

/**
 * 층 바뀌는 곳 말풍선(11-16). 점(경로 위 그 자리) 위에 짧은 글 상자. 출구·입구·통과는 남색 바탕, 층 이동·계단은 흰 바탕 남색 글.
 * 글은 서버가 만든 짧은 말이지만 HTML 로 넣으니 escape 한다.
 */
function escapeHtml(text: string): string {
  return text.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] as string)
}

/** 이만큼 안에 붙은 표시는 한 말풍선으로 잇는다('I동 1층 입구 · 계단·엘리베이터 6층 ↑'). 출입구 바로 안에서 층을 옮기면 겹쳐 보였다. */
const MERGE_METERS = 12

export function mergeRouteMarkers(markers: RouteMarker[]): RouteMarker[] {
  const out: RouteMarker[] = []
  for (const m of markers) {
    if (!Number.isFinite(m.lat) || !Number.isFinite(m.lng) || typeof m.label !== 'string' || m.label.length === 0) continue
    const last = out[out.length - 1]
    if (last && haversineMeters(last.lat, last.lng, m.lat, m.lng) < MERGE_METERS) {
      out[out.length - 1] = { ...last, label: `${last.label} · ${m.label}` }
    } else {
      out.push(m)
    }
  }
  return out
}

export function routeMarkerHtml(marker: Pick<RouteMarker, 'kind' | 'label'>): string {
  const solid = marker.kind === 'exit' || marker.kind === 'enter' || marker.kind === 'pass'
  const background = solid ? NAVY : '#FFFFFF'
  const color = solid ? '#FFFFFF' : NAVY
  return `<div style="position:relative;width:0;height:0"><div style="position:absolute;left:-5px;top:-5px;width:10px;height:10px;border-radius:50%;background:#FFFFFF;border:2.5px solid ${NAVY};box-sizing:border-box"></div><div style="position:absolute;left:0;bottom:9px;transform:translateX(-50%);white-space:nowrap;padding:3px 7px;border-radius:10px;background:${background};border:1.5px solid ${NAVY};box-shadow:0 1px 4px rgba(5,1,74,0.3);color:${color};font-size:11px;font-weight:700;line-height:14px;font-family:-apple-system,sans-serif">${escapeHtml(marker.label)}</div></div>`
}

export function routeStyleScript(
  selectedIndex: number,
  fit?: { top: number; bottom: number },
  /** 고른 경로의 건물 안 구간(건물 가운데 ↔ 계단·엘리베이터 ↔ 출입구). 흰 바탕 위 남색 점선으로 덮어 그린다. */
  indoor: { lat: number; lng: number }[][] = [],
  /** 고른 경로의 층 바뀌는 곳(출구·입구·계단·엘리베이터). 점과 짧은 글로 찍는다. */
  markers: RouteMarker[] = [],
): string {
  const markerItems = mergeRouteMarkers(markers).map((m) => ({ lat: m.lat, lng: m.lng, html: routeMarkerHtml(m) }))
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
  ${JSON.stringify(indoor)}.forEach(function (seg) {
    var path = seg.map(function (p) { return new naver.maps.LatLng(p.lat, p.lng); });
    if (path.length < 2) return;
    window.__hkIndoorLines.push(new naver.maps.Polyline({ map: map, path: path, strokeColor: '#FFFFFF', strokeWeight: 7, strokeOpacity: 1, zIndex: 210 }));
    window.__hkIndoorLines.push(new naver.maps.Polyline({ map: map, path: path, strokeColor: '${NAVY}', strokeWeight: 4, strokeOpacity: 0.95,
      strokeStyle: 'shortdash', strokeLineCap: 'round', zIndex: 211 }));
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
    poly.setOptions({ strokeColor: on ? '${NAVY}' : '${ROUTE_GRAY}', strokeWeight: on ? 6 : 5, strokeOpacity: on ? 0.92 : 0.9,
      strokeStyle: 'solid', zIndex: on ? 200 : 100 });
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
