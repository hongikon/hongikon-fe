/** v2 경로망 조사 화면(DevPathSurveyScreen)과 지도 페이지 사이: 주입 스크립트와 메시지 풀기. */

/** 웹뷰/iframe 어느 쪽에서 왔든 같은 모양으로 푼다. 이 화면이 보낸 메시지만 통과시킨다. */
export function parseSurveyMessage(event: unknown): any | null {
  const e = event as any
  const raw = e?.nativeEvent?.data ?? e?.data ?? e
  try {
    const msg = typeof raw === 'string' ? JSON.parse(raw) : raw
    return msg && msg.src === 'survey' ? msg : null
  } catch {
    return null
  }
}

/**
 * 지도 페이지 전역 `map` 위에 조사용 클릭 이벤트와 그리기 함수를 심는다(지도 페이지 코드는 건드리지 않는다).
 * 그리기 상태 s: legacy(보기 전용 회색 지점·선), modules(모듈별 색·점선·흐리게), selected/pending, mode.
 * 지점·선을 누른 직후의 지도 클릭은 무시한다(겹친 이벤트로 지점이 하나 더 찍히지 않게).
 */
export const SETUP_JS = `(function(){
  if (typeof map === 'undefined' || !window.naver) return;
  window.__surveyMode = true;
  map.setOptions({ minZoom: 10, maxBounds: null });
  function post(m){
    m.src = 'survey';
    var s = JSON.stringify(m);
    if (window.ReactNativeWebView) window.ReactNativeWebView.postMessage(s);
    else if (window.parent && window.parent !== window) window.parent.postMessage(s, '*');
  }
  function esc(t){ return String(t).replace(/[&<>]/g, function(c){ return {'&':'&amp;','<':'&lt;','>':'&gt;'}[c]; }); }
  function ll(a, b){ return new naver.maps.LatLng(a, b); }
  var lastHit = 0;
  function hit(){ lastHit = Date.now(); }
  if (window.__surveyClick) naver.maps.Event.removeListener(window.__surveyClick);
  window.__surveyClick = naver.maps.Event.addListener(map, 'click', function(e){
    if (Date.now() - lastHit < 350) return;
    post({ type: 'tap', lat: e.coord.lat(), lng: e.coord.lng() });
  });
  window.__surveyObjs = [];
  function label(text, color){
    return '<span style="font:700 11px sans-serif;color:' + color + ';background:rgba(255,255,255,.92);padding:1px 4px;border-radius:4px">' + esc(text) + '</span>';
  }
  function dot(size, fill, ring, ringWidth, text, textColor){
    return '<div style="transform:translate(-' + size / 2 + 'px,-' + size / 2 + 'px);display:flex;align-items:center;gap:4px;white-space:nowrap">'
      + '<span style="box-sizing:border-box;flex:none;width:' + size + 'px;height:' + size + 'px;border-radius:50%;background:' + fill
      + ';border:' + ringWidth + 'px solid ' + ring + ';box-shadow:0 0 3px rgba(0,0,0,.45)"></span>' + (text ? label(text, textColor) : '') + '</div>';
  }
  // 색은 pathSurveyStore.ts 의 NODE_KIND_INFO, STAIRS_COLOR 와 같아야 한다(scripts/path-survey/test-map.mjs 가 확인).
  var STAIRS = '#111827';
  function nodeColor(kind, fallback){
    if (kind === 'elevator') return '#F59E0B';
    if (kind === 'entrance') return '#E11D48';
    if (kind === 'intersection') return '#7C3AED';
    if (kind === 'stairs') return STAIRS;
    return fallback;
  }
  window.__surveyRender = function(s){
    window.__surveyObjs.forEach(function(o){ o.setMap(null); });
    window.__surveyObjs = [];
    var objs = window.__surveyObjs;
    s.legacy.lines.forEach(function(l){
      objs.push(new naver.maps.Polyline({ map: map, zIndex: 200, clickable: false, strokeColor: '#94A3B8', strokeWeight: 3, strokeOpacity: 0.7,
        strokeStyle: l[4] ? 'shortdash' : 'solid', path: [ll(l[0], l[1]), ll(l[2], l[3])] }));
    });
    s.legacy.nodes.forEach(function(n){
      objs.push(new naver.maps.Marker({ position: ll(n.lat, n.lng), map: map, zIndex: 400, clickable: false, title: n.id,
        icon: { content: dot(9, '#94A3B8', '#fff', 2, n.label, '#475569') } }));
    });
    var activeModule = s.modules.find(function(m){ return m.active; });
    s.modules.forEach(function(m){
      var op = m.dim ? 0.3 : 0.9;
      m.edges.forEach(function(e){
        var path = [ll(e.p[0], e.p[1]), ll(e.p[2], e.p[3])];
        var sel = m.active && e.id === s.selectedEdge;
        var stairs = e.kind === 'stairs';
        var weight = sel ? 8 : (m.active ? 5 : 4);
        // 계단은 모듈 색과 무관하게 STAIRS 색 굵은 선 위에 흰 점선을 얹어, 직접 고른 모듈 색과도 헷갈리지 않게 한다.
        objs.push(new naver.maps.Polyline({ map: map, zIndex: m.active ? 320 : 300, clickable: false, strokeColor: stairs ? STAIRS : m.color,
          strokeWeight: stairs ? weight + 2 : weight, strokeOpacity: op, strokeStyle: stairs || !m.dashed ? 'solid' : 'shortdash', strokeLineCap: 'round', path: path }));
        if (stairs) objs.push(new naver.maps.Polyline({ map: map, zIndex: m.active ? 321 : 301, clickable: false, strokeColor: '#fff',
          strokeWeight: 2, strokeOpacity: op, strokeStyle: 'shortdash', path: path }));
        if (!m.active) return;
        var hitLine = new naver.maps.Polyline({ map: map, zIndex: 330, clickable: true, strokeColor: m.color, strokeWeight: 22, strokeOpacity: 0.01, path: path });
        naver.maps.Event.addListener(hitLine, 'click', function(){ hit(); post({ type: 'edge', id: e.id }); });
        objs.push(hitLine);
        if (e.memo) {
          var mid = new naver.maps.Marker({ position: ll((e.p[0] + e.p[2]) / 2, (e.p[1] + e.p[3]) / 2), map: map, zIndex: 650, title: e.id,
            icon: { content: '<div style="transform:translate(-9px,-9px);width:18px;height:18px;border-radius:50%;background:#fff;border:2px solid ' + m.color
              + ';font:700 11px sans-serif;color:' + m.color + ';display:flex;align-items:center;justify-content:center">\\u270E</div>' } });
          naver.maps.Event.addListener(mid, 'click', function(){ hit(); post({ type: 'edge', id: e.id }); });
          objs.push(mid);
        }
      });
      m.nodes.forEach(function(n){
        // 간선 잇기에서는 다른 모듈의 일반 지점도 누를 수 있다(누르면 계단 끝으로 공유된다).
        var editable = m.active || (!!activeModule && ((!!n.kind && (s.mode === 'link' || s.mode === 'move')) || s.mode === 'link'));
        var ring = '#fff', ringWidth = 2;
        if (m.active && n.id === s.selected) { ring = '#111827'; ringWidth = 3; }
        else if (m.active && n.id === s.pending) { ring = '#F97316'; ringWidth = 3; }
        var size = editable ? (m.active || n.kind ? 18 : 14) : 11;
        var showLabel = editable && (n.label || n.id === s.selected || n.id === s.pending);
        var fill = nodeColor(n.kind, m.dark);
        var text = showLabel ? n.short + (n.memo ? ' \\u270E' : '') : '';
        var mk = new naver.maps.Marker({
          position: ll(n.lat, n.lng), map: map, zIndex: editable ? 700 : 500, title: n.id, clickable: editable,
          draggable: editable && s.mode === 'move',
          icon: { content: '<div style="opacity:' + (m.dim && !editable ? 0.4 : 1) + '">' + dot(size, fill, ring, ringWidth, text, fill) + '</div>' }
        });
        if (editable) {
          naver.maps.Event.addListener(mk, 'click', function(){ hit(); post({ type: 'node', id: n.id, moduleId: m.id }); });
          naver.maps.Event.addListener(mk, 'dragend', function(){
            hit();
            var p = mk.getPosition();
            var projection = map.getProjection();
            var point = projection.fromCoordToOffset(p);
            var best = null, bestDistance = 12 * 12;
            (activeModule ? activeModule.edges : []).forEach(function(e){
              if (e.a === n.id || e.b === n.id) return;
              var a = projection.fromCoordToOffset(ll(e.p[0], e.p[1]));
              var b = projection.fromCoordToOffset(ll(e.p[2], e.p[3]));
              var dx = b.x - a.x, dy = b.y - a.y;
              var length2 = dx * dx + dy * dy;
              if (!length2) return;
              var t = ((point.x - a.x) * dx + (point.y - a.y) * dy) / length2;
              if (t <= 0 || t >= 1) return;
              var x = a.x + t * dx, y = a.y + t * dy;
              // 끝 지점과 겹치는 분할은 피한다(지점 반지름 9px).
              if (Math.min(t, 1 - t) * Math.sqrt(length2) < 9) return;
              var distance = (point.x - x) * (point.x - x) + (point.y - y) * (point.y - y);
              if (distance < bestDistance) {
                bestDistance = distance;
                best = { id: e.id, coord: projection.fromOffsetToCoord(new naver.maps.Point(x, y)) };
              }
            });
            if (best) p = best.coord;
            post({ type: 'move', id: n.id, moduleId: m.id, lat: p.lat(), lng: p.lng(), edgeId: best ? best.id : null });
          });
        }
        objs.push(mk);
      });
    });
  };
})(); true;`
