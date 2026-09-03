import {
  BUILDING_PIN_WIDTH_PX,
  BUILDING_PIN_WIDTH_SELECTED_PX,
  CAMPUS_CENTER,
  DEFAULT_ZOOM,
  MARKER_CLICK_GUARD_MS,
  PARTNER_BADGE_SIZE_PX,
  PARTNER_BADGE_SIZE_SELECTED_PX,
} from '../constants/map'
import {
  REPORT_LONG_PRESS_MOVE_TOLERANCE_PX,
  REPORT_LONG_PRESS_MS,
} from '../constants/report'
import { COLORS } from '../constants/colors'
import type { Building } from '../types'
import { ENTRANCE_CHECK_DATA } from '../debug/entranceCheckData'
import { PATH_EDGES, PATH_WAYPOINTS } from '../constants/pathNodes'

const NAVER_MAP_CLIENT_ID = process.env.EXPO_PUBLIC_NAVER_MAP_CLIENT_ID ?? ''

/**
 * WebView 에 넣을 지도 문서를 만든다.
 *
 * 건물에는 마커를 그리지 않는다. 네이버 지도 배경 타일에 이미 건물 라벨이
 * 그려져 있어, 탭 좌표에서 가장 가까운 등록 건물을 찾는 방식으로 대신한다.
 * 제휴 업체는 배경에 없으므로 직접 마커를 그린다.
 *
 * `entranceDebugMode` - 임시 출입구 좌표 검증용 오버레이. `src/screens/TempEntranceDebugScreen.tsx`
 * (웹 전용 `/temp/dots`, `/temp/path` 경로)에서만 켠다 - 일반 지도 화면(MapScreen)에는 안 보인다.
 * `'dots'` 는 지점·연결선·실내 경로를 전부 그리고, `'paths'` 는 지점 마커 없이 실내 경로
 * 선만 그려 경로 모양만 따로 눈으로 확인할 수 있게 한다. `'nodes'` 는 실외 보행
 * 경로망(`pathNodes.ts`의 PATH_WAYPOINTS/PATH_EDGES)을 실제 지도 위에 그린다 -
 * 연결된 성분은 파랑, 아직 본망에 못 붙은 성분(56-60)은 주황으로 구분한다.
 * buildings.ts/pathNodes.ts 에 실 데이터가 반영되면 이 매개변수와
 * `src/debug/entranceCheckData.ts`, 아래 관련 블록을 통째로 지운다.
 */
