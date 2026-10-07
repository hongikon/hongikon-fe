import {
  BUILDING_PIN_WIDTH_PX,
  BUILDING_PIN_WIDTH_SELECTED_PX,
  CAMPUS_CENTER,
  DEFAULT_ZOOM,
  FOCUS_ZOOM,
  MARKER_CLICK_GUARD_MS,
  PARTNER_BADGE_SIZE_PX,
  PARTNER_BADGE_SIZE_SELECTED_PX,
  PARTNER_OVERLAP_CYCLE_PX,
} from '../constants/map'
import {
  REPORT_LONG_PRESS_MOVE_TOLERANCE_PX,
  REPORT_LONG_PRESS_MS,
} from '../constants/report'
import { COLORS } from '../constants/colors'
import { REPORT_PIN_CATEGORY_ICONS, REPORT_PIN_MEGAPHONE } from '../constants/reportPinIcons'
import type { Building } from '../types'
import { ENTRANCE_CHECK_DATA } from '../debug/entranceCheckData'
import { PATH_EDGES, PATH_WAYPOINTS } from '../constants/pathNodes'
import { TEMP_ENTRANCE_NODES } from '../debug/tempEntranceNodes'

const NAVER_MAP_CLIENT_ID = process.env.EXPO_PUBLIC_NAVER_MAP_CLIENT_ID ?? ''

/**
 * 정보 제보(제휴) 핀의 "○○관 근처" 표시 거리 상한(건물 중심 기준). 제휴 업체는 대개 캠퍼스 밖이라
 * 이보다 멀면 건물명을 붙이지 않는다.
 */
const PARTNER_LABEL_MAX_METERS = 80
/**
 * 제보 위치를 건물로 묶는 거리 상한(건물 중심 기준). 제보는 서버가 건물·층 단위로만 받아 건물이 꼭 필요하다.
 * 운동장·광장처럼 건물 사이 빈 곳의 행사도 많아 제휴보다 넉넉히 두되, 캠퍼스 밖까지 엉뚱한 건물로
 * 묶이지는 않게 한다. 넘으면 작성창이 "건물 가까이로 옮겨 주세요"를 안내한다.
 */
const REPORT_BUILDING_MAX_METERS = 200

/**
 * 지도 페이지가 쓰는 건물 필드만 고른다. HTML 에 굽는 초기 데이터와 `setBuildings` 메시지가 같은 모양을 쓴다.
 */
export function mapBuildingPayload(buildings: readonly Building[]) {
  return buildings.map((building) => ({
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
  }))
}

/**
 * <script> 안에 그대로 넣을 JSON. 건물 데이터가 이제 서버에서 오므로, 문자열 안의 `</script>` 가
 * 스크립트를 끊지 못하게 `<` 를 이스케이프한다(JSON 값은 그대로다).
 */
function scriptSafeJSON(value: unknown): string {
  return JSON.stringify(value).replace(/</g, '\\u003c').replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029')
}

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
 * 건물 데이터(서버)·pathNodes.ts 에 실 데이터가 반영되면 이 매개변수와
 * `src/debug/entranceCheckData.ts`, 아래 관련 블록을 통째로 지운다.
 */
