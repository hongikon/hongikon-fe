import type { NearbyOverlay } from '../lib/nearbyPartners/background'

/**
 * 지도 "근처 알림 영역 보기"(개발·현장 테스트 빌드) — 원격 지도 페이지(map.html)를 고치지 않고 `injectJavaScript` 로
 * `window.map` 위에 원을 그린다. 새로 그릴 때마다 지난 원(`window.__nearbyOverlay`)을 지운다.
 * - 업체 인식 반경(100m): 파란 테두리. 지금 안에 있는 곳은 진하게, 알림을 예약한 곳은 주황.
 * - "다시 고르기" 원: 등록한 자리 둘레 점선. 이 원을 벗어나면 가까운 업체를 다시 고른다.
 * - 등록한 자리: 작은 남색 점. 테스트 위치(지도에서 고른 가짜 GPS)는 빨간 점.
 * `focus`: 처음 켤 때 등록한 자리로 지도를 옮긴다(캠퍼스 밖이면 안 보여서).
 */
export function nearbyOverlayScript(overlay: NearbyOverlay | null, { focus = false }: { focus?: boolean } = {}): string {
  const data = JSON.stringify(overlay)
  return `(function () {
  if (!window.map || !window.naver) return;
  (window.__nearbyOverlay || []).forEach(function (o) { o.setMap(null); });
  window.__nearbyOverlay = [];
  var d = ${data};
  if (!d) return;
  function circle(lat, lng, radius, opt) {
    window.__nearbyOverlay.push(new naver.maps.Circle(Object.assign({ map: map, center: new naver.maps.LatLng(lat, lng), radius: radius, clickable: false }, opt)));
  }
  d.regions.forEach(function (r) {
    var color = r.pending ? '#D97706' : '#2563EB';
    circle(r.lat, r.lng, r.radius, { strokeColor: color, strokeWeight: r.inside || r.pending ? 2.5 : 1, strokeOpacity: 0.9, fillColor: color, fillOpacity: r.inside || r.pending ? 0.18 : 0.05 });
  });
  circle(d.center.lat, d.center.lng, d.reselectMeters, { strokeColor: '#05014A', strokeWeight: 2, strokeStyle: 'dash', strokeOpacity: 0.8, fillOpacity: 0 });
  circle(d.center.lat, d.center.lng, 6, { strokeColor: '#FFFFFF', strokeWeight: 2, fillColor: '#05014A', fillOpacity: 1 });
  if (d.testLocation) circle(d.testLocation.lat, d.testLocation.lng, 7, { strokeColor: '#FFFFFF', strokeWeight: 2, fillColor: '#DC2626', fillOpacity: 1 });
  ${focus ? "map.setCenter(new naver.maps.LatLng(d.center.lat, d.center.lng)); map.setZoom(16);" : ''}
})(); true;`
}