export function buildMapHTML(
  buildings: readonly Building[],
  entranceDebugMode: 'off' | 'dots' | 'paths' | 'nodes' = 'off',
): string {
  const buildingJSON = JSON.stringify(
    buildings.map((building) => ({
      name: building.name,
      lat: building.lat,
      lng: building.lng,
      // 건물별 색(`building.color`)은 넘기지 않는다. 핀을 메인 컬러 하나로
      // 통일해서, 알록달록한 제휴·편의시설 마커와 성격이 다르다는 것을 보인다.
      //
      // 외곽선. 있으면 탭 판정을 중심 반경이 아니라 이 폴리곤 안쪽인지로 한다.
      // 건물은 원이 아니라서, 중심 반경만으로는 길쭉한 건물의 끝을 놓친다.
      boundary: building.boundary ?? null,
      // 떨어져 있는 나머지 덩어리들. 이것도 같은 건물로 친다.
      extraBoundaries: building.extraBoundaries ?? null,
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
    /**
     * 네이버가 인증 실패를 알리는 유일한 창구다.
     * maps.js 는 키가 틀려도, 아예 없어도 200 으로 내려오므로 이 콜백이 없으면
     * 지도가 빈 화면으로 남고 원인을 알 방법이 없다.
     * Map 을 만들기 전에 정의해야 호출된다. (post 는 함수 선언이라 호이스팅된다)
     */
    window.navermap_authFailure = function () {
      post({ type: 'mapAuthFailure' });
    };

    var container = document.getElementById('map');
    var map = new naver.maps.Map(container, {
      center: new naver.maps.LatLng(${CAMPUS_CENTER.lat}, ${CAMPUS_CENTER.lng}),
      zoom: ${DEFAULT_ZOOM},
    });

    // ── 임시: 출입구 좌표 검증용 디버그 오버레이 ─────────────────────
    // buildings.ts/pathNodes.ts 에 실 데이터로 반영되면 이 블록과
    // src/debug/entranceCheckData.ts 를 통째로 지운다.
    ${
      entranceDebugMode === 'dots'
        ? `(function () {
      var DATA = ${JSON.stringify(ENTRANCE_CHECK_DATA)};
      var infowindow = new naver.maps.InfoWindow({ anchorSkew: true });
      var byId = {};
      DATA.points.forEach(function(p) {
        var size = p.flag ? 16 : 12;
        var border = p.flag ? '2.5px solid #dc2626' : '1px solid #111827';
        var marker = new naver.maps.Marker({
          position: new naver.maps.LatLng(p.lat, p.lng),
          map: map,
          zIndex: 90,
          icon: {
            content: '<div style="width:' + size + 'px;height:' + size + 'px;border-radius:50%;background:' + p.color + ';border:' + border + ';box-shadow:0 1px 3px rgba(0,0,0,0.4);"></div>',
            anchor: new naver.maps.Point(size / 2, size / 2),
          },
        });
        byId[p.id] = { p: p, marker: marker };
        var resolveLine = p.resolveNote ? ('<div style="color:#b91c1c">' + p.resolveNote + '</div>') : '';
        var flagLine = p.flag ? '<div style="color:#dc2626;font-weight:600">수정 필요할 수 있음</div>' : '';
        var html = '<div style="padding:8px;font-size:12px;max-width:260px;line-height:1.5;">' +
          '<b>' + p.label + (p.canonical ? (' (' + p.canonical + ')') : '') + '</b> \\u00b7 ' + p.floor + '<br>' +
          p.lat.toFixed(7) + ', ' + p.lng.toFixed(7) + '<br>' +
          resolveLine + flagLine +
          '<div style="margin-top:4px;color:#374151;white-space:pre-wrap">' + String(p.note).replace(/</g, '&lt;') + '</div>' +
          '</div>';
        naver.maps.Event.addListener(marker, 'click', function() {
          infowindow.setContent(html);
          infowindow.open(map, marker);
        });
      });
      DATA.connections.forEach(function(c) {
        var a = byId[c.from], b = byId[c.to];
        if (!a || !b) return;
        var style = { color: '#2563eb', dash: 'shortdash' };
        if (c.kind === 'inferred') style = { color: '#f59e0b', dash: 'shortdot' };
        if (c.kind === 'lounge') style = { color: '#a855f7', dash: 'shortdash' };
        if (c.kind === 'exterior') style = { color: '#6b7280', dash: 'shortdot' };
        new naver.maps.Polyline({
          map: map,
          path: [new naver.maps.LatLng(a.p.lat, a.p.lng), new naver.maps.LatLng(b.p.lat, b.p.lng)],
          strokeColor: style.color, strokeWeight: 3, strokeOpacity: 0.85, strokeStyle: style.dash,
        });
      });
      DATA.indoorPaths.forEach(function(ip) {
        var path = ip.points.map(function(c) { return new naver.maps.LatLng(c[0], c[1]); });
        new naver.maps.Polyline({ map: map, path: path, strokeColor: '#059669', strokeWeight: 3, strokeOpacity: 0.9 });
      });
    })();`
        : entranceDebugMode === 'paths'
        ? `(function () {
      var DATA = ${JSON.stringify(ENTRANCE_CHECK_DATA)};
      var infowindow = new naver.maps.InfoWindow({ anchorSkew: true });
      // 지점 마커 없이 실내 경로 선만 그린다 - 경로 모양만 따로 확인할 때 씀.
      DATA.indoorPaths.forEach(function(ip) {
        var path = ip.points.map(function(c) { return new naver.maps.LatLng(c[0], c[1]); });
        var poly = new naver.maps.Polyline({ map: map, path: path, strokeColor: '#059669', strokeWeight: 4, strokeOpacity: 0.9 });
        naver.maps.Event.addListener(poly, 'click', function(e) {
          infowindow.setContent('<div style="padding:8px;font-size:12px;">' + ip.label + '</div>');
          infowindow.open(map, e.coord);
        });
      });
    })();`
        : entranceDebugMode === 'nodes'
        ? `(function () {
      var WAYPOINTS = ${JSON.stringify(PATH_WAYPOINTS)};
      var EDGES = ${JSON.stringify(PATH_EDGES)};
      var BUILDING_ENTRANCES = ${JSON.stringify(
        buildings
          .filter((b) => b.entrances && b.entrances.length > 0)
          .map((b) => ({ name: b.name, entrances: b.entrances })),
      )};
      var infowindow = new naver.maps.InfoWindow({ anchorSkew: true });

      // 연결 성분 구분(합집합-찾기). 본망과, 아직 안 이어진 갈래(56-60)를 색으로 가른다.
      var parent = {};
      WAYPOINTS.forEach(function(w) { parent[w.id] = w.id; });
      function find(x) { while (parent[x] !== x) { parent[x] = parent[parent[x]]; x = parent[x]; } return x; }
      function union(a, b) { var ra = find(a), rb = find(b); if (ra !== rb) parent[ra] = rb; }
      EDGES.forEach(function(e) { union(e[0], e[1]); });

      var degree = {};
      WAYPOINTS.forEach(function(w) { degree[w.id] = 0; });
      EDGES.forEach(function(e) { degree[e[0]]++; degree[e[1]]++; });

      var byId = {};
      WAYPOINTS.forEach(function(w) { byId[w.id] = w; });

      var mainRoot = find(WAYPOINTS[0].id);
      var bounds = { swLat: Infinity, swLng: Infinity, neLat: -Infinity, neLng: -Infinity };

      WAYPOINTS.forEach(function(w) {
        bounds.swLat = Math.min(bounds.swLat, w.lat);
        bounds.swLng = Math.min(bounds.swLng, w.lng);
        bounds.neLat = Math.max(bounds.neLat, w.lat);
        bounds.neLng = Math.max(bounds.neLng, w.lng);
      });

      EDGES.forEach(function(e) {
        var a = byId[e[0]], b = byId[e[1]];
        if (!a || !b) return;
        var isMain = find(e[0]) === mainRoot;
        new naver.maps.Polyline({
          map: map,
          path: [new naver.maps.LatLng(a.lat, a.lng), new naver.maps.LatLng(b.lat, b.lng)],
          strokeColor: isMain ? '#1d4ed8' : '#d97706',
          strokeWeight: 3,
          strokeOpacity: 0.85,
          strokeStyle: isMain ? 'solid' : 'shortdash',
        });
      });

      WAYPOINTS.forEach(function(w) {
        var isMain = find(w.id) === mainRoot;
        var deg = degree[w.id];
        var color = isMain ? '#1d4ed8' : '#d97706';
        var size = deg >= 4 ? 14 : deg === 1 ? 11 : 8;
        var fill = deg === 1 ? '#fff' : color;
        var idLabel = w.id.replace('n', '');
        var marker = new naver.maps.Marker({
          position: new naver.maps.LatLng(w.lat, w.lng),
          map: map,
          zIndex: deg >= 4 ? 95 : 90,
          icon: {
            content: '<div style="position:relative;width:' + size + 'px;height:' + size + 'px;">'
              + '<div style="width:' + size + 'px;height:' + size + 'px;border-radius:50%;background:' + fill
              + ';border:2px solid ' + color + ';box-shadow:0 1px 3px rgba(0,0,0,0.4);"></div>'
              + '<span style="position:absolute;left:' + (size + 2) + 'px;top:-1px;font-size:10px;font-weight:700;'
              + 'color:#111827;background:rgba(255,255,255,0.85);padding:0 2px;border-radius:2px;white-space:nowrap;">'
              + idLabel + '</span></div>',
            anchor: new naver.maps.Point(size / 2, size / 2),
          },
        });
        naver.maps.Event.addListener(marker, 'click', function() {
          infowindow.setContent(
            '<div style="padding:8px;font-size:12px;line-height:1.5;">'
            + '<b>' + w.id + '</b> &middot; deg ' + deg + (isMain ? '' : ' &middot; <span style="color:#d97706">floating branch</span>') + '<br>'
            + w.lat.toFixed(7) + ', ' + w.lng.toFixed(7)
            + '</div>'
          );
          infowindow.open(map, marker);
        });
      });

      BUILDING_ENTRANCES.forEach(function(building) {
        building.entrances.forEach(function(entrance) {
          bounds.swLat = Math.min(bounds.swLat, entrance.lat);
          bounds.swLng = Math.min(bounds.swLng, entrance.lng);
          bounds.neLat = Math.max(bounds.neLat, entrance.lat);
          bounds.neLng = Math.max(bounds.neLng, entrance.lng);

          var marker = new naver.maps.Marker({
            position: new naver.maps.LatLng(entrance.lat, entrance.lng),
            map: map,
            zIndex: 96,
            icon: {
              content: '<div style="position:relative;width:11px;height:11px;">'
                + '<div style="width:11px;height:11px;background:#a21caf;border:2px solid #fff;'
                + 'box-shadow:0 1px 3px rgba(0,0,0,0.4);transform:rotate(45deg);"></div>'
                + '<span style="position:absolute;left:13px;top:-2px;font-size:9px;font-weight:700;'
                + 'color:#a21caf;background:rgba(255,255,255,0.9);padding:0 2px;border-radius:2px;white-space:nowrap;">'
                + entrance.label + '</span></div>',
              anchor: new naver.maps.Point(5.5, 5.5),
            },
          });
          naver.maps.Event.addListener(marker, 'click', function() {
            infowindow.setContent(
              '<div style="padding:8px;font-size:12px;line-height:1.5;">'
              + '<b>' + building.name + '</b><br>'
              + '<span style="color:#a21caf">' + entrance.label + '</span> 출입구<br>'
              + entrance.lat.toFixed(7) + ', ' + entrance.lng.toFixed(7)
              + '</div>'
            );
            infowindow.open(map, marker);
          });
        });
      });

      fitToBounds(bounds);
    })();`
        : ''
    }
    // ── 임시 블록 끝 ─────────────────────────────────────────────

    var buildings = ${buildingJSON};
    var routePolylines = [];
    var fromOverlay = null;
    var toOverlay = null;

    var partnerMarkers = [];
    var currentPartners = [];
    var selectedPartnerId = null;
    // 마커 클릭이 지도 클릭으로도 전달되는 경우가 있어, 직후의 배경 클릭을 무시한다.
    var lastMarkerClickAt = 0;

    var buildingMarkers = [];
    var selectedBuildingName = null;
    // 건물 버튼으로 27개를 모두 켰는지. 꺼져 있어도 건물을 탭하면 그 건물
    // 하나만 핀으로 뜬다. 탭했는데 아무 표시가 없으면 눌린 줄을 알 수 없다.
    var buildingsAllOn = false;

    var facilityMarkers = [];
    var reportMarkers = [];

    // 제보 작성용 롱프레스 상태. 누른 지점을 들고 있다가 시간이 차면 올려보낸다.
    var pressTimer = null;
    var pressStart = null;
    var lastLongPressAt = 0;

    // 제보 위치 선택 모드(지도를 움직여 화면 중앙에 고정된 지점을 고르는 방식).
    // 켜져 있는 동안은 건물·제휴·제보 탭과 롱프레스를 모두 무시해, 그 아래
    // 배너들이 선택 UI 위로 열리지 않게 한다.
    var pickerActive = false;

    function postPickerCenter() {
      var center = map.getCenter();
      var lat = center.lat();
      var lng = center.lng();
      var nearby = nearestBuilding(lat, lng);
      post({ type: 'pickerCenter', lat: lat, lng: lng, buildingName: nearby ? nearby.name : null });
    }

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
      if (pickerActive) return;
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

    // ── 제보 표시 ───────────────────────────────────────────
    // 지금 벌어지는 일이라 다른 마커보다 눈에 먼저 띄어야 한다. zIndex 를 가장
    // 높게 두고, 배지에 옅은 테두리 링을 둘러 '살아있는 정보'로 읽히게 한다.
    function reportLabelHTML(item) {
      var badge = 30;
      var badgeEl = '<div style="width:' + badge + 'px;height:' + badge + 'px;border-radius:50%;'
        + 'background:' + item.color + ';box-shadow:0 2px 6px rgba(0,0,0,0.3),0 0 0 3px rgba(255,255,255,0.95);'
        + 'pointer-events:auto;display:flex;align-items:center;justify-content:center;">'
        + '<svg viewBox="0 0 24 24" width="16" height="16" fill="#fff" style="display:block;">'
        + '<path d="M5 3h11l-1.6 3.4L16 9.8H7v10.9H5V3z"/></svg></div>';

      var nameEl = '<div style="margin-top:3px;white-space:nowrap;max-width:150px;overflow:hidden;'
        + 'text-overflow:ellipsis;font-family:' + PARTNER_FONT
        + ';font-size:11.5px;font-weight:700;color:#1f2937;letter-spacing:-0.2px;'
        + 'text-shadow:0 0 3px #fff,0 0 2px #fff,0 1px 1px rgba(255,255,255,0.9);">'
        + escapeHTML(item.label) + '</div>';

      return '<div style="display:flex;flex-direction:column;align-items:center;width:100%;pointer-events:none;">'
        + badgeEl + nameEl + '</div>';
    }

    function removeReportOverlays() {
      reportMarkers.forEach(function(marker) { marker.setMap(null); });
      reportMarkers = [];
    }

    function renderReports(items) {
      removeReportOverlays();
      var boxW = 160;
      var padTop = 3;
      var badge = 30;
      var boxH = padTop + badge + 3 + 18;

      items.forEach(function(item) {
        var marker = new naver.maps.Marker({
          position: new naver.maps.LatLng(item.lat, item.lng),
          map: map,
          zIndex: 300,
          icon: {
            content: '<div style="width:' + boxW + 'px;padding-top:' + padTop + 'px;pointer-events:none;">'
              + reportLabelHTML(item) + '</div>',
            size: new naver.maps.Size(boxW, boxH),
            anchor: new naver.maps.Point(boxW / 2, padTop + badge / 2),
          },
        });
        naver.maps.Event.addListener(marker, 'click', function() {
          if (pickerActive) return;
          lastMarkerClickAt = new Date().getTime();
          post({ type: 'reportTap', id: item.id });
        });
        reportMarkers.push(marker);
      });
    }

    // ── 편의시설 표시 ───────────────────────────────────────
    // 배지는 원형이다. 제휴(둥근 사각형)·건물(물방울)과 모양으로 구분된다.
    // 좌표는 건물 좌표를 그대로 쓰므로, 한 건물의 같은 종류는 네이티브 쪽
    // facilityMarkers() 가 이미 하나로 묶어 보낸다(핀이 겹치지 않게).
    var FACILITY_ICONS = {
      '프린터': partnerSVG('<path d="M7.5 3h9v3.6h-9z"/><path d="M5 8.2h14a2 2 0 0 1 2 2v5.2h-3.5v-2.6h-11v2.6H3v-5.2a2 2 0 0 1 2-2z"/><path d="M8.5 15.2h7V21h-7z"/>'),
      '정수기': partnerSVG('<path d="M12 2.4S5.6 9.9 5.6 14.1a6.4 6.4 0 0 0 12.8 0C18.4 9.9 12 2.4 12 2.4z"/>'),
      // 열람실: 펼친 책. 마주 본 두 페이지로 그려야 작은 크기에서도 책으로 읽힌다.
      '열람실': partnerSVG('<path d="M11.2 6.4C9.3 5 6.7 4.2 3.8 4.1v13.6c2.9.1 5.5.9 7.4 2.3V6.4z"/><path d="M12.8 6.4v13.6c1.9-1.4 4.5-2.2 7.4-2.3V4.1c-2.9.1-5.5.9-7.4 2.3z"/>'),
      // 스터디룸: 겹친 두 말풍선(토론). 개인 학습 위주인 열람실(펼친 책)과 갈린다.
      '스터디룸': partnerSVG('<path d="M3 4.5A1.5 1.5 0 0 1 4.5 3h9A1.5 1.5 0 0 1 15 4.5v6A1.5 1.5 0 0 1 13.5 12H9l-3.2 2.6V12H4.5A1.5 1.5 0 0 1 3 10.5v-6z"/><path d="M9 9.5A1.5 1.5 0 0 1 10.5 8h9A1.5 1.5 0 0 1 21 9.5v6a1.5 1.5 0 0 1-1.5 1.5H15l-3.2 2.6V17H10.5A1.5 1.5 0 0 1 9 15.5v-6z"/>'),
      '학생처': partnerSVG('<path d="M9.2 11.4a3.6 3.6 0 1 0 0-7.2 3.6 3.6 0 0 0 0 7.2zm0 1.7c-3.1 0-6.2 1.6-6.2 3.5V19.4h12.4v-2.8c0-1.9-3.1-3.5-6.2-3.5z"/><path d="M17.2 11.5a3 3 0 1 0 0-6 3 3 0 0 0 0 6zm.6 1.6c-.9 0-1.7.1-2.4.4 1.3.9 2 2 2 3.1v2.8h5.2v-2.7c0-1.8-2.4-3.2-4.8-3.6z"/>'),
      '카페': partnerSVG('<path d="M4 5h11v6a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5V5z"/><path d="M15 6h2.6a2.4 2.4 0 0 1 0 4.8H15V8.9h2.6a.3.3 0 0 0 0-.7H15V6z"/><rect x="3" y="18" width="13" height="1.9" rx="1"/>'),
      // 증명서 발급: 창구에서 받는 것이라 도장 찍힌 메달·리본으로 그린다.
      // 기기에서 뽑는 '프린터'와 한눈에 갈리는 모양이어야 한다.
      '증명서 발급': partnerSVG('<path fill-rule="evenodd" d="M12 1.6a5.6 5.6 0 1 0 0 11.2 5.6 5.6 0 0 0 0-11.2zm0 2.4 1.2 2.5 2.7.4-2 1.9.5 2.7L12 10.2 9.6 11.5l.5-2.7-2-1.9 2.7-.4L12 4z"/><path d="M8.1 14.1 6.2 22.4l5.8-2.8 5.8 2.8-1.9-8.3a7.6 7.6 0 0 1-7.8 0z"/>'),
      '식당': partnerSVG('<path d="M6.6 3h1.3v6h1V3h1.3v6h1V3h1.3v6a3 3 0 0 1-2 2.8V21H8.6v-9.2a3 3 0 0 1-2-2.8V3zM16.6 3c1.4 0 2.5 2.3 2.5 5.3 0 2.4-.9 3.7-1.9 4.1V21h-1.3V3z"/>'),
      // 편의점: 차양(위) + 문 자리를 뚫은(evenodd) 매대 박스로, 식당(그릇)과 한눈에 갈린다.
      '편의점': partnerSVG('<path d="M3 4h18v3H3z"/><path fill-rule="evenodd" d="M4 9h16v11a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V9zm6 4v7h4v-7h-4z"/>'),
      // 라운지: 등받이·팔걸이가 있는 소파. 휴식 공간임을 한눈에 알린다.
      '라운지': partnerSVG('<rect x="4" y="6" width="16" height="5" rx="1.5"/><rect x="3" y="11" width="18" height="5" rx="1"/><rect x="2" y="9" width="3" height="8" rx="1.5"/><rect x="19" y="9" width="3" height="8" rx="1.5"/><rect x="5" y="19" width="1.5" height="2"/><rect x="17.5" y="19" width="1.5" height="2"/>'),
      // 수면실: 헤드보드·베개가 있는 침대. 라운지(소파)와 한눈에 갈린다.
      '수면실': partnerSVG('<rect x="2" y="4" width="3" height="15" rx="1"/><rect x="2" y="14" width="20" height="3" rx="1"/><rect x="4" y="9" width="6" height="4" rx="1.5"/><rect x="2" y="19" width="2" height="2"/><rect x="20" y="19" width="2" height="2"/>'),
      // 행사·전시: 상설 전시 공간이라 액자로 그린다. 속을 비워(evenodd)
      // 배지 색이 비쳐 보이게 해, 꽉 찬 다른 글리프와 구분된다.
      '행사·전시': partnerSVG('<path fill-rule="evenodd" d="M2.6 3h18.8v13.4H2.6V3zm2 2v9.4h14.8V5H4.6z"/><path d="M11 17.4h2v3.1h-2z"/><path d="M6.4 20.4h11.2V22H6.4z"/>'),
      // 흡연구역: 연기가 피어오르는 담배. '금연' 기호와 헷갈리지 않도록 사선을 넣지 않는다.
      '흡연구역': partnerSVG('<rect x="2" y="10.3" width="13" height="3.4" rx="1"/><circle cx="16.7" cy="12" r="1.9"/><circle cx="18.6" cy="8.6" r="1.1"/><circle cx="20.1" cy="6" r="0.8"/><circle cx="21.2" cy="3.8" r="0.6"/>'),
      // 엘리베이터: 위·아래 화살표. 층간 이동 시설임을 나타낸다.
      '엘리베이터': partnerSVG('<path d="M12 2l4 5H8l4-5z"/><path d="M12 22l-4-5h8l-4 5z"/><rect x="10.7" y="8" width="2.6" height="8" rx="1"/>')
    };

    function facilityLabelHTML(marker) {
      var badge = ${PARTNER_BADGE_SIZE_PX};
      var glyph = Math.round(badge * 0.58);
      var iconSVG = FACILITY_ICONS[marker.kind] || PARTNER_ICONS['기타'];

      var badgeEl = '<div style="width:' + badge + 'px;height:' + badge + 'px;border-radius:50%;'
        + 'background:' + marker.color + ';box-shadow:0 1px 4px rgba(0,0,0,0.28),0 0 0 2px #fff;'
        + 'pointer-events:auto;display:flex;align-items:center;justify-content:center;">'
        + '<span style="width:' + glyph + 'px;height:' + glyph + 'px;display:block;">' + iconSVG + '</span></div>';

      var nameEl = '<div style="margin-top:3px;white-space:nowrap;font-family:' + PARTNER_FONT
        + ';font-size:11px;font-weight:600;color:#33363d;letter-spacing:-0.2px;'
        + 'text-shadow:0 0 3px #fff,0 0 2px #fff,0 1px 1px rgba(255,255,255,0.9);">'
        + escapeHTML(marker.label) + '</div>';

      return '<div style="display:flex;flex-direction:column;align-items:center;width:100%;pointer-events:none;">'
        + badgeEl + nameEl + '</div>';
    }

    function removeFacilityOverlays() {
      facilityMarkers.forEach(function(marker) { marker.setMap(null); });
      facilityMarkers = [];
    }

    function renderFacilities(markers) {
      removeFacilityOverlays();
      var boxW = 150;
      var padTop = 3;
      var badge = ${PARTNER_BADGE_SIZE_PX};
      var boxH = padTop + badge + 3 + 17;

      markers.forEach(function(item) {
        var marker = new naver.maps.Marker({
          position: new naver.maps.LatLng(item.lat, item.lng),
          map: map,
          zIndex: 150,
          icon: {
            content: '<div style="width:' + boxW + 'px;padding-top:' + padTop + 'px;pointer-events:none;">'
              + facilityLabelHTML(item) + '</div>',
            size: new naver.maps.Size(boxW, boxH),
            anchor: new naver.maps.Point(boxW / 2, padTop + badge / 2),
          },
        });
        naver.maps.Event.addListener(marker, 'click', function() {
          if (pickerActive) return;
          lastMarkerClickAt = new Date().getTime();
          // 편의시설 전용 배너는 아직 없다. 건물 배너를 대신 띄운다.
          post({ type: 'facilityTap', buildingName: item.buildingName });
        });
        facilityMarkers.push(marker);
      });
    }

    // ── 건물 표시 ───────────────────────────────────────────
    // 평소에는 그리지 않는다. 27개를 늘 띄워 두면 캠퍼스가 핀으로 덮여
    // 제휴 마커가 묻히기 때문에, 사용자가 건물 버튼을 눌렀을 때만 켠다.
    // 모양은 물방울 핀이다. 제휴(둥근 사각 배지)와 한눈에 구분되어야 한다.
    // 핀만 찍고 이름은 붙이지 않는다. 27개를 한꺼번에 켜면 캠퍼스 중앙부에서
    // 이름끼리, 또 네이버 기본 라벨과도 겹쳐 어느 것도 읽히지 않았다.
    // 건물 이름은 핀을 눌렀을 때 뜨는 배너에서 확인한다.
    var BUILDING_COLOR = '${COLORS.primary}';

    function buildingPinHTML(selected) {
      var w = selected ? ${BUILDING_PIN_WIDTH_SELECTED_PX} : ${BUILDING_PIN_WIDTH_PX};
      var h = Math.round(w * 1.32);

      // viewBox 24x32 물방울. 뾰족한 끝이 아래(y=32)라 좌표에 정확히 얹을 수 있다.
      var pin = '<svg viewBox="0 0 24 32" width="' + w + '" height="' + h + '" style="display:block;pointer-events:auto;'
        + 'filter:drop-shadow(0 1px 3px rgba(0,0,0,0.32));">'
        + '<path d="M12 1.2c-6 0-10.8 4.8-10.8 10.8 0 7.9 10.8 18.8 10.8 18.8S22.8 19.9 22.8 12C22.8 6 18 1.2 12 1.2z" '
        + 'fill="' + BUILDING_COLOR + '" stroke="#fff" stroke-width="2"/>'
        + '<circle cx="12" cy="11.8" r="4" fill="#fff"/></svg>';

      return '<div style="display:flex;justify-content:center;width:100%;pointer-events:none;">'
        + pin + '</div>';
    }

    function removeBuildingOverlays() {
      buildingMarkers.forEach(function(marker) { marker.setMap(null); });
      buildingMarkers = [];
    }

    /**
     * 그릴 건물 목록.
     * 버튼을 켰으면 27개 전부, 껐으면 탭한 건물 하나만. 아무것도 안 골랐으면 없음.
     */
    function buildingsToDraw() {
      if (buildingsAllOn) return buildings;
      if (selectedBuildingName === null) return [];
      return buildings.filter(function(b) { return b.name === selectedBuildingName; });
    }

    function renderBuildings() {
      removeBuildingOverlays();
      var boxW = 140;
      var padTop = 2;

      buildingsToDraw().forEach(function(building) {
        var selected = building.name === selectedBuildingName;

        // 건물은 핀 하나로만 표시한다. 외곽선(building.boundary)은 화면에
        // 그리지 않고 탭 판정에만 쓴다 — 건물 모양을 칠하면 지도가 무거워
        // 보이고, 배경 지도의 건물 윤곽과 겹쳐 오히려 읽기 어려웠다.
        var w = selected ? ${BUILDING_PIN_WIDTH_SELECTED_PX} : ${BUILDING_PIN_WIDTH_PX};
        var h = Math.round(w * 1.32);
        var boxH = padTop + h;

        var marker = new naver.maps.Marker({
          position: new naver.maps.LatLng(building.lat, building.lng),
          map: map,
          // 제휴 마커(100·200)보다 아래에 둔다. 건물은 배경, 제휴가 주인공이다.
          zIndex: selected ? 60 : 50,
          icon: {
            content: '<div style="width:' + boxW + 'px;padding-top:' + padTop + 'px;pointer-events:none;">'
              + buildingPinHTML(selected) + '</div>',
            size: new naver.maps.Size(boxW, boxH),
            // 핀의 뾰족한 끝이 건물 좌표에 오도록 잡는다.
            anchor: new naver.maps.Point(boxW / 2, padTop + h),
          },
        });
        naver.maps.Event.addListener(marker, 'click', function() {
          if (pickerActive) return;
          lastMarkerClickAt = new Date().getTime();
          selectedBuildingName = building.name;
          renderBuildings();
          post({ type: 'buildingTap', name: building.name });
        });
        buildingMarkers.push(marker);
      });
    }

    function fitToBounds(bounds) {
      if (!bounds) return;
      map.fitBounds(new naver.maps.LatLngBounds(
        new naver.maps.LatLng(bounds.swLat, bounds.swLng),
        new naver.maps.LatLng(bounds.neLat, bounds.neLng)
      ));
    }

    // 대안 경로 전부가 화면에 들어오도록, 모든 경로의 모든 점을 합쳐 범위를 잡는다.
    function boundsFromRoutes(routes) {
      var swLat = Infinity, swLng = Infinity, neLat = -Infinity, neLng = -Infinity;
      var found = false;
      routes.forEach(function(route) {
        route.points.forEach(function(p) {
          found = true;
          swLat = Math.min(swLat, p.lat);
          swLng = Math.min(swLng, p.lng);
          neLat = Math.max(neLat, p.lat);
          neLng = Math.max(neLng, p.lng);
        });
      });
      if (!found) return null;
      return { swLat: swLat, swLng: swLng, neLat: neLat, neLng: neLng };
    }

    function clearRouteOverlays() {
      routePolylines.forEach(function(p) { p.setMap(null); });
      routePolylines = [];
      if (fromOverlay) { fromOverlay.setMap(null); fromOverlay = null; }
      if (toOverlay) { toOverlay.setMap(null); toOverlay = null; }
    }

    // ── 지도 배경 탭 ────────────────────────────────────────
    // 네이버 지도 SDK는 배경 타일에 그려진 건물 라벨의 클릭을 알려주지 않는다.
    // 대신 탭 좌표에서 가장 가까운 등록 건물을 찾아 라벨을 누른 것처럼 처리한다.
    /**
     * 점이 폴리곤 안에 있는지(ray casting).
     * 건물 외곽선은 볼록하지 않은 ㄱ·ㄷ자 모양이 흔해서, 꼭짓점까지의 거리로는
     * 판정할 수 없다. 좌표는 [lat, lng] 순서다.
     */
    function isInsidePolygon(lat, lng, polygon) {
      var inside = false;
      for (var i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
        var yi = polygon[i][0], xi = polygon[i][1];
        var yj = polygon[j][0], xj = polygon[j][1];
        var intersects = ((yi > lat) !== (yj > lat))
          && (lng < (xj - xi) * (lat - yi) / (yj - yi) + xi);
        if (intersects) inside = !inside;
      }
      return inside;
    }

    // 건물이 떨어진 여러 덩어리로 되어 있으면 그중 아무 곳이나 안쪽이면 잡는다.
    function isInsideBuilding(lat, lng, b) {
      if (b.boundary && b.boundary.length > 2 && isInsidePolygon(lat, lng, b.boundary)) return true;
      if (!b.extraBoundaries) return false;
      for (var k = 0; k < b.extraBoundaries.length; k++) {
        var ring = b.extraBoundaries[k];
        if (ring && ring.length > 2 && isInsidePolygon(lat, lng, ring)) return true;
      }
      return false;
    }

    /**
     * 탭 좌표가 실제로 들어있는 건물. 27개 전부 외곽선이 있으므로 그 안쪽인
     * 경우에만 잡는다 — 근처를 눌렀다고 반경으로 스냅하지 않는다.
     */
    function buildingAt(lat, lng) {
      for (var i = 0; i < buildings.length; i++) {
        if (isInsideBuilding(lat, lng, buildings[i])) return buildings[i];
      }
      return null;
    }

    /**
     * 제보 롱프레스 전용. 건물 밖에서 벌어지는 일이 많아 좌표는 스냅하지
     * 않지만, 화면(작성창)에는 좌표 대신 항상 건물명을 보여주고 싶어서
     * 거리 제한 없이 가장 가까운 건물을 후보로 올려보낸다.
     */
    function nearestBuilding(lat, lng) {
      for (var i = 0; i < buildings.length; i++) {
        if (isInsideBuilding(lat, lng, buildings[i])) return buildings[i];
      }

      var nearest = null;
      var nearestDistance = Infinity;
      buildings.forEach(function(b) {
        var d = distanceMeters(lat, lng, b.lat, b.lng);
        if (d < nearestDistance) {
          nearestDistance = d;
          nearest = b;
        }
      });
      return nearest;
    }

    naver.maps.Event.addListener(map, 'click', function(e) {
      if (pickerActive) return;
      if (!e || !e.coord) return;
      if (new Date().getTime() - lastMarkerClickAt < ${MARKER_CLICK_GUARD_MS}) return;
      // 길게 눌러 제보 작성이 열린 직후의 click 은 그 손동작의 꼬리다.
      // 막지 않으면 작성창 뒤에서 건물 배너까지 함께 열린다.
      if (new Date().getTime() - lastLongPressAt < ${MARKER_CLICK_GUARD_MS}) return;

      if (selectedPartnerId !== null) {
        selectedPartnerId = null;
        renderPartners();
        post({ type: 'partnerDismiss' });
      }

      var lat = e.coord.lat();
      var lng = e.coord.lng();
      var hit = buildingAt(lat, lng);

      // 건물 외곽선 안쪽을 탭했을 때만 핀이 뜬다. 빈 곳을 탭했으면 거둔다.
      var nextName = hit ? hit.name : null;
      if (nextName !== selectedBuildingName) {
        selectedBuildingName = nextName;
        renderBuildings();
      }

      if (hit) {
        post({ type: 'buildingTap', name: hit.name });
      } else if (nextName === null && selectedBuildingName === null) {
        // 빈 곳을 눌렀으면 핀뿐 아니라 건물 배너도 닫는다.
        // 핀만 사라지고 배너가 남으면, 지도에 없는 건물 정보가 떠 있게 된다.
        post({ type: 'buildingDismiss' });
      }
    });

    // ── 제보 작성 롱프레스 ──────────────────────────────────
    // 지도를 길게 누르면 그 자리에 제보를 남길 수 있게 네이티브에 알린다.
    // 건물 탭과 달리 좌표를 건물로 스냅하지 않는다. 푸드트럭·부스처럼 건물
    // 밖에서 벌어지는 일이 많아, 누른 자리 자체가 정보이기 때문이다.
    // 근처 건물은 스냅이 아니라 후보로만 함께 올려보낸다.
    function cancelLongPress() {
      if (pressTimer) {
        clearTimeout(pressTimer);
        pressTimer = null;
      }
      pressStart = null;
    }

    naver.maps.Event.addListener(map, 'mousedown', function(e) {
      if (pickerActive) return;
      if (!e || !e.coord) return;
      cancelLongPress();
      pressStart = {
        x: e.point ? e.point.x : 0,
        y: e.point ? e.point.y : 0,
        lat: e.coord.lat(),
        lng: e.coord.lng(),
      };
      pressTimer = setTimeout(function() {
        pressTimer = null;
        var start = pressStart;
        pressStart = null;
        if (!start) return;
        lastLongPressAt = new Date().getTime();
        var nearby = nearestBuilding(start.lat, start.lng);
        post({
          type: 'reportLongPress',
          lat: start.lat,
          lng: start.lng,
          buildingName: nearby ? nearby.name : null,
        });
      }, ${REPORT_LONG_PRESS_MS});
    });

    // 지도를 끌어 옮기려던 동작이 제보 작성으로 오인되지 않게 한다.
    naver.maps.Event.addListener(map, 'mousemove', function(e) {
      if (!pressStart || !e || !e.point) return;
      var dx = e.point.x - pressStart.x;
      var dy = e.point.y - pressStart.y;
      if (Math.sqrt(dx * dx + dy * dy) > ${REPORT_LONG_PRESS_MOVE_TOLERANCE_PX}) {
        cancelLongPress();
      }
    });

    naver.maps.Event.addListener(map, 'mouseup', cancelLongPress);
    naver.maps.Event.addListener(map, 'dragstart', cancelLongPress);
    naver.maps.Event.addListener(map, 'zoom_changed', cancelLongPress);

    // 위치 선택 모드일 때만, 지도가 멈출 때마다(드래그·줌 끝) 화면 중앙 좌표를 올려보낸다.
    naver.maps.Event.addListener(map, 'idle', function() {
      if (pickerActive) postPickerCenter();
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

        if (msg.type === 'setReports') {
          renderReports(msg.markers || []);
        }

        if (msg.type === 'clearReports') {
          removeReportOverlays();
        }

        if (msg.type === 'setFacilities') {
          renderFacilities(msg.markers || []);
          fitToBounds(msg.bounds);
        }

        if (msg.type === 'clearFacilities') {
          removeFacilityOverlays();
        }

        if (msg.type === 'showBuildings') {
          buildingsAllOn = true;
          selectedBuildingName = msg.name === undefined ? null : msg.name;
          renderBuildings();
        }

        // 버튼을 꺼도 탭해서 고른 건물 하나는 남긴다. 배너가 떠 있는데
        // 핀만 사라지면 무엇을 보고 있는지 알 수 없다.
        if (msg.type === 'hideBuildings') {
          buildingsAllOn = false;
          renderBuildings();
        }

        // 배너를 닫는 등, 네이티브 쪽에서 건물 선택만 풀 때 쓴다.
        // 핀을 끄지는 않으므로 renderBuildings 로 강조만 되돌린다.
        if (msg.type === 'selectBuilding') {
          selectedBuildingName = msg.name === undefined ? null : msg.name;
          if (buildingMarkers.length > 0) renderBuildings();
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
          clearRouteOverlays();
          var routes = msg.routes || [];
          var selected = msg.selectedIndex || 0;

          routes.forEach(function(route, i) {
            var path = route.points.map(function(p) { return new naver.maps.LatLng(p.lat, p.lng); });
            routePolylines.push(new naver.maps.Polyline({
              map: map,
              path: path,
              strokeWeight: i === selected ? 5 : 3,
              strokeColor: i === selected ? '${COLORS.routeLine}' : '#9CA3AF',
              strokeOpacity: i === selected ? 0.9 : 0.55,
              strokeStyle: i === selected ? 'solid' : 'shortdash',
              zIndex: i === selected ? 200 : 100,
            }));
          });

          if (routes.length > 0) {
            var firstRoute = routes[0].points;
            var from = firstRoute[0];
            var to = firstRoute[firstRoute.length - 1];
            fromOverlay = new naver.maps.Marker({
              position: new naver.maps.LatLng(from.lat, from.lng),
              icon: {
                content: makeRouteMarkerHTML('#10B981', '출발'),
                size: new naver.maps.Size(32, 32),
                anchor: new naver.maps.Point(16, 16),
              },
              map: map,
            });
            toOverlay = new naver.maps.Marker({
              position: new naver.maps.LatLng(to.lat, to.lng),
              icon: {
                content: makeRouteMarkerHTML('#EF4444', '도착'),
                size: new naver.maps.Size(32, 32),
                anchor: new naver.maps.Point(16, 16),
              },
              map: map,
            });
          }

          fitToBounds(boundsFromRoutes(routes));
        }

        if (msg.type === 'selectRouteAlternative') {
          routePolylines.forEach(function(poly, i) {
            var isSelected = i === msg.index;
            poly.setOptions({
              strokeWeight: isSelected ? 5 : 3,
              strokeColor: isSelected ? '${COLORS.routeLine}' : '#9CA3AF',
              strokeOpacity: isSelected ? 0.9 : 0.55,
              strokeStyle: isSelected ? 'solid' : 'shortdash',
              zIndex: isSelected ? 200 : 100,
            });
          });
        }

        if (msg.type === 'clearRoute') {
          clearRouteOverlays();
          map.setCenter(new naver.maps.LatLng(${CAMPUS_CENTER.lat}, ${CAMPUS_CENTER.lng}));
          map.setZoom(${DEFAULT_ZOOM});
        }

        if (msg.type === 'startLocationPicker') {
          cancelLongPress();
          pickerActive = true;
          postPickerCenter();
        }

        if (msg.type === 'stopLocationPicker') {
          pickerActive = false;
        }
      } catch(e) {}
    }

    document.addEventListener('message', function(e) { handleNativeMessage(e.data); });
    window.addEventListener('message', function(e) { handleNativeMessage(e.data); });
  </script>
</body>
</html>`
}