export function buildMapHTML(
  buildings: readonly Building[],
  entranceDebugMode: 'off' | 'dots' | 'paths' | 'nodes' = 'off',
): string {
  const buildingJSON = scriptSafeJSON(mapBuildingPayload(buildings))

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
      scaleControl: true,
    });

    // ── 임시: 출입구 좌표 검증용 디버그 오버레이 ─────────────────────
    // 건물 데이터(서버)·pathNodes.ts 에 실 데이터로 반영되면 이 블록과
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

      // 임시 노드(src/debug/tempEntranceNodes.ts): 기존 출입구 라벨의 새 후보 좌표.
      // 초록 네모로 찍고, 같은 라벨의 기존 출입구(보라 마름모)까지 점선을 그어 차이를 본다.
      // 실내 전용 문은 속이 빈 네모. sameAs 가 있으면 가리키는 임시 노드 자리에 찍는다.
      var TEMP_NODES = ${JSON.stringify(TEMP_ENTRANCE_NODES)};
      var tempByKey = {};
      TEMP_NODES.forEach(function(t) { tempByKey[t.buildingName + '#' + t.label] = t; });
      TEMP_NODES.forEach(function(t) {
        var anchorNode = t.sameAs ? tempByKey[t.buildingName + '#' + t.sameAs] : null;
        var lat = anchorNode ? anchorNode.lat : t.lat;
        var lng = anchorNode ? anchorNode.lng : t.lng;
        bounds.swLat = Math.min(bounds.swLat, lat);
        bounds.swLng = Math.min(bounds.swLng, lng);
        bounds.neLat = Math.max(bounds.neLat, lat);
        bounds.neLng = Math.max(bounds.neLng, lng);

        var existing = null;
        BUILDING_ENTRANCES.forEach(function(b) {
          if (b.name !== t.buildingName) return;
          b.entrances.forEach(function(e) { if (e.label === t.label) existing = e; });
        });
        if (existing) {
          new naver.maps.Polyline({
            map: map,
            path: [new naver.maps.LatLng(existing.lat, existing.lng), new naver.maps.LatLng(lat, lng)],
            strokeColor: '#16a34a', strokeWeight: 2, strokeOpacity: 0.8, strokeStyle: 'shortdot',
          });
        }

        var fill = t.indoorOnly ? '#fff' : '#16a34a';
        var marker = new naver.maps.Marker({
          position: new naver.maps.LatLng(lat, lng),
          map: map,
          zIndex: 97,
          icon: {
            content: '<div style="position:relative;width:11px;height:11px;">'
              + '<div style="width:11px;height:11px;background:' + fill + ';border:2px solid #16a34a;'
              + 'box-shadow:0 1px 3px rgba(0,0,0,0.4);"></div>'
              + '<span style="position:absolute;left:13px;top:-2px;font-size:9px;font-weight:700;'
              + 'color:#16a34a;background:rgba(255,255,255,0.9);padding:0 2px;border-radius:2px;white-space:nowrap;">'
              + 'TEMP ' + t.label + '</span></div>',
            anchor: new naver.maps.Point(5.5, 5.5),
          },
        });
        naver.maps.Event.addListener(marker, 'click', function() {
          infowindow.setContent(
            '<div style="padding:8px;font-size:12px;line-height:1.5;">'
            + '<b>' + t.buildingName + '</b> &middot; <span style="color:#16a34a">임시 노드</span><br>'
            + t.label + (t.indoorOnly ? ' (실내 전용 문)' : '') + '<br>'
            + '받은 좌표 ' + t.lat.toFixed(7) + ', ' + t.lng.toFixed(7) + ' / 3번째 값 ' + t.raw3 + '<br>'
            + (t.sameAs ? ('지도 표시는 ' + t.sameAs + ' 위경도와 동일<br>') : '')
            + (existing ? ('기존 좌표 ' + existing.lat.toFixed(7) + ', ' + existing.lng.toFixed(7) + '<br>') : '')
            + (t.note ? ('<span style="color:#374151">' + t.note + '</span>') : '')
            + '</div>'
          );
          infowindow.open(map, marker);
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
    // 앱에서 제휴·편의시설·제보 시트가 열려 있는지(앱이 'sheetOpen' 으로 알려 준다). 건물 탭을 '시트 닫기'로만 쓸지 정한다.
    var otherSheetOpen = false;
    // 마커 클릭이 지도 클릭으로도 전달되는 경우가 있어, 직후의 배경 클릭을 무시한다.
    var lastMarkerClickAt = 0;

    // 하나를 눌러 볼 때(건물·제휴·편의시설·제보·검색) 항상 같은 배율로 그 자리를 가운데에 둔다.
    // 누른 지점으로 카메라를 부드럽게 옮긴다(예전엔 setCenter·setZoom 으로 한 번에 순간이동해 화면이 확 바뀌었다).
    // 네이버 지도 웹 API 는 확대 단계 변경을 애니메이션하지 않고 이동(panTo)만 부드럽게 움직인다. 그래서
    // 1) 지금 확대 단계 그대로 지점까지 미끄러지듯 이동하고 2) 도착한 다음 정해 둔 확대 단계(FOCUS_ZOOM, 검색·알림은 넘겨받은 값)까지
    // 한 단계씩 잠깐 간격을 두고 들어간다. 지점은 아래에서 올라오는 시트에 가리지 않게 화면 가운데보다 조금 위(13%)에 둔다.
    var focusToken = 0;
    function centerFor(point, zoom) {
      try {
        var proj = map.getProjection();
        var world = proj.fromCoordToPoint(point);
        var dy = (map.getSize().height * 0.13) / Math.pow(2, zoom);
        return proj.fromPointToCoord(new naver.maps.Point(world.x, world.y + dy));
      } catch (e) {
        return point;
      }
    }
    // 이동이 끝나길 기다리는 'idle' 리스너. 다음 focusOn·취소 때 떼어 낸다.
    // 이미 그 자리에 있으면 panTo 가 움직이지 않아 idle 이 안 나고, 남은 리스너가 나중의 엉뚱한 idle(칩 맞춤·휠 축소)에
    // 불려 옛 지점으로 19배 확대해 버렸다(10-07 점검).
    var focusIdleListener = null;
    function clearFocusIdle() {
      if (focusIdleListener) { naver.maps.Event.removeListener(focusIdleListener); focusIdleListener = null; }
    }
    // 진행 중인 '눌러 보기' 이동·확대를 멈춘다. 지도를 끌거나 휠·두 손가락으로 확대할 때, 그리고 앱이 카메라를 직접 옮길 때
    // (칩 맞춤 fitToBounds, 경로 닫기, 학사모 돌아가기) 부른다. 안 부르면 늦게 끝난 확대가 새 카메라를 덮어 옛 핀으로 되돌아갔다.
    // 학사모 버튼은 페이지 전역을 직접 만지는 스크립트라 window.cancelFocus 로 부른다(옛 map.html 에는 없어 확인하고 부른다).
    function cancelFocus() {
      focusToken++;
      clearFocusIdle();
      stopZoomAnim();
    }
    function focusOn(lat, lng, zoom) {
      cancelFocus();
      var token = focusToken;
      var target = typeof zoom === 'number' ? zoom : ${FOCUS_ZOOM};
      var point = new naver.maps.LatLng(lat, lng);
      var center = centerFor(point, target);
      var stepIn = function() {
        if (token !== focusToken) return;
        var z = map.getZoom();
        if (Math.round(z) === target) return;
        map.setZoom(z < target ? z + 1 : z - 1);
        map.setCenter(center);
        setTimeout(stepIn, 110);
      };
      var arrived = false;
      var arrive = function() {
        if (arrived || token !== focusToken) return;
        arrived = true;
        clearFocusIdle();
        if (!smoothZoom(target, center, point, token)) setTimeout(stepIn, 60);
      };
      var panTarget = centerFor(point, map.getZoom());
      var samePlace = false;
      try {
        var proj = map.getProjection();
        var a = proj.fromCoordToOffset(panTarget);
        var c = proj.fromCoordToOffset(map.getCenter());
        samePlace = Math.abs(a.x - c.x) < 1 && Math.abs(a.y - c.y) < 1;
      } catch (e) {}
      // 이미 그 자리면 옮길 것이 없으니 바로 확대 단계로 넘어간다.
      if (samePlace) { setTimeout(arrive, 0); return; }
      focusIdleListener = naver.maps.Event.addListener(map, 'idle', arrive);
      // 경계(maxBounds)에 막혀 거의 안 움직이는 등 idle 이 안 오는 경우에도 확대는 이어 간다.
      setTimeout(arrive, 900);
      map.panTo(panTarget, { duration: 420, easing: 'easeOutCubic' });
    }
    // 확대를 부드럽게 보이게 하는 흉내: 지도 타일 층만 CSS 로 목표 배율까지 0.34초 동안 키운 뒤, 끝에 실제 확대 단계로 바꾼다.
    // 그동안 마커·이름표 층은 잠깐 흐려졌다 돌아온다(타일만 커지는 동안 마커가 제자리에 남아 어긋나 보이지 않게).
    // 타일 층을 못 찾으면 false 를 돌려 한 단계씩 들어가는 방식으로 대신한다.
    function tileLayer() {
      var el = map.getElement();
      var imgs = Array.prototype.filter.call(el.querySelectorAll('img'), function(img) {
        return img.width >= 128 && img.height >= 128;
      });
      if (imgs.length === 0) return null;
      var node = imgs[0].parentElement;
      while (node && node !== el) {
        var all = true;
        for (var i = 0; i < imgs.length; i++) { if (!node.contains(imgs[i])) { all = false; break; } }
        if (all) return node;
        node = node.parentElement;
      }
      return null;
    }
    // 가장 최근에 시작한 확대 흉내 번호. 앞선 것이 늦게 끝나며 마커 층을 다시 켜서 새 확대 도중에 마커가 어긋나 보이지 않게 한다.
    var zoomAnimSeq = 0;
    // 지금 키우고 있는 타일 층을 바로 원래대로 돌리는 함수(없으면 null). 도중에 다른 곳을 누르거나 지도를 끌면 부른다.
    // 키운 층에 transition 이 걸린 채 네이버가 새 위치를 쓰면, 웹킷에선 8배 화면이 엉뚱한 곳으로 미끄러지며 0.2초쯤 보였다(10-07 시뮬레이터 점검).
    var stopZoomAnimFn = null;
    function stopZoomAnim() {
      var fn = stopZoomAnimFn;
      stopZoomAnimFn = null;
      if (fn) fn();
    }
    function smoothZoom(target, center, point, token) {
      var z = map.getZoom();
      if (Math.round(z) === target) return true;
      var layer = tileLayer();
      if (!layer || !layer.style || typeof layer.getBoundingClientRect !== 'function') return false;
      var panes = map.getPanes ? map.getPanes() : {};
      var overlays = [panes.overlayLayer, panes.overlayImage, panes.floatPane].filter(Boolean);
      // 확대 기준점 = 화면에서 핀이 있는 자리. fromCoordToOffset 의 원점은 지도를 끌 때마다 바뀌는 층 기준이라
      // 그 값을 그대로 쓰면 기준점이 핀에서 어긋나 핀이 가운데에 머물지 않고 옆으로 밀려나며 커졌다(10-07).
      // 지도 가운데와의 차이만 쓰면 원점과 상관없이 화면 위치가 나온다.
      var proj = map.getProjection();
      var pOff = proj.fromCoordToOffset(point);
      var cOff = proj.fromCoordToOffset(map.getCenter());
      var size = map.getSize();
      var sx = size.width / 2 + (pOff.x - cOff.x);
      var sy = size.height / 2 + (pOff.y - cOff.y);
      var lr = layer.getBoundingClientRect();
      var lrBefore = lr;
      var cr = map.getElement().getBoundingClientRect();
      var ox = sx - (lr.left - cr.left);
      var oy = sy - (lr.top - cr.top);
      var scale = Math.pow(2, target - z);
      var DURATION = 340;
      var animId = ++zoomAnimSeq;
      // 휠·손가락으로 확대 단계를 바꾼 뒤에는 옛 단계 타일 층이 남아 있어 위 tileLayer() 가 그 둘을 함께 품은 상위 층을 고른다.
      // Safari(웹킷)에서 네이버 지도는 이 층을 transform: matrix(...) 로 옮겨 지도 위치를 잡는데, 그 값을 scale 로 덮었다가
      // 끝에 '' 로 지워 버려 핀이 화면 위로 밀려나고 아래쪽 타일이 비었다(10-07 영상). 네이버가 써 둔 값 뒤에 배율만 덧붙이고,
      // 실제 확대 단계로 바꾸기 전에 원래 값으로 되돌려 네이버가 새로 쓰는 위치가 남게 한다.
      var base = { transform: layer.style.transform, origin: layer.style.transformOrigin, transition: layer.style.transition };
      layer.style.transformOrigin = ox + 'px ' + oy + 'px';
      layer.style.transition = 'transform ' + DURATION + 'ms cubic-bezier(0.22, 0.61, 0.36, 1)';
      // 손가락으로 확대한 뒤에는 마커 층까지 위 타일 층 안에 들어 있어 함께 커진다. 그때 흐리게 사라지게 두면 핀이 몇 배로
      // 부풀었다 사라져 보여(10-07 앱 웹킷 점검) 그 경우엔 바로 감춘다.
      overlays.forEach(function(o) {
        o.style.transition = layer.contains(o) ? 'none' : 'opacity 120ms ease-out';
        o.style.opacity = '0';
      });
      // 다음 프레임에 배율을 바꿔야 transition 이 걸린다.
      // 넣은 값을 읽어 둔다. 끝날 때 값이 그대로면 원래 값으로 돌리고, 그사이 끌기 등으로 네이버가 새 위치를 써 뒀으면 그 값을 남긴다.
      var applied = null;
      var restored = false;
      var restore = function() {
        if (restored) return;
        restored = true;
        layer.style.transition = 'none';
        if (layer.style.transform === applied) layer.style.transform = base.transform;
        layer.style.transformOrigin = base.origin;
        void layer.offsetWidth; // 되돌린 배율이 애니메이션 없이 바로 먹게 한 번 계산시킨 뒤 transition 을 돌려놓는다.
        layer.style.transition = base.transition;
      };
      stopZoomAnimFn = function() {
        restore();
        if (animId === zoomAnimSeq) overlays.forEach(function(o) { o.style.transition = 'none'; o.style.opacity = '1'; });
      };
      requestAnimationFrame(function() {
        if (restored) return;
        layer.style.transform = (base.transform ? base.transform + ' ' : '') + 'scale(' + scale + ')';
        applied = layer.style.transform;
      });
      setTimeout(function() {
        // 도중에 지도를 끌었거나 다른 곳을 눌렀으면(focusToken 이 바뀜) 확대는 하지 않으니 복사본도 덮지 않는다.
        // 예전엔 이때도 키워 둔 화면 복사본을 덮어, 끈 지도 위에 옛 확대 화면이 1초쯤 멈춰 보였다(10-07 앱 웹킷 점검).
        var stale = token !== focusToken || restored;
        if (!stale) stopZoomAnimFn = null;
        // 실제 확대 단계로 바꾸면 새 타일을 받는 동안 지도가 잠깐 하얗게 비었다(10-07). 키워 둔 화면을 복사해 위에 덮어 두고,
        // 새 타일이 다 그려지면(tilesloaded, 늦어도 0.9초) 복사본을 흐리게 걷어 낸다.
        var host = map.getElement();
        var ghost = null;
        if (!stale) try {
          var cr2 = host.getBoundingClientRect();
          ghost = document.createElement('div');
          // 복사본은 지도 층들 '아래'(z-index -1)에 깐다. 새 타일이 그려지는 자리부터 그 위를 덮고, 핀·마커도 복사본에 가리지 않는다.
          // 예전엔 맨 위에 덮고 0.9초 뒤 무조건 걷어 내, 타일이 늦거나 실패하면 회색 빈 지도만 남았다(10-07 사용자 화면).
          host.style.isolation = 'isolate';
          ghost.style.cssText = 'position:absolute;left:0;top:0;right:0;bottom:0;overflow:hidden;pointer-events:none;z-index:-1;';
          ghost.setAttribute('data-zoom-ghost', '1');
          var copy = layer.cloneNode(true);
          copy.style.position = 'absolute';
          copy.style.transition = 'none';
          // 네이버가 옮겨 둔 만큼(base.transform)은 아래 left·top(lrBefore)에 이미 들어 있으니 복사본엔 배율만 남긴다.
          copy.style.transform = 'scale(' + scale + ')';
          // 복사본은 같은 transform(배율·기준점)을 그대로 가져가므로, 키우기 전 상자 자리에 두면 지금 보이는 화면과 겹친다.
          copy.style.left = (lrBefore.left - cr2.left) + 'px';
          copy.style.top = (lrBefore.top - cr2.top) + 'px';
          ghost.appendChild(copy);
          host.appendChild(ghost);
        } catch (e) { ghost = null; }
        // 확대 단계를 바꾸기 전에 되돌린다. 바꾼 뒤에 지우면 그사이 네이버가 새로 써 둔 위치까지 지워진다.
        restore();
        if (!stale) {
          map.setZoom(target);
          map.setCenter(center);
        }
        var shown = false;
        var showOverlays = function() {
          if (shown) return;
          shown = true;
          if (animId === zoomAnimSeq) {
            overlays.forEach(function(o) { o.style.transition = 'opacity 180ms ease-in'; o.style.opacity = '1'; });
          }
        };
        var removeGhost = function(fade) {
          if (!ghost) return;
          var g = ghost;
          ghost = null;
          if (!fade) { if (g.parentNode) g.parentNode.removeChild(g); return; }
          g.style.transition = 'opacity 200ms ease-out';
          g.style.opacity = '0';
          setTimeout(function() { if (g.parentNode) g.parentNode.removeChild(g); }, 220);
        };
        if (stale) { showOverlays(); return; }
        // 마커 층은 전처럼 타일이 다 오거나 늦어도 0.9초면 돌려놓는다.
        naver.maps.Event.once(map, 'tilesloaded', function() { setTimeout(showOverlays, 30); });
        setTimeout(showOverlays, 900);
        // 복사본은 새 타일이 화면 표본 지점을 모두 덮은 뒤에야 걷는다(늦어도 30초). 그사이 새 타일은 복사본 위로 그려지고,
        // 실패한 칸은 scheduleTileCheck 가 다시 받게 한다. 그 전에 카메라가 어떤 길로든 움직이면 복사본은 옛 화면이니 바로 걷는다.
        var startedAt = new Date().getTime();
        var moveListeners = [];
        var finish = function(fade) {
          moveListeners.forEach(function(l) { naver.maps.Event.removeListener(l); });
          moveListeners = [];
          removeGhost(fade);
          if (stopZoomAnimFn === cancelGhost) stopZoomAnimFn = null;
        };
        var check = function() {
          if (!ghost) return true;
          var full = tileCoverage() >= 1;
          if (!full && new Date().getTime() - startedAt < 30000) return false;
          finish(true);
          return true;
        };
        var loop = function() { if (!check()) setTimeout(loop, 150); };
        // 도중에 지도를 끌거나 다른 곳을 누르면 복사본(옛 자리 화면)은 바로 걷는다.
        var cancelGhost = function() { finish(false); showOverlays(); };
        if (ghost) {
          stopZoomAnimFn = cancelGhost;
          naver.maps.Event.once(map, 'tilesloaded', function() { setTimeout(check, 30); });
          setTimeout(function() {
            if (!ghost) return;
            moveListeners = [
              naver.maps.Event.addListener(map, 'zoom_changed', cancelGhost),
              naver.maps.Event.addListener(map, 'center_changed', cancelGhost),
              naver.maps.Event.addListener(map, 'size_changed', cancelGhost),
            ];
          }, 60);
          setTimeout(loop, 300);
        }
      }, DURATION + 20);
      return true;
    }

    // 화면이 실제로 그려진 타일로 덮였는지(0~1). 지도 위 4×4 표본 지점마다 그 아래에 다 받은 타일 그림이 있는지 본다.
    // 네이버는 타일을 못 받으면 그 자리에 투명한 1px 그림(dot.gif)을 넣으니 크기(naturalWidth)로 거른다.
    function tileCoverage() {
      var el = map.getElement();
      var r = el.getBoundingClientRect();
      var left = Math.max(r.left, 0), top = Math.max(r.top, 0);
      var right = Math.min(r.right, window.innerWidth), bottom = Math.min(r.bottom, window.innerHeight);
      if (right - left < 10 || bottom - top < 10 || typeof document.elementsFromPoint !== 'function') return 1;
      var hit = 0, n = 0;
      for (var i = 1; i <= 4; i++) {
        for (var j = 1; j <= 4; j++) {
          n++;
          var els = document.elementsFromPoint(left + (right - left) * i / 5, top + (bottom - top) * j / 5);
          for (var k = 0; k < els.length; k++) {
            var e = els[k];
            if (e.tagName === 'IMG' && e.complete && e.naturalWidth >= 64 && el.contains(e)) { hit++; break; }
          }
        }
      }
      return hit / n;
    }
    // 지도 안 타일 그림 상태. failed: 받기에 실패해 투명 1px 그림으로 바뀐 칸, pending: 아직 받는 중인 칸.
    function tileState() {
      var imgs = map.getElement().querySelectorAll('img');
      var failed = 0, pending = 0;
      for (var i = 0; i < imgs.length; i++) {
        var img = imgs[i];
        if (img.width < 128 || img.height < 128) continue;
        if (img.closest && img.closest('[data-zoom-ghost]')) continue;
        if (!img.complete) pending++;
        else if (img.naturalWidth < 64) failed++;
      }
      return { failed: failed, pending: pending };
    }
    // 네이버는 한 번 실패한 타일을 다시 받지 않아, 망이 잠깐 끊기면 회색 빈 칸이 계속 남았다(10-07 사용자 화면).
    // 타일 받기가 끝났는데(tilesloaded·idle 뒤) 실패한 칸이 있으면 map.refresh() 로 다시 받게 한다. 간격을 2.5초씩 늘려
    // 15초까지 벌리고, 실패한 칸이 남아 있는 동안 계속 해 본다(망이 돌아오면 저절로 채워지게).
    // 아직 받는 중인 칸만 있으면(느린 망) 다시 받게 하지 않는다 — 처음부터 다시 받느라 더 늦어진다.
    var tileRetryTimer = null;
    var tileRetryCount = 0;
    var tileRetryLastAt = 0;
    function scheduleTileCheck(delay) {
      if (tileRetryTimer) clearTimeout(tileRetryTimer);
      // 다시 받은 뒤 곧바로 오는 tilesloaded·idle 이 간격을 줄여 연달아 다시 받지 않게, 정해 둔 간격은 지킨다.
      if (tileRetryCount > 0) {
        var wait = Math.min(2500 * tileRetryCount, 15000) - (new Date().getTime() - tileRetryLastAt);
        if (wait > delay) delay = wait;
      }
      tileRetryTimer = setTimeout(function() {
        tileRetryTimer = null;
        var stt = tileState();
        if (stt.failed === 0) { if (stt.pending === 0) tileRetryCount = 0; return; }
        if (typeof map.refresh !== 'function') return;
        if (document.hidden) { scheduleTileCheck(5000); return; }
        tileRetryCount++;
        tileRetryLastAt = new Date().getTime();
        map.refresh();
        scheduleTileCheck(0);
      }, delay);
    }
    naver.maps.Event.addListener(map, 'tilesloaded', function() { scheduleTileCheck(500); });
    // 카메라가 다른 자리에서 멈추면 다시 4번까지 해 볼 수 있다(오래 끊겼다 돌아온 뒤에도 다시 받게).
    var tileRetryAt = '';
    naver.maps.Event.addListener(map, 'idle', function() {
      var c = map.getCenter();
      var at = map.getZoom() + ':' + c.lat().toFixed(6) + ':' + c.lng().toFixed(6);
      if (at !== tileRetryAt) { tileRetryAt = at; tileRetryCount = 0; }
      scheduleTileCheck(3000);
    });
    window.addEventListener('online', function() { tileRetryCount = 0; scheduleTileCheck(300); });

    // 사용자가 지도를 끌기 시작하거나 휠·두 손가락으로 확대·축소하면 남은 '들어가기'를 멈춘다.
    // 휠·핀치는 dragstart 가 안 나서, 예전엔 늦게 끝난 확대가 사용자가 고른 배율을 19로 되돌렸다.
    naver.maps.Event.addListener(map, 'dragstart', cancelFocus);
    (function(el) {
      var opts = { capture: true, passive: true };
      el.addEventListener('wheel', cancelFocus, opts);
      el.addEventListener('touchstart', function(e) { if (e.touches && e.touches.length > 1) cancelFocus(); }, opts);
      el.addEventListener('gesturestart', cancelFocus, opts); // iOS 웹킷 핀치
    })(map.getElement());
    // 화면에서 겹친 마커를 같은 자리 반복 탭으로 순회하기 위한 상태.
    // key: 겹친 업체 id들을 정렬해 이어붙인 값(겹친 조합이 바뀌었는지 판별용).
    // order: 그 조합의 고정 순서(currentPartners 순서). index: 지금 몇 번째인지.
    // selectPartner() 참고.
    var overlapCycle = { key: null, order: [], index: 0 };

    // 마커 아이콘 상자(이름표까지 담은 150px 안팎)는 pointer-events:none 인데, 네이버가 그 바깥에 씌우는 감싸개 div 는
    // 상자 크기 그대로 탭을 받았다. 핀이 가까이 모이면 보이는 배지를 눌러도 옆 마커의 빈 감싸개가 탭을 가로채 아무 일도
    // 안 일어났다(제휴 경영대학 15단계에서 17개 중 13개가 안 눌림, 10-07). 감싸개도 탭을 통과시키고 배지(pointer-events:auto)만
    // 받게 한다 — 배지에서 시작한 클릭은 감싸개로 그대로 올라가(버블링) 네이버의 click 은 계속 온다.
    function tapOnlyBadge(marker) {
      var apply = function() {
        var el = marker.getElement && marker.getElement();
        if (el && el.style) el.style.pointerEvents = 'none';
        return !!el;
      };
      if (!apply()) requestAnimationFrame(apply);
    }

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
    // 무엇 때문에 고르는지('report' | 'partner'). 근처 건물을 얼마나 멀리까지 찾을지가 다르다.
    var pickerPurpose = 'report';

    function postPickerCenter() {
      var center = map.getCenter();
      var lat = center.lat();
      var lng = center.lng();
      var nearby = nearestBuilding(
        lat,
        lng,
        pickerPurpose === 'partner' ? ${PARTNER_LABEL_MAX_METERS} : ${REPORT_BUILDING_MAX_METERS}
      );
      post({ type: 'pickerCenter', lat: lat, lng: lng, buildingName: nearby ? nearby.name : null });
    }

    // 마커 HTML 의 style 속성에 들어가는 색. 문자열을 그대로 이어 붙이면 따옴표로 속성을 끊고 태그를
    // 넣을 수 있어, #rgb / #rrggbb / #rrggbbaa 형식만 통과시킨다.
    function safeColor(value, fallback) {
      return typeof value === 'string' && /^#[0-9a-fA-F]{3,8}$/.test(value) ? value : (fallback || '#888888');
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
      var nameColor = selected ? safeColor(partner.color) : '#33363d';
      var nameWeight = selected ? 700 : 600;
      var iconSVG = PARTNER_ICONS[partner.iconKey] || PARTNER_ICONS['기타'];

      // 배지만 탭 대상으로 둔다(pointer-events:auto). 이름·바깥 박스는 아래에서 none.
      var badgeEl = '<div style="width:' + badge + 'px;height:' + badge + 'px;border-radius:'
        + Math.round(badge * 0.32) + 'px;background:' + safeColor(partner.color)
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
      partnerMarkerById = {};
    }

    // 업체 id → { marker, partner }. 선택이 바뀔 때 전체(약 120개)를 다시 만들지 않고 바뀐 두 개만 고친다.
    var partnerMarkerById = {};
    // 상호명이 길어도 가운데 정렬이 유지되도록 넉넉한 고정 너비를 두고, 좌표에는 배지의 중심이 오도록 앵커를 잡는다.
    var PARTNER_BOX_W = 140;
    var PARTNER_PAD_TOP = 3;
    var PARTNER_GAP = 3;

    function partnerIcon(partner, selected) {
      var badge = selected ? ${PARTNER_BADGE_SIZE_SELECTED_PX} : ${PARTNER_BADGE_SIZE_PX};
      var nameLine = (selected ? 12 : 11) + 6;
      var boxH = PARTNER_PAD_TOP + badge + PARTNER_GAP + nameLine;
      return {
        content: '<div style="width:' + PARTNER_BOX_W + 'px;padding-top:' + PARTNER_PAD_TOP + 'px;pointer-events:none;">'
          + partnerLabelHTML(partner, selected) + '</div>',
        size: new naver.maps.Size(PARTNER_BOX_W, boxH),
        anchor: new naver.maps.Point(PARTNER_BOX_W / 2, PARTNER_PAD_TOP + badge / 2),
      };
    }

    function setPartnerMarkerSelected(id, selected) {
      var entry = id === null ? null : partnerMarkerById[id];
      if (!entry) return;
      entry.marker.setIcon(partnerIcon(entry.partner, selected));
      entry.marker.setZIndex(selected ? 200 : 100);
    }

    // 선택한 업체만 바꾼다. 예전 선택과 새 선택 마커 두 개의 아이콘만 다시 그린다.
    function changeSelectedPartner(nextId) {
      var prevId = selectedPartnerId;
      selectedPartnerId = nextId;
      if (prevId === nextId) return;
      setPartnerMarkerSelected(prevId, false);
      setPartnerMarkerSelected(nextId, true);
    }

    // 화면상 partner 배지 중심과 PARTNER_OVERLAP_CYCLE_PX 이내인 업체들을,
    // currentPartners 순서 그대로 모아 돌려준다(자기 자신 포함, 최소 1개).
    function partnerOverlapCluster(partner) {
      var projection = map.getProjection();
      if (!projection) return [partner];
      var origin = projection.fromCoordToOffset(
        new naver.maps.LatLng(partner.lat, partner.lng)
      );
      return currentPartners.filter(function(p) {
        var pt = projection.fromCoordToOffset(new naver.maps.LatLng(p.lat, p.lng));
        var dx = pt.x - origin.x;
        var dy = pt.y - origin.y;
        return Math.sqrt(dx * dx + dy * dy) <= ${PARTNER_OVERLAP_CYCLE_PX};
      });
    }

    function selectPartner(id) {
      if (pickerActive) return;
      lastMarkerClickAt = new Date().getTime();

      var clicked = currentPartners.filter(function(p) { return p.id === id; })[0];
      var nextId = id;

      if (clicked) {
        var cluster = partnerOverlapCluster(clicked);
        if (cluster.length > 1) {
          var key = cluster.map(function(p) { return p.id; }).sort().join('|');
          if (overlapCycle.key === key) {
            // 같은 겹침 조합을 다시 눌렀다 — 다음 업체로 넘어간다.
            overlapCycle.index = (overlapCycle.index + 1) % overlapCycle.order.length;
          } else {
            // 새 겹침 조합 — 지금 실제로 위에서 눌린 업체부터 순회를 시작한다.
            overlapCycle.key = key;
            overlapCycle.order = cluster;
            overlapCycle.index = cluster.indexOf(clicked);
          }
          nextId = overlapCycle.order[overlapCycle.index].id;
        } else {
          overlapCycle.key = null;
        }
      }

      changeSelectedPartner(nextId);
      post({ type: 'partnerTap', id: nextId });
    }

    // 업체 목록이 바뀔 때만(setPartners) 전부 다시 만든다. 선택만 바뀔 때는 changeSelectedPartner.
    function renderPartners() {
      removePartnerOverlays();
      currentPartners.forEach(function(partner) {
        var selected = partner.id === selectedPartnerId;
        var marker = new naver.maps.Marker({
          position: new naver.maps.LatLng(partner.lat, partner.lng),
          map: map,
          zIndex: selected ? 200 : 100,
          icon: partnerIcon(partner, selected),
        });
        naver.maps.Event.addListener(marker, 'click', function() {
          if (!pickerActive) focusOn(partner.lat, partner.lng);
          selectPartner(partner.id);
        });
        tapOnlyBadge(marker);
        partnerMarkers.push(marker);
        partnerMarkerById[partner.id] = { marker: marker, partner: partner };
      });
    }

    // ── 제보 표시 ───────────────────────────────────────────
    // 지금 벌어지는 일이라 다른 마커보다 눈에 먼저 띄어야 한다. zIndex 를 가장
    // 높게 두고, 배지에 옅은 테두리 링을 둘러 '살아있는 정보'로 읽히게 한다.
    // 모양은 시안 A(ui-shots/report-pin/options.html): 메인 컬러 원 + 흰 확성기, 오른쪽 아래 작은 흰 원에
    // 카테고리 아이콘. 카테고리는 색이 아니라 아이콘으로만 가른다(앱 색 기조 통일).
    // 예정 제보(item.upcoming)는 속이 흰 배지 + 메인 컬러 점선 테두리로, 지금 진행 중인 제보와 한눈에 갈린다.
    var REPORT_PIN_COLOR = '${COLORS.primary}';
    var REPORT_PIN_MEGAPHONE = ${JSON.stringify(REPORT_PIN_MEGAPHONE)};
    var REPORT_PIN_CATEGORY_ICONS = ${JSON.stringify(REPORT_PIN_CATEGORY_ICONS)};

    function reportPinSVG(inner, size, fill) {
      return '<svg viewBox="0 0 512 512" width="' + size + '" height="' + size + '" fill="' + fill
        + '" style="display:block;">' + inner + '</svg>';
    }

    function reportLabelHTML(item) {
      var badge = 30;
      var color = REPORT_PIN_COLOR;
      // 앱보다 서버가 먼저 새 카테고리를 내려보내도 '기타' 아이콘으로 그린다(reportCategoryMeta 와 같은 처리).
      var categoryIcon = Object.prototype.hasOwnProperty.call(REPORT_PIN_CATEGORY_ICONS, item.category)
        ? REPORT_PIN_CATEGORY_ICONS[item.category]
        : REPORT_PIN_CATEGORY_ICONS.ETC;
      var circle = item.upcoming
        ? '<div style="width:' + badge + 'px;height:' + badge + 'px;border-radius:50%;box-sizing:border-box;'
          + 'background:#fff;border:2px dashed ' + color + ';box-shadow:0 2px 6px rgba(0,0,0,0.22);'
          + 'display:flex;align-items:center;justify-content:center;">'
          + reportPinSVG(REPORT_PIN_MEGAPHONE, 16, color) + '</div>'
        : '<div style="width:' + badge + 'px;height:' + badge + 'px;border-radius:50%;'
          + 'background:' + color + ';box-shadow:0 2px 6px rgba(0,0,0,0.3),0 0 0 3px rgba(255,255,255,0.95);'
          + 'display:flex;align-items:center;justify-content:center;">'
          + reportPinSVG(REPORT_PIN_MEGAPHONE, 16, '#fff') + '</div>';
      var categoryEl = '<div style="position:absolute;right:-7px;bottom:-5px;width:17px;height:17px;border-radius:50%;'
        + 'box-sizing:border-box;background:#fff;border:1.5px solid ' + color + ';'
        + 'display:flex;align-items:center;justify-content:center;">'
        + reportPinSVG(categoryIcon, 10, color) + '</div>';
      var badgeEl = '<div style="position:relative;width:' + badge + 'px;height:' + badge + 'px;pointer-events:auto;">'
        + circle + categoryEl + '</div>';

      // HOT(최근 60분 🔥 5개 이상) 제보는 배지 오른쪽 위에 흰 원 + 🔥 불꽃(FINAL.md 지도 마커: 불꽃 #0B1A8C, 안쪽 흰색)을 붙인다.
      if (item.hot) {
        badgeEl = '<div style="position:relative;width:' + badge + 'px;height:' + badge + 'px;">' + badgeEl
          + '<div style="position:absolute;top:-8px;right:-11px;width:20px;height:20px;border-radius:50%;background:#fff;'
          + 'box-shadow:0 1px 4px rgba(0,0,0,0.3);display:flex;align-items:center;justify-content:center;">'
          + '<svg viewBox="0 4 64 52" width="13" height="13" style="display:block;">'
          + '<path fill="#0B1A8C" d="M32 3c4 10 16 15 16 30 0 10-7 18-16 18s-16-8-16-18c0-8 5-12 7-18 2 5 4 7 7 8-1-8 0-13 2-20z"/>'
          + '<path fill="#fff" d="M31 25c3 6 8 9 8 16 0 5-3 8-7 8s-7-3-7-8c0-4 2-6 3-9 1 2 2 3 4 4-1-4-1-8-1-11z"/>'
          + '</svg></div></div>';
      }

      // 오른쪽 아래 카테고리 배지(-5px)가 이름에 닿지 않게 3px 대신 5px 띄운다(renderReports 의 boxH 와 맞춤).
      var nameEl = '<div style="margin-top:5px;white-space:nowrap;max-width:150px;overflow:hidden;'
        + 'text-overflow:ellipsis;font-family:' + PARTNER_FONT
        + ';font-size:11.5px;font-weight:700;color:' + (item.upcoming ? '#4b5563' : '#1f2937') + ';letter-spacing:-0.2px;'
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
      var boxH = padTop + badge + 5 + 18;

      items.forEach(function(item) {
        var marker = new naver.maps.Marker({
          position: new naver.maps.LatLng(item.lat, item.lng),
          map: map,
          // 진행 중 제보가 예정 제보 위로 오게 한다.
          // HOT 제보는 다른 제보 위로 올린다.
          zIndex: item.upcoming ? 290 : item.hot ? 310 : 300,
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
          focusOn(item.lat, item.lng);
          post({ type: 'reportTap', id: item.id });
        });
        tapOnlyBadge(marker);
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
      // 학과사무실: 창이 난 사무동 건물. 사람 실루엣인 학생처와 한눈에 갈린다.
      '학과사무실': partnerSVG('<path fill-rule="evenodd" d="M3.5 2.5h11v19h-11v-19zm2.4 2.4v2.2h2.2V4.9H5.9zm3.9 0v2.2H12V4.9H9.8zM5.9 9v2.2h2.2V9H5.9zm3.9 0v2.2H12V9H9.8zm-3.9 4.1v2.2h2.2v-2.2H5.9zm3.9 0v2.2H12v-2.2H9.8zM7.6 17.4v4.1h2.8v-4.1H7.6z"/><path d="M15.8 8.5h4.7v13h-4.7z"/>'),
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
        + 'background:' + safeColor(marker.color, 'transparent') + ';box-shadow:0 1px 4px rgba(0,0,0,0.28),0 0 0 2px #fff;'
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
          focusOn(item.lat, item.lng);
          post({ type: 'facilityTap', buildingName: item.buildingName });
        });
        tapOnlyBadge(marker);
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
          focusOn(building.lat, building.lng);
          post({ type: 'buildingTap', name: building.name });
        });
        tapOnlyBadge(marker);
        buildingMarkers.push(marker);
      });
    }

    function fitToBounds(bounds) {
      if (!bounds) return;
      // 진행 중인 '눌러 보기' 확대가 늦게 끝나며 이 맞춤을 옛 핀 19배로 덮지 않게 먼저 멈춘다.
      cancelFocus();
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
     * 핀 근처 건물(제보 롱프레스·위치 고르기). 건물 밖에서 벌어지는 일이 많아 좌표는 스냅하지 않고,
     * 화면에는 좌표 대신 건물명을 보여 주려고 가장 가까운 건물을 후보로 올려보낸다.
     * 다만 maxMeters 보다 멀면 null 이다 — 캠퍼스 밖 가게에 "○○관 근처"가 붙거나, 한참 떨어진
     * 곳의 제보가 엉뚱한 건물로 올라가지 않게 한다.
     */
    function nearestBuilding(lat, lng, maxMeters) {
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
      return nearestDistance <= maxMeters ? nearest : null;
    }

    naver.maps.Event.addListener(map, 'click', function(e) {
      if (pickerActive) return;
      // 관성 스크롤이 남아 있는 채로 탭해도 배너가 바로 돌아오게 한다.
      post({ type: 'mapDragEnd' });
      map.setOptions({ scaleControl: true });
      if (!e || !e.coord) return;
      if (new Date().getTime() - lastMarkerClickAt < ${MARKER_CLICK_GUARD_MS}) return;
      // 길게 눌러 제보 작성이 열린 직후의 click 은 그 손동작의 꼬리다.
      // 막지 않으면 작성창 뒤에서 건물 배너까지 함께 열린다.
      if (new Date().getTime() - lastLongPressAt < ${MARKER_CLICK_GUARD_MS}) return;

      // 제휴·편의시설·제보 시트가 열린 채 누른 탭은 앱에서 '시트 닫기'로만 쓴다. 그런데 페이지가 먼저 건물로 날아가
      // 19배 확대하고 핀을 띄워, 시트만 닫히고 보던 화면을 잃었다(10-07 점검). 이때는 건물 선택·이동을 하지 않는다.
      var dismissOnly = otherSheetOpen || selectedPartnerId !== null;
      if (selectedPartnerId !== null) {
        overlapCycle.key = null;
        changeSelectedPartner(null);
        post({ type: 'partnerDismiss' });
      }

      var lat = e.coord.lat();
      var lng = e.coord.lng();
      var hit = buildingAt(lat, lng);

      if (dismissOnly && hit) {
        otherSheetOpen = false;
        post({ type: 'sheetDismiss' });
        return;
      }

      // 건물 외곽선 안쪽을 탭했을 때만 핀이 뜬다. 빈 곳을 탭했으면 거둔다.
      var nextName = hit ? hit.name : null;
      if (nextName !== selectedBuildingName) {
        selectedBuildingName = nextName;
        renderBuildings();
      }

      if (hit) {
        focusOn(hit.lat, hit.lng);
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
        var nearby = nearestBuilding(start.lat, start.lng, ${REPORT_BUILDING_MAX_METERS});
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

    // 검색바·하단 배너 뜨고 사라지는 모션(네이버·카카오맵 스타일)을 위해, 실제
    // 손가락으로 끄는 동안만 네이티브에 알린다(프로그램으로 카메라를 옮길 때는
    // dragstart 가 안 나서 안 걸린다). 위치 선택 모드는 중앙 핀 고정이 핵심이라 제외한다.
    naver.maps.Event.addListener(map, 'dragstart', function() {
      if (pickerActive) return;
      post({ type: 'mapDragStart' });
      // 저작권 로고·"© NAVER Corp." 표기는 API 약관상 항상 떠 있어야 해서 그대로 두고,
      // 축척막대만 검색바·배너와 같이 잠깐 치운다.
      map.setOptions({ scaleControl: false });
    });

    // 지도가 멈출 때마다(드래그·줌 끝, 관성 스크롤 포함) 배너를 되돌리고,
    // 위치 선택 모드면 화면 중앙 좌표도 함께 올려보낸다.
    naver.maps.Event.addListener(map, 'idle', function() {
      post({ type: 'mapDragEnd' });
      map.setOptions({ scaleControl: true });
      if (pickerActive) postPickerCenter();
    });

    function handleNativeMessage(data) {
      try {
        var msg = JSON.parse(data);

        if (msg.type === 'setPartners') {
          currentPartners = msg.partners || [];
          selectedPartnerId = null;
          overlapCycle.key = null;
          renderPartners();
          fitToBounds(msg.bounds);
        }

        if (msg.type === 'clearPartners') {
          currentPartners = [];
          selectedPartnerId = null;
          overlapCycle.key = null;
          removePartnerOverlays();
          // 마커만 거둔다. 예전엔 여기서 카메라를 캠퍼스 중심으로 되돌려, 갈래 칩만 눌러도 보던 자리를 잃었다.
          // 캠퍼스로 돌아가기는 학사모 버튼이 한다.
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

        // 지도 데이터(서버)가 바뀌면 건물 목록을 통째로 바꾼다. HTML 에 구운 초기 건물은 이 메시지를 모르는
        // 예전 앱이 계속 쓰므로 남겨 둔다. 핀·탭 판정(외곽선)·근처 건물 찾기가 모두 이 목록을 다시 읽는다.
        if (msg.type === 'setBuildings') {
          var next = [];
          (msg.buildings || []).forEach(function(b) {
            if (!b || typeof b.name !== 'string' || typeof b.lat !== 'number' || typeof b.lng !== 'number') return;
            next.push({
              name: b.name,
              lat: b.lat,
              lng: b.lng,
              boundary: Array.isArray(b.boundary) ? b.boundary : null,
              extraBoundaries: Array.isArray(b.extraBoundaries) ? b.extraBoundaries : null,
            });
          });
          buildings = next;
          var stillThere = buildings.some(function(b) { return b.name === selectedBuildingName; });
          if (!stillThere) selectedBuildingName = null;
          renderBuildings();
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
          overlapCycle.key = null;
          changeSelectedPartner(msg.id === undefined ? null : msg.id);
        }

        // 검색 결과를 고른 경우. 한 업체를 화면 가운데로 가져온다.
        // setPartners 의 bounds 는 캠퍼스를 항상 포함해 한 곳으로 좁혀지지 않는다.
        if (msg.type === 'focusPartner') {
          overlapCycle.key = null;
          changeSelectedPartner(msg.id);
          var focused = currentPartners.filter(function(p) { return p.id === msg.id; })[0];
          if (focused) {
            focusOn(focused.lat, focused.lng, msg.zoom);
          }
        }

        // 제보 알림을 탭해 들어온 경우. 그 제보 자리를 화면 가운데로 가져온다(마커는 setReports 가 그린다).
        // 관리자 "지도에서 보기": 승인 전 제보도 볼 수 있게 그 좌표에 임시 핀 하나를 찍는다(다음 미리보기나 다시 불러오면 사라짐).
        if (msg.type === 'previewPin') {
          if (window.__previewPin) window.__previewPin.setMap(null);
          // 네이버 기본 파란 핀 대신 앱 색(남색) 점 + 위에 말풍선 이름표. 지우기는 앱이 window.__previewPin 을 직접 거둔다.
          var previewLabel = String(msg.label || '제보 위치').replace(/[&<>"']/g, function(c) {
            return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
          });
          var previewW = 200;
          window.__previewPin = new naver.maps.Marker({
            position: new naver.maps.LatLng(msg.lat, msg.lng),
            map: map,
            zIndex: 1000,
            clickable: false,
            icon: {
              content: '<div style="width:' + previewW + 'px;display:flex;flex-direction:column;align-items:center;pointer-events:none;">'
                + '<div style="max-width:' + previewW + 'px;padding:4px 8px;border-radius:8px;background:#05014A;color:#fff;'
                + 'font:600 12px/16px -apple-system,system-ui,sans-serif;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;'
                + 'box-shadow:0 1px 4px rgba(0,0,0,.25);">검토 중 · ' + previewLabel + '</div>'
                + '<div style="width:2px;height:8px;background:#05014A;"></div>'
                + '<div style="width:14px;height:14px;border-radius:7px;background:#05014A;border:3px solid #fff;box-shadow:0 0 0 1px #05014A;"></div>'
                + '</div>',
              size: new naver.maps.Size(previewW, 50),
              anchor: new naver.maps.Point(previewW / 2, 43),
            },
          });
        }

        if (msg.type === 'focusReport') {
          focusOn(msg.lat, msg.lng, msg.zoom);
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

        if (msg.type === 'sheetOpen') {
          otherSheetOpen = !!msg.open;
        }

        if (msg.type === 'clearRoute') {
          cancelFocus();
          clearRouteOverlays();
          map.setZoom(${DEFAULT_ZOOM});
          map.panTo(new naver.maps.LatLng(${CAMPUS_CENTER.lat}, ${CAMPUS_CENTER.lng}), { duration: 420, easing: 'easeOutCubic' });
        }

        if (msg.type === 'startLocationPicker') {
          cancelLongPress();
          pickerActive = true;
          pickerPurpose = msg.purpose === 'partner' ? 'partner' : 'report';
          postPickerCenter();
        }

        if (msg.type === 'stopLocationPicker') {
          pickerActive = false;
        }
      } catch(e) {}
    }

    // window/document 의 'message' 리스너는 두지 않는다. 앱(MapScreen.postToMap)과 웹(NaverMapView.web.tsx)은
    // 모두 injectJavaScript 로 handleNativeMessage(...) 를 직접 부른다. 리스너가 있으면 hongikon.com 을 연
    // 다른 사이트(window.open·iframe)가 postMessage 로 지도에 임의 마커 HTML 을 넣어 이 출처에서 스크립트를
    // 실행할 수 있었다(웹 로그인 토큰 탈취 가능 — 2026-10 보안 점검).
  </script>
</body>
</html>`
}
