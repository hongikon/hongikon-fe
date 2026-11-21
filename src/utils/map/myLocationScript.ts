/**
 * 지도 페이지(map.html)에 내 위치 점과 정확도 원을 그리는 스크립트(11-03, 길찾기). map.html 을 새로 배포하지 않도록
 * nearbyOverlayScript 처럼 WebView 에 그대로 넣는다. null 이면 지운다.
 *
 * 좌표는 이 페이지 안에서 점을 그리는 데만 쓴다. 이 스크립트는 지도를 옮기지 않고(지도 그림 요청에 위치가 드러나지 않게),
 * 저장하거나 밖으로 보내지 않는다. 지도 메뉴 "내 위치"(11-06)만 캠퍼스 범위 안일 때 지도를 옮긴다(MapScreen).
 */
export function myLocationScript(position: { lat: number; lng: number; accuracy: number | null } | null): string {
  const data = JSON.stringify(position)
  return `(function () {
  if (!window.map || !window.naver) return;
  var d = ${data};
  var s = window.__myLocation;
  if (!d) {
    if (s) { s.dot.setMap(null); s.halo.setMap(null); window.__myLocation = null; }
    return;
  }
  var c = new naver.maps.LatLng(d.lat, d.lng);
  var r = Math.min(Math.max(d.accuracy || 0, 5), 100);
  if (!s) {
    s = window.__myLocation = {
      halo: new naver.maps.Circle({ map: map, center: c, radius: r, clickable: false,
        strokeColor: '#2563EB', strokeOpacity: 0.35, strokeWeight: 1, fillColor: '#2563EB', fillOpacity: 0.12, zIndex: 200 }),
      dot: new naver.maps.Marker({ map: map, position: c, clickable: false, zIndex: 300,
        icon: { content: '<div style="width:16px;height:16px;border-radius:50%;background:#2563EB;border:3px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.35);box-sizing:border-box"></div>',
          anchor: new naver.maps.Point(8, 8) } })
    };
  } else {
    s.halo.setCenter(c); s.halo.setRadius(r); s.dot.setPosition(c);
  }
})(); true;`
}
