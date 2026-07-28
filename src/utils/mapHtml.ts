import {
  CAMPUS_CENTER,
  DEFAULT_ZOOM,
  MARKER_CLICK_GUARD_MS,
  PARTNER_BADGE_SIZE_PX,
  PARTNER_BADGE_SIZE_SELECTED_PX,
  TAP_RADIUS_METERS,
} from '../constants/map'
import type { Building } from '../types'

const NAVER_MAP_CLIENT_ID = process.env.EXPO_PUBLIC_NAVER_MAP_CLIENT_ID ?? ''

/**
 * WebView 에 넣을 지도 문서를 만든다.
 *
 * 건물에는 마커를 그리지 않는다. 네이버 지도 배경 타일에 이미 건물 라벨이
 * 그려져 있어, 탭 좌표에서 가장 가까운 등록 건물을 찾는 방식으로 대신한다.
 * 제휴 업체는 배경에 없으므로 직접 마커를 그린다.
 */
export function buildMapHTML(buildings: readonly Building[]): string {
  const buildingJSON = JSON.stringify(
    buildings.map((building) => ({
      name: building.name,
      lat: building.lat,
      lng: building.lng,
    })),
  )

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no">
  <style>
    * { margin:0; padding:0; box-sizing:border-box; }
    html, body, #map { width:100%; height:100%; }
  </style>
</head>
<body>
  <div id="map"></div>
  <script type="text/javascript" src="https://oapi.map.naver.com/openapi/v3/maps.js?ncpKeyId=${NAVER_MAP_CLIENT_ID}"></script>
  <script>
    var container = document.getElementById('map');
    var map = new naver.maps.Map(container, {
      center: new naver.maps.LatLng(${CAMPUS_CENTER.lat}, ${CAMPUS_CENTER.lng}),
      zoom: ${DEFAULT_ZOOM},
    });

    var buildings = ${buildingJSON};
    var routePolyline = null;
    var fromOverlay = null;
    var toOverlay = null;

    var partnerMarkers = [];
    var currentPartners = [];
    var selectedPartnerId = null;
    // 마커 클릭이 지도 클릭으로도 전달되는 경우가 있어, 직후의 배경 클릭을 무시한다.
    var lastMarkerClickAt = 0;

    function escapeHTML(value) {
      return String(value).replace(/[&<>"']/g, function(ch) {
        if (ch === '&') return '&amp;';
        if (ch === '<') return '&lt;';
        if (ch === '>') return '&gt;';
        if (ch === '"') return '&quot;';
        return '&#39;';
      });
    }

    function post(msg) {
      if (window.ReactNativeWebView) {
        window.ReactNativeWebView.postMessage(JSON.stringify(msg));
      }
    }

    function makeRouteMarkerHTML(color, label) {
      return '<div style="width:32px;height:32px;border-radius:50%;background:' + color + ';border:2.5px solid #fff;box-shadow:0 2px 8px rgba(0,0,0,0.3);display:flex;align-items:center;justify-content:center;"><span style="color:#fff;font-size:9px;font-weight:700;">' + label + '</span></div>';
    }

    function distanceMeters(lat1, lng1, lat2, lng2) {
      var R = 6371000;
      var rad = Math.PI / 180;
      var dLat = (lat2 - lat1) * rad;
      var dLng = (lng2 - lng1) * rad;
      var a = Math.pow(Math.sin(dLat / 2), 2)
        + Math.cos(lat1 * rad) * Math.cos(lat2 * rad) * Math.pow(Math.sin(dLng / 2), 2);
      return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    }

    // ── 제휴 업체 표시 ──────────────────────────────────────
    // 네이버 기본 지도 라벨처럼 [아이콘 배지] 위 + [상호명] 아래로 쌓는다.
    // 배지 크기는 미터가 아니라 화면 픽셀(${PARTNER_BADGE_SIZE_PX}px)로 고정한다.
    // 줌을 당기든 밀든 같은 크기로 보여야 하기 때문이다.
    // 아이콘은 WebView 안에서 아이콘 폰트를 못 쓰므로 인라인 SVG 로 그린다(이모지 미사용).
    var PARTNER_FONT = "'Pretendard','Apple SD Gothic Neo',-apple-system,'Malgun Gothic',sans-serif";

    function partnerSVG(inner) {
      return '<svg viewBox="0 0 24 24" width="100%" height="100%" fill="#fff" style="display:block;">' + inner + '</svg>';
    }

    // 업종별 흰색 글리프. 색 배경 배지 위에 얹는다.
    var PARTNER_ICONS = {
      '카페': partnerSVG('<path d="M4 5h11v6a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5V5z"/><path d="M15 6h2.6a2.4 2.4 0 0 1 0 4.8H15V8.9h2.6a.3.3 0 0 0 0-.7H15V6z"/><rect x="3" y="18" width="13" height="1.9" rx="1"/>'),
      '주점': partnerSVG('<path d="M7 3h10l-1.2 6.2A4 4 0 0 1 12.9 12v6H16v1.9H8V18h3.1v-6A4 4 0 0 1 8.2 9.2L7 3z"/>'),
      '음식': partnerSVG('<path d="M6.6 3h1.3v6h1V3h1.3v6h1V3h1.3v6a3 3 0 0 1-2 2.8V21H8.6v-9.2a3 3 0 0 1-2-2.8V3zM16.6 3c1.4 0 2.5 2.3 2.5 5.3 0 2.4-.9 3.7-1.9 4.1V21h-1.3V3z"/>'),
      '의료/미용': partnerSVG('<path fill-rule="evenodd" d="M9.64 7.64c.23-.5.36-1.05.36-1.64 0-2.21-1.79-4-4-4S2 3.79 2 6s1.79 4 4 4c.59 0 1.14-.13 1.64-.36L10 12l-2.36 2.36C7.14 14.13 6.59 14 6 14c-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4c0-.59-.13-1.14-.36-1.64L12 14l7 7h3v-1L9.64 7.64zM6 8c-1.1 0-2-.89-2-2s.9-2 2-2 2 .89 2 2-.9 2-2 2zm0 12c-1.1 0-2-.89-2-2s.9-2 2-2 2 .89 2 2-.9 2-2 2zm6-7.5c-.28 0-.5-.22-.5-.5s.22-.5.5-.5.5.22.5.5-.22.5-.5.5zM19 3l-6 6 2 2 7-7V3z"/>'),
      '문화': partnerSVG('<path fill-rule="evenodd" d="M22 10V6c0-1.1-.9-2-2-2H4c-1.1 0-1.99.9-1.99 2v4c1.1 0 1.99.9 1.99 2s-.89 2-2 2v4c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2v-4c-1.1 0-2-.9-2-2s.9-2 2-2zM13 17.5h-2v-2h2v2zm0-4.5h-2v-2h2v2zm0-4.5h-2v-2h2v2z"/>'),
      '기타': partnerSVG('<path fill-rule="evenodd" d="M12.7 3H20v7.3l-9 9L3.7 12l9-9zM16.4 6.2a1.6 1.6 0 1 0 0 3.2 1.6 1.6 0 0 0 0-3.2z"/>'),
      '교육': partnerSVG('<path d="M12 4L2 8.5l10 4.4 8-3.5V15h2V8.5z"/><path d="M6 12.2V16c0 1.6 2.7 2.9 6 2.9s6-1.3 6-2.9v-3.8l-6 2.6-6-2.6z"/>'),
      // 병원: 카테고리가 아니라 partner.mapIcon 으로 개별 지정한다(의료/미용 중 검진센터).
      // 초록 배지 + 흰 십자(녹십자)라는 보편 기호. 배지 색은 PARTNER_MAP_ICON_COLOR 에서 온다.
      '병원': partnerSVG('<path d="M13.7 4h-3.4a1 1 0 0 0-1 1v4.3H5a1 1 0 0 0-1 1v3.4a1 1 0 0 0 1 1h4.3V19a1 1 0 0 0 1 1h3.4a1 1 0 0 0 1-1v-4.3H19a1 1 0 0 0 1-1v-3.4a1 1 0 0 0-1-1h-4.3V5a1 1 0 0 0-1-1z"/>')
    };

    function partnerLabelHTML(partner, selected) {
      var badge = selected ? ${PARTNER_BADGE_SIZE_SELECTED_PX} : ${PARTNER_BADGE_SIZE_PX};
      var glyph = Math.round(badge * 0.6);
      var nameSize = selected ? 12 : 11;
      var nameColor = selected ? partner.color : '#33363d';
      var nameWeight = selected ? 700 : 600;
      var iconSVG = PARTNER_ICONS[partner.iconKey] || PARTNER_ICONS['기타'];

      // 배지만 탭 대상으로 둔다(pointer-events:auto). 이름·바깥 박스는 아래에서 none.
      var badgeEl = '<div style="width:' + badge + 'px;height:' + badge + 'px;border-radius:'
        + Math.round(badge * 0.32) + 'px;background:' + partner.color
        + ';box-shadow:0 1px 4px rgba(0,0,0,0.28),0 0 0 2px #fff;pointer-events:auto;'
        + 'display:flex;align-items:center;justify-content:center;">'
        + '<span style="width:' + glyph + 'px;height:' + glyph + 'px;display:block;">' + iconSVG + '</span></div>';

      // 상호명은 알약 배경 없이 흰 후광(text-shadow)만 둘러 지도 위에서 읽히게 한다.
      var nameEl = '<div style="margin-top:3px;white-space:nowrap;font-family:' + PARTNER_FONT
        + ';font-size:' + nameSize + 'px;font-weight:' + nameWeight + ';color:' + nameColor
        + ';letter-spacing:-0.2px;text-shadow:0 0 3px #fff,0 0 2px #fff,0 1px 1px rgba(255,255,255,0.9);">'
        + escapeHTML(partner.name) + '</div>';

      return '<div style="display:flex;flex-direction:column;align-items:center;width:100%;pointer-events:none;">'
        + badgeEl + nameEl + '</div>';
    }

    function removePartnerOverlays() {
      partnerMarkers.forEach(function(marker) { marker.setMap(null); });
      partnerMarkers = [];
    }

    function selectPartner(id) {
      lastMarkerClickAt = new Date().getTime();
      selectedPartnerId = id;
      renderPartners();
      post({ type: 'partnerTap', id: id });
    }

    function renderPartners() {
      removePartnerOverlays();
      // 상호명이 길어도 가운데 정렬이 유지되도록 넉넉한 고정 너비를 두고,
      // 좌표에는 배지의 중심이 오도록 앵커를 잡는다.
      var boxW = 140;
      var padTop = 3;
      var gap = 3;

      currentPartners.forEach(function(partner) {
        var selected = partner.id === selectedPartnerId;
        var badge = selected ? ${PARTNER_BADGE_SIZE_SELECTED_PX} : ${PARTNER_BADGE_SIZE_PX};
        var nameLine = (selected ? 12 : 11) + 6;
        var boxH = padTop + badge + gap + nameLine;
        var position = new naver.maps.LatLng(partner.lat, partner.lng);

        var marker = new naver.maps.Marker({
          position: position,
          map: map,
          zIndex: selected ? 200 : 100,
          icon: {
            content: '<div style="width:' + boxW + 'px;padding-top:' + padTop + 'px;pointer-events:none;">'
              + partnerLabelHTML(partner, selected) + '</div>',
            size: new naver.maps.Size(boxW, boxH),
            anchor: new naver.maps.Point(boxW / 2, padTop + badge / 2),
          },
        });
        naver.maps.Event.addListener(marker, 'click', function() {
          selectPartner(partner.id);
        });
        partnerMarkers.push(marker);
      });
    }

    function fitToBounds(bounds) {
      if (!bounds) return;
      map.fitBounds(new naver.maps.LatLngBounds(
        new naver.maps.LatLng(bounds.swLat, bounds.swLng),
        new naver.maps.LatLng(bounds.neLat, bounds.neLng)
      ));
    }

    // ── 지도 배경 탭 ────────────────────────────────────────
    // 네이버 지도 SDK는 배경 타일에 그려진 건물 라벨의 클릭을 알려주지 않는다.
    // 대신 탭 좌표에서 가장 가까운 등록 건물을 찾아 라벨을 누른 것처럼 처리한다.
    naver.maps.Event.addListener(map, 'click', function(e) {
      if (!e || !e.coord) return;
      if (new Date().getTime() - lastMarkerClickAt < ${MARKER_CLICK_GUARD_MS}) return;

      if (selectedPartnerId !== null) {
        selectedPartnerId = null;
        renderPartners();
        post({ type: 'partnerDismiss' });
      }

      var lat = e.coord.lat();
      var lng = e.coord.lng();
      var nearest = null;
      var nearestDistance = Infinity;
      buildings.forEach(function(b) {
        var d = distanceMeters(lat, lng, b.lat, b.lng);
        if (d < nearestDistance) {
          nearestDistance = d;
          nearest = b;
        }
      });
      if (nearest && nearestDistance <= ${TAP_RADIUS_METERS}) {
        post({ type: 'buildingTap', name: nearest.name });
      }
    });

    function handleNativeMessage(data) {
      try {
        var msg = JSON.parse(data);

        if (msg.type === 'setPartners') {
          currentPartners = msg.partners || [];
          selectedPartnerId = null;
          renderPartners();
          fitToBounds(msg.bounds);
        }

        if (msg.type === 'clearPartners') {
          currentPartners = [];
          selectedPartnerId = null;
          removePartnerOverlays();
          map.setCenter(new naver.maps.LatLng(${CAMPUS_CENTER.lat}, ${CAMPUS_CENTER.lng}));
          map.setZoom(${DEFAULT_ZOOM});
        }

        if (msg.type === 'selectPartner') {
          selectedPartnerId = msg.id === undefined ? null : msg.id;
          renderPartners();
        }

        // 검색 결과를 고른 경우. 한 업체를 화면 가운데로 가져온다.
        // setPartners 의 bounds 는 캠퍼스를 항상 포함해 한 곳으로 좁혀지지 않는다.
        if (msg.type === 'focusPartner') {
          selectedPartnerId = msg.id;
          renderPartners();
          var focused = currentPartners.filter(function(p) { return p.id === msg.id; })[0];
          if (focused) {
            map.setCenter(new naver.maps.LatLng(focused.lat, focused.lng));
            map.setZoom(msg.zoom || 18);
          }
        }

        if (msg.type === 'showRoute') {
          if (routePolyline) routePolyline.setMap(null);
          if (fromOverlay) fromOverlay.setMap(null);
          if (toOverlay) toOverlay.setMap(null);
          var from = new naver.maps.LatLng(msg.fromLat, msg.fromLng);
          var to = new naver.maps.LatLng(msg.toLat, msg.toLng);
          routePolyline = new naver.maps.Polyline({
            map: map,
            path: [from, to],
            strokeWeight: 4,
            strokeColor: '#3B82F6',
            strokeOpacity: 0.88,
            strokeStyle: 'dash',
          });
          fromOverlay = new naver.maps.Marker({
            position: from,
            icon: {
              content: makeRouteMarkerHTML('#10B981', '출발'),
              size: new naver.maps.Size(32, 32),
              anchor: new naver.maps.Point(16, 16),
            },
            map: map,
          });
          toOverlay = new naver.maps.Marker({
            position: to,
            icon: {
              content: makeRouteMarkerHTML('#EF4444', '도착'),
              size: new naver.maps.Size(32, 32),
              anchor: new naver.maps.Point(16, 16),
            },
            map: map,
          });
          fitToBounds({
            swLat: Math.min(msg.fromLat, msg.toLat),
            swLng: Math.min(msg.fromLng, msg.toLng),
            neLat: Math.max(msg.fromLat, msg.toLat),
            neLng: Math.max(msg.fromLng, msg.toLng),
          });
        }

        if (msg.type === 'clearRoute') {
          if (routePolyline) { routePolyline.setMap(null); routePolyline = null; }
          if (fromOverlay) { fromOverlay.setMap(null); fromOverlay = null; }
          if (toOverlay) { toOverlay.setMap(null); toOverlay = null; }
          map.setCenter(new naver.maps.LatLng(${CAMPUS_CENTER.lat}, ${CAMPUS_CENTER.lng}));
          map.setZoom(${DEFAULT_ZOOM});
        }
      } catch(e) {}
    }

    document.addEventListener('message', function(e) { handleNativeMessage(e.data); });
    window.addEventListener('message', function(e) { handleNativeMessage(e.data); });
  </script>
</body>
</html>`
}
