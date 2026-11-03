/**
 * 지도 페이지(map.html)의 길찾기 경로선·출발/도착 표시를 브랜드 남색으로 다시 칠하는 스크립트(11-03, 운영진: 메인 컬러만).
 * 배포된 map.html 은 파랑 선·초록/빨강 표시로 그려서, showRoute·selectRouteAlternative 를 보낸 뒤 이걸 넣는다
 * (map.html 을 새로 배포하지 않아도 된다. 소스 map.html 도 같은 색으로 고쳐 두었다).
 *
 * - 고른 경로: 남색 실선, 다른 경로: 옅은 남색 점선
 * - 출발: 흰 바탕에 남색 테두리 '출발', 도착: 남색 바탕 흰 글씨 '도착'
 */
const NAVY = '#05014A'
const NAVY_FAINT = '#9A9CC4'

function marker(label: string, filled: boolean): string {
  const background = filled ? NAVY : '#FFFFFF'
  const text = filled ? '#FFFFFF' : NAVY
  const border = filled ? '#FFFFFF' : NAVY
  return `<div style="width:34px;height:34px;border-radius:50%;background:${background};border:2.5px solid ${border};box-shadow:0 2px 8px rgba(5,1,74,0.35);display:flex;align-items:center;justify-content:center;box-sizing:border-box"><span style="color:${text};font-size:10px;font-weight:700;font-family:-apple-system,sans-serif">${label}</span></div>`
}

export function routeStyleScript(selectedIndex: number): string {
  return `(function () {
  if (!window.naver || typeof routePolylines === 'undefined') return;
  routePolylines.forEach(function (poly, i) {
    var on = i === ${selectedIndex};
    poly.setOptions({ strokeColor: on ? '${NAVY}' : '${NAVY_FAINT}', strokeWeight: on ? 6 : 3, strokeOpacity: on ? 0.92 : 0.6,
      strokeStyle: on ? 'solid' : 'shortdash', zIndex: on ? 200 : 100 });
  });
  var icon = function (html) { return { content: html, size: new naver.maps.Size(34, 34), anchor: new naver.maps.Point(17, 17) }; };
  if (typeof fromOverlay !== 'undefined' && fromOverlay) fromOverlay.setIcon(icon(${JSON.stringify(marker('출발', false))}));
  if (typeof toOverlay !== 'undefined' && toOverlay) toOverlay.setIcon(icon(${JSON.stringify(marker('도착', true))}));
})(); true;`
}
