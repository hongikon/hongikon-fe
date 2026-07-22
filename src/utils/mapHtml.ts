import {
  CAMPUS_CENTER,
  DEFAULT_ZOOM,
  MARKER_CLICK_GUARD_MS,
  PARTNER_DOT_SIZE_PX,
  PARTNER_DOT_SIZE_SELECTED_PX,
  PARTNER_HIT_AREA_PX,
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
    // 점 크기는 미터가 아니라 화면 픽셀(${PARTNER_DOT_SIZE_PX}px)로 고정한다.
    // 줌을 당기든 밀든 같은 크기로 보여야 하기 때문이다.
    // 점만으로는 손가락으로 누르기 어려워, 터치 판정은 투명한 ${PARTNER_HIT_AREA_PX}px 영역과
    // 옆에 붙는 상호명 라벨이 받는다.
    function partnerLabelHTML(partner, selected) {
      var hit = ${PARTNER_HIT_AREA_PX};
      var dot = selected ? ${PARTNER_DOT_SIZE_SELECTED_PX} : ${PARTNER_DOT_SIZE_PX};
      var labelBg = selected ? partner.color : 'rgba(255,255,255,0.96)';
      var labelColor = selected ? '#ffffff' : '#111111';
      var labelWeight = selected ? 700 : 600;

      // 흰 테두리를 border 가 아니라 box-shadow 로 둘러, 점의 색 면적을 깎지 않는다.
      var dotEl = '<div style="position:absolute;left:50%;top:50%;width:' + dot + 'px;height:' + dot
        + 'px;margin-left:' + (-dot / 2) + 'px;margin-top:' + (-dot / 2)
        + 'px;border-radius:50%;background:' + partner.color
        + ';box-shadow:0 0 0 1.5px #fff, 0 1px 3px rgba(0,0,0,0.3);"></div>';

      var label = '<div style="position:absolute;left:' + (hit / 2 + dot / 2 + 5)
        + 'px;top:50%;transform:translateY(-50%);white-space:nowrap;background:' + labelBg
        + ';color:' + labelColor + ';border-radius:5px;padding:2px 6px;font-size:10.5px;font-weight:'
        + labelWeight + ';box-shadow:0 1px 3px rgba(0,0,0,0.2);">' + escapeHTML(partner.name) + '</div>';

      return '<div style="position:relative;width:' + hit + 'px;height:' + hit + 'px;">' + dotEl + label + '</div>';
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
      var hit = ${PARTNER_HIT_AREA_PX};

      currentPartners.forEach(function(partner) {
        var selected = partner.id === selectedPartnerId;
        var position = new naver.maps.LatLng(partner.lat, partner.lng);

        var marker = new naver.maps.Marker({
          position: position,
          map: map,
          zIndex: selected ? 200 : 100,
          icon: {
            content: partnerLabelHTML(partner, selected),
            size: new naver.maps.Size(hit, hit),
            anchor: new naver.maps.Point(hit / 2, hit / 2),
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
